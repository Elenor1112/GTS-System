import 'server-only';

import { Prisma, type BillStatus, type BillDirection, type PaymentMethod } from '@prisma/client';

import { db, transaction, type Tx } from '../db';
import { writeAudit } from './audit';
import { nextRef } from './counters';
import { notifyBillPendingApproval, notifyBillApproved, notifyPaymentReceived } from './notifications';
import { WHT_THRESHOLD } from '../egypt';
import { DomainError } from '../errors';

/**
 * GTS — billing.
 *
 * THE RULE: the browser never supplies a total.
 *
 * A request may post line items — description, quantity, unit price, VAT
 * rate — and nothing else. Every derived figure (line net, line VAT,
 * subtotal, VAT, total, withholding) is computed here, in Decimal, and
 * written from this module's own arithmetic. A posted `total` field is
 * ignored, not validated: validating it would still mean trusting the
 * shape of a number the client chose.
 */

type Numeric = Prisma.Decimal | number | string;
const D = (v: Numeric) => new Prisma.Decimal(v);
/** Money rounds to piastres — 2 places, half-up, as an Egyptian
 *  invoice is quoted and as the ETA will re-derive it. */
const money = (v: Numeric) => D(v).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
const qty = (v: Numeric) => D(v).toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP);

export class BillingError extends DomainError {}

/* ============================================================
   THE TOTALS ENGINE
   ============================================================ */

export interface LineInput {
  productId?: string | null;
  descriptionEn: string;
  descriptionAr?: string | null;
  itemCode?: string | null;
  gpcCode?: string | null;
  quantity: Numeric;
  unit?: string;
  unitPrice: Numeric;
  discount?: Numeric;
  vatRate?: Numeric;
  sortOrder?: number;
}

export interface ComputedLine {
  descriptionEn: string;
  descriptionAr: string | null;
  itemCode: string | null;
  gpcCode: string | null;
  productId: string | null;
  quantity: Prisma.Decimal;
  unit: string;
  unitPrice: Prisma.Decimal;
  discount: Prisma.Decimal;
  vatRate: Prisma.Decimal;
  lineNet: Prisma.Decimal;
  lineVat: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  sortOrder: number;
}

export interface ComputedTotals {
  lines: ComputedLine[];
  subtotal: Prisma.Decimal;
  discount: Prisma.Decimal;
  net: Prisma.Decimal;
  vatAmount: Prisma.Decimal;
  total: Prisma.Decimal;
  whtRate: Prisma.Decimal;
  whtAmount: Prisma.Decimal;
  /** What actually reaches the bank: total − withholding. */
  netPayable: Prisma.Decimal;
}

/**
 * Compute every figure on a bill from its lines.
 *
 * VAT accumulates PER LINE rather than being applied to the net total,
 * because one document may mix 14% goods with zero-rated exports —
 * taxing the aggregate would silently overcharge the customer and
 * misstate the VAT return.
 *
 * This mirrors `computeTotals()` in lib/eta.ts, which the UI uses for
 * live preview. That one runs on floats for display; this one runs on
 * Decimal and is the only version whose output is ever persisted.
 */
export function computeBillTotals(lines: LineInput[], whtRate: Numeric = 0): ComputedTotals {
  if (lines.length === 0) {
    throw new BillingError('NO_LINES', 'A bill must carry at least one line item.');
  }

  const computed: ComputedLine[] = [];
  let subtotal = D(0);
  let discountTotal = D(0);
  let vatTotal = D(0);

  for (const [index, line] of lines.entries()) {
    const quantity = qty(line.quantity);
    const unitPrice = money(line.unitPrice);
    const discount = money(line.discount ?? 0);
    const vatRate = D(line.vatRate ?? 14);

    if (quantity.lessThanOrEqualTo(0)) {
      throw new BillingError('INVALID_QUANTITY', `Line ${index + 1}: quantity must be greater than zero.`);
    }
    if (unitPrice.isNegative()) {
      throw new BillingError('INVALID_PRICE', `Line ${index + 1}: unit price cannot be negative.`);
    }
    if (discount.isNegative()) {
      throw new BillingError('INVALID_DISCOUNT', `Line ${index + 1}: discount cannot be negative.`);
    }
    if (vatRate.isNegative() || vatRate.greaterThan(100)) {
      throw new BillingError('INVALID_VAT', `Line ${index + 1}: VAT rate must be between 0 and 100.`);
    }

    const lineGross = money(quantity.times(unitPrice));
    if (discount.greaterThan(lineGross)) {
      throw new BillingError(
        'DISCOUNT_EXCEEDS_LINE',
        `Line ${index + 1}: discount of ${discount} exceeds the line value of ${lineGross}.`,
      );
    }

    const lineNet = money(lineGross.minus(discount));
    const lineVat = money(lineNet.times(vatRate).dividedBy(100));
    const lineTotal = money(lineNet.plus(lineVat));

    subtotal = subtotal.plus(lineGross);
    discountTotal = discountTotal.plus(discount);
    vatTotal = vatTotal.plus(lineVat);

    computed.push({
      productId: line.productId ?? null,
      descriptionEn: line.descriptionEn,
      descriptionAr: line.descriptionAr ?? null,
      itemCode: line.itemCode ?? null,
      gpcCode: line.gpcCode ?? null,
      quantity,
      unit: line.unit ?? 'EA',
      unitPrice,
      discount,
      vatRate,
      lineNet,
      lineVat,
      lineTotal,
      sortOrder: line.sortOrder ?? index,
    });
  }

  subtotal = money(subtotal);
  discountTotal = money(discountTotal);
  const net = money(subtotal.minus(discountTotal));
  const vatAmount = money(vatTotal);
  const total = money(net.plus(vatAmount));

  // Withholding is computed on the PRE-VAT base and only once the
  // document clears the ETA threshold. It reduces the cash collected,
  // never the invoice total — so it is reported beside the total.
  const rate = D(whtRate);
  const whtAmount =
    rate.greaterThan(0) && total.greaterThanOrEqualTo(WHT_THRESHOLD)
      ? money(net.times(rate).dividedBy(100))
      : D(0);

  return {
    lines: computed,
    subtotal,
    discount: discountTotal,
    net,
    vatAmount,
    total,
    whtRate: rate,
    whtAmount,
    netPayable: money(total.minus(whtAmount)),
  };
}

/* ============================================================
   THE STATUS MACHINE
   ============================================================ */

/**
 * Which statuses may follow which.
 *
 * PAID, CANCELLED are terminal. PARTIALLY_PAID and PAID are reached by
 * recording a payment, never by a user choosing them from a menu — which
 * is why they are absent from most of these lists.
 */
const TRANSITIONS: Record<BillStatus, BillStatus[]> = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'DRAFT', 'CANCELLED'],
  APPROVED: ['SENT', 'CANCELLED'],
  SENT: ['PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'],
  PARTIALLY_PAID: ['PAID', 'OVERDUE', 'CANCELLED'],
  OVERDUE: ['PARTIALLY_PAID', 'PAID', 'CANCELLED'],
  PAID: [],
  CANCELLED: [],
};

export function canTransition(from: BillStatus, to: BillStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** A bill may only be edited while it is still a draft. */
export function isEditable(status: BillStatus): boolean {
  return status === 'DRAFT';
}

/* ============================================================
   CREATE / UPDATE
   ============================================================ */

export interface ActorRef {
  id: string;
  email: string;
}

export interface CreateBillInput {
  actor: ActorRef;
  direction: BillDirection;
  clientId?: string | null;
  vendorId?: string | null;
  projectId?: string | null;
  issuedOn: Date;
  /** Omitted: derived from the counterparty's agreed payment terms. */
  dueOn?: Date | null;
  currency?: string;
  exchangeRate?: Numeric | null;
  whtRate?: Numeric;
  notes?: string | null;
  lines: LineInput[];
}

export async function createBill(input: CreateBillInput) {
  const { actor } = input;

  if (input.direction === 'RECEIVABLE' && !input.clientId) {
    throw new BillingError('CLIENT_REQUIRED', 'A receivable must name the client it is issued to.');
  }
  if (input.direction === 'PAYABLE' && !input.vendorId) {
    throw new BillingError('VENDOR_REQUIRED', 'A payable must name the vendor it came from.');
  }
  if (input.clientId && input.vendorId) {
    throw new BillingError('AMBIGUOUS_COUNTERPARTY', 'A bill belongs to a client or a vendor, not both.');
  }

  const currency = input.currency ?? 'EGP';
  if (currency !== 'EGP' && !input.exchangeRate) {
    throw new BillingError(
      'EXCHANGE_RATE_REQUIRED',
      'A document not issued in EGP must carry the exchange rate used.',
    );
  }

  // Computed BEFORE the transaction opens: a validation failure should
  // not consume a bill number.
  const totals = computeBillTotals(input.lines, input.whtRate ?? 0);

  return transaction(async (tx) => {
    const counterparty = await resolveCounterparty(tx, input.clientId, input.vendorId);

    const dueOn = input.dueOn ?? addDays(input.issuedOn, counterparty.paymentTermsDays);
    if (dueOn < input.issuedOn) {
      throw new BillingError('DUE_BEFORE_ISSUE', 'The due date cannot fall before the issue date.');
    }

    if (input.projectId) {
      const project = await tx.project.findFirst({
        where: { id: input.projectId, deletedAt: null },
        select: { clientId: true, code: true },
      });
      if (!project) throw new BillingError('PROJECT_NOT_FOUND', 'That project does not exist.');
      // A receivable against a project must belong to that project's
      // client, or the client statement silently mixes counterparties.
      if (input.direction === 'RECEIVABLE' && project.clientId !== input.clientId) {
        throw new BillingError(
          'PROJECT_CLIENT_MISMATCH',
          `Project ${project.code} belongs to a different client.`,
        );
      }
    }

    const number = await nextRef(
      tx,
      input.direction === 'RECEIVABLE' ? 'bill_receivable' : 'bill_payable',
      input.issuedOn.getFullYear(),
    );

    const bill = await tx.electronicBill.create({
      data: {
        number,
        direction: input.direction,
        status: 'DRAFT',
        clientId: input.clientId ?? null,
        vendorId: input.vendorId ?? null,
        projectId: input.projectId ?? null,
        issuedOn: input.issuedOn,
        dueOn,
        currency,
        exchangeRate: input.exchangeRate != null ? D(input.exchangeRate) : null,
        subtotal: totals.subtotal,
        discount: totals.discount,
        net: totals.net,
        vatAmount: totals.vatAmount,
        total: totals.total,
        whtRate: totals.whtRate,
        whtAmount: totals.whtAmount,
        notes: input.notes ?? null,
        items: { create: totals.lines },
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    await writeAudit(
      {
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'CREATE',
        entityType: 'ElectronicBill',
        entityId: bill.id,
        summary: `Drafted ${number} for ${counterparty.nameEn}, ${currency} ${totals.total}`,
        afterState: {
          number,
          direction: input.direction,
          total: totals.total.toString(),
          lines: totals.lines.length,
        },
      },
      tx,
    );

    return bill;
  });
}

/** Replace a draft's lines and recompute every total from them. */
export async function updateBillLines(params: {
  actor: ActorRef;
  billId: string;
  lines: LineInput[];
  whtRate?: Numeric;
}) {
  const totals = computeBillTotals(params.lines, params.whtRate ?? 0);

  return transaction(async (tx) => {
    const bill = await tx.electronicBill.findFirst({
      where: { id: params.billId, deletedAt: null },
      select: { id: true, number: true, status: true, total: true, whtRate: true },
    });
    if (!bill) throw new BillingError('NOT_FOUND', 'That bill does not exist.');

    if (!isEditable(bill.status)) {
      throw new BillingError(
        'NOT_EDITABLE',
        `${bill.number} is ${bill.status.toLowerCase().replace('_', ' ')} and can no longer be edited.`,
        { status: bill.status },
      );
    }

    await tx.billItem.deleteMany({ where: { billId: bill.id } });

    const updated = await tx.electronicBill.update({
      where: { id: bill.id },
      data: {
        subtotal: totals.subtotal,
        discount: totals.discount,
        net: totals.net,
        vatAmount: totals.vatAmount,
        total: totals.total,
        whtRate: totals.whtRate,
        whtAmount: totals.whtAmount,
        items: { create: totals.lines },
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    await writeAudit(
      {
        actorId: params.actor.id,
        actorEmail: params.actor.email,
        action: 'UPDATE',
        entityType: 'ElectronicBill',
        entityId: bill.id,
        summary: `Edited lines on ${bill.number}`,
        beforeState: { total: bill.total.toString() },
        afterState: { total: totals.total.toString(), lines: totals.lines.length },
      },
      tx,
    );

    return updated;
  });
}

/* ============================================================
   WORKFLOW
   ============================================================ */

async function moveStatus(params: {
  actor: ActorRef;
  billId: string;
  to: BillStatus;
  action: string;
  note?: string | null;
  /** Extra guard run inside the transaction before the move. */
  precondition?: (bill: { id: string; number: string; status: BillStatus }, tx: Tx) => Promise<void>;
}) {
  return transaction(async (tx) => {
    // Locked so two approvers clicking at once cannot both transition it.
    const rows = await tx.$queryRaw<{ id: string; number: string; status: BillStatus }[]>`
      SELECT "id", "number", "status" FROM "electronic_bills"
      WHERE "id" = ${params.billId} AND "deletedAt" IS NULL
      FOR UPDATE
    `;
    const bill = rows[0];
    if (!bill) throw new BillingError('NOT_FOUND', 'That bill does not exist.');

    if (!canTransition(bill.status, params.to)) {
      throw new BillingError(
        'INVALID_TRANSITION',
        `${bill.number} is ${bill.status.toLowerCase().replace('_', ' ')}; it cannot move to ${params.to.toLowerCase().replace('_', ' ')}.`,
        { from: bill.status, to: params.to },
      );
    }

    await params.precondition?.(bill, tx);

    const updated = await tx.electronicBill.update({
      where: { id: bill.id },
      data: { status: params.to },
    });

    await tx.billApproval.create({
      data: {
        billId: bill.id,
        action: params.action,
        fromStatus: bill.status,
        toStatus: params.to,
        note: params.note ?? null,
        actorId: params.actor.id,
      },
    });

    await writeAudit(
      {
        actorId: params.actor.id,
        actorEmail: params.actor.email,
        action:
          params.to === 'APPROVED' ? 'APPROVE'
          : params.to === 'CANCELLED' ? 'CANCEL'
          : params.to === 'SENT' ? 'SEND'
          : params.action === 'REJECTED' ? 'REJECT'
          : 'UPDATE',
        entityType: 'ElectronicBill',
        entityId: bill.id,
        summary: `${bill.number}: ${bill.status} → ${params.to}${params.note ? ` (${params.note})` : ''}`,
        beforeState: { status: bill.status },
        afterState: { status: params.to },
      },
      tx,
    );

    return updated;
  });
}

/** Draft → awaiting approval. Refuses a document the ETA would reject. */
export async function submitForApproval(params: { actor: ActorRef; billId: string; note?: string }) {
  const bill = await moveStatus({
    ...params,
    to: 'PENDING_APPROVAL',
    action: 'SUBMITTED',
    precondition: async (b, tx) => {
      const problems = await validateBillForIssue(tx, b.id);
      if (problems.length > 0) {
        throw new BillingError('INCOMPLETE_DOCUMENT', problems.join(' '), { problems });
      }
    },
  });

  const counterparty = await counterpartyName(bill.clientId, bill.vendorId);
  await notifyBillPendingApproval({
    id: bill.id,
    number: bill.number,
    total: bill.total.toString(),
    counterparty,
  });

  return bill;
}

export async function approveBill(params: { actor: ActorRef; billId: string; note?: string }) {
  const bill = await moveStatus({ ...params, to: 'APPROVED', action: 'APPROVED' });
  await notifyBillApproved({ id: bill.id, number: bill.number });
  return bill;
}

export async function rejectBill(params: { actor: ActorRef; billId: string; note: string }) {
  if (!params.note?.trim()) {
    throw new BillingError('REASON_REQUIRED', 'Rejecting a bill must say why.');
  }
  return moveStatus({ ...params, to: 'DRAFT', action: 'REJECTED' });
}

export async function sendBill(params: { actor: ActorRef; billId: string; note?: string }) {
  return moveStatus({ ...params, to: 'SENT', action: 'SENT' });
}

export async function cancelBill(params: { actor: ActorRef; billId: string; note: string }) {
  if (!params.note?.trim()) {
    throw new BillingError('REASON_REQUIRED', 'Cancelling a bill must say why.');
  }
  return moveStatus({
    ...params,
    to: 'CANCELLED',
    action: 'CANCELLED',
    precondition: async (b, tx) => {
      // Cancelling a bill that has taken money would strand the payment.
      const paid = await tx.payment.aggregate({ where: { billId: b.id }, _sum: { amount: true } });
      if (paid._sum.amount && D(paid._sum.amount).greaterThan(0)) {
        throw new BillingError(
          'HAS_PAYMENTS',
          `${b.number} has payments recorded against it. Reverse them before cancelling.`,
        );
      }
    },
  });
}

/* ============================================================
   PAYMENTS
   ============================================================ */

export async function recordPayment(params: {
  actor: ActorRef;
  billId: string;
  amount: Numeric;
  whtDeducted?: Numeric;
  method?: PaymentMethod;
  reference?: string | null;
  notes?: string | null;
  receivedOn: Date;
}) {
  const amount = money(params.amount);
  const wht = money(params.whtDeducted ?? 0);

  if (amount.lessThanOrEqualTo(0)) {
    throw new BillingError('INVALID_AMOUNT', 'A payment must be greater than zero.');
  }
  if (wht.isNegative()) {
    throw new BillingError('INVALID_WHT', 'Withholding cannot be negative.');
  }

  const result = await transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      {
        id: string; number: string; status: BillStatus; total: Prisma.Decimal;
        paidAmount: Prisma.Decimal; whtAmount: Prisma.Decimal;
        clientId: string | null; vendorId: string | null;
      }[]
    >`
      SELECT "id","number","status","total","paidAmount","whtAmount","clientId","vendorId"
      FROM "electronic_bills"
      WHERE "id" = ${params.billId} AND "deletedAt" IS NULL
      FOR UPDATE
    `;
    const bill = rows[0];
    if (!bill) throw new BillingError('NOT_FOUND', 'That bill does not exist.');

    if (bill.status === 'DRAFT' || bill.status === 'PENDING_APPROVAL') {
      throw new BillingError(
        'NOT_PAYABLE',
        `${bill.number} has not been approved yet; a payment cannot be recorded against it.`,
      );
    }
    if (bill.status === 'CANCELLED') {
      throw new BillingError('CANCELLED', `${bill.number} is cancelled.`);
    }

    // Withholding was already deducted from what the buyer owes in cash,
    // so the collectable figure is total − WHT.
    const collectable = money(D(bill.total).minus(D(bill.whtAmount)));
    const alreadyPaid = money(bill.paidAmount);
    const outstanding = money(collectable.minus(alreadyPaid));

    if (amount.greaterThan(outstanding)) {
      throw new BillingError(
        'OVERPAYMENT',
        `${bill.number} has only ${outstanding} outstanding; ${amount} would overpay it.`,
        { outstanding: outstanding.toString(), attempted: amount.toString() },
      );
    }

    const ref = await nextRef(tx, 'payment', params.receivedOn.getFullYear());

    const payment = await tx.payment.create({
      data: {
        ref,
        billId: bill.id,
        clientId: bill.clientId,
        vendorId: bill.vendorId,
        amount,
        whtDeducted: wht,
        method: params.method ?? 'BANK_TRANSFER',
        reference: params.reference ?? null,
        notes: params.notes ?? null,
        receivedOn: params.receivedOn,
        recordedById: params.actor.id,
      },
    });

    const newPaid = money(alreadyPaid.plus(amount));
    // Fully settled when the collectable figure is met — not the gross
    // total, which the buyer never owed in cash.
    const nowPaid = newPaid.greaterThanOrEqualTo(collectable);

    const updated = await tx.electronicBill.update({
      where: { id: bill.id },
      data: {
        paidAmount: newPaid,
        status: nowPaid ? 'PAID' : 'PARTIALLY_PAID',
      },
    });

    await writeAudit(
      {
        actorId: params.actor.id,
        actorEmail: params.actor.email,
        action: 'PAYMENT',
        entityType: 'Payment',
        entityId: payment.id,
        summary: `${ref}: ${amount} against ${bill.number}`,
        beforeState: { paidAmount: alreadyPaid.toString(), status: bill.status },
        afterState: { paidAmount: newPaid.toString(), status: updated.status },
      },
      tx,
    );

    return { payment, bill: updated };
  });

  const counterparty = await counterpartyName(result.bill.clientId, result.bill.vendorId);
  await notifyPaymentReceived({
    id: result.payment.id,
    ref: result.payment.ref,
    amount: amount.toString(),
    counterparty,
    billNumber: result.bill.number,
  });

  return result;
}

/* ============================================================
   OVERDUE SWEEP
   ============================================================ */

/**
 * Mark sent and partially-paid bills overdue once their due date passes.
 *
 * A scheduled job, not something a page render triggers — a status that
 * changes as a side effect of somebody opening a screen is a status
 * nobody can reason about.
 */
export async function markOverdueBills(): Promise<number> {
  const todayCairo = cairoDate(new Date());

  // Resolved once, outside the loop: the acting user is the same for
  // every bill in the sweep, and an empty string here would violate the
  // foreign key rather than failing usefully.
  const systemActor = await db.user.findFirst({
    where: { role: { key: 'admin' }, isActive: true, deletedAt: null },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!systemActor) {
    console.warn('[billing] overdue sweep skipped: no active administrator to attribute it to.');
    return 0;
  }

  const due = await db.electronicBill.findMany({
    where: {
      deletedAt: null,
      status: { in: ['SENT', 'PARTIALLY_PAID'] },
      dueOn: { lt: todayCairo },
    },
    select: { id: true, number: true, status: true },
  });

  for (const bill of due) {
    await transaction(async (tx) => {
      await tx.electronicBill.update({ where: { id: bill.id }, data: { status: 'OVERDUE' } });
      await tx.billApproval.create({
        data: {
          billId: bill.id,
          action: 'OVERDUE',
          fromStatus: bill.status,
          toStatus: 'OVERDUE',
          note: 'Due date passed',
          actorId: systemActor.id,
        },
      });
    });
  }

  return due.length;
}

/* ============================================================
   VALIDATION
   ============================================================ */

/**
 * The ETA's mandatory fields, checked before a document may leave DRAFT.
 *
 * Runs against the persisted bill so it validates what will actually be
 * issued, not what a form believed it was submitting.
 */
export async function validateBillForIssue(tx: Tx, billId: string): Promise<string[]> {
  const bill = await tx.electronicBill.findUnique({
    where: { id: billId },
    include: {
      items: true,
      client: { select: { nameEn: true, trn: true } },
      vendor: { select: { nameEn: true, trn: true } },
    },
  });
  if (!bill) return ['That bill does not exist.'];

  const problems: string[] = [];
  const trn = /^\d{9}$/;

  const counterparty = bill.client ?? bill.vendor;
  if (!counterparty) {
    problems.push('The bill names no client or vendor.');
  } else if (!counterparty.trn || !trn.test(counterparty.trn.replace(/\D/g, ''))) {
    problems.push(`${counterparty.nameEn} has no valid 9-digit tax registration number.`);
  }

  if (bill.items.length === 0) {
    problems.push('A document must carry at least one line item.');
  }
  if (bill.currency !== 'EGP' && !bill.exchangeRate) {
    problems.push('An exchange rate is required for documents not issued in EGP.');
  }
  if (bill.dueOn < bill.issuedOn) {
    problems.push('The due date falls before the issue date.');
  }
  for (const item of bill.items) {
    if (!item.gpcCode) {
      problems.push(`"${item.descriptionEn}" is missing its GPC/EGS item code.`);
    }
  }

  return problems;
}

/* ============================================================
   HELPERS
   ============================================================ */

async function resolveCounterparty(tx: Tx, clientId?: string | null, vendorId?: string | null) {
  if (clientId) {
    const client = await tx.client.findFirst({
      where: { id: clientId, deletedAt: null },
      select: { nameEn: true, paymentTermsDays: true },
    });
    if (!client) throw new BillingError('CLIENT_NOT_FOUND', 'That client does not exist.');
    return client;
  }
  const vendor = await tx.vendor.findFirst({
    where: { id: vendorId!, deletedAt: null },
    select: { nameEn: true, paymentTermsDays: true },
  });
  if (!vendor) throw new BillingError('VENDOR_NOT_FOUND', 'That vendor does not exist.');
  return vendor;
}

async function counterpartyName(clientId: string | null, vendorId: string | null): Promise<string> {
  if (clientId) {
    const c = await db.client.findUnique({ where: { id: clientId }, select: { nameEn: true } });
    return c?.nameEn ?? 'Unknown client';
  }
  if (vendorId) {
    const v = await db.vendor.findUnique({ where: { id: vendorId }, select: { nameEn: true } });
    return v?.nameEn ?? 'Unknown vendor';
  }
  return 'Unknown';
}


function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Today's date in Africa/Cairo, as a DATE-comparable midnight UTC. */
export function cairoDate(at: Date): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
  return new Date(`${parts}T00:00:00.000Z`);
}

/** What is still collectable on a bill. */
export function outstandingOf(bill: {
  total: Prisma.Decimal | number;
  whtAmount: Prisma.Decimal | number;
  paidAmount: Prisma.Decimal | number;
}): Prisma.Decimal {
  return money(D(bill.total).minus(D(bill.whtAmount)).minus(D(bill.paidAmount)));
}
