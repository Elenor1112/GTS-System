import 'server-only';

import { Prisma } from '@prisma/client';

import { db } from '../db';
import { DomainError } from '../errors';
import { writeAudit, writeUpdateAudit } from './audit';

/**
 * GTS — vendors.
 *
 * The mirror of clients: the same shape of relationship seen from the
 * other side. What they supplied, what we sent back, what they billed
 * us, what we have paid, and what is still owed.
 */

const D = (v: Prisma.Decimal | number | string | null | undefined) => new Prisma.Decimal(v ?? 0);

export class VendorError extends DomainError {}

export interface ActorRef {
  id: string;
  email: string;
}

/* ============================================================
   LIST
   ============================================================ */

export async function listVendors(options: {
  search?: string;
  includeArchived?: boolean;
} = {}) {
  const rows = await db.vendor.findMany({
    where: {
      ...(options.includeArchived ? {} : { deletedAt: null }),
      ...(options.search
        ? {
            OR: [
              { nameEn: { contains: options.search, mode: 'insensitive' } },
              { nameAr: { contains: options.search } },
              { code: { contains: options.search, mode: 'insensitive' } },
              { trn: { contains: options.search } },
            ],
          }
        : {}),
    },
    select: {
      id: true, code: true, nameEn: true, nameAr: true, trn: true,
      governorateCode: true, contactName: true, contactPhone: true, isActive: true,
      _count: { select: { products: true } },
      bills: {
        where: { deletedAt: null, status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] } },
        select: { total: true, whtAmount: true, paidAmount: true, status: true },
      },
    },
    orderBy: { nameEn: 'asc' },
  });

  return rows.map((v) => {
    let outstanding = D(0);
    let overdue = D(0);
    for (const bill of v.bills) {
      const due = D(bill.total).minus(D(bill.whtAmount)).minus(D(bill.paidAmount));
      if (due.lessThanOrEqualTo(0)) continue;
      outstanding = outstanding.plus(due);
      if (bill.status === 'OVERDUE') overdue = overdue.plus(due);
    }
    return {
      id: v.id, code: v.code, nameEn: v.nameEn, nameAr: v.nameAr, trn: v.trn,
      governorateCode: v.governorateCode, contactName: v.contactName,
      contactPhone: v.contactPhone, isActive: v.isActive,
      productCount: v._count.products,
      outstanding: outstanding.toDecimalPlaces(2),
      overdue: overdue.toDecimalPlaces(2),
    };
  });
}

/* ============================================================
   DETAIL
   ============================================================ */

export async function vendorDetail(vendorId: string) {
  const vendor = await db.vendor.findFirst({
    where: { id: vendorId, deletedAt: null },
    include: {
      products: {
        where: { deletedAt: null },
        select: {
          id: true, sku: true, nameEn: true, unit: true,
          costPrice: true, salePrice: true, reorderLevel: true,
          stock: { select: { quantity: true } },
        },
        orderBy: { nameEn: 'asc' },
      },
      bills: {
        where: { deletedAt: null },
        select: {
          id: true, number: true, status: true, issuedOn: true, dueOn: true,
          total: true, whtAmount: true, paidAmount: true, currency: true,
        },
        orderBy: { issuedOn: 'desc' },
      },
      payments: {
        select: {
          id: true, ref: true, amount: true, whtDeducted: true,
          method: true, receivedOn: true, reference: true,
          bill: { select: { number: true } },
        },
        orderBy: { receivedOn: 'desc' },
        take: 50,
      },
      documents: {
        where: { deletedAt: null },
        select: { id: true, filename: true, mimeType: true, sizeBytes: true, createdAt: true },
      },
    },
  });

  if (!vendor) return null;

  /* ---- What this vendor has supplied, and what went back ---- */
  const movements = await db.vendorProductTransaction.groupBy({
    by: ['productId', 'direction'],
    where: { vendorId },
    _sum: { quantity: true },
  });

  const productIds = [...new Set(movements.map((m) => m.productId))];
  const products = productIds.length
    ? await db.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, sku: true, nameEn: true, unit: true },
      })
    : [];
  const byId = new Map(products.map((p) => [p.id, p]));

  const supply = new Map<string, { received: Prisma.Decimal; returned: Prisma.Decimal }>();
  for (const row of movements) {
    const entry = supply.get(row.productId) ?? { received: D(0), returned: D(0) };
    const qty = D(row._sum.quantity);
    if (row.direction === 'RECEIVED') entry.received = entry.received.plus(qty);
    else entry.returned = entry.returned.plus(qty);
    supply.set(row.productId, entry);
  }

  const supplied = [...supply.entries()]
    .map(([productId, position]) => {
      const product = byId.get(productId);
      if (!product) return null;
      return {
        productId,
        sku: product.sku,
        nameEn: product.nameEn,
        unit: product.unit,
        received: position.received,
        returned: position.returned,
        net: position.received.minus(position.returned),
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .sort((a, b) => b.received.comparedTo(a.received));

  /** Stock currently held of each product this vendor supplies. */
  const catalogue = vendor.products.map((product) => ({
    ...product,
    onHand: product.stock.reduce((sum, s) => sum.plus(D(s.quantity)), D(0)),
  }));

  return { ...vendor, supplied, catalogue };
}

/* ============================================================
   MUTATIONS
   ============================================================ */

export interface VendorInput {
  code: string;
  nameEn: string;
  nameAr?: string | null;
  trn?: string | null;
  commercialRegNo?: string | null;
  governorateCode?: number | null;
  addressLine?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  paymentTermsDays?: number;
  notes?: string | null;
}

export async function createVendor(params: { actor: ActorRef; input: VendorInput }) {
  const { input, actor } = params;

  const clash = await db.vendor.findFirst({
    where: {
      deletedAt: null,
      OR: [{ code: input.code }, ...(input.trn ? [{ trn: input.trn }] : [])],
    },
    select: { code: true, trn: true },
  });
  if (clash) {
    throw new VendorError(
      'DUPLICATE',
      clash.code === input.code
        ? `Vendor code ${input.code} is already in use.`
        : `Another vendor is already registered with tax number ${input.trn}.`,
    );
  }

  const vendor = await db.vendor.create({
    data: {
      code: input.code,
      nameEn: input.nameEn,
      nameAr: input.nameAr ?? null,
      trn: input.trn ?? null,
      commercialRegNo: input.commercialRegNo ?? null,
      governorateCode: input.governorateCode ?? null,
      addressLine: input.addressLine ?? null,
      contactName: input.contactName ?? null,
      contactPhone: input.contactPhone ?? null,
      contactEmail: input.contactEmail ?? null,
      paymentTermsDays: input.paymentTermsDays ?? 30,
      notes: input.notes ?? null,
    },
  });

  await writeAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: 'CREATE',
    entityType: 'Vendor',
    entityId: vendor.id,
    summary: `Created vendor ${vendor.code} — ${vendor.nameEn}`,
    afterState: { code: vendor.code, nameEn: vendor.nameEn, trn: vendor.trn },
  });

  return vendor;
}

export async function updateVendor(params: {
  actor: ActorRef;
  vendorId: string;
  input: Partial<VendorInput>;
}) {
  const before = await db.vendor.findFirst({
    where: { id: params.vendorId, deletedAt: null },
  });
  if (!before) throw new VendorError('NOT_FOUND', 'That vendor does not exist.');

  if (params.input.code && params.input.code !== before.code) {
    const clash = await db.vendor.findFirst({
      where: { deletedAt: null, code: params.input.code, id: { not: params.vendorId } },
      select: { id: true },
    });
    if (clash) throw new VendorError('DUPLICATE', `Vendor code ${params.input.code} is already in use.`);
  }

  const after = await db.vendor.update({
    where: { id: params.vendorId },
    data: {
      ...(params.input.code !== undefined ? { code: params.input.code } : {}),
      ...(params.input.nameEn !== undefined ? { nameEn: params.input.nameEn } : {}),
      ...(params.input.nameAr !== undefined ? { nameAr: params.input.nameAr } : {}),
      ...(params.input.trn !== undefined ? { trn: params.input.trn } : {}),
      ...(params.input.commercialRegNo !== undefined ? { commercialRegNo: params.input.commercialRegNo } : {}),
      ...(params.input.governorateCode !== undefined ? { governorateCode: params.input.governorateCode } : {}),
      ...(params.input.addressLine !== undefined ? { addressLine: params.input.addressLine } : {}),
      ...(params.input.contactName !== undefined ? { contactName: params.input.contactName } : {}),
      ...(params.input.contactPhone !== undefined ? { contactPhone: params.input.contactPhone } : {}),
      ...(params.input.contactEmail !== undefined ? { contactEmail: params.input.contactEmail } : {}),
      ...(params.input.paymentTermsDays !== undefined ? { paymentTermsDays: params.input.paymentTermsDays } : {}),
      ...(params.input.notes !== undefined ? { notes: params.input.notes } : {}),
    },
  });

  await writeUpdateAudit({
    actorId: params.actor.id,
    actorEmail: params.actor.email,
    entityType: 'Vendor',
    entityId: after.id,
    summary: `Updated vendor ${after.code}`,
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
  });

  return after;
}

export async function archiveVendor(params: { actor: ActorRef; vendorId: string }) {
  const vendor = await db.vendor.findFirst({
    where: { id: params.vendorId, deletedAt: null },
    select: {
      id: true, code: true, nameEn: true,
      bills: {
        where: { deletedAt: null, status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] } },
        select: { number: true },
      },
      products: { where: { deletedAt: null }, select: { sku: true } },
    },
  });
  if (!vendor) throw new VendorError('NOT_FOUND', 'That vendor does not exist.');

  if (vendor.bills.length > 0) {
    throw new VendorError(
      'HAS_OPEN_BILLS',
      `${vendor.nameEn} has ${vendor.bills.length} unpaid bill${vendor.bills.length === 1 ? '' : 's'}. Settle them first.`,
    );
  }

  // Products keep working — `vendorId` is SetNull — but flagging it means
  // nobody archives a supplier and then wonders why the catalogue lost
  // its source of supply.
  const archived = await db.vendor.update({
    where: { id: params.vendorId },
    data: { deletedAt: new Date(), isActive: false },
  });

  await writeAudit({
    actorId: params.actor.id,
    actorEmail: params.actor.email,
    action: 'DELETE',
    entityType: 'Vendor',
    entityId: archived.id,
    summary: `Archived vendor ${archived.code} — ${archived.nameEn}${
      vendor.products.length ? ` (${vendor.products.length} products keep their record)` : ''
    }`,
  });

  return archived;
}
