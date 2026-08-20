import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { Prisma } from '@prisma/client';

import { db } from '@/lib/db';
import {
  receiveStock,
  issueStock,
  allocateToProject,
  deliverToProject,
  returnFromProject,
  transferStock,
  adjustStock,
  stockAt,
  stockOnHand,
  projectPosition,
  productLedger,
  InventoryError,
} from '@/lib/services/inventory';

/**
 * The inventory engine, against the real database.
 *
 * These are not unit tests with a mocked client. They run the actual
 * transactions, take the actual row locks and hit the actual CHECK
 * constraints — because the questions worth asking here ("can two
 * concurrent issues drive stock negative?") are questions about the
 * database, and a mock would answer them by assumption.
 */

let actor: { id: string; email: string };
let productId: string;
let secondProductId: string;
let wh6: string;
let whAlex: string;
let projectId: string;
let projectCode: string;

beforeAll(async () => {
  actor = await db.user.findFirstOrThrow({
    where: { email: 'admin@gts.example' },
    select: { id: true, email: true },
  });
  productId = (await db.product.findFirstOrThrow({ where: { sku: 'CEM-42.5N' }, select: { id: true } })).id;
  secondProductId = (await db.product.findFirstOrThrow({ where: { sku: 'STL-B12' }, select: { id: true } })).id;
  wh6 = (await db.warehouse.findFirstOrThrow({ where: { code: 'WH-6OCT' }, select: { id: true } })).id;
  whAlex = (await db.warehouse.findFirstOrThrow({ where: { code: 'WH-ALEX' }, select: { id: true } })).id;
  const project = await db.project.findFirstOrThrow({
    where: { code: 'PRJ-0142' },
    select: { id: true, code: true },
  });
  projectId = project.id;
  projectCode = project.code;
});

/** Return the test products to a known empty state before each test. */
async function reset(ids: string[] = [productId, secondProductId]) {
  await db.clientProductTransaction.deleteMany({ where: { productId: { in: ids } } });
  await db.vendorProductTransaction.deleteMany({ where: { productId: { in: ids } } });
  await db.inventoryTransaction.deleteMany({ where: { productId: { in: ids } } });
  await db.projectProduct.deleteMany({ where: { productId: { in: ids } } });
  await db.warehouseStock.deleteMany({ where: { productId: { in: ids } } });
}

beforeEach(async () => {
  await reset();
});

afterAll(async () => {
  await reset();
  await db.$disconnect();
});

const n = (v: Prisma.Decimal | number | string) => new Prisma.Decimal(v).toNumber();

describe('the lifecycle in the brief', () => {
  it('moves 100 → allocate 30 → 70, then return 10 → 80, leaving 20 on site', async () => {
    await receiveStock({ actor, productId, warehouseId: wh6, quantity: 100, unitCost: 198 });
    expect(n(await stockAt(wh6, productId))).toBe(100);

    await allocateToProject({ actor, projectId, productId, warehouseId: wh6, quantity: 30, agreedPrice: 232.5 });
    expect(n(await stockAt(wh6, productId))).toBe(70);

    await deliverToProject({ actor, projectId, productId, quantity: 30 });

    await returnFromProject({ actor, projectId, productId, warehouseId: wh6, quantity: 10 });
    expect(n(await stockAt(wh6, productId))).toBe(80);

    const pp = await db.projectProduct.findFirstOrThrow({ where: { projectId, productId } });
    const position = projectPosition(pp);
    expect(n(position.allocated)).toBe(30);
    expect(n(position.delivered)).toBe(30);
    expect(n(position.returned)).toBe(10);
    expect(n(position.remaining)).toBe(20);
  });

  it('writes off damaged stock without returning it to sellable inventory', async () => {
    await receiveStock({ actor, productId, warehouseId: wh6, quantity: 50 });
    await allocateToProject({ actor, projectId, productId, warehouseId: wh6, quantity: 20 });
    await deliverToProject({ actor, projectId, productId, quantity: 20 });

    const beforeDamage = n(await stockAt(wh6, productId));
    await returnFromProject({ actor, projectId, productId, warehouseId: wh6, quantity: 5, damaged: true });

    // Damage removes the units from the world; it does not restock them.
    expect(n(await stockAt(wh6, productId))).toBe(beforeDamage - 5);

    const pp = await db.projectProduct.findFirstOrThrow({ where: { projectId, productId } });
    expect(n(projectPosition(pp).damaged)).toBe(5);
    expect(n(projectPosition(pp).remaining)).toBe(15);
  });

  it('records the client side of every delivery, return and write-off', async () => {
    await receiveStock({ actor, productId, warehouseId: wh6, quantity: 40 });
    await allocateToProject({ actor, projectId, productId, warehouseId: wh6, quantity: 30 });
    await deliverToProject({ actor, projectId, productId, quantity: 30 });
    await returnFromProject({ actor, projectId, productId, warehouseId: wh6, quantity: 6 });
    await returnFromProject({ actor, projectId, productId, warehouseId: wh6, quantity: 4, damaged: true });

    const rows = await db.clientProductTransaction.findMany({
      where: { projectId, productId },
      orderBy: { createdAt: 'asc' },
    });

    expect(rows.map((r) => r.direction)).toEqual(['DELIVERED', 'RETURNED', 'DAMAGED']);
    expect(rows.map((r) => n(r.quantity))).toEqual([30, 6, 4]);
  });
});

describe('transfers', () => {
  it('moves stock between warehouses without creating or destroying any', async () => {
    await receiveStock({ actor, productId, warehouseId: wh6, quantity: 60 });
    const totalBefore = n(await stockOnHand(productId));

    await transferStock({ actor, productId, fromWarehouseId: wh6, toWarehouseId: whAlex, quantity: 25 });

    expect(n(await stockAt(wh6, productId))).toBe(35);
    expect(n(await stockAt(whAlex, productId))).toBe(25);
    expect(n(await stockOnHand(productId))).toBe(totalBefore);
  });

  it('links both halves of a transfer with one groupRef', async () => {
    await receiveStock({ actor, productId, warehouseId: wh6, quantity: 30 });
    const { groupRef } = await transferStock({
      actor, productId, fromWarehouseId: wh6, toWarehouseId: whAlex, quantity: 10,
    });

    const halves = await db.inventoryTransaction.findMany({ where: { groupRef } });
    expect(halves).toHaveLength(2);
    expect(halves.map((h) => n(h.quantity)).sort((a, b) => a - b)).toEqual([-10, 10]);
  });

  it('refuses a transfer to the same warehouse', async () => {
    await receiveStock({ actor, productId, warehouseId: wh6, quantity: 10 });
    await expect(
      transferStock({ actor, productId, fromWarehouseId: wh6, toWarehouseId: wh6, quantity: 5 }),
    ).rejects.toMatchObject({ code: 'SAME_WAREHOUSE' });
  });

  it('rolls back entirely when the source cannot cover the transfer', async () => {
    await receiveStock({ actor, productId, warehouseId: wh6, quantity: 5 });

    await expect(
      transferStock({ actor, productId, fromWarehouseId: wh6, toWarehouseId: whAlex, quantity: 50 }),
    ).rejects.toBeInstanceOf(InventoryError);

    // Neither side moved: a half-committed transfer would invent stock.
    expect(n(await stockAt(wh6, productId))).toBe(5);
    expect(n(await stockAt(whAlex, productId))).toBe(0);
  });
});

describe('refusals', () => {
  it('never lets stock go negative', async () => {
    await receiveStock({ actor, productId, warehouseId: wh6, quantity: 10 });

    await expect(
      issueStock({ actor, productId, warehouseId: wh6, quantity: 11 }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });

    expect(n(await stockAt(wh6, productId))).toBe(10);
  });

  it('reports what is available when it refuses', async () => {
    await receiveStock({ actor, productId, warehouseId: wh6, quantity: 7 });

    await expect(
      issueStock({ actor, productId, warehouseId: wh6, quantity: 20 }),
    ).rejects.toMatchObject({
      code: 'INSUFFICIENT_STOCK',
      detail: expect.objectContaining({ available: '7', requested: '20' }),
    });
  });

  it('rejects zero and negative quantities', async () => {
    for (const quantity of [0, -1]) {
      await expect(
        receiveStock({ actor, productId, warehouseId: wh6, quantity }),
      ).rejects.toMatchObject({ code: 'INVALID_QUANTITY' });
    }
  });

  it('will not deliver more than was allocated', async () => {
    await receiveStock({ actor, productId, warehouseId: wh6, quantity: 50 });
    await allocateToProject({ actor, projectId, productId, warehouseId: wh6, quantity: 10 });

    await expect(
      deliverToProject({ actor, projectId, productId, quantity: 11 }),
    ).rejects.toMatchObject({ code: 'EXCEEDS_ALLOCATION' });
  });

  it('will not return more than is on site', async () => {
    await receiveStock({ actor, productId, warehouseId: wh6, quantity: 50 });
    await allocateToProject({ actor, projectId, productId, warehouseId: wh6, quantity: 10 });
    await deliverToProject({ actor, projectId, productId, quantity: 10 });
    await returnFromProject({ actor, projectId, productId, warehouseId: wh6, quantity: 10 });

    await expect(
      returnFromProject({ actor, projectId, productId, warehouseId: wh6, quantity: 1 }),
    ).rejects.toMatchObject({ code: 'EXCEEDS_ON_SITE' });
  });

  it('refuses to allocate to a product that was never allocated', async () => {
    await expect(
      deliverToProject({ actor, projectId, productId, quantity: 1 }),
    ).rejects.toMatchObject({ code: 'NOT_ALLOCATED' });
  });

  it('refuses an adjustment with no stated reason', async () => {
    await receiveStock({ actor, productId, warehouseId: wh6, quantity: 10 });
    await expect(
      adjustStock({ actor, productId, warehouseId: wh6, countedQuantity: 8, reason: '   ' }),
    ).rejects.toMatchObject({ code: 'REASON_REQUIRED' });
  });

  it('refuses to allocate stock to a completed project', async () => {
    const completed = await db.project.findFirstOrThrow({
      where: { status: 'COMPLETED' },
      select: { id: true },
    });
    await receiveStock({ actor, productId, warehouseId: wh6, quantity: 10 });

    await expect(
      allocateToProject({ actor, projectId: completed.id, productId, warehouseId: wh6, quantity: 1 }),
    ).rejects.toMatchObject({ code: 'PROJECT_CLOSED' });
  });
});

describe('adjustments', () => {
  it('posts the difference, not the counted figure', async () => {
    await receiveStock({ actor, productId, warehouseId: wh6, quantity: 100 });

    await adjustStock({
      actor, productId, warehouseId: wh6,
      countedQuantity: 97,
      reason: 'Physical count — three bags torn in handling',
    });

    expect(n(await stockAt(wh6, productId))).toBe(97);

    const adjustment = await db.inventoryTransaction.findFirstOrThrow({
      where: { productId, type: 'ADJUSTMENT' },
      orderBy: { createdAt: 'desc' },
    });
    // The ledger records −3, so the shrinkage is visible as an event
    // rather than hidden inside a rewritten total.
    expect(n(adjustment.quantity)).toBe(-3);
    expect(adjustment.reason).toContain('Physical count');
  });

  it('writes nothing when the count already matches', async () => {
    await receiveStock({ actor, productId, warehouseId: wh6, quantity: 42 });
    const before = await db.inventoryTransaction.count({ where: { productId } });

    const result = await adjustStock({
      actor, productId, warehouseId: wh6, countedQuantity: 42, reason: 'Routine count',
    });

    expect(result.unchanged).toBe(true);
    expect(await db.inventoryTransaction.count({ where: { productId } })).toBe(before);
  });
});

describe('the ledger is the truth', () => {
  it('replays to exactly the current stock level', async () => {
    await receiveStock({ actor, productId, warehouseId: wh6, quantity: 100 });
    await allocateToProject({ actor, projectId, productId, warehouseId: wh6, quantity: 30 });
    await deliverToProject({ actor, projectId, productId, quantity: 30 });
    await returnFromProject({ actor, projectId, productId, warehouseId: wh6, quantity: 10 });
    await transferStock({ actor, productId, fromWarehouseId: wh6, toWarehouseId: whAlex, quantity: 20 });
    await adjustStock({ actor, productId, warehouseId: wh6, countedQuantity: 55, reason: 'Count' });

    const rows = await db.inventoryTransaction.findMany({
      where: { productId, warehouseId: wh6 },
      orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
    });

    let running = new Prisma.Decimal(0);
    for (const row of rows) {
      running = running.plus(row.quantity);
      // Each row's stored balance must equal the replayed running total.
      expect(n(row.balanceAfter)).toBe(n(running));
    }

    expect(n(running)).toBe(n(await stockAt(wh6, productId)));
  });

  it('never updates or deletes a ledger row once written', async () => {
    await receiveStock({ actor, productId, warehouseId: wh6, quantity: 20 });
    const row = await db.inventoryTransaction.findFirstOrThrow({ where: { productId } });

    await adjustStock({ actor, productId, warehouseId: wh6, countedQuantity: 15, reason: 'Count' });

    const after = await db.inventoryTransaction.findUniqueOrThrow({ where: { id: row.id } });
    expect(n(after.quantity)).toBe(n(row.quantity));
    expect(n(after.balanceAfter)).toBe(n(row.balanceAfter));
  });

  it('gives every movement a unique gapless reference', async () => {
    await receiveStock({ actor, productId, warehouseId: wh6, quantity: 10 });
    await receiveStock({ actor, productId, warehouseId: wh6, quantity: 10 });
    await receiveStock({ actor, productId, warehouseId: wh6, quantity: 10 });

    const rows = await productLedger(productId, { limit: 3 });
    const refs = rows.map((r) => r.ref);
    expect(new Set(refs).size).toBe(refs.length);
    expect(refs.every((r) => /^TX-\d{4}-\d{5}$/.test(r))).toBe(true);
  });

  it('audits every movement with an actor', async () => {
    const before = await db.auditLog.count({ where: { action: 'INVENTORY_MOVE' } });
    await receiveStock({ actor, productId, warehouseId: wh6, quantity: 10 });
    const after = await db.auditLog.count({ where: { action: 'INVENTORY_MOVE' } });

    expect(after).toBe(before + 1);

    const entry = await db.auditLog.findFirstOrThrow({
      where: { action: 'INVENTORY_MOVE' },
      orderBy: { createdAt: 'desc' },
    });
    expect(entry.actorId).toBe(actor.id);
  });
});

describe('concurrency', () => {
  it('does not let two simultaneous issues oversell the last units', async () => {
    await receiveStock({ actor, productId, warehouseId: wh6, quantity: 10 });

    // Both requests want 6 of the 10. Exactly one may succeed; if both
    // did, stock would be −2 and the warehouse would have promised
    // pallets it does not have.
    const results = await Promise.allSettled([
      issueStock({ actor, productId, warehouseId: wh6, quantity: 6, reason: 'A' }),
      issueStock({ actor, productId, warehouseId: wh6, quantity: 6, reason: 'B' }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled').length;
    expect(fulfilled).toBe(1);

    const remaining = n(await stockAt(wh6, productId));
    expect(remaining).toBe(4);
    expect(remaining).toBeGreaterThanOrEqual(0);
  });

  it('keeps the ledger consistent under a burst of concurrent receipts', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        receiveStock({ actor, productId, warehouseId: wh6, quantity: 10 }),
      ),
    );

    // Serialisable isolation may abort some of these; whichever committed,
    // the stored level must equal the sum of the rows that were written.
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    expect(succeeded).toBeGreaterThan(0);

    const rows = await db.inventoryTransaction.findMany({ where: { productId, warehouseId: wh6 } });
    const sum = rows.reduce((acc, r) => acc.plus(r.quantity), new Prisma.Decimal(0));
    expect(n(sum)).toBe(n(await stockAt(wh6, productId)));
    expect(rows.length).toBe(succeeded);
  });
});

describe('the database is the backstop', () => {
  it('rejects negative stock at the constraint level, not only in code', async () => {
    await receiveStock({ actor, productId, warehouseId: wh6, quantity: 5 });

    // Bypass the service entirely — this is what a future careless caller
    // would do. Postgres must still refuse it.
    await expect(
      db.warehouseStock.updateMany({
        where: { warehouseId: wh6, productId },
        data: { quantity: -1 },
      }),
    ).rejects.toThrow();
  });

  it('rejects a fence radius below the sanity floor', async () => {
    const location = await db.projectLocation.findFirstOrThrow({ select: { id: true } });
    await expect(
      db.projectLocation.update({ where: { id: location.id }, data: { radiusMetres: 5 } }),
    ).rejects.toThrow();
  });
});
