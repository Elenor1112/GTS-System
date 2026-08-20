/**
 * Restore development data the test suites consume.
 *
 * Two things get eaten by running the tests:
 *
 *   1. The inventory suite deliberately drains CEM-42.5N and STL-B12 to
 *      prove stock cannot go negative, and does not put them back.
 *   2. Attendance history — the geofence tests need today's row cleared,
 *      and an earlier, too-broad teardown removed the seeded weeks too.
 *
 * Everything here goes through the REAL services, so the ledger explains
 * every unit and the geofence judges every check-in. Safe to re-run: it
 * tops up to a target rather than adding a fixed amount, and skips any
 * check-in the engine refuses.
 *
 * Run with `npm run db:replenish`.
 */

import { test } from 'vitest';
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

import { receiveStock, stockOnHand } from '@/lib/services/inventory';
import { checkIn } from '@/lib/services/attendance';

process.env.DATABASE_URL = process.env.DIRECT_URL!;
const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DIRECT_URL! }) });

/** Deterministic, so a re-run produces the same business. */
let seed = 20260820;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const between = (min: number, max: number) => Math.floor(min + rand() * (max - min + 1));

test('replenish development data', { timeout: 900_000 }, async () => {
  const actor = await db.user.findFirstOrThrow({
    where: { email: 'admin@gts.example' },
    select: { id: true, email: true },
  });

  /* ---------- 1 · Stock ---------- */
  const warehouse = await db.warehouse.findFirstOrThrow({
    where: { code: 'WH-6OCT' },
    select: { id: true },
  });

  const products = await db.product.findMany({
    where: { deletedAt: null, reorderLevel: { gt: 0 } },
    select: { id: true, sku: true, costPrice: true, reorderLevel: true },
  });

  let topped = 0;
  for (const product of products) {
    const onHand = await stockOnHand(product.id);
    // Three times the reorder level: comfortably above it, so the
    // low-stock alert means something rather than being permanently lit.
    const target = Number(product.reorderLevel) * 3;
    const shortfall = target - onHand.toNumber();
    if (shortfall <= 0) continue;

    await receiveStock({
      actor,
      productId: product.id,
      warehouseId: warehouse.id,
      quantity: shortfall,
      unitCost: Number(product.costPrice),
      reference: 'GRN-REPLENISH',
      notes: 'Development top-up after the test suite',
    });
    topped += 1;
    console.log(`  ${product.sku}: +${shortfall} → ${await stockOnHand(product.id)}`);
  }
  console.log(`  products topped up: ${topped}`);

  /* ---------- 2 · Attendance ---------- */
  const assignments = await db.projectEmployee.findMany({
    where: { releasedOn: null, project: { status: 'ACTIVE', location: { isNot: null } } },
    select: { employeeId: true, project: { select: { id: true, location: true } } },
  });

  let recorded = 0;
  // The last three weeks, skipping the Egyptian weekend. Today is left
  // alone: the geofence suite needs that row free.
  for (let back = 21; back >= 1; back -= 1) {
    const day = new Date();
    day.setDate(day.getDate() - back);

    const weekday = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Cairo',
      weekday: 'short',
    }).format(day);
    if (weekday === 'Fri' || weekday === 'Sat') continue;

    for (const assignment of assignments) {
      if (rand() > 0.86) continue; // not everybody is on site every day

      const location = assignment.project.location!;
      // Real GPS jitter a few metres from the pin — comfortably inside
      // the fence, and genuinely evaluated by the server.
      const jitter = () => (rand() - 0.5) * 0.0004;

      const at = new Date(day);
      const hour = rand() > 0.85 ? 9 : 7; // occasionally late enough to flag
      at.setUTCHours(hour - 3, between(0, 55), 0, 0); // Cairo is UTC+3 in summer

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
        recorded += 1;
      } catch {
        // A duplicate, or a jitter that landed outside: the engine's
        // call, not ours. Skip rather than force a row it refused.
      }
    }
  }
  console.log(`  attendance recorded: ${recorded}`);

  await db.$disconnect();
});
