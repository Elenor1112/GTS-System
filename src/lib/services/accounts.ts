import 'server-only';

import { Prisma } from '@prisma/client';

import { db } from '../db';
import { cairoDate } from './billing';

/**
 * GTS — account summaries.
 *
 * Every figure here is derived from bill and payment rows at query time.
 * There is no `summary` table, no nightly rollup and no cached total,
 * because a stored summary is a number that can disagree with the
 * transactions it claims to describe — and when it does, nobody can tell
 * which one is wrong.
 *
 * The cost of recomputing is one indexed aggregate per call. The
 * `bills_outstanding_idx` partial index exists for exactly these queries.
 */

const D = (v: Prisma.Decimal | number | string | null | undefined) => new Prisma.Decimal(v ?? 0);
const money = (v: Prisma.Decimal | number | string | null | undefined) =>
  D(v).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

/** Statuses that represent money still owed. */
const OPEN_STATUSES = ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] as const;

/* ============================================================
   AGEING
   ============================================================ */

export interface AgeingBuckets {
  current: Prisma.Decimal;
  days1to30: Prisma.Decimal;
  days31to60: Prisma.Decimal;
  days61to90: Prisma.Decimal;
  over90: Prisma.Decimal;
  total: Prisma.Decimal;
}

function emptyBuckets(): AgeingBuckets {
  return {
    current: D(0), days1to30: D(0), days31to60: D(0),
    days61to90: D(0), over90: D(0), total: D(0),
  };
}

/** Days a bill is past due, in Cairo terms. Negative means not yet due. */
export function daysOverdue(dueOn: Date, asOf = new Date()): number {
  const due = cairoDate(dueOn);
  const now = cairoDate(asOf);
  return Math.floor((now.getTime() - due.getTime()) / 86_400_000);
}

function bucketFor(buckets: AgeingBuckets, days: number, amount: Prisma.Decimal) {
  if (days <= 0) buckets.current = buckets.current.plus(amount);
  else if (days <= 30) buckets.days1to30 = buckets.days1to30.plus(amount);
  else if (days <= 60) buckets.days31to60 = buckets.days31to60.plus(amount);
  else if (days <= 90) buckets.days61to90 = buckets.days61to90.plus(amount);
  else buckets.over90 = buckets.over90.plus(amount);
  buckets.total = buckets.total.plus(amount);
}

/**
 * What is still collectable on a bill.
 *
 * Withholding is subtracted because the buyer never owed it in cash —
 * they remit it to the ETA on our behalf. Treating the gross total as
 * receivable would overstate the ledger by the withheld amount for every
 * invoice above the threshold.
 */
function outstanding(bill: {
  total: Prisma.Decimal; whtAmount: Prisma.Decimal; paidAmount: Prisma.Decimal;
}): Prisma.Decimal {
  return money(D(bill.total).minus(D(bill.whtAmount)).minus(D(bill.paidAmount)));
}

/* ============================================================
   CLIENT SUMMARY
   ============================================================ */

export interface CounterpartySummary {
  billed: Prisma.Decimal;
  paid: Prisma.Decimal;
  withheld: Prisma.Decimal;
  outstanding: Prisma.Decimal;
  overdue: Prisma.Decimal;
  ageing: AgeingBuckets;
  billCount: number;
  openBillCount: number;
  overdueBillCount: number;
  oldestOverdueDays: number;
}

export async function clientSummary(clientId: string, asOf = new Date()): Promise<CounterpartySummary> {
  const bills = await db.electronicBill.findMany({
    where: { clientId, deletedAt: null, status: { not: 'CANCELLED' } },
    select: { status: true, total: true, whtAmount: true, paidAmount: true, dueOn: true },
  });

  return summarise(bills, asOf);
}

export async function vendorSummary(vendorId: string, asOf = new Date()): Promise<CounterpartySummary> {
  const bills = await db.electronicBill.findMany({
    where: { vendorId, deletedAt: null, status: { not: 'CANCELLED' } },
    select: { status: true, total: true, whtAmount: true, paidAmount: true, dueOn: true },
  });

  return summarise(bills, asOf);
}

function summarise(
  bills: {
    status: string; total: Prisma.Decimal; whtAmount: Prisma.Decimal;
    paidAmount: Prisma.Decimal; dueOn: Date;
  }[],
  asOf: Date,
): CounterpartySummary {
  const ageing = emptyBuckets();
  let billed = D(0);
  let paid = D(0);
  let withheld = D(0);
  let outstandingTotal = D(0);
  let overdue = D(0);
  let openCount = 0;
  let overdueCount = 0;
  let oldestOverdueDays = 0;

  for (const bill of bills) {
    billed = billed.plus(D(bill.total));
    paid = paid.plus(D(bill.paidAmount));
    withheld = withheld.plus(D(bill.whtAmount));

    // Drafts and bills awaiting approval are not yet owed by anyone.
    if (!OPEN_STATUSES.includes(bill.status as (typeof OPEN_STATUSES)[number])) continue;

    const due = outstanding(bill);
    if (due.lessThanOrEqualTo(0)) continue;

    openCount += 1;
    outstandingTotal = outstandingTotal.plus(due);

    const days = daysOverdue(bill.dueOn, asOf);
    bucketFor(ageing, days, due);

    if (days > 0) {
      overdue = overdue.plus(due);
      overdueCount += 1;
      oldestOverdueDays = Math.max(oldestOverdueDays, days);
    }
  }

  return {
    billed: money(billed),
    paid: money(paid),
    withheld: money(withheld),
    outstanding: money(outstandingTotal),
    overdue: money(overdue),
    ageing: {
      current: money(ageing.current),
      days1to30: money(ageing.days1to30),
      days31to60: money(ageing.days31to60),
      days61to90: money(ageing.days61to90),
      over90: money(ageing.over90),
      total: money(ageing.total),
    },
    billCount: bills.length,
    openBillCount: openCount,
    overdueBillCount: overdueCount,
    oldestOverdueDays,
  };
}

/* ============================================================
   PROJECT FINANCIALS
   ============================================================ */

export interface ProjectFinancials {
  budget: Prisma.Decimal | null;
  billed: Prisma.Decimal;
  collected: Prisma.Decimal;
  outstanding: Prisma.Decimal;
  /** Value of stock allocated to the site, at agreed or catalogue price. */
  materialsAllocated: Prisma.Decimal;
  materialsReturned: Prisma.Decimal;
  materialsDamaged: Prisma.Decimal;
  /** Labour cost from attendance × daily rate. */
  labourCost: Prisma.Decimal;
  /** Budget − (materials on site + labour). Null when no budget is set. */
  remainingBudget: Prisma.Decimal | null;
  attendanceDays: number;
}

export async function projectFinancials(projectId: string): Promise<ProjectFinancials> {
  const [project, bills, products, attendance] = await Promise.all([
    db.project.findUniqueOrThrow({ where: { id: projectId }, select: { budget: true } }),
    db.electronicBill.findMany({
      where: { projectId, deletedAt: null, status: { not: 'CANCELLED' } },
      select: { total: true, whtAmount: true, paidAmount: true, status: true, dueOn: true },
    }),
    db.projectProduct.findMany({
      where: { projectId },
      select: {
        allocated: true, delivered: true, returned: true, damaged: true,
        agreedPrice: true,
        product: { select: { salePrice: true } },
      },
    }),
    // Labour is costed from the employee's daily rate at the time of
    // reading; a historical rate table would be the next refinement.
    db.attendance.findMany({
      where: { projectId, status: { in: ['ATTENDED', 'LATE'] } },
      select: { employee: { select: { dailyRate: true } } },
    }),
  ]);

  let billed = D(0);
  let collected = D(0);
  let outstandingTotal = D(0);
  for (const bill of bills) {
    billed = billed.plus(D(bill.total));
    collected = collected.plus(D(bill.paidAmount));
    if (OPEN_STATUSES.includes(bill.status as (typeof OPEN_STATUSES)[number])) {
      const due = outstanding(bill);
      if (due.greaterThan(0)) outstandingTotal = outstandingTotal.plus(due);
    }
  }

  let allocated = D(0);
  let returned = D(0);
  let damaged = D(0);
  for (const row of products) {
    // The agreed project price wins over the catalogue price — that is
    // the figure the client was quoted.
    const price = D(row.agreedPrice ?? row.product.salePrice);
    allocated = allocated.plus(D(row.allocated).times(price));
    returned = returned.plus(D(row.returned).times(price));
    damaged = damaged.plus(D(row.damaged).times(price));
  }

  let labour = D(0);
  for (const record of attendance) {
    labour = labour.plus(D(record.employee.dailyRate ?? 0));
  }

  const materialsOnSite = allocated.minus(returned);
  const budget = project.budget ? D(project.budget) : null;

  return {
    budget: budget ? money(budget) : null,
    billed: money(billed),
    collected: money(collected),
    outstanding: money(outstandingTotal),
    materialsAllocated: money(allocated),
    materialsReturned: money(returned),
    materialsDamaged: money(damaged),
    labourCost: money(labour),
    remainingBudget: budget ? money(budget.minus(materialsOnSite).minus(labour)) : null,
    attendanceDays: attendance.length,
  };
}

/* ============================================================
   ORGANISATION-WIDE
   ============================================================ */

export interface LedgerTotals {
  receivable: CounterpartySummary;
  payable: CounterpartySummary;
  /** Receivable outstanding − payable outstanding. */
  netPosition: Prisma.Decimal;
}

export async function ledgerTotals(asOf = new Date()): Promise<LedgerTotals> {
  const [receivables, payables] = await Promise.all([
    db.electronicBill.findMany({
      where: { direction: 'RECEIVABLE', deletedAt: null, status: { not: 'CANCELLED' } },
      select: { status: true, total: true, whtAmount: true, paidAmount: true, dueOn: true },
    }),
    db.electronicBill.findMany({
      where: { direction: 'PAYABLE', deletedAt: null, status: { not: 'CANCELLED' } },
      select: { status: true, total: true, whtAmount: true, paidAmount: true, dueOn: true },
    }),
  ]);

  const receivable = summarise(receivables, asOf);
  const payable = summarise(payables, asOf);

  return {
    receivable,
    payable,
    netPosition: money(D(receivable.outstanding).minus(D(payable.outstanding))),
  };
}

/**
 * Every client with money outstanding, worst first.
 *
 * Ordered by overdue rather than by total, because the collections
 * question is "who is late", not "who is large".
 */
export async function receivablesByClient(asOf = new Date()) {
  const clients = await db.client.findMany({
    where: { deletedAt: null },
    select: {
      id: true, code: true, nameEn: true, nameAr: true, creditLimit: true,
      bills: {
        where: { deletedAt: null, status: { not: 'CANCELLED' } },
        select: { status: true, total: true, whtAmount: true, paidAmount: true, dueOn: true },
      },
    },
  });

  return clients
    .map((client) => ({
      id: client.id,
      code: client.code,
      nameEn: client.nameEn,
      nameAr: client.nameAr,
      creditLimit: money(client.creditLimit),
      summary: summarise(client.bills, asOf),
    }))
    .filter((c) => c.summary.outstanding.greaterThan(0))
    .sort((a, b) => {
      const byOverdue = b.summary.overdue.comparedTo(a.summary.overdue);
      return byOverdue !== 0 ? byOverdue : b.summary.outstanding.comparedTo(a.summary.outstanding);
    });
}

export async function payablesByVendor(asOf = new Date()) {
  const vendors = await db.vendor.findMany({
    where: { deletedAt: null },
    select: {
      id: true, code: true, nameEn: true, nameAr: true,
      bills: {
        where: { deletedAt: null, status: { not: 'CANCELLED' } },
        select: { status: true, total: true, whtAmount: true, paidAmount: true, dueOn: true },
      },
    },
  });

  return vendors
    .map((vendor) => ({
      id: vendor.id,
      code: vendor.code,
      nameEn: vendor.nameEn,
      nameAr: vendor.nameAr,
      summary: summarise(vendor.bills, asOf),
    }))
    .filter((v) => v.summary.outstanding.greaterThan(0))
    .sort((a, b) => b.summary.overdue.comparedTo(a.summary.overdue));
}

/* ============================================================
   CLIENT ACTIVITY — a real timeline, from real rows
   ============================================================ */

export type ActivityKind =
  | 'PROJECT_STARTED'
  | 'BILL_ISSUED'
  | 'BILL_PAID'
  | 'PAYMENT_RECEIVED'
  | 'GOODS_DELIVERED'
  | 'GOODS_RETURNED'
  | 'GOODS_DAMAGED';

export interface ActivityEvent {
  kind: ActivityKind;
  at: Date;
  title: string;
  detail: string;
  amount: Prisma.Decimal | null;
  href: string | null;
}

/**
 * A client's history, assembled from the rows that actually recorded the
 * events — projects, bills, payments and goods movements.
 *
 * Nothing is synthesised. If an event is on this timeline, there is a
 * database row that caused it; if there is no row, nothing is shown.
 */
export async function clientActivity(clientId: string, limit = 50): Promise<ActivityEvent[]> {
  const [projects, bills, payments, goods] = await Promise.all([
    db.project.findMany({
      where: { clientId, deletedAt: null },
      select: { id: true, code: true, nameEn: true, startsOn: true, createdAt: true, budget: true },
    }),
    db.electronicBill.findMany({
      where: { clientId, deletedAt: null },
      select: {
        id: true, number: true, total: true, status: true,
        issuedOn: true, createdAt: true,
      },
    }),
    db.payment.findMany({
      where: { clientId },
      select: {
        id: true, ref: true, amount: true, receivedOn: true, method: true,
        bill: { select: { number: true } },
      },
    }),
    db.clientProductTransaction.findMany({
      where: { clientId },
      select: {
        id: true, direction: true, quantity: true, occurredAt: true, unitPrice: true,
        product: { select: { sku: true, nameEn: true, unit: true } },
        project: { select: { code: true } },
      },
      take: 200,
      orderBy: { occurredAt: 'desc' },
    }),
  ]);

  const events: ActivityEvent[] = [];

  for (const p of projects) {
    events.push({
      kind: 'PROJECT_STARTED',
      at: p.startsOn ?? p.createdAt,
      title: `Project ${p.code} started`,
      detail: p.nameEn,
      amount: p.budget ? money(p.budget) : null,
      href: `/projects/${p.id}`,
    });
  }

  for (const b of bills) {
    events.push({
      kind: 'BILL_ISSUED',
      at: b.issuedOn,
      title: `Bill ${b.number} issued`,
      detail: b.status.toLowerCase().replace('_', ' '),
      amount: money(b.total),
      href: `/bills/${b.id}`,
    });
  }

  for (const p of payments) {
    events.push({
      kind: 'PAYMENT_RECEIVED',
      at: p.receivedOn,
      title: `Payment ${p.ref}`,
      detail: p.bill ? `Against ${p.bill.number}` : p.method.toLowerCase().replace('_', ' '),
      amount: money(p.amount),
      href: '/accounts',
    });
  }

  for (const g of goods) {
    const kind: ActivityKind =
      g.direction === 'RETURNED' ? 'GOODS_RETURNED'
      : g.direction === 'DAMAGED' ? 'GOODS_DAMAGED'
      : 'GOODS_DELIVERED';

    events.push({
      kind,
      at: g.occurredAt,
      title: `${g.quantity} ${g.product.unit} ${g.direction.toLowerCase()}`,
      detail: `${g.product.nameEn}${g.project ? ` — ${g.project.code}` : ''}`,
      amount: g.unitPrice ? money(D(g.unitPrice).times(D(g.quantity))) : null,
      href: null,
    });
  }

  return events.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}

/** The same, from the vendor's side. */
export async function vendorActivity(vendorId: string, limit = 50): Promise<ActivityEvent[]> {
  const [bills, payments, goods] = await Promise.all([
    db.electronicBill.findMany({
      where: { vendorId, deletedAt: null },
      select: { id: true, number: true, total: true, status: true, issuedOn: true },
    }),
    db.payment.findMany({
      where: { vendorId },
      select: {
        id: true, ref: true, amount: true, receivedOn: true, method: true,
        bill: { select: { number: true } },
      },
    }),
    db.vendorProductTransaction.findMany({
      where: { vendorId },
      select: {
        id: true, direction: true, quantity: true, occurredAt: true, unitCost: true,
        product: { select: { sku: true, nameEn: true, unit: true } },
      },
      take: 200,
      orderBy: { occurredAt: 'desc' },
    }),
  ]);

  const events: ActivityEvent[] = [];

  for (const b of bills) {
    events.push({
      kind: 'BILL_ISSUED',
      at: b.issuedOn,
      title: `Bill ${b.number} received`,
      detail: b.status.toLowerCase().replace('_', ' '),
      amount: money(b.total),
      href: `/bills/${b.id}`,
    });
  }

  for (const p of payments) {
    events.push({
      kind: 'PAYMENT_RECEIVED',
      at: p.receivedOn,
      title: `Payment ${p.ref}`,
      detail: p.bill ? `Against ${p.bill.number}` : p.method.toLowerCase().replace('_', ' '),
      amount: money(p.amount),
      href: '/accounts',
    });
  }

  for (const g of goods) {
    events.push({
      kind: g.direction === 'RETURNED' ? 'GOODS_RETURNED' : 'GOODS_DELIVERED',
      at: g.occurredAt,
      title: `${g.quantity} ${g.product.unit} ${g.direction.toLowerCase()}`,
      detail: g.product.nameEn,
      amount: g.unitCost ? money(D(g.unitCost).times(D(g.quantity))) : null,
      href: null,
    });
  }

  return events.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}
