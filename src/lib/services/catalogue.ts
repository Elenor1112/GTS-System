import 'server-only';

import { Prisma } from '@prisma/client';

import { db } from '../db';
import { DomainError } from '../errors';
import { writeAudit, writeUpdateAudit } from './audit';
import { receiveStock } from './inventory';

/**
 * GTS — products and warehouses.
 *
 * The read side of the inventory system. All MOVEMENT lives in
 * `services/inventory.ts` — nothing here writes a stock level, because
 * stock is only ever changed by appending to the ledger.
 */

const D = (v: Prisma.Decimal | number | string | null | undefined) => new Prisma.Decimal(v ?? 0);

export class CatalogueError extends DomainError {}

export interface ActorRef {
  id: string;
  email: string;
}

/* ============================================================
   PRODUCTS
   ============================================================ */

export async function listProducts(options: {
  search?: string;
  categoryId?: string;
  vendorId?: string;
  warehouseId?: string;
  lowStockOnly?: boolean;
} = {}) {
  const products = await db.product.findMany({
    where: {
      deletedAt: null,
      ...(options.categoryId ? { categoryId: options.categoryId } : {}),
      ...(options.vendorId ? { vendorId: options.vendorId } : {}),
      ...(options.warehouseId
        ? { stock: { some: { warehouseId: options.warehouseId, quantity: { gt: 0 } } } }
        : {}),
      ...(options.search
        ? {
            OR: [
              { nameEn: { contains: options.search, mode: 'insensitive' } },
              { nameAr: { contains: options.search } },
              { sku: { contains: options.search, mode: 'insensitive' } },
              { brand: { contains: options.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: {
      id: true, sku: true, nameEn: true, nameAr: true, brand: true, unit: true,
      gpcCode: true, costPrice: true, salePrice: true, vatRate: true,
      reorderLevel: true, isActive: true,
      category: { select: { id: true, nameEn: true } },
      vendor: { select: { id: true, nameEn: true } },
      stock: { select: { quantity: true, reserved: true } },
    },
    orderBy: { nameEn: 'asc' },
  });

  const rows = products.map((p) => {
    const onHand = p.stock.reduce((sum, s) => sum.plus(D(s.quantity)), D(0));
    const reserved = p.stock.reduce((sum, s) => sum.plus(D(s.reserved)), D(0));
    return {
      ...p,
      onHand,
      reserved,
      /** Physically present and not promised to a project. */
      free: onHand.minus(reserved),
      isLow: D(p.reorderLevel).greaterThan(0) && onHand.lessThanOrEqualTo(D(p.reorderLevel)),
      /** Margin on the catalogue prices, as a percentage. */
      marginPct: D(p.salePrice).greaterThan(0)
        ? Math.round(
            D(p.salePrice).minus(D(p.costPrice)).dividedBy(D(p.salePrice)).times(100).toNumber(),
          )
        : null,
    };
  });

  return options.lowStockOnly ? rows.filter((r) => r.isLow) : rows;
}

export async function productDetail(productId: string) {
  const product = await db.product.findFirst({
    where: { id: productId, deletedAt: null },
    include: {
      category: { select: { id: true, nameEn: true } },
      vendor: { select: { id: true, code: true, nameEn: true } },
      stock: {
        select: {
          id: true, quantity: true, reserved: true, binLocation: true, updatedAt: true,
          warehouse: { select: { id: true, code: true, nameEn: true } },
        },
      },
      projectProducts: {
        select: {
          id: true, allocated: true, delivered: true, returned: true, damaged: true,
          project: { select: { id: true, code: true, nameEn: true, status: true } },
        },
      },
    },
  });

  if (!product) return null;

  const onHand = product.stock.reduce((sum, s) => sum.plus(D(s.quantity)), D(0));

  // The ledger, newest first — the answer to "where did it go".
  const movements = await db.inventoryTransaction.findMany({
    where: { productId },
    orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    take: 100,
    include: {
      warehouse: { select: { code: true, nameEn: true } },
      destinationWarehouse: { select: { code: true, nameEn: true } },
      project: { select: { code: true } },
      performedBy: { select: { nameEn: true } },
    },
  });

  return { ...product, onHand, movements };
}

export interface ProductInput {
  sku: string;
  nameEn: string;
  nameAr?: string | null;
  categoryId?: string | null;
  vendorId?: string | null;
  brand?: string | null;
  unit: string;
  gpcCode?: string | null;
  costPrice: number | string;
  salePrice: number | string;
  vatRate: number | string;
  reorderLevel: number | string;
  /** Where the product starts out. Create-only — see `createProduct`. */
  warehouseId?: string;
  openingQuantity?: number | string;
  binLocation?: string | null;
}

export async function createProduct(params: { actor: ActorRef; input: ProductInput }) {
  const { input, actor } = params;

  const clash = await db.product.findFirst({
    where: { deletedAt: null, sku: input.sku },
    select: { id: true },
  });
  if (clash) throw new CatalogueError('DUPLICATE', `SKU ${input.sku} is already in use.`);

  if (input.warehouseId) {
    const warehouse = await db.warehouse.findFirst({
      where: { id: input.warehouseId, deletedAt: null },
      select: { id: true },
    });
    if (!warehouse) throw new CatalogueError('NOT_FOUND', 'That warehouse does not exist.');
  }

  const product = await db.product.create({
    data: {
      sku: input.sku,
      nameEn: input.nameEn,
      nameAr: input.nameAr ?? null,
      categoryId: input.categoryId ?? null,
      vendorId: input.vendorId ?? null,
      brand: input.brand ?? null,
      unit: input.unit,
      gpcCode: input.gpcCode ?? null,
      costPrice: D(input.costPrice),
      salePrice: D(input.salePrice),
      vatRate: D(input.vatRate),
      reorderLevel: D(input.reorderLevel),
    },
  });

  await writeAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: 'CREATE',
    entityType: 'Product',
    entityId: product.id,
    summary: `Created product ${product.sku} — ${product.nameEn}`,
    afterState: { sku: product.sku, nameEn: product.nameEn },
  });

  // The opening quantity is a real inbound movement — it goes through
  // the ledger like any other receipt, not a direct stock write. A
  // product created with no quantity has no warehouse relationship yet;
  // `WarehouseStock` rows only ever come from a movement, never from a
  // bare "belongs to" assignment.
  const openingQuantity = D(input.openingQuantity ?? 0);
  if (input.warehouseId && openingQuantity.greaterThan(0)) {
    await receiveStock({
      actor,
      productId: product.id,
      warehouseId: input.warehouseId,
      quantity: openingQuantity,
      unitCost: D(input.costPrice),
      reference: 'Opening stock',
    });

    if (input.binLocation) {
      await db.warehouseStock.updateMany({
        where: { warehouseId: input.warehouseId, productId: product.id },
        data: { binLocation: input.binLocation },
      });
    }
  }

  return product;
}

export async function updateProduct(params: {
  actor: ActorRef;
  productId: string;
  input: Partial<ProductInput>;
}) {
  const before = await db.product.findFirst({
    where: { id: params.productId, deletedAt: null },
  });
  if (!before) throw new CatalogueError('NOT_FOUND', 'That product does not exist.');

  if (params.input.sku && params.input.sku !== before.sku) {
    const clash = await db.product.findFirst({
      where: { deletedAt: null, sku: params.input.sku, id: { not: params.productId } },
      select: { id: true },
    });
    if (clash) throw new CatalogueError('DUPLICATE', `SKU ${params.input.sku} is already in use.`);
  }

  const after = await db.product.update({
    where: { id: params.productId },
    data: {
      ...(params.input.sku !== undefined ? { sku: params.input.sku } : {}),
      ...(params.input.nameEn !== undefined ? { nameEn: params.input.nameEn } : {}),
      ...(params.input.nameAr !== undefined ? { nameAr: params.input.nameAr } : {}),
      ...(params.input.categoryId !== undefined ? { categoryId: params.input.categoryId } : {}),
      ...(params.input.vendorId !== undefined ? { vendorId: params.input.vendorId } : {}),
      ...(params.input.brand !== undefined ? { brand: params.input.brand } : {}),
      ...(params.input.unit !== undefined ? { unit: params.input.unit } : {}),
      ...(params.input.gpcCode !== undefined ? { gpcCode: params.input.gpcCode } : {}),
      ...(params.input.costPrice !== undefined ? { costPrice: D(params.input.costPrice) } : {}),
      ...(params.input.salePrice !== undefined ? { salePrice: D(params.input.salePrice) } : {}),
      ...(params.input.vatRate !== undefined ? { vatRate: D(params.input.vatRate) } : {}),
      ...(params.input.reorderLevel !== undefined ? { reorderLevel: D(params.input.reorderLevel) } : {}),
    },
  });

  await writeUpdateAudit({
    actorId: params.actor.id,
    actorEmail: params.actor.email,
    entityType: 'Product',
    entityId: after.id,
    summary: `Updated product ${after.sku}`,
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
  });

  return after;
}

/**
 * Archive a product.
 *
 * Refused while stock is on hand: a product with 400 bags in the depot
 * that no longer appears in the catalogue is stock nobody can issue,
 * which is worse than a cluttered list.
 */
export async function archiveProduct(params: { actor: ActorRef; productId: string }) {
  const product = await db.product.findFirst({
    where: { id: params.productId, deletedAt: null },
    select: {
      id: true, sku: true, nameEn: true,
      stock: { select: { quantity: true } },
    },
  });
  if (!product) throw new CatalogueError('NOT_FOUND', 'That product does not exist.');

  const onHand = product.stock.reduce((sum, s) => sum.plus(D(s.quantity)), D(0));
  if (onHand.greaterThan(0)) {
    throw new CatalogueError(
      'HAS_STOCK',
      `${product.nameEn} still has ${onHand.toString()} in stock. Issue or write it off before archiving.`,
    );
  }

  const archived = await db.product.update({
    where: { id: params.productId },
    data: { deletedAt: new Date(), isActive: false },
  });

  await writeAudit({
    actorId: params.actor.id,
    actorEmail: params.actor.email,
    action: 'DELETE',
    entityType: 'Product',
    entityId: archived.id,
    summary: `Archived product ${archived.sku}`,
  });

  return archived;
}

/* ============================================================
   WAREHOUSES
   ============================================================ */

export async function listWarehouses() {
  const warehouses = await db.warehouse.findMany({
    where: { deletedAt: null },
    select: {
      id: true, code: true, nameEn: true, nameAr: true,
      governorateCode: true, addressLine: true,
      latitude: true, longitude: true, capacityM3: true, isActive: true,
      stock: { select: { quantity: true, reserved: true } },
    },
    orderBy: { nameEn: 'asc' },
  });

  return warehouses.map((w) => {
    const lines = w.stock.filter((s) => D(s.quantity).greaterThan(0));
    return {
      ...w,
      distinctProducts: lines.length,
      totalUnits: w.stock.reduce((sum, s) => sum.plus(D(s.quantity)), D(0)),
      reservedUnits: w.stock.reduce((sum, s) => sum.plus(D(s.reserved)), D(0)),
    };
  });
}

export async function warehouseDetail(warehouseId: string) {
  const warehouse = await db.warehouse.findFirst({
    where: { id: warehouseId, deletedAt: null },
    include: {
      stock: {
        where: { quantity: { gt: 0 } },
        select: {
          id: true, quantity: true, reserved: true, binLocation: true, updatedAt: true,
          product: {
            select: {
              id: true, sku: true, nameEn: true, unit: true,
              costPrice: true, reorderLevel: true,
            },
          },
        },
        orderBy: { product: { nameEn: 'asc' } },
      },
    },
  });

  if (!warehouse) return null;

  const movements = await db.inventoryTransaction.findMany({
    where: { warehouseId },
    orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    take: 60,
    include: {
      product: { select: { id: true, sku: true, nameEn: true, unit: true } },
      destinationWarehouse: { select: { code: true } },
      project: { select: { code: true } },
      performedBy: { select: { nameEn: true } },
    },
  });

  /** Value at cost — what is standing in the building. */
  const valueAtCost = warehouse.stock.reduce(
    (sum, s) => sum.plus(D(s.quantity).times(D(s.product.costPrice))),
    D(0),
  );

  return { ...warehouse, movements, valueAtCost: valueAtCost.toDecimalPlaces(2) };
}

export interface WarehouseInput {
  code: string;
  nameEn: string;
  nameAr?: string | null;
  governorateCode?: number | null;
  addressLine?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  capacityM3?: number | null;
}

export async function createWarehouse(params: { actor: ActorRef; input: WarehouseInput }) {
  const { input, actor } = params;

  const clash = await db.warehouse.findFirst({
    where: { deletedAt: null, code: input.code },
    select: { id: true },
  });
  if (clash) throw new CatalogueError('DUPLICATE', `Warehouse code ${input.code} is already in use.`);

  const warehouse = await db.warehouse.create({
    data: {
      code: input.code,
      nameEn: input.nameEn,
      nameAr: input.nameAr ?? null,
      governorateCode: input.governorateCode ?? null,
      addressLine: input.addressLine ?? null,
      latitude: input.latitude != null ? D(input.latitude) : null,
      longitude: input.longitude != null ? D(input.longitude) : null,
      capacityM3: input.capacityM3 != null ? D(input.capacityM3) : null,
    },
  });

  await writeAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: 'CREATE',
    entityType: 'Warehouse',
    entityId: warehouse.id,
    summary: `Created warehouse ${warehouse.code} — ${warehouse.nameEn}`,
  });

  return warehouse;
}

export async function updateWarehouse(params: {
  actor: ActorRef;
  warehouseId: string;
  input: Partial<WarehouseInput>;
}) {
  const before = await db.warehouse.findFirst({
    where: { id: params.warehouseId, deletedAt: null },
  });
  if (!before) throw new CatalogueError('NOT_FOUND', 'That warehouse does not exist.');

  const after = await db.warehouse.update({
    where: { id: params.warehouseId },
    data: {
      ...(params.input.code !== undefined ? { code: params.input.code } : {}),
      ...(params.input.nameEn !== undefined ? { nameEn: params.input.nameEn } : {}),
      ...(params.input.nameAr !== undefined ? { nameAr: params.input.nameAr } : {}),
      ...(params.input.governorateCode !== undefined ? { governorateCode: params.input.governorateCode } : {}),
      ...(params.input.addressLine !== undefined ? { addressLine: params.input.addressLine } : {}),
      ...(params.input.latitude !== undefined
        ? { latitude: params.input.latitude != null ? D(params.input.latitude) : null }
        : {}),
      ...(params.input.longitude !== undefined
        ? { longitude: params.input.longitude != null ? D(params.input.longitude) : null }
        : {}),
      ...(params.input.capacityM3 !== undefined
        ? { capacityM3: params.input.capacityM3 != null ? D(params.input.capacityM3) : null }
        : {}),
    },
  });

  await writeUpdateAudit({
    actorId: params.actor.id,
    actorEmail: params.actor.email,
    entityType: 'Warehouse',
    entityId: after.id,
    summary: `Updated warehouse ${after.code}`,
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
  });

  return after;
}

/* ============================================================
   CATEGORIES
   ============================================================ */

export async function listCategories() {
  return db.productCategory.findMany({
    select: {
      id: true, nameEn: true, nameAr: true,
      _count: { select: { products: true } },
    },
    orderBy: { nameEn: 'asc' },
  });
}
