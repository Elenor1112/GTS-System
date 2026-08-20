import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { Prisma } from '@prisma/client';

import { db } from '@/lib/db';
import {
  requestLeave,
  approveLeave,
  rejectLeave,
  cancelLeave,
  balancesFor,
  workingDaysBetween,
  LeaveError,
} from '@/lib/services/leave';

let actor: { id: string; email: string };
let employeeId: string;
let annualTypeId: string;
let unpaidTypeId: string;
const year = 2026;

beforeAll(async () => {
  actor = await db.user.findFirstOrThrow({
    where: { email: 'admin@gts.example' },
    select: { id: true, email: true },
  });
  employeeId = (await db.employee.findFirstOrThrow({ where: { code: 'EMP-006' }, select: { id: true } })).id;
  annualTypeId = (await db.leaveType.findFirstOrThrow({ where: { key: 'annual' }, select: { id: true } })).id;
  unpaidTypeId = (await db.leaveType.findFirstOrThrow({ where: { key: 'unpaid' }, select: { id: true } })).id;
});

async function reset() {
  await db.leaveRequest.deleteMany({ where: { employeeId } });
  await db.leaveBalance.updateMany({
    where: { employeeId, year },
    data: { taken: 0, pending: 0 },
  });
}

beforeEach(reset);
afterAll(async () => {
  await reset();
  await db.$disconnect();
});

const n = (v: Prisma.Decimal | number | string) => new Prisma.Decimal(v).toNumber();
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

async function annual() {
  const balances = await balancesFor(employeeId, year);
  return balances.find((b) => b.key === 'annual')!;
}

describe('working days', () => {
  it('excludes Friday and Saturday, the Egyptian weekend', () => {
    // Thu 20 Aug 2026 → Sun 23 Aug 2026.
    // Thu (work), Fri (weekend), Sat (weekend), Sun (work) = 2 days.
    expect(workingDaysBetween(d('2026-08-20'), d('2026-08-23'))).toBe(2);
  });

  it('counts a full Sunday–Thursday week as five days', () => {
    expect(workingDaysBetween(d('2026-08-23'), d('2026-08-27'))).toBe(5);
  });

  it('counts a single working day as one', () => {
    expect(workingDaysBetween(d('2026-08-24'), d('2026-08-24'))).toBe(1);
  });

  it('counts a weekend-only range as zero', () => {
    // Fri 21 and Sat 22 August.
    expect(workingDaysBetween(d('2026-08-21'), d('2026-08-22'))).toBe(0);
  });
});

describe('requesting leave', () => {
  it('reserves the days as pending, without consuming them', async () => {
    const before = await annual();

    await requestLeave({
      actor, employeeId, leaveTypeId: annualTypeId,
      startsOn: d('2026-09-06'), endsOn: d('2026-09-10'), // Sun–Thu, 5 days
    });

    const after = await annual();
    expect(n(after.pending)).toBe(n(before.pending) + 5);
    // Not yet taken — it has not been approved.
    expect(n(after.taken)).toBe(n(before.taken));
    expect(n(after.available)).toBe(n(before.available) - 5);
  });

  it('counts only working days against the balance', async () => {
    // Thu 3 Sep → Sun 6 Sep: Thu + Sun = 2 working days.
    const request = await requestLeave({
      actor, employeeId, leaveTypeId: annualTypeId,
      startsOn: d('2026-09-03'), endsOn: d('2026-09-06'),
    });
    expect(n(request.workingDays)).toBe(2);
  });

  it('refuses a range that ends before it starts', async () => {
    await expect(
      requestLeave({
        actor, employeeId, leaveTypeId: annualTypeId,
        startsOn: d('2026-09-10'), endsOn: d('2026-09-06'),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_RANGE' });
  });

  it('refuses a range that is entirely weekend', async () => {
    await expect(
      requestLeave({
        actor, employeeId, leaveTypeId: annualTypeId,
        startsOn: d('2026-09-04'), endsOn: d('2026-09-05'), // Fri + Sat
      }),
    ).rejects.toMatchObject({ code: 'NO_WORKING_DAYS' });
  });

  it('refuses a request exceeding the remaining balance', async () => {
    // The annual entitlement is 21 days; 30 working days cannot fit.
    await expect(
      requestLeave({
        actor, employeeId, leaveTypeId: annualTypeId,
        startsOn: d('2026-09-06'), endsOn: d('2026-11-06'),
      }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' });
  });

  it('refuses an overlapping request', async () => {
    await requestLeave({
      actor, employeeId, leaveTypeId: annualTypeId,
      startsOn: d('2026-09-06'), endsOn: d('2026-09-10'),
    });

    // Starts inside the first range.
    await expect(
      requestLeave({
        actor, employeeId, leaveTypeId: annualTypeId,
        startsOn: d('2026-09-08'), endsOn: d('2026-09-14'),
      }),
    ).rejects.toMatchObject({ code: 'OVERLAPPING_REQUEST' });
  });

  it('allows a request that merely abuts another', async () => {
    await requestLeave({
      actor, employeeId, leaveTypeId: annualTypeId,
      startsOn: d('2026-09-06'), endsOn: d('2026-09-08'),
    });

    // Starts the day after the first ends — not an overlap.
    const second = await requestLeave({
      actor, employeeId, leaveTypeId: annualTypeId,
      startsOn: d('2026-09-09'), endsOn: d('2026-09-10'),
    });
    expect(second.status).toBe('PENDING');
  });

  it('does not charge unpaid leave against an entitlement', async () => {
    const before = await annual();
    await requestLeave({
      actor, employeeId, leaveTypeId: unpaidTypeId,
      startsOn: d('2026-10-04'), endsOn: d('2026-10-08'),
    });
    const after = await annual();
    expect(n(after.pending)).toBe(n(before.pending));
  });

  it('gives every request a unique reference', async () => {
    const a = await requestLeave({
      actor, employeeId, leaveTypeId: annualTypeId,
      startsOn: d('2026-09-06'), endsOn: d('2026-09-07'),
    });
    const b = await requestLeave({
      actor, employeeId, leaveTypeId: annualTypeId,
      startsOn: d('2026-09-13'), endsOn: d('2026-09-14'),
    });
    expect(a.ref).toMatch(/^LV-2026-\d{5}$/);
    expect(a.ref).not.toBe(b.ref);
  });
});

describe('deciding', () => {
  async function pending() {
    return requestLeave({
      actor, employeeId, leaveTypeId: annualTypeId,
      startsOn: d('2026-09-06'), endsOn: d('2026-09-10'), // 5 days
    });
  }

  it('turns a reservation into consumption on approval', async () => {
    const request = await pending();
    const before = await annual();
    expect(n(before.pending)).toBe(5);

    await approveLeave({ actor, requestId: request.id, note: 'Cover arranged' });

    const after = await annual();
    expect(n(after.pending)).toBe(0);
    expect(n(after.taken)).toBe(5);
    // Availability is unchanged by approval — the days were already held.
    expect(n(after.available)).toBe(n(before.available));
  });

  it('releases the reservation on rejection', async () => {
    const request = await pending();
    await rejectLeave({ actor, requestId: request.id, note: 'Peak delivery week' });

    const after = await annual();
    expect(n(after.pending)).toBe(0);
    expect(n(after.taken)).toBe(0);
    expect(n(after.available)).toBe(21);
  });

  it('returns the days when an approved absence is cancelled', async () => {
    const request = await pending();
    await approveLeave({ actor, requestId: request.id });
    expect(n((await annual()).taken)).toBe(5);

    await cancelLeave({ actor, requestId: request.id, note: 'Trip called off' });

    const after = await annual();
    expect(n(after.taken)).toBe(0);
    expect(n(after.available)).toBe(21);
  });

  it('refuses to decide the same request twice', async () => {
    const request = await pending();
    await approveLeave({ actor, requestId: request.id });

    await expect(
      approveLeave({ actor, requestId: request.id }),
    ).rejects.toMatchObject({ code: 'ALREADY_DECIDED' });
  });

  it('requires a reason to reject', async () => {
    const request = await pending();
    await expect(
      rejectLeave({ actor, requestId: request.id, note: '   ' }),
    ).rejects.toMatchObject({ code: 'REASON_REQUIRED' });
  });

  it('records the approver and the decision time', async () => {
    const request = await pending();
    const decided = await approveLeave({ actor, requestId: request.id, note: 'Approved' });

    expect(decided.approverId).toBe(actor.id);
    expect(decided.decidedAt).toBeInstanceOf(Date);
    expect(decided.decisionNote).toBe('Approved');
  });

  it('writes an audit row for every decision', async () => {
    const request = await pending();
    const before = await db.auditLog.count({ where: { entityType: 'LeaveRequest' } });
    await approveLeave({ actor, requestId: request.id });
    expect(await db.auditLog.count({ where: { entityType: 'LeaveRequest' } })).toBe(before + 1);
  });
});

describe('concurrency', () => {
  it('does not let two requests spend the same remaining days', async () => {
    // Reduce the entitlement to 5, then submit two 5-day requests at once.
    await db.leaveBalance.updateMany({
      where: { employeeId, leaveTypeId: annualTypeId, year },
      data: { entitled: 5, taken: 0, pending: 0 },
    });

    try {
      const results = await Promise.allSettled([
        requestLeave({
          actor, employeeId, leaveTypeId: annualTypeId,
          startsOn: d('2026-09-06'), endsOn: d('2026-09-10'),
        }),
        requestLeave({
          actor, employeeId, leaveTypeId: annualTypeId,
          startsOn: d('2026-10-04'), endsOn: d('2026-10-08'),
        }),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

      const balance = await annual();
      // Never over-committed beyond the entitlement.
      expect(n(balance.pending) + n(balance.taken)).toBeLessThanOrEqual(5);
    } finally {
      await db.leaveBalance.updateMany({
        where: { employeeId, leaveTypeId: annualTypeId, year },
        data: { entitled: 21 },
      });
    }
  });

  it('does not let two approvers both approve one request', async () => {
    const request = await requestLeave({
      actor, employeeId, leaveTypeId: annualTypeId,
      startsOn: d('2026-09-06'), endsOn: d('2026-09-10'),
    });

    const results = await Promise.allSettled([
      approveLeave({ actor, requestId: request.id }),
      approveLeave({ actor, requestId: request.id }),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    // And the balance was charged once, not twice.
    expect(n((await annual()).taken)).toBe(5);
  });
});
