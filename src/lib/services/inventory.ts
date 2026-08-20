import 'server-only';

import { Prisma, type InventoryTxType } from '@prisma/client';

import { db, transaction, type Tx } from '../db';
import { writeAudit } from './audit';
import { nextRef } from './counters';
import { notifyLowStock } from './notifications';
import { DomainError } from '../errors';

/**
 * GTS — the inventory engine.
 *
 * THE RULE: stock is never assigned, only moved.
 *
 * Every function here appends an InventoryTransaction row and derives the
 * new WarehouseStock level from the old one inside the SAME serialisable
 * transaction. Nothing writes `quantity` to an arbitrary value; even a
 * stock-count correction is posted as an ADJUSTMENT of the difference, so
 * the ledger explains every unit the warehouse believes it holds.
 *
 * Concurrency: two storekeepers issuing the last pallet simultaneously is
 * the case that matters. The stock row is locked with SELECT … FOR UPDATE
 * before it is read, so the second request waits, re-reads the decremented
 * level, and is refused. The database CHECK constraint is the backstop if
 * a future caller ever bypasses this module.
 */

/* ============================================================
   QUANTITIES

   Prisma.Decimal throughout. A float would make 0.1 + 0.2 units of
   cable a real discrepancy in a real warehouse.
   ============================================================ */

type Numeric = Prisma.Decimal | number | string;

const D = (v: Numeric) => new Prisma.Decimal(v);
/** Quantities are held to 3 decimal places — see the schema. */
const q = (v: Numeric) => D(v).toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP);

export class InventoryError extends DomainError {}

/* ============================================================
   LOCKED READ
   ============================================================ */

/**
 * Read a stock row with a row-level lock, creating it at zero if absent.
 *
 * `FOR UPDATE` is the entire concurrency story. Without it, two requests
 * both read 100, both compute 100 − 60, and both write 40 — leaving 40
 * where there should be −20, which the CHECK constraint would then have
 * to catch as a corruption rather than preventing as a race.
 */
async function lockStock(
  tx: Tx,
  warehouseId: string,
  productId: string,
): Promise<{ id: string; quantity: Prisma.Decimal; reserved: Prisma.Decimal }> {
  const rows = await tx.$queryRaw<
    { id: string; quantity: Prisma.Decimal; reserved: Prisma.Decimal }[]
  >`
    SELECT "id", "quantity", "reserved"
    FROM "warehouse_stock"
    WHERE "warehouseId" = ${warehouseId} AND "productId" = ${productId}
    FOR UPDATE
  `;

  if (rows.length > 0) return rows[0]!;

  // First movement of this product into this warehouse. The unique
  // constraint makes a concurrent create safe to absorb.
  try {
    const created = await tx.warehouseStock.create({
      data: { warehouseId, productId, quantity: 0, reserved: 0 },
      select: { id: true, quantity: true, reserved: true },
    });
    return created;
  } catch {
    const again = await tx.$queryRaw<
      { id: string; quantity: Prisma.Decimal; reserved: Prisma.Decimal }[]
    >`
      SELECT "id", "quantity", "reserved"
      FROM "warehouse_stock"
      WHERE "warehouseId" = ${warehouseId} AND "productId" = ${productId}
      FOR UPDATE
    `;
    if (!again[0]) {
      throw new InventoryError('STOCK_ROW_MISSING', 'Could not open a stock record for this product.');
    }
    return again[0];
  }
}

/* ============================================================
   THE PRIMITIVE — one ledger row + one derived balance
   ============================================================ */

interface MovementInput {
  type: InventoryTxType;
  productId: string;
  warehouseId: string;
  /** Signed: positive adds to this warehouse, negative removes. */
  quantity: Prisma.Decimal;
  destinationWarehouseId?: string | null;
  projectId?: string | null;
  unitCost?: Numeric | null;
  groupRef?: string | null;
  reason?: string | null;
  notes?: string | null;
  performedById: string;
  occurredAt?: Date;
}

/**
 * Apply one signed movement to one warehouse and append its ledger row.
 *
 * This is the only function in the codebase that writes
 * `warehouse_stock.quantity`, and it always derives the new value from
 * the locked previous value.
 */
async function applyMovement(tx: Tx, input: MovementInput) {
  const stock = await lockStock(tx, input.warehouseId, input.productId);

  const before = q(stock.quantity);
  const delta = q(input.quantity);
  const after = q(before.plus(delta));

  if (after.isNegative()) {
    // Refused with the numbers, because "insufficient stock" without them
    // is useless to a storekeeper standing at a rack.
    throw new InventoryError(
      'INSUFFICIENT_STOCK',
      `Not enough stock: ${before.toString()} available, ${delta.abs().toString()} requested.`,
      {
        available: before.toString(),
        requested: delta.abs().toString(),
        warehouseId: input.warehouseId,
        productId: input.productId,
      },
    );
  }

  // Reserved stock is committed to a project; issuing it elsewhere would
  // break a promise already made.
  const reserved = q(stock.reserved);
  if (delta.isNegative() && after.lessThan(reserved)) {
    throw new InventoryError(
      'RESERVED_STOCK',
      `Only ${before.minus(reserved).toString()} is free — ${reserved.toString()} is reserved for project allocations.`,
      { available: before.toString(), reserved: reserved.toString() },
    );
  }

  await tx.warehouseStock.update({
    where: { id: stock.id },
    data: { quantity: after },
  });

  const ref = await nextRef(tx, 'inventory');

  const row = await tx.inventoryTransaction.create({
    data: {
      ref,
      type: input.type,
      productId: input.productId,
      warehouseId: input.warehouseId,
      destinationWarehouseId: input.destinationWarehouseId ?? null,
      quantity: delta,
      balanceAfter: after,
      unitCost: input.unitCost != null ? D(input.unitCost) : null,
      projectId: input.projectId ?? null,
      groupRef: input.groupRef ?? null,
      reason: input.reason ?? null,
      notes: input.notes ?? null,
      performedById: input.performedById,
      occurredAt: input.occurredAt ?? new Date(),
    },
  });

  return { row, balanceBefore: before, balanceAfter: after };
}

/* ============================================================
   PUBLIC OPERATIONS
   ============================================================ */

export interface ActorRef {
  id: string;
  email: string;
}

/** Goods arriving from a vendor, or any inbound addition to a warehouse. */
export async function receiveStock(params: {
  actor: ActorRef;
  productId: string;
  warehouseId: string;
  quantity: Numeric;
  unitCost?: Numeric | null;
  vendorId?: string | null;
  reference?: string | null;
  notes?: string | null;
  occurredAt?: Date;
}) {
  const quantity = q(params.quantity);
  if (quantity.lessThanOrEqualTo(0)) {
    throw new InventoryError('INVALID_QUANTITY', 'Received quantity must be greater than zero.');
  }

  return transaction(async (tx) => {
    const result = await applyMovement(tx, {
      type: 'RECEIVE',
      productId: params.productId,
      warehouseId: params.warehouseId,
      quantity,
      unitCost: params.unitCost ?? null,
      notes: params.notes ?? null,
      reason: params.reference ?? null,
      performedById: params.actor.id,
      occurredAt: params.occurredAt,
    });

    // The vendor's side of the same event, so a supplier statement can be
    // produced without inferring it from the warehouse ledger.
    if (params.vendorId) {
      await tx.vendorProductTransaction.create({
        data: {
          vendorId: params.vendorId,
          productId: params.productId,
          direction: 'RECEIVED',
          quantity,
          unitCost: params.unitCost != null ? D(params.unitCost) : null,
          reference: params.reference ?? result.row.ref,
          occurredAt: params.occurredAt ?? new Date(),
        },
      });
    }

    await writeAudit(
      {
        actorId: params.actor.id,
        actorEmail: params.actor.email,
        action: 'INVENTORY_MOVE',
        entityType: 'InventoryTransaction',
        entityId: result.row.id,
        summary: `Received ${quantity.toString()} into warehouse`,
        afterState: {
          type: 'RECEIVE',
          quantity: quantity.toString(),
          balanceAfter: result.balanceAfter.toString(),
        },
      },
      tx,
    );

    return result;
  });
}

/** Stock leaving the warehouse for a reason other than a project. */
export async function issueStock(params: {
  actor: ActorRef;
  productId: string;
  warehouseId: string;
  quantity: Numeric;
  projectId?: string | null;
  reason?: string | null;
  notes?: string | null;
  occurredAt?: Date;
}) {
  const quantity = q(params.quantity);
  if (quantity.lessThanOrEqualTo(0)) {
    throw new InventoryError('INVALID_QUANTITY', 'Issued quantity must be greater than zero.');
  }

  const result = await transaction(async (tx) => {
    const moved = await applyMovement(tx, {
      type: 'ISSUE',
      productId: params.productId,
      warehouseId: params.warehouseId,
      quantity: quantity.negated(),
      projectId: params.projectId ?? null,
      reason: params.reason ?? null,
      notes: params.notes ?? null,
      performedById: params.actor.id,
      occurredAt: params.occurredAt,
    });

    await writeAudit(
      {
        actorId: params.actor.id,
        actorEmail: params.actor.email,
        action: 'INVENTORY_MOVE',
        entityType: 'InventoryTransaction',
        entityId: moved.row.id,
        summary: `Issued ${quantity.toString()} from warehouse`,
        afterState: { type: 'ISSUE', quantity: quantity.toString(), balanceAfter: moved.balanceAfter.toString() },
      },
      tx,
    );

    return moved;
  });

  await checkReorderLevel(params.productId);
  return result;
}

/**
 * Move stock between warehouses.
 *
 * Two ledger rows sharing a groupRef, inside one transaction: the source
 * is decremented and the destination incremented, or neither happens. A
 * transfer that half-committed would create or destroy stock.
 */
export async function transferStock(params: {
  actor: ActorRef;
  productId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: Numeric;
  reason?: string | null;
  notes?: string | null;
  occurredAt?: Date;
}) {
  const quantity = q(params.quantity);
  if (quantity.lessThanOrEqualTo(0)) {
    throw new InventoryError('INVALID_QUANTITY', 'Transfer quantity must be greater than zero.');
  }
  if (params.fromWarehouseId === params.toWarehouseId) {
    throw new InventoryError('SAME_WAREHOUSE', 'Source and destination warehouses must differ.');
  }

  return transaction(async (tx) => {
    const groupRef = `TRF-${Date.now().toString(36).toUpperCase()}`;
    const occurredAt = params.occurredAt ?? new Date();

    // Lock in a stable order so two opposite transfers running at once
    // cannot deadlock by grabbing each other's rows.
    const [firstWh, secondWh] = [params.fromWarehouseId, params.toWarehouseId].sort();
    await lockStock(tx, firstWh!, params.productId);
    await lockStock(tx, secondWh!, params.productId);

    const out = await applyMovement(tx, {
      type: 'TRANSFER',
      productId: params.productId,
      warehouseId: params.fromWarehouseId,
      destinationWarehouseId: params.toWarehouseId,
      quantity: quantity.negated(),
      groupRef,
      reason: params.reason ?? null,
      notes: params.notes ?? null,
      performedById: params.actor.id,
      occurredAt,
    });

    const incoming = await applyMovement(tx, {
      type: 'TRANSFER',
      productId: params.productId,
      warehouseId: params.toWarehouseId,
      destinationWarehouseId: params.fromWarehouseId,
      quantity,
      groupRef,
      reason: params.reason ?? null,
      notes: params.notes ?? null,
      performedById: params.actor.id,
      occurredAt,
    });

    await writeAudit(
      {
        actorId: params.actor.id,
        actorEmail: params.actor.email,
        action: 'INVENTORY_MOVE',
        entityType: 'InventoryTransaction',
        entityId: out.row.id,
        summary: `Transferred ${quantity.toString()} between warehouses`,
        afterState: {
          groupRef,
          quantity: quantity.toString(),
          fromBalance: out.balanceAfter.toString(),
          toBalance: incoming.balanceAfter.toString(),
        },
      },
      tx,
    );

    return { groupRef, out, incoming };
  });
}

/**
 * Allocate stock from a warehouse to a project.
 *
 * This is the movement in the brief: warehouse 100, allocate 30, warehouse
 * 70 and project 30. The stock physically leaves the warehouse, so the
 * ledger row is negative, and the ProjectProduct row records the position
 * on site.
 */
export async function allocateToProject(params: {
  actor: ActorRef;
  projectId: string;
  productId: string;
  warehouseId: string;
  quantity: Numeric;
  agreedPrice?: Numeric | null;
  notes?: string | null;
  occurredAt?: Date;
}) {
  const quantity = q(params.quantity);
  if (quantity.lessThanOrEqualTo(0)) {
    throw new InventoryError('INVALID_QUANTITY', 'Allocated quantity must be greater than zero.');
  }

  const result = await transaction(async (tx) => {
    const project = await tx.project.findFirst({
      where: { id: params.projectId, deletedAt: null },
      select: { id: true, code: true, status: true, clientId: true },
    });
    if (!project) throw new InventoryError('PROJECT_NOT_FOUND', 'That project does not exist.');
    if (project.status === 'CANCELLED' || project.status === 'COMPLETED') {
      throw new InventoryError(
        'PROJECT_CLOSED',
        `Project ${project.code} is ${project.status.toLowerCase()}; stock cannot be allocated to it.`,
      );
    }

    const moved = await applyMovement(tx, {
      type: 'PROJECT_ALLOCATION',
      productId: params.productId,
      warehouseId: params.warehouseId,
      quantity: quantity.negated(),
      projectId: params.projectId,
      notes: params.notes ?? null,
      performedById: params.actor.id,
      occurredAt: params.occurredAt,
    });

    const position = await tx.projectProduct.upsert({
      where: { projectId_productId: { projectId: params.projectId, productId: params.productId } },
      create: {
        projectId: params.projectId,
        productId: params.productId,
        allocated: quantity,
        agreedPrice: params.agreedPrice != null ? D(params.agreedPrice) : null,
      },
      update: { allocated: { increment: quantity } },
    });

    await writeAudit(
      {
        actorId: params.actor.id,
        actorEmail: params.actor.email,
        action: 'INVENTORY_MOVE',
        entityType: 'ProjectProduct',
        entityId: position.id,
        summary: `Allocated ${quantity.toString()} to project ${project.code}`,
        afterState: {
          allocated: position.allocated.toString(),
          warehouseBalance: moved.balanceAfter.toString(),
        },
      },
      tx,
    );

    return { movement: moved, position, project };
  });

  await checkReorderLevel(params.productId);
  return result;
}

/**
 * Record that allocated stock reached the site and was handed to the
 * client. No warehouse movement — the stock already left on allocation.
 * This advances the project position and writes the client's side.
 */
export async function deliverToProject(params: {
  actor: ActorRef;
  projectId: string;
  productId: string;
  quantity: Numeric;
  reference?: string | null;
  occurredAt?: Date;
}) {
  const quantity = q(params.quantity);
  if (quantity.lessThanOrEqualTo(0)) {
    throw new InventoryError('INVALID_QUANTITY', 'Delivered quantity must be greater than zero.');
  }

  return transaction(async (tx) => {
    const position = await lockProjectProduct(tx, params.projectId, params.productId);

    const undelivered = q(position.allocated).minus(q(position.delivered));
    if (quantity.greaterThan(undelivered)) {
      throw new InventoryError(
        'EXCEEDS_ALLOCATION',
        `Only ${undelivered.toString()} of the allocation is still undelivered.`,
        { allocated: position.allocated.toString(), delivered: position.delivered.toString() },
      );
    }

    const updated = await tx.projectProduct.update({
      where: { id: position.id },
      data: { delivered: { increment: quantity } },
      select: { id: true, allocated: true, delivered: true, returned: true, damaged: true, agreedPrice: true },
    });

    const project = await tx.project.findUniqueOrThrow({
      where: { id: params.projectId },
      select: { clientId: true, code: true },
    });

    await tx.clientProductTransaction.create({
      data: {
        clientId: project.clientId,
        projectId: params.projectId,
        productId: params.productId,
        direction: 'DELIVERED',
        quantity,
        unitPrice: updated.agreedPrice,
        reference: params.reference ?? null,
        occurredAt: params.occurredAt ?? new Date(),
      },
    });

    await writeAudit(
      {
        actorId: params.actor.id,
        actorEmail: params.actor.email,
        action: 'INVENTORY_MOVE',
        entityType: 'ProjectProduct',
        entityId: updated.id,
        summary: `Delivered ${quantity.toString()} to project ${project.code}`,
        afterState: { delivered: updated.delivered.toString() },
      },
      tx,
    );

    return updated;
  });
}

/**
 * Stock coming back from a project into a warehouse.
 *
 * The brief's second half: project holds 30, return 10, warehouse goes
 * 70 → 80 and the project's remaining falls to 20. Both sides move in one
 * transaction.
 */
export async function returnFromProject(params: {
  actor: ActorRef;
  projectId: string;
  productId: string;
  warehouseId: string;
  quantity: Numeric;
  /** Damaged stock returns to the ledger as DAMAGE, not RETURN, and does
   *  not go back on the shelf as sellable. */
  damaged?: boolean;
  reason?: string | null;
  occurredAt?: Date;
}) {
  const quantity = q(params.quantity);
  if (quantity.lessThanOrEqualTo(0)) {
    throw new InventoryError('INVALID_QUANTITY', 'Returned quantity must be greater than zero.');
  }

  return transaction(async (tx) => {
    const position = await lockProjectProduct(tx, params.projectId, params.productId);

    // You can only send back what is actually still on site.
    const onSite = q(position.delivered).minus(q(position.returned)).minus(q(position.damaged));
    if (quantity.greaterThan(onSite)) {
      throw new InventoryError(
        'EXCEEDS_ON_SITE',
        `Only ${onSite.toString()} is still on site; ${quantity.toString()} cannot be returned.`,
        {
          delivered: position.delivered.toString(),
          returned: position.returned.toString(),
          damaged: position.damaged.toString(),
        },
      );
    }

    const isDamage = params.damaged === true;

    // Damaged goods are written off, not restocked: the warehouse row
    // records the loss so the ledger still explains where the units went.
    const moved = await applyMovement(tx, {
      type: isDamage ? 'DAMAGE' : 'RETURN',
      productId: params.productId,
      warehouseId: params.warehouseId,
      quantity: isDamage ? quantity.negated() : quantity,
      projectId: params.projectId,
      reason: params.reason ?? (isDamage ? 'Damaged on site' : 'Returned from site'),
      performedById: params.actor.id,
      occurredAt: params.occurredAt,
    });

    const updated = await tx.projectProduct.update({
      where: { id: position.id },
      data: isDamage ? { damaged: { increment: quantity } } : { returned: { increment: quantity } },
      select: { id: true, allocated: true, delivered: true, returned: true, damaged: true, agreedPrice: true },
    });

    const project = await tx.project.findUniqueOrThrow({
      where: { id: params.projectId },
      select: { clientId: true, code: true },
    });

    await tx.clientProductTransaction.create({
      data: {
        clientId: project.clientId,
        projectId: params.projectId,
        productId: params.productId,
        direction: isDamage ? 'DAMAGED' : 'RETURNED',
        quantity,
        unitPrice: updated.agreedPrice,
        reference: moved.row.ref,
        occurredAt: params.occurredAt ?? new Date(),
      },
    });

    await writeAudit(
      {
        actorId: params.actor.id,
        actorEmail: params.actor.email,
        action: 'INVENTORY_MOVE',
        entityType: 'ProjectProduct',
        entityId: updated.id,
        summary: `${isDamage ? 'Wrote off' : 'Returned'} ${quantity.toString()} from project ${project.code}`,
        afterState: {
          returned: updated.returned.toString(),
          damaged: updated.damaged.toString(),
          warehouseBalance: moved.balanceAfter.toString(),
        },
      },
      tx,
    );

    return { position: updated, movement: moved };
  });
}

/**
 * Correct the recorded level to a counted level.
 *
 * The delta is posted, never the absolute figure, so the ledger keeps
 * explaining every unit — including the ones that went missing.
 */
export async function adjustStock(params: {
  actor: ActorRef;
  productId: string;
  warehouseId: string;
  /** The physically counted quantity. */
  countedQuantity: Numeric;
  reason: string;
  occurredAt?: Date;
}) {
  const counted = q(params.countedQuantity);
  if (counted.isNegative()) {
    throw new InventoryError('INVALID_QUANTITY', 'A counted quantity cannot be negative.');
  }
  if (!params.reason?.trim()) {
    throw new InventoryError('REASON_REQUIRED', 'A stock adjustment must state its reason.');
  }

  return transaction(async (tx) => {
    const stock = await lockStock(tx, params.warehouseId, params.productId);
    const current = q(stock.quantity);
    const delta = q(counted.minus(current));

    if (delta.isZero()) {
      return { unchanged: true as const, balance: current };
    }

    const moved = await applyMovement(tx, {
      type: 'ADJUSTMENT',
      productId: params.productId,
      warehouseId: params.warehouseId,
      quantity: delta,
      reason: params.reason,
      performedById: params.actor.id,
      occurredAt: params.occurredAt,
    });

    await writeAudit(
      {
        actorId: params.actor.id,
        actorEmail: params.actor.email,
        action: 'INVENTORY_MOVE',
        entityType: 'InventoryTransaction',
        entityId: moved.row.id,
        summary: `Adjusted stock by ${delta.toString()}: ${params.reason}`,
        beforeState: { quantity: current.toString() },
        afterState: { quantity: counted.toString(), reason: params.reason },
      },
      tx,
    );

    return { unchanged: false as const, movement: moved, balance: moved.balanceAfter };
  });
}

/* ============================================================
   HELPERS
   ============================================================ */

async function lockProjectProduct(tx: Tx, projectId: string, productId: string) {
  const rows = await tx.$queryRaw<
    {
      id: string;
      allocated: Prisma.Decimal;
      delivered: Prisma.Decimal;
      returned: Prisma.Decimal;
      damaged: Prisma.Decimal;
      agreedPrice: Prisma.Decimal | null;
    }[]
  >`
    SELECT "id", "allocated", "delivered", "returned", "damaged", "agreedPrice"
    FROM "project_products"
    WHERE "projectId" = ${projectId} AND "productId" = ${productId}
    FOR UPDATE
  `;

  if (!rows[0]) {
    throw new InventoryError(
      'NOT_ALLOCATED',
      'This product has not been allocated to that project.',
      { projectId, productId },
    );
  }
  return rows[0];
}

/**
 * Notify when a product falls below its reorder level.
 *
 * Deliberately OUTSIDE the movement transaction: a notification failure
 * must never roll back a legitimate stock movement.
 */
export async function checkReorderLevel(productId: string): Promise<void> {
  try {
    const product = await db.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { id: true, sku: true, nameEn: true, reorderLevel: true },
    });
    if (!product || q(product.reorderLevel).lessThanOrEqualTo(0)) return;

    const total = await db.warehouseStock.aggregate({
      where: { productId },
      _sum: { quantity: true },
    });

    const onHand = q(total._sum.quantity ?? 0);
    if (onHand.lessThanOrEqualTo(q(product.reorderLevel))) {
      await notifyLowStock({
        productId: product.id,
        sku: product.sku,
        nameEn: product.nameEn,
        onHand: onHand.toString(),
        reorderLevel: product.reorderLevel.toString(),
      });
    }
  } catch {
    // Never let the alerting path break the movement that triggered it.
  }
}

/* ============================================================
   READ MODELS
   ============================================================ */

/** Total stock of a product across every warehouse. */
export async function stockOnHand(productId: string): Promise<Prisma.Decimal> {
  const result = await db.warehouseStock.aggregate({
    where: { productId },
    _sum: { quantity: true },
  });
  return q(result._sum.quantity ?? 0);
}

/** Stock of a product in one warehouse. */
export async function stockAt(warehouseId: string, productId: string): Promise<Prisma.Decimal> {
  const row = await db.warehouseStock.findUnique({
    where: { warehouseId_productId: { warehouseId, productId } },
    select: { quantity: true },
  });
  return q(row?.quantity ?? 0);
}

/**
 * The position of a product on a project.
 * `remaining` is what is still on site: delivered − returned − damaged.
 */
export function projectPosition(p: {
  allocated: Prisma.Decimal | number;
  delivered: Prisma.Decimal | number;
  returned: Prisma.Decimal | number;
  damaged: Prisma.Decimal | number;
}) {
  const allocated = q(p.allocated);
  const delivered = q(p.delivered);
  const returned = q(p.returned);
  const damaged = q(p.damaged);

  return {
    allocated,
    delivered,
    returned,
    damaged,
    /** Allocated but not yet physically delivered to site. */
    inTransit: q(allocated.minus(delivered)),
    /** Still on site and unaccounted for by a return or write-off. */
    remaining: q(delivered.minus(returned).minus(damaged)),
  };
}

/** The movement history of one product, newest first. */
export async function productLedger(
  productId: string,
  options: { warehouseId?: string; limit?: number } = {},
) {
  return db.inventoryTransaction.findMany({
    where: {
      productId,
      ...(options.warehouseId ? { warehouseId: options.warehouseId } : {}),
    },
    orderBy: { occurredAt: 'desc' },
    take: options.limit ?? 100,
    include: {
      warehouse: { select: { code: true, nameEn: true } },
      destinationWarehouse: { select: { code: true, nameEn: true } },
      project: { select: { code: true, nameEn: true } },
      performedBy: { select: { nameEn: true } },
    },
  });
}
