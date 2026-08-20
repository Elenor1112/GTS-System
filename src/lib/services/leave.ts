import 'server-only';

import { Prisma, type LeaveStatus } from '@prisma/client';

import { db, transaction, type Tx } from '../db';
import { writeAudit } from './audit';
import { nextRef } from './counters';
import { notifyLeaveRequested, notifyLeaveDecided } from './notifications';
import { DomainError } from '../errors';

/**
 * GTS — leave.
 *
 * Balances are held in three parts: `entitled`, `taken` and `pending`.
 * The `pending` column is what stops the classic double-spend — two
 * requests submitted the same morning both seeing the full remaining
 * balance and both being approvable. A request reserves its days at
 * submission and releases them on rejection or cancellation.
 *
 * Working days exclude Friday and Saturday, the Egyptian weekend, so a
 * Thursday-to-Sunday absence costs two days rather than four.
 */

const D = (v: Prisma.Decimal | number | string) => new Prisma.Decimal(v);
const days = (v: Prisma.Decimal | number | string) =>
  D(v).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

export class LeaveError extends DomainError {}

/* ============================================================
   WORKING DAYS
   ============================================================ */

/** UTC midnight for a date, so DATE columns compare cleanly. */
function dateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Working days between two dates, inclusive.
 *
 * Friday (5) and Saturday (6) are the Egyptian weekend and are not
 * deducted from anybody's balance.
 */
export function workingDaysBetween(start: Date, end: Date): number {
  const from = dateOnly(start);
  const to = dateOnly(end);
  if (to < from) return 0;

  let count = 0;
  const cursor = new Date(from);
  while (cursor <= to) {
    const day = cursor.getUTCDay();
    if (day !== 5 && day !== 6) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

/* ============================================================
   BALANCES
   ============================================================ */

export interface BalanceView {
  leaveTypeId: string;
  key: string;
  nameEn: string;
  nameAr: string | null;
  isPaid: boolean;
  entitled: Prisma.Decimal;
  taken: Prisma.Decimal;
  pending: Prisma.Decimal;
  /** What can still be requested: entitled − taken − pending. */
  available: Prisma.Decimal;
}

export async function balancesFor(employeeId: string, year = new Date().getFullYear()): Promise<BalanceView[]> {
  const rows = await db.leaveBalance.findMany({
    where: { employeeId, year },
    include: { leaveType: true },
    orderBy: { leaveType: { nameEn: 'asc' } },
  });

  return rows.map((r) => ({
    leaveTypeId: r.leaveTypeId,
    key: r.leaveType.key,
    nameEn: r.leaveType.nameEn,
    nameAr: r.leaveType.nameAr,
    isPaid: r.leaveType.isPaid,
    entitled: days(r.entitled),
    taken: days(r.taken),
    pending: days(r.pending),
    available: days(D(r.entitled).minus(D(r.taken)).minus(D(r.pending))),
  }));
}

/** Lock a balance row for update, creating it from the type default if absent. */
async function lockBalance(tx: Tx, employeeId: string, leaveTypeId: string, year: number) {
  const rows = await tx.$queryRaw<
    { id: string; entitled: Prisma.Decimal; taken: Prisma.Decimal; pending: Prisma.Decimal }[]
  >`
    SELECT "id", "entitled", "taken", "pending"
    FROM "leave_balances"
    WHERE "employeeId" = ${employeeId} AND "leaveTypeId" = ${leaveTypeId} AND "year" = ${year}
    FOR UPDATE
  `;
  if (rows[0]) return rows[0];

  const type = await tx.leaveType.findUniqueOrThrow({
    where: { id: leaveTypeId },
    select: { defaultDays: true },
  });

  return tx.leaveBalance.create({
    data: { employeeId, leaveTypeId, year, entitled: D(type.defaultDays) },
    select: { id: true, entitled: true, taken: true, pending: true },
  });
}

/* ============================================================
   REQUEST
   ============================================================ */

export interface ActorRef {
  id: string;
  email: string;
}

export async function requestLeave(params: {
  actor: ActorRef;
  employeeId: string;
  leaveTypeId: string;
  startsOn: Date;
  endsOn: Date;
  reason?: string | null;
}) {
  const startsOn = dateOnly(params.startsOn);
  const endsOn = dateOnly(params.endsOn);

  if (endsOn < startsOn) {
    throw new LeaveError('INVALID_RANGE', 'The last day of leave cannot fall before the first.');
  }

  const workingDays = workingDaysBetween(startsOn, endsOn);
  if (workingDays === 0) {
    throw new LeaveError(
      'NO_WORKING_DAYS',
      'That range covers only weekend days, so there is nothing to request.',
    );
  }

  const year = startsOn.getUTCFullYear();

  const request = await transaction(async (tx) => {
    const type = await tx.leaveType.findUnique({
      where: { id: params.leaveTypeId },
      select: { id: true, key: true, nameEn: true, defaultDays: true, isPaid: true },
    });
    if (!type) throw new LeaveError('TYPE_NOT_FOUND', 'That leave type does not exist.');

    /* ---- Overlap: one absence at a time ---- */
    const clash = await tx.leaveRequest.findFirst({
      where: {
        employeeId: params.employeeId,
        status: { in: ['PENDING', 'APPROVED'] },
        // Two ranges overlap unless one ends before the other starts.
        startsOn: { lte: endsOn },
        endsOn: { gte: startsOn },
      },
      select: { id: true, ref: true, startsOn: true, endsOn: true, status: true },
    });
    if (clash) {
      throw new LeaveError(
        'OVERLAPPING_REQUEST',
        `This overlaps ${clash.ref}, which runs ${clash.startsOn.toISOString().slice(0, 10)} to ${clash.endsOn.toISOString().slice(0, 10)}.`,
        { conflictId: clash.id, conflictRef: clash.ref },
      );
    }

    /* ---- Balance, reserved at submission ---- */
    // Unpaid leave has no entitlement to spend, so it skips the check.
    if (type.isPaid) {
      const balance = await lockBalance(tx, params.employeeId, type.id, year);
      const available = days(D(balance.entitled).minus(D(balance.taken)).minus(D(balance.pending)));

      if (D(workingDays).greaterThan(available)) {
        throw new LeaveError(
          'INSUFFICIENT_BALANCE',
          `Only ${available} days of ${type.nameEn} remain; this request needs ${workingDays}.`,
          { available: available.toString(), requested: workingDays },
        );
      }

      // Reserved now, so a second request cannot spend the same days.
      await tx.leaveBalance.update({
        where: { id: balance.id },
        data: { pending: { increment: D(workingDays) } },
      });
    }

    const ref = await nextRef(tx, 'leave', year);

    const created = await tx.leaveRequest.create({
      data: {
        ref,
        employeeId: params.employeeId,
        leaveTypeId: type.id,
        startsOn,
        endsOn,
        workingDays: D(workingDays),
        reason: params.reason ?? null,
        status: 'PENDING',
      },
      include: { employee: { select: { nameEn: true, userId: true } } },
    });

    await writeAudit(
      {
        actorId: params.actor.id,
        actorEmail: params.actor.email,
        action: 'CREATE',
        entityType: 'LeaveRequest',
        entityId: created.id,
        summary: `${ref}: ${workingDays} working days of ${type.nameEn}`,
        afterState: {
          ref,
          type: type.key,
          startsOn: startsOn.toISOString().slice(0, 10),
          endsOn: endsOn.toISOString().slice(0, 10),
          workingDays,
        },
      },
      tx,
    );

    return created;
  });

  await notifyLeaveRequested({
    id: request.id,
    ref: request.ref,
    employeeName: request.employee.nameEn,
    days: String(workingDays),
    startsOn,
  });

  return request;
}

/* ============================================================
   DECISION
   ============================================================ */

async function decide(params: {
  actor: ActorRef;
  requestId: string;
  to: Extract<LeaveStatus, 'APPROVED' | 'REJECTED' | 'CANCELLED'>;
  note?: string | null;
  /** Cancellation by the requester is allowed after approval; a
   *  rejection is not. */
  allowFromApproved?: boolean;
}) {
  return transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      {
        id: string; ref: string; status: LeaveStatus; employeeId: string;
        leaveTypeId: string; workingDays: Prisma.Decimal; startsOn: Date;
      }[]
    >`
      SELECT "id","ref","status","employeeId","leaveTypeId","workingDays","startsOn"
      FROM "leave_requests" WHERE "id" = ${params.requestId}
      FOR UPDATE
    `;
    const request = rows[0];
    if (!request) throw new LeaveError('NOT_FOUND', 'That leave request does not exist.');

    const decidable = params.allowFromApproved
      ? ['PENDING', 'APPROVED']
      : ['PENDING'];

    if (!decidable.includes(request.status)) {
      throw new LeaveError(
        'ALREADY_DECIDED',
        `${request.ref} is already ${request.status.toLowerCase()}.`,
        { status: request.status },
      );
    }

    const year = request.startsOn.getUTCFullYear();
    const type = await tx.leaveType.findUniqueOrThrow({
      where: { id: request.leaveTypeId },
      select: { isPaid: true, nameEn: true },
    });

    if (type.isPaid) {
      const balance = await lockBalance(tx, request.employeeId, request.leaveTypeId, year);
      const amount = D(request.workingDays);

      if (params.to === 'APPROVED') {
        // The reservation becomes consumption.
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: { pending: { decrement: amount }, taken: { increment: amount } },
        });
      } else if (request.status === 'PENDING') {
        // Rejected or cancelled while pending: release the reservation.
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: { pending: { decrement: amount } },
        });
      } else {
        // Cancelled after approval: give the days back.
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: { taken: { decrement: amount } },
        });
      }
    }

    const updated = await tx.leaveRequest.update({
      where: { id: request.id },
      data: {
        status: params.to,
        approverId: params.actor.id,
        decidedAt: new Date(),
        decisionNote: params.note ?? null,
      },
      include: { employee: { select: { userId: true, nameEn: true } } },
    });

    await writeAudit(
      {
        actorId: params.actor.id,
        actorEmail: params.actor.email,
        action: params.to === 'APPROVED' ? 'APPROVE' : params.to === 'REJECTED' ? 'REJECT' : 'CANCEL',
        entityType: 'LeaveRequest',
        entityId: request.id,
        summary: `${request.ref}: ${request.status} → ${params.to}${params.note ? ` (${params.note})` : ''}`,
        beforeState: { status: request.status },
        afterState: { status: params.to, note: params.note ?? null },
      },
      tx,
    );

    return updated;
  });
}

export async function approveLeave(params: { actor: ActorRef; requestId: string; note?: string }) {
  const request = await decide({ ...params, to: 'APPROVED' });
  await notifyLeaveDecided({
    id: request.id, ref: request.ref, status: 'APPROVED', userId: request.employee.userId,
  });
  return request;
}

export async function rejectLeave(params: { actor: ActorRef; requestId: string; note: string }) {
  if (!params.note?.trim()) {
    throw new LeaveError('REASON_REQUIRED', 'Rejecting a leave request must say why.');
  }
  const request = await decide({ ...params, to: 'REJECTED' });
  await notifyLeaveDecided({
    id: request.id, ref: request.ref, status: 'REJECTED', userId: request.employee.userId,
  });
  return request;
}

/**
 * Cancel a request.
 *
 * Permitted from PENDING or APPROVED — plans change, and an approved
 * absence that did not happen must return its days rather than being
 * silently consumed.
 */
export async function cancelLeave(params: { actor: ActorRef; requestId: string; note?: string }) {
  return decide({ ...params, to: 'CANCELLED', allowFromApproved: true });
}

/* ============================================================
   READ MODELS
   ============================================================ */

export async function pendingRequests(limit = 50) {
  return db.leaveRequest.findMany({
    where: { status: 'PENDING' },
    orderBy: { startsOn: 'asc' },
    take: limit,
    include: {
      employee: { select: { code: true, nameEn: true, jobTitleEn: true, department: true } },
      leaveType: { select: { nameEn: true, nameAr: true, isPaid: true } },
    },
  });
}

export async function requestsFor(employeeId: string, limit = 50) {
  return db.leaveRequest.findMany({
    where: { employeeId },
    orderBy: { startsOn: 'desc' },
    take: limit,
    include: {
      leaveType: { select: { nameEn: true, nameAr: true, isPaid: true } },
      approver: { select: { nameEn: true } },
    },
  });
}

/** Who is away on a given day — the coverage view. */
export async function awayOn(date: Date) {
  const day = dateOnly(date);
  return db.leaveRequest.findMany({
    where: { status: 'APPROVED', startsOn: { lte: day }, endsOn: { gte: day } },
    include: {
      employee: { select: { code: true, nameEn: true, jobTitleEn: true, department: true } },
      leaveType: { select: { nameEn: true } },
    },
  });
}
