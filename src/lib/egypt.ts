/**
 * GTS — Egypt locale profile.
 *
 * Single source of truth for everything market-specific: currency, tax,
 * statutory identifiers, geography and the e-invoicing document shape.
 *
 * Pages must not hardcode 'EGP', '14%' or a governorate name. They read
 * from here, so moving markets is a change to one file — and so the
 * eventual database schema can persist these same values verbatim.
 */

/* ============================================================
   CURRENCY
   ============================================================ */

export const CURRENCY = {
  code: 'EGP',
  /** The mark shown beside figures. Latin 'EGP' reads unambiguously in
   *  both scripts; '£' collides with sterling, and 'ج.م' mixes scripts
   *  inside an LTR-isolated number run. */
  mark: 'EGP',
  nameEn: 'Egyptian pound',
  nameAr: 'جنيه مصري',
  /** Piastres. Egyptian invoices are quoted to 2 places. */
  minorUnits: 2,
  minorNameEn: 'piastre',
  minorNameAr: 'قرش',
} as const;

/** Currencies an Egyptian trading company realistically bills in.
 *  EGP is the functional currency; the rest appear on export contracts. */
export const CURRENCY_OPTIONS = [
  { code: 'EGP', label: 'EGP — Egyptian pound' },
  { code: 'USD', label: 'USD — US dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'SAR', label: 'SAR — Saudi riyal' },
  { code: 'AED', label: 'AED — UAE dirham' },
] as const;

/* ============================================================
   VENDOR FIELDS OF WORK
   ============================================================ */

/**
 * What a vendor is in the business of supplying.
 *
 * A fixed list keeps the field filterable and consistent across vendors;
 * an "Other" option on the form escapes to free text for anything that
 * doesn't fit, stored in the same column so listing and filtering never
 * need to know which case produced the value.
 */
export const VENDOR_FIELDS = [
  'Construction materials',
  'Electrical & lighting',
  'Plumbing & sanitary ware',
  'Steel & metalwork',
  'Timber & carpentry',
  'Paints & finishes',
  'Machinery & equipment',
  'Furniture & fixtures',
  'IT & electronics',
  'Office supplies & stationery',
  'Transport & logistics',
  'Food & catering',
  'Cleaning & maintenance services',
  'Professional services',
] as const;

/* ============================================================
   VALUE ADDED TAX — Law 67 of 2016
   ============================================================ */

/** Standard Egyptian VAT rate, as a percentage. */
export const VAT_STANDARD = 14;

/**
 * The VAT rates an Egyptian invoice line can carry.
 *
 * `eta` is the Egyptian Tax Authority tax-subtype code that must appear
 * on the submitted document; it is not cosmetic. T1 is VAT, and the
 * sub-codes distinguish standard, zero-rated and exempt supplies.
 */
export const VAT_RATES = [
  { rate: 14, eta: 'T1', labelEn: 'Standard 14%', labelAr: 'قياسي ١٤٪' },
  { rate: 10, eta: 'T1', labelEn: 'Reduced 10%', labelAr: 'مخفض ١٠٪' },
  { rate: 5, eta: 'T1', labelEn: 'Reduced 5%', labelAr: 'مخفض ٥٪' },
  { rate: 0, eta: 'T2', labelEn: 'Zero-rated export', labelAr: 'صادرات بنسبة صفر' },
  { rate: 0, eta: 'T3', labelEn: 'Exempt', labelAr: 'معفى' },
] as const;

export type VatRate = (typeof VAT_RATES)[number];

/* ============================================================
   WITHHOLDING TAX — khasm wa idafa (خصم وإضافة)

   Deducted by the CUSTOMER at payment and remitted to the ETA on the
   supplier's behalf. It reduces cash collected but never the invoice
   total, so it must be modelled separately from VAT — otherwise
   receivables and the aging ladder both go wrong.
   ============================================================ */

export const WHT_RATES = [
  { rate: 0.5, labelEn: 'Supplies & contracting 0.5%', labelAr: 'توريدات ومقاولات ٠٫٥٪' },
  { rate: 1, labelEn: 'Services 1%', labelAr: 'خدمات ١٪' },
  { rate: 3, labelEn: 'Professional fees 3%', labelAr: 'أتعاب مهنية ٣٪' },
  { rate: 5, labelEn: 'Commission 5%', labelAr: 'عمولة ٥٪' },
] as const;

/** WHT applies only above this invoice value, per ETA practice. */
export const WHT_THRESHOLD = 300;

/* ============================================================
   STATUTORY IDENTIFIERS
   ============================================================ */

/** Tax Registration Number — 9 digits, conventionally shown 123-456-789. */
export const TRN = {
  labelEn: 'Tax registration number',
  labelAr: 'رقم التسجيل الضريبي',
  digits: 9,
  helpEn: '9 digits, issued by the Egyptian Tax Authority',
  pattern: /^\d{3}-?\d{3}-?\d{3}$/,
  format(raw: string) {
    const d = raw.replace(/\D/g, '').slice(0, 9);
    return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean).join('-');
  },
  /** Redacted form for list views, matching how the design masks VAT numbers. */
  mask(raw: string) {
    const d = raw.replace(/\D/g, '');
    return d.length === 9 ? `${d.slice(0, 3)}•••••${d.slice(8)}` : raw;
  },
} as const;

/** Commercial register number — issued by GAFI. */
export const COMMERCIAL_REGISTER = {
  labelEn: 'Commercial register',
  labelAr: 'السجل التجاري',
  helpEn: 'Issued by GAFI',
} as const;

/** National ID — 14 digits. Belongs to employee records, not company records. */
export const NATIONAL_ID = {
  labelEn: 'National ID',
  labelAr: 'الرقم القومي',
  digits: 14,
  pattern: /^\d{14}$/,
} as const;

/** Social insurance number — 9 digits, for payroll and attendance. */
export const SOCIAL_INSURANCE = {
  labelEn: 'Social insurance number',
  labelAr: 'رقم التأمين الاجتماعي',
  digits: 9,
} as const;

/**
 * Validate an Egyptian national ID's structural fields: century marker,
 * birth date and governorate of issue.
 *
 * There is no published checksum, so this rejects the impossible, not
 * the merely false. Treat a `true` as 'well-formed', never as 'verified'.
 */
export function validateNationalId(id: string): boolean {
  if (!NATIONAL_ID.pattern.test(id)) return false;

  const century = Number(id[0]);
  if (century !== 2 && century !== 3) return false; // 2 = 1900s, 3 = 2000s

  const month = Number(id.slice(3, 5));
  const day = Number(id.slice(5, 7));
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  // Governorate 88 marks a birth outside Egypt and is legitimate.
  const gov = Number(id.slice(7, 9));
  return gov === 88 || GOVERNORATE_CODES.has(gov);
}

/* ============================================================
   GEOGRAPHY — the 27 governorates.

   Codes are the official ones used inside the national ID and on ETA
   documents, so they are stable join keys, not display ordering.
   Coordinates are each governorate's capital, used to centre the map
   before a project's exact location has been pinned.
   ============================================================ */

export const GOVERNORATES = [
  { code: 1, en: 'Cairo', ar: 'القاهرة', lat: 30.0444, lng: 31.2357 },
  { code: 2, en: 'Alexandria', ar: 'الإسكندرية', lat: 31.2001, lng: 29.9187 },
  { code: 3, en: 'Port Said', ar: 'بورسعيد', lat: 31.2653, lng: 32.3019 },
  { code: 4, en: 'Suez', ar: 'السويس', lat: 29.9668, lng: 32.5498 },
  { code: 11, en: 'Damietta', ar: 'دمياط', lat: 31.4165, lng: 31.8133 },
  { code: 12, en: 'Dakahlia', ar: 'الدقهلية', lat: 31.0409, lng: 31.3785 },
  { code: 13, en: 'Sharqia', ar: 'الشرقية', lat: 30.5877, lng: 31.502 },
  { code: 14, en: 'Qalyubia', ar: 'القليوبية', lat: 30.4592, lng: 31.1786 },
  { code: 15, en: 'Kafr El Sheikh', ar: 'كفر الشيخ', lat: 31.1117, lng: 30.9398 },
  { code: 16, en: 'Gharbia', ar: 'الغربية', lat: 30.7865, lng: 31.0004 },
  { code: 17, en: 'Monufia', ar: 'المنوفية', lat: 30.5972, lng: 30.9876 },
  { code: 18, en: 'Beheira', ar: 'البحيرة', lat: 31.0341, lng: 30.4682 },
  { code: 19, en: 'Ismailia', ar: 'الإسماعيلية', lat: 30.5965, lng: 32.2715 },
  { code: 21, en: 'Giza', ar: 'الجيزة', lat: 30.0131, lng: 31.2089 },
  { code: 22, en: 'Beni Suef', ar: 'بني سويف', lat: 29.0661, lng: 31.0994 },
  { code: 23, en: 'Faiyum', ar: 'الفيوم', lat: 29.3084, lng: 30.8428 },
  { code: 24, en: 'Minya', ar: 'المنيا', lat: 28.1099, lng: 30.7503 },
  { code: 25, en: 'Asyut', ar: 'أسيوط', lat: 27.1809, lng: 31.1837 },
  { code: 26, en: 'Sohag', ar: 'سوهاج', lat: 26.5591, lng: 31.6957 },
  { code: 27, en: 'Qena', ar: 'قنا', lat: 26.1551, lng: 32.716 },
  { code: 28, en: 'Aswan', ar: 'أسوان', lat: 24.0889, lng: 32.8998 },
  { code: 29, en: 'Luxor', ar: 'الأقصر', lat: 25.6872, lng: 32.6396 },
  { code: 31, en: 'Red Sea', ar: 'البحر الأحمر', lat: 27.2579, lng: 33.8116 },
  { code: 32, en: 'New Valley', ar: 'الوادي الجديد', lat: 25.4404, lng: 30.5465 },
  { code: 33, en: 'Matrouh', ar: 'مطروح', lat: 31.3543, lng: 27.2373 },
  { code: 34, en: 'North Sinai', ar: 'شمال سيناء', lat: 31.131, lng: 33.8033 },
  { code: 35, en: 'South Sinai', ar: 'جنوب سيناء', lat: 28.2416, lng: 33.6176 },
] as const;

export type Governorate = (typeof GOVERNORATES)[number];

export const GOVERNORATE_CODES = new Set<number>(GOVERNORATES.map((g) => g.code));

export function governorate(code: number): Governorate | undefined {
  return GOVERNORATES.find((g) => g.code === code);
}

/** Country centroid — the map default before any project is pinned. */
export const COUNTRY_CENTRE = { lat: 26.8206, lng: 30.8025, zoom: 6 } as const;

export const COUNTRY = {
  iso2: 'EG',
  iso3: 'EGY',
  nameEn: 'Egypt',
  nameAr: 'مصر',
  dialCode: '+20',
  /** Egypt reintroduced summer time in 2023, so a fixed +02:00 offset
   *  would silently shift every attendance timestamp for half the year.
   *  Always resolve through the IANA zone. */
  timezone: 'Africa/Cairo',
} as const;

/* ============================================================
   PHONE NUMBERS
   ============================================================ */

/** Egyptian mobiles: 01, an operator digit (0, 1, 2 or 5), then 8 digits. */
export const MOBILE_PATTERN = /^(?:\+20|0020|0)?1[0125]\d{8}$/;

export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^(?:0020|20)/, '');
  const local = digits.startsWith('0') ? digits.slice(1) : digits;
  if (local.length === 10 && local.startsWith('1')) {
    return `${COUNTRY.dialCode} ${local.slice(0, 3)} ${local.slice(3, 7)} ${local.slice(7)}`;
  }
  return raw;
}

/* ============================================================
   WORKING CALENDAR
   ============================================================ */

/**
 * The Egyptian private-sector week runs Sunday to Thursday, with Friday
 * and Saturday off. Attendance 'missed' detection and leave day-counting
 * both depend on this, so it lives here rather than inside either module.
 * JS day numbers: 0 = Sunday.
 */
export const WEEKEND_DAYS: readonly number[] = [5, 6];
export const WORKING_DAYS: readonly number[] = [0, 1, 2, 3, 4];

export function isWorkingDay(date: Date): boolean {
  return !WEEKEND_DAYS.includes(date.getDay());
}

/** Typical private-sector hours. Administrator-configurable; these are
 *  the defaults a new tenant starts from. */
export const WORKING_HOURS = {
  start: '09:00',
  end: '17:00',
  /** Minutes after `start` before a check-in is marked LATE. */
  lateThresholdMinutes: 15,
  /** Ramadan shortens the statutory working day by two hours. */
  ramadanEnd: '15:00',
} as const;

/**
 * Statutory leave under the Egyptian Labour Law (Law 12 of 2003).
 * These are legal minimums: an employer may exceed them, never reduce them.
 */
export const LEAVE_ENTITLEMENTS = {
  /** 21 days after one full year; 30 after ten years' service or age 50. */
  annual: { base: 21, afterTenYears: 30, labelEn: 'Annual leave', labelAr: 'إجازة سنوية' },
  /** Full pay for the first 90 days, reducing thereafter. */
  sick: { days: 90, labelEn: 'Sick leave', labelAr: 'إجازة مرضية' },
  /** 90 days at full pay, twice over the whole term of service. */
  maternity: { days: 90, maxOccurrences: 2, labelEn: 'Maternity leave', labelAr: 'إجازة وضع' },
  /** Casual leave is drawn from the annual balance, capped at 6 a year. */
  casual: { days: 6, labelEn: 'Casual leave', labelAr: 'إجازة عارضة' },
  /** Once over the whole term of service, for those who have not performed it. */
  hajj: { days: 30, maxOccurrences: 1, labelEn: 'Hajj leave', labelAr: 'إجازة الحج' },
} as const;

/**
 * Fixed-date national holidays.
 *
 * The Islamic feasts (Eid al-Fitr, Eid al-Adha, Islamic New Year, the
 * Prophet's birthday) and Coptic Easter all move against the Gregorian
 * calendar and are confirmed by ministerial decree each year, so an
 * administrator enters them per year rather than this file computing them.
 */
export const FIXED_HOLIDAYS = [
  { month: 1, day: 7, en: 'Coptic Christmas', ar: 'عيد الميلاد المجيد' },
  { month: 1, day: 25, en: 'Revolution Day & Police Day', ar: 'عيد ثورة ٢٥ يناير' },
  { month: 4, day: 25, en: 'Sinai Liberation Day', ar: 'عيد تحرير سيناء' },
  { month: 5, day: 1, en: 'Labour Day', ar: 'عيد العمال' },
  { month: 6, day: 30, en: 'June 30 Revolution Day', ar: 'ثورة ٣٠ يونيو' },
  { month: 7, day: 23, en: 'July 23 Revolution Day', ar: 'عيد ثورة ٢٣ يوليو' },
  { month: 10, day: 6, en: 'Armed Forces Day', ar: 'عيد القوات المسلحة' },
] as const;
