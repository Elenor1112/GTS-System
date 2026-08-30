import 'server-only';

import { Prisma } from '@prisma/client';

import { db, transaction, type DbClient } from '../db';
import { writeAudit, writeUpdateAudit } from './audit';
import { nextCode } from './counters';
import { DomainError } from '../errors';

/**
 * GTS — clients.
 *
 * CRUD, but not only CRUD: `clientDetail` assembles the whole
 * relationship — projects, goods movements, bills, payments, balance and
 * activity — because that is the question a person actually opens a
 * client record to answer.
 */

const D = (v: Prisma.Decimal | number | string | null | undefined) => new Prisma.Decimal(v ?? 0);

export class ClientError extends DomainError {}

export interface ActorRef {
  id: string;
  email: string;
}

/* ============================================================
   LIST
   ============================================================ */

export interface ClientListItem {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string | null;
  trn: string | null;
  governorateCode: number | null;
  contactName: string | null;
  contactPhone: string | null;
  isActive: boolean;
  projectCount: number;
  outstanding: Prisma.Decimal;
  overdue: Prisma.Decimal;
}

export async function listClients(options: {
  search?: string;
  includeArchived?: boolean;
  governorateCode?: number;
} = {}): Promise<ClientListItem[]> {
  const rows = await db.client.findMany({
    where: {
      ...(options.includeArchived ? {} : { deletedAt: null }),
      ...(options.governorateCode ? { governorateCode: options.governorateCode } : {}),
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
      _count: { select: { projects: true } },
      bills: {
        where: {
          deletedAt: null,
          status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] },
        },
        select: { total: true, whtAmount: true, paidAmount: true, status: true },
      },
    },
    orderBy: { nameEn: 'asc' },
  });

  return rows.map((c) => {
    let outstanding = D(0);
    let overdue = D(0);
    for (const bill of c.bills) {
      const due = D(bill.total).minus(D(bill.whtAmount)).minus(D(bill.paidAmount));
      if (due.lessThanOrEqualTo(0)) continue;
      outstanding = outstanding.plus(due);
      if (bill.status === 'OVERDUE') overdue = overdue.plus(due);
    }
    return {
      id: c.id, code: c.code, nameEn: c.nameEn, nameAr: c.nameAr, trn: c.trn,
      governorateCode: c.governorateCode, contactName: c.contactName,
      contactPhone: c.contactPhone, isActive: c.isActive,
      projectCount: c._count.projects,
      outstanding: outstanding.toDecimalPlaces(2),
      overdue: overdue.toDecimalPlaces(2),
    };
  });
}

/* ============================================================
   DETAIL — the whole relationship
   ============================================================ */

export async function clientDetail(clientId: string) {
  const client = await db.client.findFirst({
    where: { id: clientId, deletedAt: null },
    include: {
      projects: {
        where: { deletedAt: null },
        select: {
          id: true, code: true, nameEn: true, status: true, budget: true,
          startsOn: true, endsOn: true,
          location: { select: { addressLine: true, latitude: true, longitude: true } },
          _count: { select: { employees: true, products: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      bills: {
        where: { deletedAt: null },
        select: {
          id: true, number: true, status: true, issuedOn: true, dueOn: true,
          total: true, whtAmount: true, paidAmount: true, currency: true,
          project: { select: { code: true } },
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

  if (!client) return null;

  /* ---- Goods received, returned and damaged, by product ---- */
  const goods = await db.clientProductTransaction.groupBy({
    by: ['productId', 'direction'],
    where: { clientId },
    _sum: { quantity: true },
  });

  const productIds = [...new Set(goods.map((g) => g.productId))];
  const products = productIds.length
    ? await db.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, sku: true, nameEn: true, unit: true, salePrice: true },
      })
    : [];
  const productById = new Map(products.map((p) => [p.id, p]));

  const goodsByProduct = new Map<
    string,
    { delivered: Prisma.Decimal; returned: Prisma.Decimal; damaged: Prisma.Decimal }
  >();
  for (const row of goods) {
    const entry = goodsByProduct.get(row.productId) ?? {
      delivered: D(0), returned: D(0), damaged: D(0),
    };
    const qty = D(row._sum.quantity);
    if (row.direction === 'DELIVERED') entry.delivered = entry.delivered.plus(qty);
    else if (row.direction === 'RETURNED') entry.returned = entry.returned.plus(qty);
    else if (row.direction === 'DAMAGED') entry.damaged = entry.damaged.plus(qty);
    goodsByProduct.set(row.productId, entry);
  }

  const productPositions = [...goodsByProduct.entries()]
    .map(([productId, position]) => {
      const product = productById.get(productId);
      if (!product) return null;
      return {
        productId,
        sku: product.sku,
        nameEn: product.nameEn,
        unit: product.unit,
        delivered: position.delivered,
        returned: position.returned,
        damaged: position.damaged,
        /** Still with the client: delivered − returned − damaged. */
        retained: position.delivered.minus(position.returned).minus(position.damaged),
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .sort((a, b) => b.delivered.comparedTo(a.delivered));

  return { ...client, productPositions };
}

/* ============================================================
   MUTATIONS
   ============================================================ */

export interface ClientInput {
  /** Omitted on create — the server assigns the next CL-0001-style code. */
  code?: string;
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
  creditLimit?: number | string;
  notes?: string | null;
}

export async function createClient(params: { actor: ActorRef; input: ClientInput }) {
  const { input, actor } = params;

  // A TRN clash is still worth a friendly message before we touch the
  // counter — the code itself is server-assigned and cannot clash.
  if (input.trn) {
    const clash = await db.client.findFirst({
      where: { deletedAt: null, trn: input.trn },
      select: { trn: true },
    });
    if (clash) {
      throw new ClientError('DUPLICATE', `Another client is already registered with tax number ${input.trn}.`);
    }
  }

  const client = await transaction(async (tx) => {
    const code = input.code ?? (await nextCode(tx, 'client'));
    return tx.client.create({
      data: {
        code,
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
        creditLimit: D(input.creditLimit ?? 0),
        notes: input.notes ?? null,
      },
    });
  });

  await writeAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: 'CREATE',
    entityType: 'Client',
    entityId: client.id,
    summary: `Created client ${client.code} — ${client.nameEn}`,
    afterState: { code: client.code, nameEn: client.nameEn, trn: client.trn },
  });

  return client;
}

export async function updateClient(params: {
  actor: ActorRef;
  clientId: string;
  input: Partial<ClientInput>;
}) {
  const before = await db.client.findFirst({
    where: { id: params.clientId, deletedAt: null },
  });
  if (!before) throw new ClientError('NOT_FOUND', 'That client does not exist.');

  if (params.input.code && params.input.code !== before.code) {
    const clash = await db.client.findFirst({
      where: { deletedAt: null, code: params.input.code, id: { not: params.clientId } },
      select: { id: true },
    });
    if (clash) throw new ClientError('DUPLICATE', `Client code ${params.input.code} is already in use.`);
  }

  const after = await db.client.update({
    where: { id: params.clientId },
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
      ...(params.input.creditLimit !== undefined ? { creditLimit: D(params.input.creditLimit) } : {}),
      ...(params.input.notes !== undefined ? { notes: params.input.notes } : {}),
    },
  });

  await writeUpdateAudit({
    actorId: params.actor.id,
    actorEmail: params.actor.email,
    entityType: 'Client',
    entityId: after.id,
    summary: `Updated client ${after.code}`,
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
  });

  return after;
}

/**
 * Archive a client.
 *
 * Soft deletion, always: a client with bills is part of the tax record,
 * and the partial unique index means their code becomes reusable without
 * the history being destroyed. A client with live projects is refused —
 * archiving them would orphan work that is still happening.
 */
export async function archiveClient(params: { actor: ActorRef; clientId: string }) {
  const client = await db.client.findFirst({
    where: { id: params.clientId, deletedAt: null },
    select: {
      id: true, code: true, nameEn: true,
      projects: {
        where: { deletedAt: null, status: { in: ['ACTIVE', 'PLANNING'] } },
        select: { code: true },
      },
      bills: {
        where: { deletedAt: null, status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] } },
        select: { number: true },
      },
    },
  });
  if (!client) throw new ClientError('NOT_FOUND', 'That client does not exist.');

  if (client.projects.length > 0) {
    throw new ClientError(
      'HAS_LIVE_PROJECTS',
      `${client.nameEn} still has ${client.projects.length} live project${client.projects.length === 1 ? '' : 's'} (${client.projects.map((p) => p.code).join(', ')}). Close them first.`,
    );
  }
  if (client.bills.length > 0) {
    throw new ClientError(
      'HAS_OPEN_BILLS',
      `${client.nameEn} has ${client.bills.length} unpaid bill${client.bills.length === 1 ? '' : 's'}. Settle or cancel them first.`,
    );
  }

  const archived = await db.client.update({
    where: { id: params.clientId },
    data: { deletedAt: new Date(), isActive: false },
  });

  await writeAudit({
    actorId: params.actor.id,
    actorEmail: params.actor.email,
    action: 'DELETE',
    entityType: 'Client',
    entityId: archived.id,
    summary: `Archived client ${archived.code} — ${archived.nameEn}`,
    beforeState: { isActive: true, deletedAt: null },
    afterState: { isActive: false, deletedAt: archived.deletedAt },
  });

  return archived;
}

export async function restoreClient(params: { actor: ActorRef; clientId: string }) {
  const client = await db.client.findUnique({ where: { id: params.clientId } });
  if (!client) throw new ClientError('NOT_FOUND', 'That client does not exist.');
  if (!client.deletedAt) return client;

  // Their code may have been taken by a new client while they were away.
  const clash = await db.client.findFirst({
    where: { deletedAt: null, code: client.code },
    select: { id: true },
  });
  if (clash) {
    throw new ClientError(
      'CODE_TAKEN',
      `Client code ${client.code} has been reassigned. Give this record a new code before restoring it.`,
    );
  }

  const restored = await db.client.update({
    where: { id: params.clientId },
    data: { deletedAt: null, isActive: true },
  });

  await writeAudit({
    actorId: params.actor.id,
    actorEmail: params.actor.email,
    action: 'RESTORE',
    entityType: 'Client',
    entityId: restored.id,
    summary: `Restored client ${restored.code}`,
  });

  return restored;
}
