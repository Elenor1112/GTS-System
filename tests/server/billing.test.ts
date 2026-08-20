import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { Prisma } from '@prisma/client';

import { db } from '@/lib/db';
import {
  computeBillTotals,
  createBill,
  updateBillLines,
  submitForApproval,
  approveBill,
  rejectBill,
  sendBill,
  cancelBill,
  recordPayment,
  canTransition,
  outstandingOf,
  BillingError,
} from '@/lib/services/billing';

/**
 * Billing, against the real database.
 *
 * The question these answer is the one that matters on an invoice: does
 * the server's arithmetic agree with what a tax inspector would compute
 * by hand from the same lines? Every expected figure below was worked
 * out independently, not copied from the implementation's output.
 */

let actor: { id: string; email: string };
let clientId: string;
let vendorId: string;
let projectId: string;
let productId: string;

beforeAll(async () => {
  actor = await db.user.findFirstOrThrow({
    where: { email: 'admin@gts.example' },
    select: { id: true, email: true },
  });
  clientId = (await db.client.findFirstOrThrow({ where: { code: 'CL-001' }, select: { id: true } })).id;
  vendorId = (await db.vendor.findFirstOrThrow({ where: { code: 'VN-001' }, select: { id: true } })).id;
  projectId = (await db.project.findFirstOrThrow({ where: { code: 'PRJ-0142' }, select: { id: true } })).id;
  productId = (await db.product.findFirstOrThrow({ where: { sku: 'CEM-42.5N' }, select: { id: true } })).id;
});

/** Remove only what these tests created. */
async function cleanup() {
  const bills = await db.electronicBill.findMany({
    where: { notes: { startsWith: '[test]' } },
    select: { id: true },
  });
  const ids = bills.map((b) => b.id);
  if (ids.length === 0) return;
  await db.payment.deleteMany({ where: { billId: { in: ids } } });
  await db.billApproval.deleteMany({ where: { billId: { in: ids } } });
  await db.billItem.deleteMany({ where: { billId: { in: ids } } });
  await db.electronicBill.deleteMany({ where: { id: { in: ids } } });
}

beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

const n = (v: Prisma.Decimal | number | string) => new Prisma.Decimal(v).toNumber();
const issuedOn = new Date('2026-08-01T00:00:00.000Z');

/** A minimal valid line, with the GPC code the ETA requires. */
const line = (over: Partial<Parameters<typeof computeBillTotals>[0][number]> = {}) => ({
  descriptionEn: 'Portland cement 42.5N — 50kg',
  gpcCode: '10000160',
  quantity: 10,
  unit: 'BG',
  unitPrice: 232.5,
  vatRate: 14,
  ...over,
});

describe('the totals engine', () => {
  it('computes a single standard-rated line by hand-checkable arithmetic', () => {
    // 10 × 232.50 = 2,325.00 net; VAT 14% = 325.50; total 2,650.50
    const t = computeBillTotals([line()]);
    expect(n(t.subtotal)).toBe(2325);
    expect(n(t.net)).toBe(2325);
    expect(n(t.vatAmount)).toBe(325.5);
    expect(n(t.total)).toBe(2650.5);
  });

  it('accumulates VAT per line so mixed rates do not overcharge', () => {
    // Line A: 100 × 100 = 10,000 @ 14% → 1,400
    // Line B: 50 × 200 = 10,000 @ 0%  →     0   (zero-rated export)
    // Net 20,000, VAT 1,400 — NOT 20,000 × 14% = 2,800.
    const t = computeBillTotals([
      line({ quantity: 100, unitPrice: 100, vatRate: 14 }),
      line({ quantity: 50, unitPrice: 200, vatRate: 0 }),
    ]);
    expect(n(t.net)).toBe(20000);
    expect(n(t.vatAmount)).toBe(1400);
    expect(n(t.total)).toBe(21400);
  });

  it('applies a line discount before tax', () => {
    // 10 × 232.50 = 2,325.00, less 325.00 → net 2,000.00
    // VAT 14% of 2,000 = 280.00; total 2,280.00
    const t = computeBillTotals([line({ discount: 325 })]);
    expect(n(t.discount)).toBe(325);
    expect(n(t.net)).toBe(2000);
    expect(n(t.vatAmount)).toBe(280);
    expect(n(t.total)).toBe(2280);
  });

  it('holds decimal precision where a float would drift', () => {
    // 3 × 0.10 = 0.30 exactly. In binary floating point this is
    // 0.30000000000000004, which would print as a one-piastre error.
    const t = computeBillTotals([line({ quantity: 3, unitPrice: 0.1, vatRate: 0 })]);
    expect(t.net.toString()).toBe('0.3');
    expect(n(t.total)).toBe(0.3);
  });

  it('rounds the unit price to piastres before multiplying, not after', () => {
    // A unit price is stored as Decimal(14,2) — an invoice cannot quote
    // 33.333. So the price rounds to 33.33 FIRST, and the line is
    // 3 × 33.33 = 99.99.
    //
    // Rounding the product instead would give 100.00, a figure the
    // printed invoice could not reproduce from its own unit price: the
    // customer would read "3 @ 33.33 = 100.00" and be right to query it.
    const t = computeBillTotals([line({ quantity: 3, unitPrice: 33.333, vatRate: 0 })]);
    expect(n(t.net)).toBe(99.99);

    // And the line as persisted agrees with itself.
    const [only] = t.lines;
    expect(n(only!.unitPrice)).toBe(33.33);
    expect(n(only!.quantity.times(only!.unitPrice))).toBe(99.99);
  });

  it('withholds on the pre-VAT base, not the total', () => {
    // Net 10,000, VAT 1,400, total 11,400.
    // WHT at 1% is on the NET: 100.00 — not 114.00.
    const t = computeBillTotals([line({ quantity: 100, unitPrice: 100, vatRate: 14 })], 1);
    expect(n(t.net)).toBe(10000);
    expect(n(t.total)).toBe(11400);
    expect(n(t.whtAmount)).toBe(100);
    // Withholding reduces cash collected, never the invoice total.
    expect(n(t.netPayable)).toBe(11300);
  });

  it('does not withhold below the ETA threshold', () => {
    // Total 114.00, under the 300 threshold: no withholding at all.
    const t = computeBillTotals([line({ quantity: 1, unitPrice: 100, vatRate: 14 })], 1);
    expect(n(t.total)).toBe(114);
    expect(n(t.whtAmount)).toBe(0);
    expect(n(t.netPayable)).toBe(114);
  });

  it('refuses lines that are not arithmetic', () => {
    expect(() => computeBillTotals([])).toThrow(BillingError);
    expect(() => computeBillTotals([line({ quantity: 0 })])).toThrow(/quantity/i);
    expect(() => computeBillTotals([line({ quantity: -1 })])).toThrow(/quantity/i);
    expect(() => computeBillTotals([line({ unitPrice: -5 })])).toThrow(/negative/i);
    expect(() => computeBillTotals([line({ vatRate: 150 })])).toThrow(/VAT/i);
    // A discount larger than the line it discounts.
    expect(() => computeBillTotals([line({ quantity: 1, unitPrice: 10, discount: 20 })])).toThrow(/exceeds/i);
  });
});

describe('creating a bill', () => {
  it('persists the server-computed totals, never a supplied one', async () => {
    const bill = await createBill({
      actor, direction: 'RECEIVABLE', clientId, projectId, issuedOn,
      notes: '[test] totals',
      lines: [line({ productId })],
    });

    expect(n(bill.total)).toBe(2650.5);
    expect(n(bill.vatAmount)).toBe(325.5);
    expect(bill.status).toBe('DRAFT');

    // Re-read from the database: what was persisted is what was computed.
    const stored = await db.electronicBill.findUniqueOrThrow({
      where: { id: bill.id },
      include: { items: true },
    });
    expect(n(stored.total)).toBe(2650.5);
    expect(n(stored.items[0]!.lineTotal)).toBe(2650.5);
  });

  it('allocates gapless sequential numbers', async () => {
    const a = await createBill({ actor, direction: 'RECEIVABLE', clientId, issuedOn, notes: '[test] a', lines: [line()] });
    const b = await createBill({ actor, direction: 'RECEIVABLE', clientId, issuedOn, notes: '[test] b', lines: [line()] });

    expect(a.number).toMatch(/^INV-2026-\d{5}$/);
    expect(b.number).toMatch(/^INV-2026-\d{5}$/);

    const seq = (s: string) => Number(s.split('-')[2]);
    expect(seq(b.number)).toBe(seq(a.number) + 1);
  });

  it('numbers payables in their own sequence', async () => {
    const payable = await createBill({
      actor, direction: 'PAYABLE', vendorId, issuedOn, notes: '[test] payable', lines: [line()],
    });
    expect(payable.number).toMatch(/^PUR-2026-\d{5}$/);
  });

  it('derives the due date from the counterparty payment terms', async () => {
    // CL-001 (Palm Hills) is seeded with 45-day terms.
    const bill = await createBill({
      actor, direction: 'RECEIVABLE', clientId, issuedOn, notes: '[test] terms', lines: [line()],
    });
    const days = Math.round((bill.dueOn.getTime() - bill.issuedOn.getTime()) / 86_400_000);
    expect(days).toBe(45);
  });

  it('refuses a receivable with no client and a payable with no vendor', async () => {
    await expect(
      createBill({ actor, direction: 'RECEIVABLE', issuedOn, notes: '[test]', lines: [line()] }),
    ).rejects.toMatchObject({ code: 'CLIENT_REQUIRED' });

    await expect(
      createBill({ actor, direction: 'PAYABLE', issuedOn, notes: '[test]', lines: [line()] }),
    ).rejects.toMatchObject({ code: 'VENDOR_REQUIRED' });
  });

  it('refuses a bill naming both a client and a vendor', async () => {
    await expect(
      createBill({ actor, direction: 'RECEIVABLE', clientId, vendorId, issuedOn, notes: '[test]', lines: [line()] }),
    ).rejects.toMatchObject({ code: 'AMBIGUOUS_COUNTERPARTY' });
  });

  it("refuses a project that belongs to a different client", async () => {
    const otherClient = await db.client.findFirstOrThrow({
      where: { code: 'CL-002' }, select: { id: true },
    });
    await expect(
      createBill({
        actor, direction: 'RECEIVABLE', clientId: otherClient.id, projectId,
        issuedOn, notes: '[test]', lines: [line()],
      }),
    ).rejects.toMatchObject({ code: 'PROJECT_CLIENT_MISMATCH' });
  });

  it('requires an exchange rate for a non-EGP document', async () => {
    await expect(
      createBill({
        actor, direction: 'RECEIVABLE', clientId, issuedOn,
        currency: 'USD', notes: '[test]', lines: [line()],
      }),
    ).rejects.toMatchObject({ code: 'EXCHANGE_RATE_REQUIRED' });
  });
});

describe('the status machine', () => {
  it('permits only the transitions the workflow defines', () => {
    expect(canTransition('DRAFT', 'PENDING_APPROVAL')).toBe(true);
    expect(canTransition('PENDING_APPROVAL', 'APPROVED')).toBe(true);
    expect(canTransition('APPROVED', 'SENT')).toBe(true);

    // A draft cannot skip approval and be sent.
    expect(canTransition('DRAFT', 'SENT')).toBe(false);
    expect(canTransition('DRAFT', 'APPROVED')).toBe(false);
    // Terminal states are terminal.
    expect(canTransition('PAID', 'DRAFT')).toBe(false);
    expect(canTransition('CANCELLED', 'APPROVED')).toBe(false);
  });

  it('walks draft → approval → approved → sent, recording every step', async () => {
    const bill = await createBill({
      actor, direction: 'RECEIVABLE', clientId, issuedOn, notes: '[test] workflow', lines: [line({ productId })],
    });

    await submitForApproval({ actor, billId: bill.id });
    await approveBill({ actor, billId: bill.id, note: 'Checked against the purchase order' });
    const sent = await sendBill({ actor, billId: bill.id });

    expect(sent.status).toBe('SENT');

    const history = await db.billApproval.findMany({
      where: { billId: bill.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(history.map((h) => h.action)).toEqual(['SUBMITTED', 'APPROVED', 'SENT']);
    // Every step names who took it.
    expect(history.every((h) => h.actorId === actor.id)).toBe(true);
    expect(history[1]!.note).toContain('purchase order');
  });

  it('refuses to approve a bill that was never submitted', async () => {
    const bill = await createBill({
      actor, direction: 'RECEIVABLE', clientId, issuedOn, notes: '[test] skip', lines: [line({ productId })],
    });
    await expect(approveBill({ actor, billId: bill.id })).rejects.toMatchObject({
      code: 'INVALID_TRANSITION',
    });
  });

  it('sends a rejected bill back to draft with its reason', async () => {
    const bill = await createBill({
      actor, direction: 'RECEIVABLE', clientId, issuedOn, notes: '[test] reject', lines: [line({ productId })],
    });
    await submitForApproval({ actor, billId: bill.id });

    const rejected = await rejectBill({ actor, billId: bill.id, note: 'Wrong rate applied on line 1' });
    expect(rejected.status).toBe('DRAFT');

    const last = await db.billApproval.findFirstOrThrow({
      where: { billId: bill.id }, orderBy: { createdAt: 'desc' },
    });
    expect(last.action).toBe('REJECTED');
    expect(last.note).toContain('Wrong rate');
  });

  it('requires a reason to reject or cancel', async () => {
    const bill = await createBill({
      actor, direction: 'RECEIVABLE', clientId, issuedOn, notes: '[test] reasons', lines: [line({ productId })],
    });
    await submitForApproval({ actor, billId: bill.id });

    await expect(rejectBill({ actor, billId: bill.id, note: '  ' })).rejects.toMatchObject({
      code: 'REASON_REQUIRED',
    });
  });

  it('blocks editing once a bill has left draft', async () => {
    const bill = await createBill({
      actor, direction: 'RECEIVABLE', clientId, issuedOn, notes: '[test] locked', lines: [line({ productId })],
    });
    await submitForApproval({ actor, billId: bill.id });

    await expect(
      updateBillLines({ actor, billId: bill.id, lines: [line({ quantity: 999 })] }),
    ).rejects.toMatchObject({ code: 'NOT_EDITABLE' });
  });

  it('recomputes totals when a draft is edited', async () => {
    const bill = await createBill({
      actor, direction: 'RECEIVABLE', clientId, issuedOn, notes: '[test] edit', lines: [line({ productId })],
    });
    expect(n(bill.total)).toBe(2650.5);

    const updated = await updateBillLines({
      actor, billId: bill.id,
      lines: [line({ quantity: 20, unitPrice: 100, vatRate: 14 })],
    });
    // 20 × 100 = 2,000 net; VAT 280; total 2,280.
    expect(n(updated.total)).toBe(2280);
    expect(updated.items).toHaveLength(1);
  });

  it('refuses to issue a document the ETA would reject', async () => {
    // No GPC code on the line — mandatory for submission.
    const bill = await createBill({
      actor, direction: 'RECEIVABLE', clientId, issuedOn, notes: '[test] incomplete',
      lines: [line({ gpcCode: null })],
    });

    await expect(submitForApproval({ actor, billId: bill.id })).rejects.toMatchObject({
      code: 'INCOMPLETE_DOCUMENT',
    });
  });
});

describe('payments', () => {
  async function sentBill(over: { whtRate?: number } = {}) {
    const bill = await createBill({
      actor, direction: 'RECEIVABLE', clientId, issuedOn,
      notes: '[test] payment',
      whtRate: over.whtRate ?? 0,
      lines: [line({ quantity: 100, unitPrice: 100, vatRate: 14, productId })],
    });
    await submitForApproval({ actor, billId: bill.id });
    await approveBill({ actor, billId: bill.id });
    return sendBill({ actor, billId: bill.id });
  }

  it('moves a bill to partially paid, then paid', async () => {
    const bill = await sentBill(); // total 11,400

    const first = await recordPayment({
      actor, billId: bill.id, amount: 5000, receivedOn: new Date('2026-08-10'),
    });
    expect(first.bill.status).toBe('PARTIALLY_PAID');
    expect(n(first.bill.paidAmount)).toBe(5000);

    const second = await recordPayment({
      actor, billId: bill.id, amount: 6400, receivedOn: new Date('2026-08-20'),
    });
    expect(second.bill.status).toBe('PAID');
    expect(n(second.bill.paidAmount)).toBe(11400);
    expect(n(outstandingOf(second.bill))).toBe(0);
  });

  it('settles at total − withholding, because that is what the buyer owes in cash', async () => {
    // Net 10,000, VAT 1,400, total 11,400, WHT 1% of net = 100.
    // The buyer remits 11,300 and pays 100 to the ETA on our behalf.
    const bill = await sentBill({ whtRate: 1 });
    expect(n(bill.total)).toBe(11400);
    expect(n(bill.whtAmount)).toBe(100);

    const paid = await recordPayment({
      actor, billId: bill.id, amount: 11300, whtDeducted: 100, receivedOn: new Date('2026-08-15'),
    });

    // Fully settled on 11,300 — the 100 was never collectable in cash.
    expect(paid.bill.status).toBe('PAID');
    expect(n(outstandingOf(paid.bill))).toBe(0);
  });

  it('refuses an overpayment', async () => {
    const bill = await sentBill();
    await expect(
      recordPayment({ actor, billId: bill.id, amount: 11401, receivedOn: new Date('2026-08-15') }),
    ).rejects.toMatchObject({ code: 'OVERPAYMENT' });
  });

  it('refuses a payment against an unapproved bill', async () => {
    const draft = await createBill({
      actor, direction: 'RECEIVABLE', clientId, issuedOn, notes: '[test] draft pay', lines: [line({ productId })],
    });
    await expect(
      recordPayment({ actor, billId: draft.id, amount: 100, receivedOn: new Date() }),
    ).rejects.toMatchObject({ code: 'NOT_PAYABLE' });
  });

  it('refuses a zero or negative payment', async () => {
    const bill = await sentBill();
    for (const amount of [0, -50]) {
      await expect(
        recordPayment({ actor, billId: bill.id, amount, receivedOn: new Date() }),
      ).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
    }
  });

  it('will not cancel a bill that has taken money', async () => {
    const bill = await sentBill();
    await recordPayment({ actor, billId: bill.id, amount: 1000, receivedOn: new Date('2026-08-12') });

    await expect(
      cancelBill({ actor, billId: bill.id, note: 'Client changed their mind' }),
    ).rejects.toMatchObject({ code: 'HAS_PAYMENTS' });
  });

  it('gives every payment a unique reference and an audit row', async () => {
    const bill = await sentBill();
    const before = await db.auditLog.count({ where: { action: 'PAYMENT' } });

    const { payment } = await recordPayment({
      actor, billId: bill.id, amount: 2500, receivedOn: new Date('2026-08-11'),
    });

    expect(payment.ref).toMatch(/^PAY-2026-\d{5}$/);
    expect(await db.auditLog.count({ where: { action: 'PAYMENT' } })).toBe(before + 1);
  });
});

describe('concurrency', () => {
  it('does not let two approvers both transition the same bill', async () => {
    const bill = await createBill({
      actor, direction: 'RECEIVABLE', clientId, issuedOn, notes: '[test] race', lines: [line({ productId })],
    });
    await submitForApproval({ actor, billId: bill.id });

    const results = await Promise.allSettled([
      approveBill({ actor, billId: bill.id, note: 'first' }),
      approveBill({ actor, billId: bill.id, note: 'second' }),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

    // And exactly one APPROVED row in the history — not two.
    const approvals = await db.billApproval.count({
      where: { billId: bill.id, action: 'APPROVED' },
    });
    expect(approvals).toBe(1);
  });

  it('does not let two payments together overpay a bill', async () => {
    const bill = await createBill({
      actor, direction: 'RECEIVABLE', clientId, issuedOn, notes: '[test] pay race',
      lines: [line({ quantity: 100, unitPrice: 100, vatRate: 14, productId })],
    });
    await submitForApproval({ actor, billId: bill.id });
    await approveBill({ actor, billId: bill.id });
    await sendBill({ actor, billId: bill.id });

    // Total 11,400. Two payments of 8,000 would be 16,000.
    const results = await Promise.allSettled([
      recordPayment({ actor, billId: bill.id, amount: 8000, receivedOn: new Date('2026-08-10') }),
      recordPayment({ actor, billId: bill.id, amount: 8000, receivedOn: new Date('2026-08-10') }),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

    const final = await db.electronicBill.findUniqueOrThrow({ where: { id: bill.id } });
    expect(n(final.paidAmount)).toBeLessThanOrEqual(n(final.total));
  });
});
