import 'server-only';

import type { NotificationKind } from '@prisma/client';

import { db, type DbClient } from '../db';
import type { PermissionKey } from '../permissions';
import { ADMIN_ROLE } from '../permissions';

/**
 * GTS — notifications.
 *
 * Notifications are fanned out to the people who can act on the event,
 * resolved from the permission that governs it. "Whoever can approve a
 * bill" is the right audience for a bill awaiting approval; naming
 * individuals here would go stale the moment somebody changes role.
 *
 * De-duplication is by (userId, kind, entityId) among UNREAD rows, so an
 * overdue-bill sweep running nightly does not produce thirty copies.
 */

interface NotifyInput {
  userIds: string[];
  kind: NotificationKind;
  titleEn: string;
  titleAr?: string;
  bodyEn: string;
  bodyAr?: string;
  href?: string;
  entityType?: string;
  entityId?: string;
}

export async function notify(input: NotifyInput, client: DbClient = db): Promise<number> {
  const userIds = [...new Set(input.userIds)].filter(Boolean);
  if (userIds.length === 0) return 0;

  // Skip anyone who already has an unread notification about this exact
  // thing.
  let recipients = userIds;
  if (input.entityId) {
    const existing = await client.notification.findMany({
      where: {
        userId: { in: userIds },
        kind: input.kind,
        entityId: input.entityId,
        readAt: null,
      },
      select: { userId: true },
    });
    const already = new Set(existing.map((e) => e.userId));
    recipients = userIds.filter((id) => !already.has(id));
  }

  if (recipients.length === 0) return 0;

  const result = await client.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      kind: input.kind,
      titleEn: input.titleEn,
      titleAr: input.titleAr ?? null,
      bodyEn: input.bodyEn,
      bodyAr: input.bodyAr ?? null,
      href: input.href ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
    })),
  });

  return result.count;
}

/**
 * Everyone who holds a permission — administrators included, since they
 * hold every permission implicitly rather than through a row.
 */
export async function usersWithPermission(
  permission: PermissionKey,
  client: DbClient = db,
): Promise<string[]> {
  const users = await client.user.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      OR: [
        { role: { key: ADMIN_ROLE } },
        { role: { permissions: { some: { permission: { key: permission } } } } },
      ],
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

/* ============================================================
   EVENT HELPERS

   One per business event, so callers do not each invent their own
   wording for the same thing.
   ============================================================ */

export async function notifyLowStock(product: {
  productId: string;
  sku: string;
  nameEn: string;
  onHand: string;
  reorderLevel: string;
}): Promise<void> {
  const userIds = await usersWithPermission('inventory.manage');
  await notify({
    userIds,
    kind: 'LOW_INVENTORY',
    titleEn: `Low stock — ${product.nameEn}`,
    titleAr: `مخزون منخفض — ${product.nameEn}`,
    bodyEn: `${product.sku} is down to ${product.onHand}, at or below its reorder level of ${product.reorderLevel}.`,
    href: `/products/${product.productId}`,
    entityType: 'Product',
    entityId: product.productId,
  });
}

export async function notifyLeaveRequested(
  request: { id: string; ref: string; employeeName: string; days: string; startsOn: Date },
  client: DbClient = db,
): Promise<void> {
  const userIds = await usersWithPermission('leave.approve', client);
  await notify(
    {
      userIds,
      kind: 'LEAVE_REQUESTED',
      titleEn: `Leave request — ${request.employeeName}`,
      titleAr: `طلب إجازة — ${request.employeeName}`,
      bodyEn: `${request.days} working days from ${request.startsOn.toISOString().slice(0, 10)}. Awaiting your decision.`,
      // The leave page lists every request and carries the decision
      // controls inline, so it IS the detail view; the anchor scrolls to
      // the row. There is no /leave/[id] route to link to.
      href: `/leave#request-${request.id}`,
      entityType: 'LeaveRequest',
      entityId: request.id,
    },
    client,
  );
}

export async function notifyLeaveDecided(
  request: { id: string; ref: string; status: string; userId: string | null },
  client: DbClient = db,
): Promise<void> {
  if (!request.userId) return;
  const decided = request.status === 'APPROVED' ? 'approved' : 'rejected';
  await notify(
    {
      userIds: [request.userId],
      kind: 'LEAVE_DECIDED',
      titleEn: `Leave ${decided}`,
      titleAr: request.status === 'APPROVED' ? 'تمت الموافقة على الإجازة' : 'تم رفض الإجازة',
      bodyEn: `Your leave request ${request.ref} was ${decided}.`,
      // The leave page lists every request and carries the decision
      // controls inline, so it IS the detail view; the anchor scrolls to
      // the row. There is no /leave/[id] route to link to.
      href: `/leave#request-${request.id}`,
      entityType: 'LeaveRequest',
      entityId: request.id,
    },
    client,
  );
}

export async function notifyBillPendingApproval(
  bill: { id: string; number: string; total: string; counterparty: string },
  client: DbClient = db,
): Promise<void> {
  const userIds = await usersWithPermission('bills.approve', client);
  await notify(
    {
      userIds,
      kind: 'BILL_PENDING_APPROVAL',
      titleEn: `Bill awaiting approval — ${bill.number}`,
      titleAr: `فاتورة في انتظار الموافقة — ${bill.number}`,
      bodyEn: `${bill.counterparty}, EGP ${bill.total}.`,
      href: `/bills/${bill.id}`,
      entityType: 'ElectronicBill',
      entityId: bill.id,
    },
    client,
  );
}

export async function notifyBillApproved(
  bill: { id: string; number: string; createdById?: string | null },
  client: DbClient = db,
): Promise<void> {
  const userIds = bill.createdById
    ? [bill.createdById]
    : await usersWithPermission('bills.create', client);
  await notify(
    {
      userIds,
      kind: 'BILL_APPROVED',
      titleEn: `Bill approved — ${bill.number}`,
      titleAr: `تمت الموافقة على الفاتورة — ${bill.number}`,
      bodyEn: `${bill.number} has been approved and may now be sent.`,
      href: `/bills/${bill.id}`,
      entityType: 'ElectronicBill',
      entityId: bill.id,
    },
    client,
  );
}

export async function notifyProjectAssigned(
  assignment: { projectId: string; projectName: string; userId: string },
  client: DbClient = db,
): Promise<void> {
  await notify(
    {
      userIds: [assignment.userId],
      kind: 'PROJECT_ASSIGNED',
      titleEn: `Assigned to ${assignment.projectName}`,
      titleAr: `تم تعيينك في ${assignment.projectName}`,
      bodyEn: 'You can now check in at this site from the Attendance screen.',
      href: '/attendance',
      entityType: 'Project',
      entityId: assignment.projectId,
    },
    client,
  );
}

export async function notifyPaymentReceived(
  payment: { id: string; ref: string; amount: string; counterparty: string; billNumber?: string | null },
  client: DbClient = db,
): Promise<void> {
  const userIds = await usersWithPermission('accounts.view', client);
  await notify(
    {
      userIds,
      kind: 'PAYMENT_RECEIVED',
      titleEn: `Payment recorded — EGP ${payment.amount}`,
      titleAr: `تم تسجيل دفعة — ${payment.amount} جنيه`,
      bodyEn: `${payment.counterparty}${payment.billNumber ? ` against ${payment.billNumber}` : ''}.`,
      href: payment.billNumber ? `/bills` : '/accounts',
      entityType: 'Payment',
      entityId: payment.id,
    },
    client,
  );
}

/* ============================================================
   READ SIDE
   ============================================================ */

export async function unreadCount(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, readAt: null } });
}

export async function listNotifications(userId: string, options: { limit?: number; unreadOnly?: boolean } = {}) {
  return db.notification.findMany({
    where: { userId, ...(options.unreadOnly ? { readAt: null } : {}) },
    orderBy: { createdAt: 'desc' },
    take: options.limit ?? 50,
  });
}

/** Mark one notification read — scoped to its owner so a guessed id
 *  cannot mark somebody else's notification. */
export async function markRead(userId: string, notificationId: string): Promise<boolean> {
  const result = await db.notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count > 0;
}

export async function markAllRead(userId: string): Promise<number> {
  const result = await db.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}
