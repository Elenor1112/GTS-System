import type { EtaDocumentFacts, EtaReceiverFacts } from '../eta-rules';

/**
 * Adapters from GTS rows to the facts lib/eta-rules.ts checks.
 *
 * Kept apart from the rules so the rules stay free of Prisma types and
 * can run in the browser.
 */

type Numeric = { toString(): string } | number | string;

export interface ClientReceiverRow {
  nameEn: string;
  nameAr: string | null;
  trn: string | null;
  receiverType: 'B' | 'P' | 'F';
  nationalId: string | null;
  foreignId: string | null;
  countryCode: string;
  governorateCode: number | null;
  regionCity: string | null;
  addressLine: string | null;
  buildingNumber: string | null;
}

export function receiverFacts(client: ClientReceiverRow | null): EtaReceiverFacts | null {
  if (!client) return null;
  return {
    receiverType: client.receiverType,
    nameEn: client.nameEn,
    nameAr: client.nameAr,
    trn: client.trn,
    nationalId: client.nationalId,
    foreignId: client.foreignId,
    countryCode: client.countryCode,
    governorateCode: client.governorateCode,
    regionCity: client.regionCity,
    addressLine: client.addressLine,
    buildingNumber: client.buildingNumber,
  };
}

export interface OrgFacts {
  nameEn: string;
  trn: string;
  governorateCode: number;
  activityCode: string;
}

export function etaFactsForBill(
  bill: {
    issuedOn: Date;
    activityCode: string | null;
    currency: string;
    exchangeRate: Numeric | null;
    client: ClientReceiverRow | null;
    items: {
      descriptionEn: string;
      gpcCode: string | null;
      itemType: string | null;
      unit: string;
      quantity: Numeric;
      unitPrice: Numeric;
      discount: Numeric;
      vatRate: Numeric;
    }[];
  },
  org: OrgFacts,
): EtaDocumentFacts {
  return {
    issuedOn: bill.issuedOn,
    activityCode: bill.activityCode?.trim() || org.activityCode,
    currency: bill.currency,
    exchangeRate: bill.exchangeRate?.toString() ?? null,
    issuer: { nameEn: org.nameEn, trn: org.trn, governorateCode: org.governorateCode },
    receiver: receiverFacts(bill.client),
    lines: bill.items.map((i) => ({
      descriptionEn: i.descriptionEn,
      gpcCode: i.gpcCode,
      itemType: i.itemType,
      unit: i.unit,
      quantity: i.quantity.toString(),
      unitPrice: i.unitPrice.toString(),
      discount: i.discount.toString(),
      vatRate: i.vatRate.toString(),
    })),
  };
}
