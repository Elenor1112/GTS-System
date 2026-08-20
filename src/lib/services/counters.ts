import 'server-only';

import type { Tx } from '../db';

/**
 * GTS — gapless reference numbers.
 *
 * A bill number must be gapless: the Egyptian Tax Authority and a tax
 * inspector both read a gap as a suppressed sale. `count() + 1` cannot
 * deliver that — two concurrent requests read the same count and both
 * take the same number, and a deleted row leaves a hole for ever.
 *
 * So the counter is a row, and it is incremented with an UPDATE …
 * RETURNING inside the caller's transaction. Postgres serialises the
 * update on the row lock, so the second request waits and receives the
 * next value. If the surrounding transaction rolls back, the number is
 * released with it.
 */

export type CounterKind = 'bill_receivable' | 'bill_payable' | 'inventory' | 'leave' | 'payment';

const PREFIX: Record<CounterKind, string> = {
  bill_receivable: 'INV',
  bill_payable: 'PUR',
  inventory: 'TX',
  leave: 'LV',
  payment: 'PAY',
};

/** Width of the zero-padded sequence. */
const PAD = 5;

/**
 * Take the next number for a kind, within the current year.
 *
 * MUST be called with an open transaction — a counter incremented outside
 * the transaction that uses the number will leave a gap when that
 * transaction rolls back.
 */
export async function nextRef(tx: Tx, kind: CounterKind, year = new Date().getFullYear()): Promise<string> {
  const key = `${kind}:${year}`;

  // Upsert-and-increment in one statement. ON CONFLICT makes the first
  // call of the year safe against two requests racing to create the row.
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "counters" ("key", "value")
    VALUES (${key}, 1)
    ON CONFLICT ("key") DO UPDATE SET "value" = "counters"."value" + 1
    RETURNING "value"
  `;

  const value = rows[0]?.value;
  if (value === undefined) {
    throw new Error(`Could not allocate a ${kind} number for ${year}.`);
  }

  return `${PREFIX[kind]}-${year}-${String(value).padStart(PAD, '0')}`;
}

/** Read a counter without consuming a number — for admin display only. */
export async function peekCounter(tx: Tx, kind: CounterKind, year = new Date().getFullYear()) {
  const row = await tx.counter.findUnique({ where: { key: `${kind}:${year}` } });
  return row?.value ?? 0;
}
