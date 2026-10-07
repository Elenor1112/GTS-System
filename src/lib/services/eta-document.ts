import 'server-only';

import { Prisma } from '@prisma/client';

import { governorate } from '../egypt';
import { itemType, vatSubType, type ReceiverType } from '../eta-rules';

export { itemType, vatSubType };

/**
 * GTS — the ETA document.
 *
 * Turns a persisted bill into the JSON the ETA's documentsubmissions
 * endpoint accepts. Pure: no database, no network, so the shape and the
 * arithmetic are testable on their own.
 *
 * It reads the server-computed line figures (lineNet, lineVat) rather
 * than recomputing them, so the document the ETA receives carries the
 * same numbers as the bill the client was shown. The only arithmetic
 * here is the conversion to EGP, which the ETA requires for every amount
 * on a foreign-currency document.
 *
 * VERSION: "0.9" is the unsigned format the pre-production environment
 * accepts. Production requires "1.0" with a CAdES-BES signature from the
 * taxpayer's e-seal; `signEtaDocument` is where that will plug in.
 */

type Numeric = Prisma.Decimal | number | string;
const D = (v: Numeric) => new Prisma.Decimal(v);
/** The ETA works to 5 decimal places. */
const r5 = (v: Prisma.Decimal) => Number(v.toDecimalPlaces(5, Prisma.Decimal.ROUND_HALF_UP));

export const ETA_DOCUMENT_VERSION = '0.9';

export interface EtaBillInput {
  number: string;
  documentType: 'I' | 'C' | 'D';
  issuedOn: Date;
  currency: string;
  exchangeRate: Numeric | null;
  purchaseOrderRef: string | null;
  salesOrderRef: string | null;
  /** Per-document activity code; null falls back to the issuer's. */
  activityCode?: string | null;
  items: {
    descriptionEn: string;
    descriptionAr: string | null;
    itemCode: string | null;
    gpcCode: string | null;
    itemType?: string | null;
    quantity: Numeric;
    unit: string;
    unitPrice: Numeric;
    discount: Numeric;
    vatRate: Numeric;
    lineNet: Numeric;
    lineVat: Numeric;
  }[];
}

export interface EtaPartyInput {
  nameEn: string;
  nameAr?: string | null;
  trn: string | null;
  addressLine: string | null;
  governorateCode: number | null;
  countryCode?: string | null;
  regionCity?: string | null;
  buildingNumber?: string | null;
}

export interface EtaReceiverInput extends EtaPartyInput {
  receiverType?: ReceiverType;
  nationalId?: string | null;
  foreignId?: string | null;
}

export interface EtaIssuerInput extends EtaPartyInput {
  activityCode: string;
  branchId: string;
}

function address(party: EtaPartyInput, branchId?: string) {
  const country = party.countryCode?.trim().toUpperCase() || 'EG';
  const gov = country === 'EG' && party.governorateCode
    ? governorate(party.governorateCode)?.en
    : undefined;
  const city = party.regionCity?.trim();
  return {
    ...(branchId !== undefined ? { branchID: branchId } : {}),
    country,
    governate: gov ?? city ?? 'Cairo',
    regionCity: city || gov || 'Cairo',
    street: party.addressLine?.trim() || party.nameEn,
    buildingNumber: party.buildingNumber?.trim() || '0',
  };
}

/** The receiver block: its type decides which identifier it carries. */
function receiverBlock(receiver: EtaReceiverInput) {
  const type = receiver.receiverType ?? 'B';
  const id =
    type === 'B' ? (receiver.trn ?? '').replace(/\D/g, '')
    : type === 'P' ? (receiver.nationalId ?? '').replace(/\D/g, '')
    : (receiver.foreignId ?? '').trim();
  return {
    type,
    // A person below the ID threshold, or a foreign party without a
    // number, is sent without one: an empty id fails validation.
    ...(id ? { id } : {}),
    name: receiver.nameAr || receiver.nameEn,
    address: address(receiver),
  };
}

/**
 * The issue timestamp, in the ETA's format.
 *
 * The ETA refuses a timestamp in the future, and a bill only carries a
 * date. So the document is stamped at 08:00 UTC on that date, or one
 * minute ago if that would still be ahead of now.
 */
export function etaIssueTimestamp(issuedOn: Date, now: Date = new Date()): string {
  const day = issuedOn.toISOString().slice(0, 10);
  const stamped = new Date(`${day}T08:00:00Z`);
  const latest = new Date(now.getTime() - 60_000);
  const chosen = stamped > latest ? latest : stamped;
  return `${chosen.toISOString().slice(0, 19)}Z`;
}

export function buildEtaDocument(params: {
  bill: EtaBillInput;
  issuer: EtaIssuerInput;
  receiver: EtaReceiverInput;
  now?: Date;
}) {
  const { bill, issuer, receiver } = params;
  const foreign = bill.currency !== 'EGP';
  const rate = foreign ? D(bill.exchangeRate ?? 0) : D(1);

  let totalSales = 0;
  let totalDiscount = 0;
  let netAmount = 0;
  let taxTotal = 0;

  const invoiceLines = bill.items.map((item) => {
    const vatRate = Number(item.vatRate);
    const discount = D(item.discount);

    const unitEGP = r5(D(item.unitPrice).times(rate));
    const salesTotal = r5(D(item.lineNet).plus(discount).times(rate));
    const discountEGP = r5(discount.times(rate));
    const netTotal = r5(D(salesTotal).minus(discountEGP));
    const tax = r5(D(item.lineVat).times(rate));
    const total = r5(D(netTotal).plus(tax));

    totalSales += salesTotal;
    totalDiscount += discountEGP;
    netAmount += netTotal;
    taxTotal += tax;

    const code = item.gpcCode ?? '';
    return {
      description: item.descriptionEn,
      itemType: item.itemType === 'EGS' || item.itemType === 'GS1' ? item.itemType : itemType(code),
      itemCode: code,
      unitType: item.unit,
      quantity: Number(item.quantity),
      internalCode: item.itemCode ?? code,
      salesTotal,
      total,
      valueDifference: 0,
      totalTaxableFees: 0,
      netTotal,
      itemsDiscount: 0,
      unitValue: foreign
        ? {
            currencySold: bill.currency,
            amountSold: Number(item.unitPrice),
            currencyExchangeRate: Number(rate),
            amountEGP: unitEGP,
          }
        : { currencySold: 'EGP', amountEGP: unitEGP },
      discount: { rate: 0, amount: discountEGP },
      taxableItems: [
        { taxType: 'T1', amount: tax, subType: vatSubType(vatRate, bill.currency), rate: vatRate },
      ],
    };
  });

  const round = (n: number) => r5(D(n));
  const netTotal = round(netAmount);
  const taxes = round(taxTotal);

  return {
    issuer: {
      type: 'B',
      id: (issuer.trn ?? '').replace(/\D/g, ''),
      name: issuer.nameAr || issuer.nameEn,
      address: address(issuer, issuer.branchId),
    },
    receiver: receiverBlock(receiver),
    documentType: bill.documentType,
    documentTypeVersion: ETA_DOCUMENT_VERSION,
    dateTimeIssued: etaIssueTimestamp(bill.issuedOn, params.now),
    taxpayerActivityCode: bill.activityCode?.trim() || issuer.activityCode,
    internalID: bill.number,
    ...(bill.purchaseOrderRef ? { purchaseOrderReference: bill.purchaseOrderRef } : {}),
    ...(bill.salesOrderRef ? { salesOrderReference: bill.salesOrderRef } : {}),
    invoiceLines,
    totalDiscountAmount: round(totalDiscount),
    totalSalesAmount: round(totalSales),
    netAmount: netTotal,
    taxTotals: [{ taxType: 'T1', amount: taxes }],
    totalAmount: round(netTotal + taxes),
    extraDiscountAmount: 0,
    totalItemsDiscountAmount: 0,
  };
}

export type EtaDocument = ReturnType<typeof buildEtaDocument>;

/**
 * Signing hook.
 *
 * Version 0.9 documents are submitted unsigned. When the taxpayer's
 * e-seal is available, this becomes the call to the signer that holds
 * the token — it returns the document with `signatures` attached and
 * `documentTypeVersion` set to "1.0".
 */
export async function signEtaDocument(document: EtaDocument): Promise<EtaDocument> {
  return document;
}
