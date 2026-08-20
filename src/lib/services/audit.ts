import 'server-only';

import type { DbClient } from '../db';
import { db } from '../db';

/**
 * GTS — the audit trail.
 *
 * Every entry is written with the SAME client that performed the change:
 * pass the transaction and the audit row commits or rolls back with the
 * work it describes. An action that succeeds while its audit entry fails
 * silently is exactly the gap an audit trail exists to close.
 */

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'RESTORE'
  | 'APPROVE'
  | 'REJECT'
  | 'CANCEL'
  | 'SEND'
  | 'PAYMENT'
  | 'INVENTORY_MOVE'
  | 'LOCATION_CHANGE'
  | 'PERMISSION_CHANGE'
  | 'CHECK_IN'
  | 'CHECK_OUT'
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'PASSWORD_CHANGE';

/** Never write these to the audit log, whatever the caller passes. */
const REDACTED_FIELDS = new Set([
  'password',
  'passwordHash',
  'plainPassword',
  'token',
  'tokenHash',
  'sessionToken',
  'secret',
]);

/**
 * Reduce a before/after pair to only what actually changed.
 *
 * Storing whole rows makes the log unreadable and duplicates the
 * database. Storing the diff makes "what did this person change?"
 * answerable at a glance.
 */
export function diff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  if (!before || !after) return null;

  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of keys) {
    if (REDACTED_FIELDS.has(key)) continue;
    const a = normalise(before[key]);
    const b = normalise(after[key]);
    if (a !== b) {
      changedBefore[key] = a;
      changedAfter[key] = b;
    }
  }

  return Object.keys(changedAfter).length ? { before: changedBefore, after: changedAfter } : null;
}

/** Dates and Decimals must compare and serialise as stable strings. */
function normalise(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  // Prisma Decimal and anything else with a meaningful toString.
  if (typeof value === 'object' && 'toFixed' in (value as object)) return String(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

/** Strip redacted keys from a plain snapshot. */
export function scrub(state: Record<string, unknown> | null | undefined) {
  if (!state) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(state)) {
    if (REDACTED_FIELDS.has(k)) continue;
    out[k] = normalise(v);
  }
  return out;
}

export interface AuditEntry {
  actorId?: string | null;
  actorEmail?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  summary?: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Write one audit entry.
 *
 * @param client Pass the open transaction whenever one exists, so the
 *               entry shares the fate of the change it records.
 */
export async function writeAudit(entry: AuditEntry, client: DbClient = db): Promise<void> {
  await client.auditLog.create({
    data: {
      actorId: entry.actorId ?? null,
      actorEmail: entry.actorEmail ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary ?? null,
      beforeState: (scrub(entry.beforeState) ?? undefined) as never,
      afterState: (scrub(entry.afterState) ?? undefined) as never,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
    },
  });
}

/**
 * Write an UPDATE entry only when something actually changed.
 *
 * Prevents the log filling with no-op saves from someone opening a form
 * and pressing Save without editing anything.
 */
export async function writeUpdateAudit(
  entry: Omit<AuditEntry, 'action' | 'beforeState' | 'afterState'> & {
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  },
  client: DbClient = db,
): Promise<boolean> {
  const changes = diff(entry.before, entry.after);
  if (!changes) return false;

  await writeAudit(
    {
      ...entry,
      action: 'UPDATE',
      beforeState: changes.before,
      afterState: changes.after,
    },
    client,
  );
  return true;
}
