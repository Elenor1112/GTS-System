/**
 * GTS — the ETA's acceptance rules, in one place.
 *
 * The bill form runs these live, the server runs them again before a
 * sales bill is saved, and the submission step runs them a third time
 * before anything is sent. One function for all three is what stops the
 * form from accepting a document the ETA will then refuse.
 *
 * Client-safe: no database, no network, no `server-only`. Whatever needs
 * the ETA's own data (the taxpayer's approved item codes) is passed in.
 *
 * What cannot be checked here: whether a well-formed TRN belongs to a
 * taxpayer the ETA knows. Only the ETA holds that registry.
 */

import { computeTotals } from './eta';
import { GOVERNORATE_CODES, VAT_RATES } from './egypt';

/* ============================================================
   CODE LISTS
   ============================================================ */

/**
 * ETA unit types — UN/ECE Recommendation 20 codes, as published in the
 * ETA's unit-type code table. Only codes on that table are accepted; a
 * free-typed "pcs" or "kg" fails the document's code step.
 */
export const ETA_UNIT_TYPES = [
  { code: 'EA', en: 'Each', ar: 'قطعة' },
  { code: 'C62', en: 'One (unit)', ar: 'وحدة' },
  { code: 'PK', en: 'Pack', ar: 'عبوة' },
  { code: 'BOX', en: 'Box', ar: 'صندوق' },
  { code: 'BG', en: 'Bag', ar: 'شيكارة' },
  { code: 'SET', en: 'Set', ar: 'طقم' },
  { code: 'PR', en: 'Pair', ar: 'زوج' },
  { code: 'ROL', en: 'Roll', ar: 'لفة' },
  { code: 'PAL', en: 'Pallet', ar: 'بالتة' },
  { code: 'GRM', en: 'Gram', ar: 'جرام' },
  { code: 'KGM', en: 'Kilogram', ar: 'كيلوجرام' },
  { code: 'TNE', en: 'Tonne', ar: 'طن' },
  { code: 'MLT', en: 'Millilitre', ar: 'ملليلتر' },
  { code: 'LTR', en: 'Litre', ar: 'لتر' },
  { code: 'MMT', en: 'Millimetre', ar: 'ملليمتر' },
  { code: 'CMT', en: 'Centimetre', ar: 'سنتيمتر' },
  { code: 'MTR', en: 'Metre', ar: 'متر' },
  { code: 'KMT', en: 'Kilometre', ar: 'كيلومتر' },
  { code: 'MTK', en: 'Square metre', ar: 'متر مربع' },
  { code: 'MTQ', en: 'Cubic metre', ar: 'متر مكعب' },
  { code: 'KWH', en: 'Kilowatt hour', ar: 'كيلووات ساعة' },
  { code: 'MIN', en: 'Minute', ar: 'دقيقة' },
  { code: 'HUR', en: 'Hour', ar: 'ساعة' },
  { code: 'DAY', en: 'Day', ar: 'يوم' },
  { code: 'WEE', en: 'Week', ar: 'أسبوع' },
  { code: 'MON', en: 'Month', ar: 'شهر' },
  { code: 'ANN', en: 'Year', ar: 'سنة' },
  { code: 'JOB', en: 'Job', ar: 'مهمة' },
] as const;

export const ETA_UNIT_CODES = new Set<string>(ETA_UNIT_TYPES.map((u) => u.code));

/** B: an Egyptian business. P: a person. F: a foreign party. */
export const RECEIVER_TYPES = ['B', 'P', 'F'] as const;
export type ReceiverType = (typeof RECEIVER_TYPES)[number];

/** At or above this total (EGP), a person receiver must carry a national ID. */
export const PERSON_ID_THRESHOLD_EGP = 50_000;

/** How many days back the ETA accepts an issue date. */
export const MAX_ISSUE_AGE_DAYS = 7;

export type EtaItemType = 'EGS' | 'GS1';

/** GS1 codes are numeric; codes on the taxpayer's own scheme start EG-. */
export function itemType(code: string): EtaItemType {
  return code.toUpperCase().startsWith('EG-') ? 'EGS' : 'GS1';
}

/** The VAT subtype for a line. Zero-rated is an export abroad, exempt at home. */
export function vatSubType(rate: number, currency: string): string {
  if (rate > 0) return 'V009';
  return currency === 'EGP' ? 'V003' : 'V001';
}

/** One approved code from the taxpayer's ETA code list. */
export interface EtaCode {
  codeType: EtaItemType;
  itemCode: string;
  nameEn: string;
  nameAr: string | null;
  parentCode: string | null;
}

/* ============================================================
   THE ISSUE-DATE WINDOW
   ============================================================ */

/** A calendar date in Cairo, as YYYY-MM-DD. */
export function cairoDate(at: Date): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(at);
}

/** The earliest and latest issue dates the ETA accepts today. */
export function issueDateWindow(now: Date = new Date()): { min: string; max: string } {
  const max = cairoDate(now);
  const min = new Date(`${max}T00:00:00Z`);
  min.setUTCDate(min.getUTCDate() - MAX_ISSUE_AGE_DAYS);
  return { min: min.toISOString().slice(0, 10), max };
}

/* ============================================================
   THE CHECK
   ============================================================ */

export interface EtaIssuerFacts {
  nameEn: string;
  trn: string;
  governorateCode: number | null;
}

export interface EtaReceiverFacts {
  receiverType: ReceiverType;
  nameEn: string;
  nameAr?: string | null;
  trn: string | null;
  nationalId: string | null;
  foreignId: string | null;
  countryCode: string | null;
  governorateCode: number | null;
  regionCity: string | null;
  addressLine: string | null;
  buildingNumber: string | null;
}

export interface EtaLineFacts {
  descriptionEn: string;
  itemType?: string | null;
  /** The ETA item code (EGS or GS1). Stored as `gpcCode` on a bill line. */
  gpcCode?: string | null;
  unit: string;
  quantity: number | string;
  unitPrice: number | string;
  discount?: number | string | null;
  vatRate: number | string;
}

export interface EtaDocumentFacts {
  /** YYYY-MM-DD, or a DATE column's midnight-UTC Date. */
  issuedOn: string | Date;
  activityCode: string;
  currency: string;
  exchangeRate: number | string | null;
  issuer: EtaIssuerFacts | null;
  receiver: EtaReceiverFacts | null;
  lines: EtaLineFacts[];
}

export interface EtaCheckOptions {
  /** The taxpayer's approved codes. Omitted: the code is format-checked only. */
  approvedCodes?: EtaCode[] | null;
  /** Skipped when editing a draft, whose date is already fixed. */
  checkIssueDate?: boolean;
  now?: Date;
}

export interface EtaProblem {
  /** The form field it belongs to: `issuedOn`, `receiver`, `lines.0.gpcCode`… */
  field: string;
  message: string;
}

const digits = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '');

/**
 * Every reason the ETA would refuse this document, as far as can be known
 * without asking it. An empty list means the document is submittable.
 */
export function checkEtaDocument(doc: EtaDocumentFacts, options: EtaCheckOptions = {}): EtaProblem[] {
  const problems: EtaProblem[] = [];
  const add = (field: string, message: string) => problems.push({ field, message });

  /* ---- Header ---- */
  if (!/^\d{4}$/.test(doc.activityCode.trim())) {
    add('activityCode', 'The activity code must be the 4-digit code registered with the ETA.');
  }

  if (options.checkIssueDate !== false) {
    const day = typeof doc.issuedOn === 'string' ? doc.issuedOn : doc.issuedOn.toISOString().slice(0, 10);
    const { min, max } = issueDateWindow(options.now);
    if (day > max) {
      add('issuedOn', 'The ETA does not accept an issue date in the future.');
    } else if (day < min) {
      add('issuedOn', `The ETA only accepts documents issued in the last ${MAX_ISSUE_AGE_DAYS} days (from ${min}).`);
    }
  }

  const foreign = doc.currency !== 'EGP';
  const rate = Number(doc.exchangeRate ?? 0);
  if (foreign && !(rate > 0)) {
    add('exchangeRate', `An exchange rate to EGP is required for a ${doc.currency} document.`);
  }

  /* ---- Issuer ---- */
  if (!doc.issuer) {
    add('issuer', 'The company details are missing.');
  } else {
    if (!/^\d{9}$/.test(digits(doc.issuer.trn))) {
      add('issuer', 'The company tax registration number is not set in Administration.');
    }
    if (!doc.issuer.governorateCode || !GOVERNORATE_CODES.has(doc.issuer.governorateCode)) {
      add('issuer', 'The company governorate is not set in Administration.');
    }
  }

  /* ---- Lines ---- */
  if (doc.lines.length === 0) add('lines', 'A document must carry at least one line.');

  const approved = options.approvedCodes
    ? new Map(options.approvedCodes.map((c) => [c.itemCode.toUpperCase(), c]))
    : null;

  doc.lines.forEach((line, i) => {
    const at = (f: string) => `lines.${i}.${f}`;
    const n = `Line ${i + 1}`;
    const code = (line.gpcCode ?? '').trim();

    if (!line.descriptionEn.trim()) add(at('descriptionEn'), `${n}: a description is required.`);

    if (!code) {
      add(at('gpcCode'), `${n}: choose an approved ETA item code.`);
    } else if (approved) {
      const match = approved.get(code.toUpperCase());
      if (!match) {
        add(at('gpcCode'), `${n}: ${code} is not one of your approved ETA item codes.`);
      } else if (line.itemType && line.itemType !== match.codeType) {
        add(at('gpcCode'), `${n}: ${code} is an ${match.codeType} code, not ${line.itemType}.`);
      }
    } else if (itemType(code) === 'GS1' && !/^\d{8,14}$/.test(code)) {
      add(at('gpcCode'), `${n}: ${code} is not a valid GS1 or EGS item code.`);
    }

    if (!ETA_UNIT_CODES.has(line.unit)) {
      add(at('unit'), `${n}: ${line.unit || 'the unit'} is not an ETA unit type.`);
    }
    if (!(Number(line.quantity) > 0)) add(at('quantity'), `${n}: quantity must be greater than zero.`);
    if (!(Number(line.unitPrice) >= 0)) add(at('unitPrice'), `${n}: the unit value cannot be negative.`);
    if (!VAT_RATES.some((v) => v.rate === Number(line.vatRate))) {
      add(at('vatRate'), `${n}: ${line.vatRate}% is not an ETA VAT rate.`);
    }
  });

  /* ---- Receiver ---- */
  const r = doc.receiver;
  if (!r) {
    add('receiver', 'Choose the client this invoice is issued to.');
    return problems;
  }

  const name = r.nameAr?.trim() || r.nameEn.trim();
  if (!name) add('receiver', 'The receiver has no name.');

  if (r.receiverType === 'B') {
    if (!/^\d{9}$/.test(digits(r.trn))) {
      add('receiver', `${r.nameEn} has no valid 9-digit tax registration number.`);
    }
    if (!r.governorateCode || !GOVERNORATE_CODES.has(r.governorateCode)) {
      add('receiver', `${r.nameEn} has no governorate.`);
    }
    if (!r.regionCity?.trim()) add('receiver', `${r.nameEn} has no city / region.`);
    if (!r.addressLine?.trim()) add('receiver', `${r.nameEn} has no street address.`);
    if (!r.buildingNumber?.trim()) add('receiver', `${r.nameEn} has no building number.`);
  } else if (r.receiverType === 'P') {
    const preview = computeTotals(
      doc.lines.map((l) => ({
        code: '', descriptionEn: '', unit: l.unit,
        quantity: Number(l.quantity) || 0,
        unitPrice: Number(l.unitPrice) || 0,
        discount: Number(l.discount ?? 0) || 0,
        vatRate: Number(l.vatRate) || 0,
      })),
    );
    const totalEGP = preview.total * (foreign ? rate : 1);
    const id = digits(r.nationalId);
    if (totalEGP >= PERSON_ID_THRESHOLD_EGP && id.length !== 14) {
      add('receiver', `${r.nameEn} needs a 14-digit national ID: the invoice is EGP ${PERSON_ID_THRESHOLD_EGP.toLocaleString('en')} or more.`);
    } else if (id && id.length !== 14) {
      add('receiver', `${r.nameEn}'s national ID must be 14 digits.`);
    }
  } else {
    const country = (r.countryCode ?? '').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(country) || country === 'EG') {
      add('receiver', `${r.nameEn} is a foreign receiver but has no foreign country set.`);
    }
  }

  return problems;
}
