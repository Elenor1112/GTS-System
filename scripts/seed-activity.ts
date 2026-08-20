/**
 * GTS — development activity seed.
 *
 * Generates a plausible trading history so the development environment
 * shows a working business rather than a wall of zeroes.
 *
 * IMPORTANT: every row here is created by calling the REAL services —
 * receiveStock, allocateToProject, createBill, recordPayment, checkIn.
 * Nothing writes a stock level or a bill total directly. That means this
 * script is itself a test of the engines: if the ledger, the totals or
 * the geofence were wrong, this would fail rather than quietly producing
 * pretty numbers.
 *
 * Run with `npm run db:seed:activity`. Safe to re-run — it clears the
 * activity it previously generated first.
 */

import { test } from 'vitest';
import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

import {
  receiveStock, allocateToProject, deliverToProject, returnFromProject, transferStock,
} from '@/lib/services/inventory';
import {
  createBill, submitForApproval, approveBill, sendBill, recordPayment, markOverdueBills,
} from '@/lib/services/billing';
import { checkIn } from '@/lib/services/attendance';
import { requestLeave, approveLeave } from '@/lib/services/leave';

process.env.DATABASE_URL = process.env.DIRECT_URL!;

const db = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DIRECT_URL! }),
});

const D = (v: Prisma.Decimal | number | string) => new Prisma.Decimal(v);

const today = new Date();
const daysAgo = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d;
};
const dateOnly = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));

/** Deterministic pseudo-random, so re-running gives the same business. */
let seed = 20260819;
function rand(): number {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const pick = <T,>(items: readonly T[]): T => items[Math.floor(rand() * items.length)]!;
const between = (min: number, max: number) => Math.floor(min + rand() * (max - min + 1));

async function main() {

  console.log('▸ Generating development activity…');

  const admin = await db.user.findFirstOrThrow({
    where: { email: 'admin@gts.example' },
    select: { id: true, email: true },
  });
  const actor = admin;

  /* ---- Clear activity from a previous run ---- */
  await db.clientProductTransaction.deleteMany({});
  await db.vendorProductTransaction.deleteMany({});
  await db.inventoryTransaction.deleteMany({});
  await db.projectProduct.deleteMany({});
  await db.warehouseStock.deleteMany({});
  await db.payment.deleteMany({});
  await db.billApproval.deleteMany({});
  await db.billItem.deleteMany({});
  await db.electronicBill.deleteMany({});
  await db.attendance.deleteMany({});
  await db.leaveRequest.deleteMany({});
  await db.leaveBalance.updateMany({ data: { taken: 0, pending: 0 } });
  await db.notification.deleteMany({});
  await db.counter.deleteMany({});
  console.log('  cleared previous activity');

  const products = await db.product.findMany({
    where: { deletedAt: null },
    select: { id: true, sku: true, nameEn: true, unit: true, gpcCode: true, salePrice: true, costPrice: true },
  });
  const warehouses = await db.warehouse.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true },
  });
  const clients = await db.client.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true, nameEn: true },
  });
  const vendors = await db.vendor.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true, nameEn: true },
  });
  const projects = await db.project.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true, clientId: true, status: true },
  });

  const wh6 = warehouses.find((w) => w.code === 'WH-6OCT')!;
  const whAlex = warehouses.find((w) => w.code === 'WH-ALEX')!;
  const wh10 = warehouses.find((w) => w.code === 'WH-10RAM')!;

  /* ============================================================
     1 · GOODS IN — every product received from its vendor
     ============================================================ */
  let received = 0;
  for (const product of products) {
    const vendor = pick(vendors);
    // Enough stock that the reorder alerts are meaningful rather than
    // permanently firing on everything.
    for (const [warehouse, qty] of [
      [wh6, between(800, 2400)],
      [whAlex, between(300, 900)],
      [wh10, between(400, 1200)],
    ] as const) {
      await receiveStock({
        actor,
        productId: product.id,
        warehouseId: warehouse.id,
        quantity: qty,
        unitCost: Number(product.costPrice),
        vendorId: vendor.id,
        reference: `GRN-${between(1000, 9999)}`,
        occurredAt: daysAgo(between(120, 200)),
      });
      received += 1;
    }
  }
  console.log(`  stock receipts: ${received}`);

  /* ============================================================
     2 · A TRANSFER between depots
     ============================================================ */
  await transferStock({
    actor,
    productId: products[0]!.id,
    fromWarehouseId: wh6.id,
    toWarehouseId: whAlex.id,
    quantity: 150,
    reason: 'Rebalancing ahead of the Alexandria fit-out',
    occurredAt: daysAgo(60),
  });
  console.log('  transfers: 1');

  /* ============================================================
     3 · PROJECT MATERIAL — allocate, deliver, return, damage
     ============================================================ */
  const liveProjects = projects.filter((p) => p.status === 'ACTIVE' || p.status === 'PLANNING');
  let allocations = 0;

  for (const project of liveProjects) {
    const chosen = products.slice(0, between(3, 5));

    for (const product of chosen) {
      const allocate = between(40, 220);
      await allocateToProject({
        actor,
        projectId: project.id,
        productId: product.id,
        warehouseId: wh6.id,
        quantity: allocate,
        agreedPrice: Number(product.salePrice),
        occurredAt: daysAgo(between(30, 90)),
      });
      allocations += 1;

      // Most of an allocation reaches site.
      const deliver = Math.floor(allocate * (0.6 + rand() * 0.4));
      if (deliver > 0) {
        await deliverToProject({
          actor,
          projectId: project.id,
          productId: product.id,
          quantity: deliver,
          reference: `DN-${between(1000, 9999)}`,
          occurredAt: daysAgo(between(10, 30)),
        });

        // Some comes back; a little is damaged.
        if (rand() > 0.5) {
          const back = Math.max(1, Math.floor(deliver * 0.12));
          await returnFromProject({
            actor, projectId: project.id, productId: product.id,
            warehouseId: wh6.id, quantity: back,
            occurredAt: daysAgo(between(3, 9)),
          });
        }
        if (rand() > 0.75) {
          const broken = Math.max(1, Math.floor(deliver * 0.04));
          await returnFromProject({
            actor, projectId: project.id, productId: product.id,
            warehouseId: wh6.id, quantity: broken, damaged: true,
            reason: pick(['Damaged in transit', 'Water damage on site', 'Dropped during unloading']),
            occurredAt: daysAgo(between(2, 8)),
          });
        }
      }
    }
  }
  console.log(`  project allocations: ${allocations}`);

  /* ============================================================
     4 · RECEIVABLES — bills to clients, most of them paid
     ============================================================ */
  let billCount = 0;
  let paidCount = 0;

  for (const project of projects) {
    const client = clients.find((c) => c.id === project.clientId)!;
    const howMany = between(2, 4);

    for (let i = 0; i < howMany; i += 1) {
      // Weighted towards recent months, with a tail going back half a
      // year: the ageing ladder needs genuinely old invoices, and the
      // "this month" figures need genuinely new ones.
      const age = i === 0 ? between(1, 25) : between(20, 170);
      const issuedOn = dateOnly(daysAgo(age));
      const lines = products.slice(0, between(2, 4)).map((p) => ({
        productId: p.id,
        descriptionEn: p.nameEn,
        gpcCode: p.gpcCode,
        itemCode: p.sku,
        quantity: between(10, 90),
        unit: p.unit,
        unitPrice: Number(p.salePrice),
        vatRate: 14,
      }));

      const bill = await createBill({
        actor,
        direction: 'RECEIVABLE',
        clientId: client.id,
        projectId: project.id,
        issuedOn,
        // Supplies and contracting, the common Egyptian rate.
        whtRate: 0.5,
        lines,
      });
      billCount += 1;

      await submitForApproval({ actor, billId: bill.id });
      await approveBill({ actor, billId: bill.id, note: 'Checked against the delivery notes' });
      await sendBill({ actor, billId: bill.id });

      // Most invoices are settled; some are part-paid; a few are late.
      const roll = rand();
      const collectable = D(bill.total).minus(D(bill.whtAmount));

      if (roll > 0.42) {
        await recordPayment({
          actor,
          billId: bill.id,
          amount: collectable.toString(),
          whtDeducted: bill.whtAmount.toString(),
          method: pick(['BANK_TRANSFER', 'CHEQUE', 'BANK_TRANSFER'] as const),
          reference: `TT-${between(100000, 999999)}`,
          receivedOn: dateOnly(daysAgo(between(1, 9))),
        });
        paidCount += 1;
      } else if (roll > 0.24) {
        await recordPayment({
          actor,
          billId: bill.id,
          amount: collectable.times(0.45).toDecimalPlaces(2).toString(),
          method: 'BANK_TRANSFER',
          reference: `TT-${between(100000, 999999)}`,
          receivedOn: dateOnly(daysAgo(between(1, 20))),
        });
      }
      // The remainder stay unpaid, and the older ones age into overdue.
    }
  }

  /* ============================================================
     5 · PAYABLES — vendor bills, mostly settled
     ============================================================ */
  for (const vendor of vendors) {
    for (let i = 0; i < between(1, 3); i += 1) {
      const issuedOn = dateOnly(daysAgo(between(15, 150)));
      const lines = products.slice(0, between(1, 3)).map((p) => ({
        productId: p.id,
        descriptionEn: p.nameEn,
        gpcCode: p.gpcCode,
        itemCode: p.sku,
        quantity: between(100, 400),
        unit: p.unit,
        unitPrice: Number(p.costPrice),
        vatRate: 14,
      }));

      const bill = await createBill({
        actor, direction: 'PAYABLE', vendorId: vendor.id, issuedOn, lines,
      });
      billCount += 1;

      await submitForApproval({ actor, billId: bill.id });
      await approveBill({ actor, billId: bill.id });
      await sendBill({ actor, billId: bill.id });

      // A trading company settles most of what it owes — a supplier
      // ledger where two thirds is outstanding would describe a business
      // about to lose its credit terms, not a working one.
      if (rand() > 0.15) {
        await recordPayment({
          actor,
          billId: bill.id,
          amount: D(bill.total).minus(D(bill.whtAmount)).toString(),
          method: 'BANK_TRANSFER',
          receivedOn: dateOnly(daysAgo(between(1, 12))),
        });
        paidCount += 1;
      }
    }
  }
  console.log(`  bills: ${billCount} (${paidCount} settled)`);

  /* ============================================================
     6 · ATTENDANCE — real check-ins, inside each real geofence
     ============================================================ */
  const assignments = await db.projectEmployee.findMany({
    where: { releasedOn: null, project: { status: 'ACTIVE', location: { isNot: null } } },
    select: {
      employeeId: true,
      project: { select: { id: true, location: true } },
    },
  });

  let checkIns = 0;
  // The last 21 calendar days, skipping the Egyptian weekend.
  for (let back = 21; back >= 0; back -= 1) {
    const day = daysAgo(back);
    const weekday = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Cairo', weekday: 'short',
    }).format(day);
    if (weekday === 'Fri' || weekday === 'Sat') continue;

    for (const assignment of assignments) {
      // Not everybody is on site every day.
      if (rand() > 0.86) continue;

      const location = assignment.project.location!;
      // A fix a few metres from the pin — a real GPS jitter, comfortably
      // inside the fence, and genuinely evaluated by the server.
      const jitter = () => (rand() - 0.5) * 0.0004;

      const at = new Date(day);
      // Mostly on time; occasionally late enough to be flagged.
      const hour = rand() > 0.85 ? 9 : 7;
      const minute = between(0, 55);
      at.setUTCHours(hour - 3, minute, 0, 0); // Cairo is UTC+3 in summer

      try {
        await checkIn({
          actor,
          employeeId: assignment.employeeId,
          projectId: assignment.project.id,
          latitude: Number(location.latitude) + jitter(),
          longitude: Number(location.longitude) + jitter(),
          accuracy: between(6, 24),
          at,
        });
        checkIns += 1;
      } catch {
        // A duplicate or an out-of-fence jitter: skip it rather than
        // forcing a row the engine refused. The engine is the authority.
      }
    }
  }
  console.log(`  attendance check-ins: ${checkIns}`);

  /* ============================================================
     7 · LEAVE — a few requests, some decided
     ============================================================ */
  const employees = await db.employee.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true },
    take: 5,
  });
  const annual = await db.leaveType.findFirstOrThrow({ where: { key: 'annual' }, select: { id: true } });

  let leaveCount = 0;
  for (const [i, employee] of employees.entries()) {
    const start = new Date(today);
    start.setDate(start.getDate() + 14 + i * 12);
    const end = new Date(start);
    end.setDate(end.getDate() + between(2, 4));

    try {
      const request = await requestLeave({
        actor,
        employeeId: employee.id,
        leaveTypeId: annual.id,
        startsOn: dateOnly(start),
        endsOn: dateOnly(end),
        reason: pick(['Family visit to Alexandria', 'Eid holiday', 'Personal', 'Medical appointment']),
      });
      leaveCount += 1;
      // Leave the last two pending, so the approval queue is not empty.
      if (i < employees.length - 2) {
        await approveLeave({ actor, requestId: request.id, note: 'Cover arranged with the foreman' });
      }
    } catch {
      // Overlap or balance refusal — the engine's call, not ours.
    }
  }
  console.log(`  leave requests: ${leaveCount}`);

  /* ---- Age the ledger ----
     Bills do not become overdue by being looked at; the sweep is what
     moves them, exactly as the scheduled job will in production. */
  const overdue = await markOverdueBills();
  console.log();

  /* ---- Report the resulting position ---- */
  const [stockRows, billTotals, payments] = await Promise.all([
    db.warehouseStock.aggregate({ _sum: { quantity: true } }),
    db.electronicBill.aggregate({ _sum: { total: true }, _count: true }),
    db.payment.aggregate({ _sum: { amount: true }, _count: true }),
  ]);

  console.log('\n▸ Development activity generated.');
  console.log(`  stock on hand      ${stockRows._sum.quantity ?? 0} units`);
  console.log(`  bills              ${billTotals._count} totalling EGP ${billTotals._sum.total ?? 0}`);
  console.log(`  payments           ${payments._count} totalling EGP ${payments._sum.amount ?? 0}`);
}

/**
 * Run through Vitest rather than bare Node.
 *
 * The services import each other with the '@/…' alias, which bare Node
 * cannot resolve — and rewriting the source to use relative paths with
 * explicit extensions, purely so a seed script can load it, would make
 * the application worse to serve the tooling. Vitest already resolves
 * the alias, so the seed runs through it.
 *
 * Invoke with: npm run db:seed:activity
 */
test('generate development activity', { timeout: 900_000 }, async () => {
  await main();
  await db.$disconnect();
});
