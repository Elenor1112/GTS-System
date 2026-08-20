/**
 * GTS — Egyptian Tax Authority (ETA) e-invoicing.
 *
 * Egypt's e-invoice mandate means an invoice is not a document the seller
 * designs; it is a document the ETA specifies. This module holds that
 * shape — the required fields, the lifecycle, and the arithmetic.
 *
 * SCOPE: this builds the DOCUMENT, not the transmission. Submitting to
 * the ETA additionally requires taxpayer credentials, a client id/secret
 * and an e-seal certificate (USB token or HSM) to sign the canonical
 * serialization. Those cannot live in this repository, and no code here
 * pretends to have them — `submission` below is the record of a
 * submission, deliberately nullable until a real integration fills it.
 *
 * ARITHMETIC: every total here is computed from line items. In the
 * eventual server implementation these same functions run server-side on
 * decimal values, never on a total posted by the browser.
 */

import { VAT_STANDARD, WHT_THRESHOLD } from './egypt';

/* ============================================================
   DOCUMENT TYPES
   ============================================================ */

/** ETA document types. `I` is an invoice, `C` a credit note, `D` a debit note. */
export type EtaDocumentType = 'I' | 'C' | 'D';

export const DOCUMENT_TYPES: Record<EtaDocumentType, { en: string; ar: string }> = {
  I: { en: 'Tax invoice', ar: 'فاتورة ضريبية' },
  C: { en: 'Credit note', ar: 'إشعار دائن' },
  D: { en: 'Debit note', ar: 'إشعار مدين' },
};

/**
 * Document lifecycle.
 *
 * The first five are the seller's internal workflow. The last three are
 * the ETA's own verdict, returned after submission — they are not states
 * a user can set, and the UI must never offer them as an action.
 */
export type BillStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SENT'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED';

/** What the ETA said about the document, once it has been submitted. */
export type EtaSubmissionStatus = 'NOT_SUBMITTED' | 'SUBMITTED' | 'VALID' | 'INVALID' | 'REJECTED';

export const SUBMISSION_LABELS: Record<EtaSubmissionStatus, { en: string; ar: string }> = {
  NOT_SUBMITTED: { en: 'Not submitted', ar: 'لم تُرسل' },
  SUBMITTED: { en: 'Submitted — awaiting validation', ar: 'أُرسلت — في انتظار التحقق' },
  VALID: { en: 'Accepted by the ETA', ar: 'مقبولة من مصلحة الضرائب' },
  INVALID: { en: 'Rejected — validation errors', ar: 'مرفوضة — أخطاء في التحقق' },
  REJECTED: { en: 'Rejected by the buyer', ar: 'مرفوضة من المشتري' },
};

/* ============================================================
   LINE ITEMS
   ============================================================ */

/**
 * A single invoice line.
 *
 * `gpcCode` is the GS1 Global Product Classification code the ETA
 * requires for goods (an EGS code is the alternative for items
 * registered on the taxpayer's own coding scheme). It is mandatory on
 * submission, which is why it sits on the line rather than being
 * derived at export time.
 */
export interface BillLine {
  code: string;
  descriptionEn: string;
  descriptionAr?: string;
  /** GS1 GPC or an EGS code registered to the taxpayer. */
  gpcCode?: string;
  quantity: number;
  /** ETA unit-of-measure code, e.g. EA, KGM, MTQ, HUR. */
  unit: string;
  unitPrice: number;
  /** Line-level discount, as an absolute amount, applied before tax. */
  discount?: number;
  /** VAT percentage for this line — 14, 10, 5 or 0. */
  vatRate: number;
}

/* ============================================================
   TOTALS
   ============================================================ */

export interface BillTotals {
  /** Sum of quantity × unit price, before any discount. */
  gross: number;
  /** Total of all line discounts. */
  discount: number;
  /** Taxable base: gross − discount. */
  net: number;
  /** VAT, accumulated per line so that mixed rates compute correctly. */
  vat: number;
  /** The invoice total the buyer owes. */
  total: number;
  /** Withheld at payment by the buyer — reduces cash, not the total. */
  withheld: number;
  /** What actually arrives in the bank: total − withheld. */
  netPayable: number;
}

/** Round to piastres. Money must never carry float noise into a document
 *  that a tax authority will re-derive and compare against. */
function piastres(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Compute every total on a bill from its lines.
 *
 * VAT accumulates per line rather than being applied to the net total,
 * because a document may mix 14% goods with zero-rated exports — taxing
 * the aggregate would silently overcharge.
 *
 * @param whtRate Withholding percentage the buyer will deduct at payment.
 *                Only applies above the ETA threshold.
 */
export function computeTotals(lines: BillLine[], whtRate = 0): BillTotals {
  let gross = 0;
  let discount = 0;
  let vat = 0;

  for (const line of lines) {
    const lineGross = piastres(line.quantity * line.unitPrice);
    const lineDiscount = piastres(line.discount ?? 0);
    const lineNet = lineGross - lineDiscount;

    gross += lineGross;
    discount += lineDiscount;
    vat += piastres(lineNet * (line.vatRate / 100));
  }

  gross = piastres(gross);
  discount = piastres(discount);
  const net = piastres(gross - discount);
  vat = piastres(vat);
  const total = piastres(net + vat);

  // Withholding is calculated on the pre-VAT base, and only once the
  // invoice clears the threshold.
  const withheld =
    whtRate > 0 && total >= WHT_THRESHOLD ? piastres(net * (whtRate / 100)) : 0;

  return {
    gross,
    discount,
    net,
    vat,
    total,
    withheld,
    netPayable: piastres(total - withheld),
  };
}

/* ============================================================
   NUMBERING
   ============================================================ */

/**
 * Internal invoice number.
 *
 * This is the seller's own sequence and must be gapless — the ETA and
 * the tax inspector both read a gap as a suppressed sale. The eventual
 * database implementation allocates it inside the same transaction that
 * inserts the bill, from a per-year counter row, so concurrent issuing
 * cannot produce a duplicate or skip.
 */
export function formatBillNumber(year: number, sequence: number, prefix = 'INV'): string {
  return `${prefix}-${year}-${String(sequence).padStart(5, '0')}`;
}

/** Egyptian tax periods are monthly; the VAT return is due within two
 *  months of the period's end. */
export function taxPeriod(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/* ============================================================
   THE DOCUMENT
   ============================================================ */

export interface TaxpayerParty {
  nameEn: string;
  nameAr?: string;
  /** 9-digit Tax Registration Number. */
  trn: string;
  /** ETA governorate/branch code. */
  branchCode?: string;
  addressLine: string;
  governorateCode: number;
  country: 'EG' | string;
}

/**
 * The record of an ETA submission.
 *
 * Every field here is assigned by the ETA, never by this system. It stays
 * null until a real integration runs — a UUID invented locally would be a
 * fabricated compliance record, which is exactly the failure mode a tax
 * document must not have.
 */
export interface EtaSubmission {
  status: EtaSubmissionStatus;
  /** ETA-assigned document UUID. */
  uuid: string | null;
  /** ETA-assigned long identifier, printed on the document. */
  longId: string | null;
  submittedAt: string | null;
  /** Validation errors returned by the ETA, verbatim. */
  errors: string[];
}

export const NOT_SUBMITTED: EtaSubmission = {
  status: 'NOT_SUBMITTED',
  uuid: null,
  longId: null,
  submittedAt: null,
  errors: [],
};

export interface Bill {
  number: string;
  documentType: EtaDocumentType;
  /** ETA document version currently in force. */
  documentVersion: '1.0';
  issuedAt: string;
  dueAt: string;
  currency: string;
  /** Required by the ETA whenever currency is not EGP. */
  exchangeRate?: number;
  issuer: TaxpayerParty;
  receiver: TaxpayerParty;
  lines: BillLine[];
  whtRate: number;
  status: BillStatus;
  submission: EtaSubmission;
  projectRef?: string;
}

/**
 * Pre-flight check against the ETA's mandatory fields.
 *
 * Runs before a bill may leave DRAFT, so a document is never sent to a
 * client in a shape the ETA would later reject. Returns human-readable
 * problems; an empty array means the document is structurally complete.
 */
export function validateForSubmission(bill: Bill): string[] {
  const problems: string[] = [];
  const trn = /^\d{9}$/;

  if (!trn.test(bill.issuer.trn.replace(/\D/g, ''))) {
    problems.push('Issuer tax registration number must be 9 digits.');
  }
  if (!trn.test(bill.receiver.trn.replace(/\D/g, ''))) {
    problems.push('Receiver tax registration number must be 9 digits.');
  }
  if (bill.lines.length === 0) {
    problems.push('A document must carry at least one line item.');
  }
  if (bill.currency !== 'EGP' && !bill.exchangeRate) {
    problems.push('An exchange rate is required for documents not issued in EGP.');
  }
  for (const line of bill.lines) {
    if (!line.gpcCode) {
      problems.push(`Line ${line.code} is missing its GPC/EGS item code.`);
    }
    if (line.quantity <= 0) {
      problems.push(`Line ${line.code} must have a positive quantity.`);
    }
  }
  if (new Date(bill.dueAt) < new Date(bill.issuedAt)) {
    problems.push('The due date cannot fall before the issue date.');
  }

  return problems;
}

/** Default VAT rate applied to a new line. */
export const DEFAULT_VAT_RATE = VAT_STANDARD;
