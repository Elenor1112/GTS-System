import 'server-only';

import { Prisma } from '@prisma/client';

import { db } from '../db';
import { cairoWorkDate } from './attendance';

/**
 * GTS — reports.
 *
 * Aggregates run in SQL, not in JavaScript. Pulling a year of inventory
 * transactions into memory to group them here would work on the seed
 * data and fall over on a real one; `GROUP BY` is what a database is for.
 *
 * Every figure traces to rows. There is no reporting table to fall out
 * of step with the ledger it summarises.
 */

const D = (v: Prisma.Decimal | number | string | null | undefined) => new Prisma.Decimal(v ?? 0);

export interface DateRange {
  from: Date;
  to: Date;
}

/** The last complete month, as a sensible default range. */
export function defaultRange(): DateRange {
  const now = new Date();
  return {
    from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)),
    to: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)),
  };
}

/* ============================================================
   FINANCIAL
   ============================================================ */

export interface FinancialReport {
  billed: Prisma.Decimal;
  vatCharged: Prisma.Decimal;
  collected: Prisma.Decimal;
  withheld: Prisma.Decimal;
  purchased: Prisma.Decimal;
  vatPaid: Prisma.Decimal;
  paid: Prisma.Decimal;
  /** Billed − purchased. Not profit: it ignores labour and overhead. */
  grossMargin: Prisma.Decimal;
  /** What the VAT return owes: VAT charged − VAT paid on purchases. */
  vatPosition: Prisma.Decimal;
  byMonth: { month: string; billed: number; collected: number }[];
}

export async function financialReport(range: DateRange): Promise<FinancialReport> {
  const [receivable, payable, receipts, payments, monthly] = await Promise.all([
    db.electronicBill.aggregate({
      where: {
        direction: 'RECEIVABLE', deletedAt: null,
        status: { not: 'CANCELLED' },
        issuedOn: { gte: range.from, lte: range.to },
      },
      _sum: { total: true, vatAmount: true, whtAmount: true },
    }),
    db.electronicBill.aggregate({
      where: {
        direction: 'PAYABLE', deletedAt: null,
        status: { not: 'CANCELLED' },
        issuedOn: { gte: range.from, lte: range.to },
      },
      _sum: { total: true, vatAmount: true },
    }),
    db.payment.aggregate({
      where: { clientId: { not: null }, receivedOn: { gte: range.from, lte: range.to } },
      _sum: { amount: true },
    }),
    db.payment.aggregate({
      where: { vendorId: { not: null }, receivedOn: { gte: range.from, lte: range.to } },
      _sum: { amount: true },
    }),
    db.$queryRaw<{ month: string; billed: Prisma.Decimal; collected: Prisma.Decimal }[]>`
      SELECT months.month,
             COALESCE(b.billed, 0)    AS billed,
             COALESCE(p.collected, 0) AS collected
      FROM (
        SELECT to_char(generate_series(
          date_trunc('month', ${range.from}::date),
          date_trunc('month', ${range.to}::date),
          interval '1 month'
        ), 'YYYY-MM') AS month
      ) months
      LEFT JOIN (
        SELECT to_char(date_trunc('month', "issuedOn"), 'YYYY-MM') AS month,
               SUM("total") AS billed
        FROM "electronic_bills"
        WHERE "direction" = 'RECEIVABLE' AND "deletedAt" IS NULL
          AND "status" <> 'CANCELLED'
          AND "issuedOn" BETWEEN ${range.from} AND ${range.to}
        GROUP BY 1
      ) b ON b.month = months.month
      LEFT JOIN (
        SELECT to_char(date_trunc('month', "receivedOn"), 'YYYY-MM') AS month,
               SUM("amount") AS collected
        FROM "payments"
        WHERE "clientId" IS NOT NULL
          AND "receivedOn" BETWEEN ${range.from} AND ${range.to}
        GROUP BY 1
      ) p ON p.month = months.month
      ORDER BY months.month
    `,
  ]);

  const billed = D(receivable._sum.total);
  const vatCharged = D(receivable._sum.vatAmount);
  const purchased = D(payable._sum.total);
  const vatPaid = D(payable._sum.vatAmount);

  return {
    billed,
    vatCharged,
    collected: D(receipts._sum.amount),
    withheld: D(receivable._sum.whtAmount),
    purchased,
    vatPaid,
    paid: D(payments._sum.amount),
    grossMargin: billed.minus(purchased),
    vatPosition: vatCharged.minus(vatPaid),
    byMonth: monthly.map((m) => ({
      month: m.month,
      billed: D(m.billed).toNumber(),
      collected: D(m.collected).toNumber(),
    })),
  };
}

/* ============================================================
   INVENTORY
   ============================================================ */

export async function inventoryReport(range: DateRange) {
  const movements = await db.$queryRaw<
    {
      productId: string; sku: string; nameEn: string; unit: string;
      received: Prisma.Decimal; issued: Prisma.Decimal;
      returned: Prisma.Decimal; damaged: Prisma.Decimal; adjusted: Prisma.Decimal;
      onHand: Prisma.Decimal;
    }[]
  >`
    SELECT p."id" AS "productId", p."sku", p."nameEn", p."unit",
           COALESCE(SUM(CASE WHEN t."type" = 'RECEIVE' THEN t."quantity" END), 0) AS received,
           COALESCE(-SUM(CASE WHEN t."type" IN ('ISSUE','PROJECT_ALLOCATION') THEN t."quantity" END), 0) AS issued,
           COALESCE(SUM(CASE WHEN t."type" = 'RETURN' THEN t."quantity" END), 0) AS returned,
           COALESCE(-SUM(CASE WHEN t."type" = 'DAMAGE' THEN t."quantity" END), 0) AS damaged,
           COALESCE(SUM(CASE WHEN t."type" = 'ADJUSTMENT' THEN t."quantity" END), 0) AS adjusted,
           COALESCE((SELECT SUM(ws."quantity") FROM "warehouse_stock" ws WHERE ws."productId" = p."id"), 0) AS "onHand"
    FROM "products" p
    LEFT JOIN "inventory_transactions" t
      ON t."productId" = p."id"
     AND t."occurredAt" BETWEEN ${range.from} AND ${range.to}
    WHERE p."deletedAt" IS NULL
    GROUP BY p."id", p."sku", p."nameEn", p."unit"
    ORDER BY p."nameEn"
  `;

  return movements.map((m) => ({
    ...m,
    received: D(m.received),
    issued: D(m.issued),
    returned: D(m.returned),
    damaged: D(m.damaged),
    adjusted: D(m.adjusted),
    onHand: D(m.onHand),
  }));
}

/* ============================================================
   ATTENDANCE
   ============================================================ */

export async function attendanceReport(range: DateRange) {
  const rows = await db.$queryRaw<
    {
      employeeId: string; code: string; nameEn: string; jobTitleEn: string;
      days: bigint; late: bigint; minutesLate: bigint; workedMinutes: bigint | null;
    }[]
  >`
    SELECT e."id" AS "employeeId", e."code", e."nameEn", e."jobTitleEn",
           COUNT(a."id")                                        AS days,
           COUNT(a."id") FILTER (WHERE a."status" = 'LATE')      AS late,
           COALESCE(SUM(a."minutesLate"), 0)                     AS "minutesLate",
           COALESCE(SUM(a."workedMinutes"), 0)                   AS "workedMinutes"
    FROM "employees" e
    LEFT JOIN "attendance" a
      ON a."employeeId" = e."id"
     AND a."workDate" BETWEEN ${cairoWorkDate(range.from)} AND ${cairoWorkDate(range.to)}
    WHERE e."deletedAt" IS NULL AND e."isActive" = true
    GROUP BY e."id", e."code", e."nameEn", e."jobTitleEn"
    ORDER BY e."nameEn"
  `;

  return rows.map((r) => ({
    employeeId: r.employeeId,
    code: r.code,
    nameEn: r.nameEn,
    jobTitleEn: r.jobTitleEn,
    days: Number(r.days),
    late: Number(r.late),
    minutesLate: Number(r.minutesLate),
    hoursWorked: Number(((Number(r.workedMinutes ?? 0)) / 60).toFixed(1)),
  }));
}

/* ============================================================
   PROJECTS
   ============================================================ */

export async function projectReport() {
  const projects = await db.project.findMany({
    where: { deletedAt: null },
    select: {
      id: true, code: true, nameEn: true, status: true, budget: true,
      client: { select: { nameEn: true } },
      bills: {
        where: { deletedAt: null, status: { not: 'CANCELLED' } },
        select: { total: true, paidAmount: true, whtAmount: true },
      },
      products: {
        select: {
          allocated: true, delivered: true, returned: true, damaged: true,
          agreedPrice: true,
          product: { select: { salePrice: true } },
        },
      },
      _count: { select: { employees: true, attendance: true } },
    },
    orderBy: [{ status: 'asc' }, { code: 'desc' }],
  });

  return projects.map((p) => {
    const billed = p.bills.reduce((s, b) => s.plus(D(b.total)), D(0));
    const collected = p.bills.reduce((s, b) => s.plus(D(b.paidAmount)), D(0));

    let materials = D(0);
    let damaged = D(0);
    for (const row of p.products) {
      const price = D(row.agreedPrice ?? row.product.salePrice);
      materials = materials.plus(D(row.allocated).minus(D(row.returned)).times(price));
      damaged = damaged.plus(D(row.damaged).times(price));
    }

    const budget = p.budget ? D(p.budget) : null;

    return {
      id: p.id,
      code: p.code,
      nameEn: p.nameEn,
      clientName: p.client.nameEn,
      status: p.status,
      budget,
      billed: billed.toDecimalPlaces(2),
      collected: collected.toDecimalPlaces(2),
      materials: materials.toDecimalPlaces(2),
      damaged: damaged.toDecimalPlaces(2),
      attendanceDays: p._count.attendance,
      teamSize: p._count.employees,
      consumedPct:
        budget && budget.greaterThan(0)
          ? Math.round(billed.dividedBy(budget).times(100).toNumber())
          : null,
    };
  });
}
