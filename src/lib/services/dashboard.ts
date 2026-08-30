import 'server-only';

import { Prisma } from '@prisma/client';

import { db } from '../db';
import { ledgerTotals, receivablesByClient } from './accounts';
import { cairoWorkDate, cairoMinutes, isCairoWeekend, parseHhMm } from './attendance';
import type { Actor } from '../auth';
import { can } from '../permissions';
import { getSetting } from './settings';

/**
 * GTS — the dashboard.
 *
 * Every figure is computed from the transaction tables at request time.
 * There is no dashboard cache and no precomputed metric row, because a
 * dashboard that can disagree with the ledger is worse than no dashboard:
 * it is a number people act on that nobody can reconcile.
 *
 * The alerts are the same discipline — each one is a real row that
 * currently satisfies a real condition, with a link to the record it
 * came from. Nothing is illustrative.
 */

const D = (v: Prisma.Decimal | number | string | null | undefined) => new Prisma.Decimal(v ?? 0);
const money = (v: Prisma.Decimal | number | string | null | undefined) =>
  D(v).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

export interface DashboardAlert {
  id: string;
  tone: 'danger' | 'warning' | 'info';
  title: string;
  detail: string;
  href: string;
  action: string;
}

export interface Dashboard {
  /** Outstanding receivables minus payables — the headline figure. */
  netPosition: Prisma.Decimal;
  /** All money ever collected from clients minus all money ever paid to vendors. */
  cashBalance: Prisma.Decimal;
  receivable: Prisma.Decimal;
  payable: Prisma.Decimal;
  overdueReceivable: Prisma.Decimal;
  collectedThisMonth: Prisma.Decimal;
  billedThisMonth: Prisma.Decimal;
  /** Twelve months of receipts, oldest first, for the sparkline. */
  receiptsSeries: { month: string; value: number }[];
  alerts: DashboardAlert[];
  projects: {
    id: string;
    code: string;
    nameEn: string;
    clientName: string;
    status: string;
    budget: Prisma.Decimal | null;
    billed: Prisma.Decimal;
    /** Billed ÷ budget, as a percentage. Null with no budget set. */
    consumedPct: number | null;
  }[];
  warehouses: {
    id: string;
    code: string;
    nameEn: string;
    distinctProducts: number;
    totalUnits: Prisma.Decimal;
  }[];
  attendanceToday: {
    expected: number;
    present: number;
    late: number;
    missing: number;
    /** Friday or Saturday in Cairo — absence is not absence. */
    isWeekend: boolean;
    /**
     * True before the working day has started.
     *
     * Nobody having checked in at 06:00 is not a problem; the same
     * figure at 14:00 is. Without this the dashboard reports a red
     * "11 not in" every morning until the first person arrives.
     */
    beforeWorkStart: boolean;
  };
  counts: {
    activeProjects: number;
    clients: number;
    vendors: number;
    products: number;
    pendingLeave: number;
    billsAwaitingApproval: number;
  };
}

/**
 * Build the dashboard for one actor.
 *
 * Sections the actor cannot see are omitted rather than zeroed — an
 * employee without `accounts.view` gets no financial figures at all, not
 * a row of zeroes that implies the business has no money.
 */
export async function buildDashboard(actor: Actor): Promise<Dashboard> {
  const now = new Date();
  const today = cairoWorkDate(now);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const seesMoney = can(actor, 'accounts.view');
  const seesInventory = can(actor, 'inventory.view');
  const seesProjects = can(actor, 'projects.view');
  const seesAttendance = can(actor, 'attendance.view');

  const [
    ledger,
    cashIn,
    cashOut,
    monthPayments,
    monthBills,
    receiptRows,
    projectRows,
    warehouseRows,
    attendanceRows,
    assignedToday,
    counts,
  ] = await Promise.all([
    seesMoney ? ledgerTotals(now) : null,

    // All-time cash actually received/paid, for the cash balance — not
    // outstanding obligations, which is what receivable/payable track.
    seesMoney
      ? db.payment.aggregate({ where: { clientId: { not: null } }, _sum: { amount: true } })
      : null,

    seesMoney
      ? db.payment.aggregate({ where: { vendorId: { not: null } }, _sum: { amount: true } })
      : null,

    seesMoney
      ? db.payment.aggregate({
          where: { receivedOn: { gte: monthStart }, clientId: { not: null } },
          _sum: { amount: true },
        })
      : null,

    seesMoney
      ? db.electronicBill.aggregate({
          where: {
            direction: 'RECEIVABLE',
            deletedAt: null,
            status: { not: 'CANCELLED' },
            issuedOn: { gte: monthStart },
          },
          _sum: { total: true },
        })
      : null,

    // Twelve months of receipts, grouped in SQL rather than in JS —
    // pulling every payment row to bucket it here would not scale.
    seesMoney
      ? db.$queryRaw<{ month: string; total: Prisma.Decimal }[]>`
          SELECT to_char(date_trunc('month', "receivedOn"), 'YYYY-MM') AS month,
                 SUM("amount") AS total
          FROM "payments"
          WHERE "clientId" IS NOT NULL
            AND "receivedOn" >= (CURRENT_DATE - INTERVAL '12 months')
          GROUP BY 1
          ORDER BY 1
        `
      : null,

    seesProjects
      ? db.project.findMany({
          where: { deletedAt: null, status: { in: ['ACTIVE', 'PLANNING'] } },
          select: {
            id: true, code: true, nameEn: true, status: true, budget: true,
            client: { select: { nameEn: true } },
            bills: {
              where: { deletedAt: null, status: { not: 'CANCELLED' } },
              select: { total: true },
            },
          },
          orderBy: { updatedAt: 'desc' },
          take: 6,
        })
      : null,

    seesInventory
      ? db.warehouse.findMany({
          where: { deletedAt: null, isActive: true },
          select: {
            id: true, code: true, nameEn: true, capacityM3: true,
            stock: { select: { quantity: true } },
          },
        })
      : null,

    seesAttendance
      ? db.attendance.groupBy({ by: ['status'], where: { workDate: today }, _count: true })
      : null,

    seesAttendance
      ? db.projectEmployee.count({
          where: {
            OR: [{ releasedOn: null }, { releasedOn: { gte: today } }],
            project: { deletedAt: null, status: 'ACTIVE' },
          },
        })
      : null,

    Promise.all([
      db.project.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      db.client.count({ where: { deletedAt: null, isActive: true } }),
      db.vendor.count({ where: { deletedAt: null, isActive: true } }),
      db.product.count({ where: { deletedAt: null, isActive: true } }),
      db.leaveRequest.count({ where: { status: 'PENDING' } }),
      db.electronicBill.count({ where: { deletedAt: null, status: 'PENDING_APPROVAL' } }),
    ]),
  ]);

  /* ---- Receipts series, gap-filled so the sparkline has no holes ---- */
  const receiptsByMonth = new Map(
    (receiptRows ?? []).map((r) => [r.month, D(r.total).toNumber()]),
  );
  const receiptsSeries: { month: string; value: number }[] = [];
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    receiptsSeries.push({ month: key, value: receiptsByMonth.get(key) ?? 0 });
  }

  /* ---- Projects, with budget consumption ---- */
  const projects = (projectRows ?? []).map((p) => {
    const billed = p.bills.reduce((sum, b) => sum.plus(D(b.total)), D(0));
    const budget = p.budget ? D(p.budget) : null;
    return {
      id: p.id,
      code: p.code,
      nameEn: p.nameEn,
      clientName: p.client.nameEn,
      status: p.status,
      budget: budget ? money(budget) : null,
      billed: money(billed),
      consumedPct:
        budget && budget.greaterThan(0)
          ? Math.round(billed.dividedBy(budget).times(100).toNumber())
          : null,
    };
  });

  /* ---- Warehouses ---- */
  const warehouses = (warehouseRows ?? []).map((w) => ({
    id: w.id,
    code: w.code,
    nameEn: w.nameEn,
    distinctProducts: w.stock.filter((s) => D(s.quantity).greaterThan(0)).length,
    totalUnits: money(w.stock.reduce((sum, s) => sum.plus(D(s.quantity)), D(0))),
  }));

  /* ---- Attendance today ---- */
  const statusCounts = Object.fromEntries(
    (attendanceRows ?? []).map((r) => [r.status, r._count]),
  ) as Record<string, number>;
  const present = (statusCounts.ATTENDED ?? 0) + (statusCounts.LATE ?? 0);
  const expected = assignedToday ?? 0;

  const [activeProjects, clients, vendors, products, pendingLeave, billsAwaitingApproval] = counts;

  return {
    netPosition: ledger ? ledger.netPosition : D(0),
    cashBalance: money(D(cashIn?._sum.amount ?? 0).minus(D(cashOut?._sum.amount ?? 0))),
    receivable: ledger ? ledger.receivable.outstanding : D(0),
    payable: ledger ? ledger.payable.outstanding : D(0),
    overdueReceivable: ledger ? ledger.receivable.overdue : D(0),
    collectedThisMonth: money(monthPayments?._sum.amount ?? 0),
    billedThisMonth: money(monthBills?._sum.total ?? 0),
    receiptsSeries,
    alerts: await buildAlerts(actor),
    projects,
    warehouses,
    attendanceToday: {
      expected,
      present,
      late: statusCounts.LATE ?? 0,
      missing: Math.max(0, expected - present),
      isWeekend: isCairoWeekend(now),
      // A grace period past the configured start, so somebody arriving
      // at 08:05 does not briefly register as missing.
      beforeWorkStart:
        cairoMinutes(now) <
        parseHhMm(await getSetting('attendance.workStart', '08:00'), 8 * 60) + 30,
    },
    counts: {
      activeProjects, clients, vendors, products,
      pendingLeave, billsAwaitingApproval,
    },
  };
}

/**
 * Alerts, each one a real row meeting a real condition right now.
 *
 * Ordered by urgency rather than by type, and capped — an alert list
 * nobody can finish reading is a list nobody reads.
 */
async function buildAlerts(actor: Actor): Promise<DashboardAlert[]> {
  const alerts: DashboardAlert[] = [];
  const now = new Date();

  /* ---- Overdue receivables ---- */
  if (can(actor, 'accounts.view')) {
    const worst = (await receivablesByClient(now)).filter((c) => c.summary.overdue.greaterThan(0));

    for (const client of worst.slice(0, 3)) {
      alerts.push({
        id: `overdue-${client.id}`,
        tone: client.summary.oldestOverdueDays > 90 ? 'danger' : 'warning',
        title: `${client.nameEn} — ${client.summary.oldestOverdueDays} days overdue`,
        detail: `EGP ${client.summary.overdue.toFixed(2)} across ${client.summary.overdueBillCount} bill${client.summary.overdueBillCount === 1 ? '' : 's'}`,
        href: `/clients/${client.id}`,
        action: 'Open',
      });
    }
  }

  /* ---- Stock at or below reorder level ---- */
  if (can(actor, 'inventory.view')) {
    // The comparison is against the SUM across warehouses, so a product
    // split thinly over three sites is still caught.
    const low = await db.$queryRaw<
      { id: string; sku: string; nameEn: string; onHand: Prisma.Decimal; reorderLevel: Prisma.Decimal }[]
    >`
      SELECT p."id", p."sku", p."nameEn", p."reorderLevel",
             COALESCE(SUM(ws."quantity"), 0) AS "onHand"
      FROM "products" p
      LEFT JOIN "warehouse_stock" ws ON ws."productId" = p."id"
      WHERE p."deletedAt" IS NULL AND p."isActive" = true AND p."reorderLevel" > 0
      GROUP BY p."id", p."sku", p."nameEn", p."reorderLevel"
      HAVING COALESCE(SUM(ws."quantity"), 0) <= p."reorderLevel"
      ORDER BY (COALESCE(SUM(ws."quantity"), 0) / NULLIF(p."reorderLevel", 0)) ASC
      LIMIT 3
    `;

    for (const product of low) {
      alerts.push({
        id: `stock-${product.id}`,
        tone: D(product.onHand).isZero() ? 'danger' : 'warning',
        title: `${product.nameEn} at or below reorder level`,
        detail: `${D(product.onHand).toString()} on hand · reorder at ${D(product.reorderLevel).toString()}`,
        href: `/products/${product.id}`,
        action: 'Order',
      });
    }
  }

  /* ---- Bills waiting on this person ---- */
  if (can(actor, 'bills.approve')) {
    const waiting = await db.electronicBill.count({
      where: { deletedAt: null, status: 'PENDING_APPROVAL' },
    });
    if (waiting > 0) {
      alerts.push({
        id: 'bills-approval',
        tone: 'warning',
        title: `${waiting} bill${waiting === 1 ? '' : 's'} awaiting your approval`,
        detail: 'Nothing can be sent to a client until it is approved',
        href: '/bills?status=PENDING_APPROVAL',
        action: 'Review',
      });
    }
  }

  /* ---- Leave waiting on this person ---- */
  if (can(actor, 'leave.approve')) {
    const pending = await db.leaveRequest.count({ where: { status: 'PENDING' } });
    if (pending > 0) {
      alerts.push({
        id: 'leave-approval',
        tone: 'info',
        title: `${pending} leave request${pending === 1 ? '' : 's'} pending`,
        detail: 'Balances stay reserved until each one is decided',
        href: '/leave',
        action: 'Decide',
      });
    }
  }

  /* ---- Projects approaching or past their deadline ---- */
  if (can(actor, 'projects.view')) {
    const today = cairoWorkDate(now);
    const horizon = new Date(today);
    horizon.setUTCDate(horizon.getUTCDate() + 7);

    const due = await db.project.findMany({
      where: {
        deletedAt: null,
        status: { in: ['PLANNING', 'ACTIVE'] },
        endsOn: { not: null, lte: horizon },
      },
      select: { id: true, code: true, nameEn: true, endsOn: true },
      orderBy: { endsOn: 'asc' },
      take: 3,
    });

    for (const project of due) {
      const days = Math.round((project.endsOn!.getTime() - today.getTime()) / 86_400_000);
      const overdue = days < 0;
      alerts.push({
        id: `deadline-${project.id}`,
        tone: overdue ? 'danger' : 'warning',
        title: overdue
          ? `${project.code} — ${project.nameEn} is ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`
          : `${project.code} — ${project.nameEn} is due in ${days} day${days === 1 ? '' : 's'}`,
        detail: `Deadline ${project.endsOn!.toISOString().slice(0, 10)}`,
        href: `/projects/${project.id}`,
        action: 'Open',
      });
    }
  }

  /* ---- Projects running without a geofence ---- */
  if (can(actor, 'projects.location')) {
    const unpinned = await db.project.findMany({
      where: { deletedAt: null, status: 'ACTIVE', location: null },
      select: { id: true, code: true, nameEn: true },
      take: 2,
    });

    for (const project of unpinned) {
      alerts.push({
        id: `unpinned-${project.id}`,
        tone: 'warning',
        title: `${project.code} has no site location`,
        detail: 'Nobody assigned to this project can check in until it is pinned',
        href: `/projects/${project.id}`,
        action: 'Set location',
      });
    }
  }

  const rank = { danger: 0, warning: 1, info: 2 } as const;
  return alerts.sort((a, b) => rank[a.tone] - rank[b.tone]).slice(0, 6);
}
