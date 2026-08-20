/**
 * GTS — value formatting.
 *
 * Every number a user sees passes through here. Centralising it is what
 * keeps the financial voice consistent: the integer reads first, the
 * fraction and currency mark are subordinate, and digits stay LTR-isolated
 * in both text directions.
 */

import { COUNTRY, CURRENCY, WEEKEND_DAYS } from './egypt';

export type Locale = 'en' | 'ar';

/** Split a money value into the parts the type system styles separately. */
export function splitAmount(value: number, locale: Locale = 'en') {
  const abs = Math.abs(value);
  // Western digits in both locales. Egyptian commercial and banking
  // practice sets figures in Latin numerals even in Arabic documents;
  // Eastern Arabic digits are a per-tenant opt-in, not a default.
  const parts = new Intl.NumberFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).formatToParts(abs);

  const integer = parts
    .filter((p) => p.type === 'integer' || p.type === 'group')
    .map((p) => p.value)
    .join('');
  const fraction = parts.find((p) => p.type === 'fraction')?.value ?? '00';
  const decimal = parts.find((p) => p.type === 'decimal')?.value ?? '.';

  return { negative: value < 0, integer, fraction, decimal };
}

/** Compact form for axis labels and dense cells: 2.85M, 486K. */
export function compact(value: number, locale: Locale = 'en') {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export function percent(value: number, locale: Locale = 'en') {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value);
}

/** ISO date → locale form. Gregorian in both locales: Egypt keeps civil,
 *  tax and commercial dates on the Gregorian calendar. The Hijri date is
 *  shown only where a religious observance is the subject. */
export function formatDate(iso: string, locale: Locale = 'en') {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-ca-gregory-nu-latn' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export function formatTime(iso: string, locale: Locale = 'en') {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

/** Distance for the attendance geofence. Metres below 1km, else km. */
export function formatDistance(metres: number, locale: Locale = 'en') {
  const nf = new Intl.NumberFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', {
    maximumFractionDigits: metres < 1000 ? 0 : 1,
  });
  return metres < 1000
    ? { value: nf.format(metres), unit: 'm' }
    : { value: nf.format(metres / 1000), unit: 'km' };
}

/** Days overdue → the phrasing used in status chips. */
export function agingBucket(days: number): 'current' | 'due' | 'late' | 'severe' {
  if (days <= 0) return 'current';
  if (days <= 30) return 'due';
  if (days <= 90) return 'late';
  return 'severe';
}


/* ============================================================
   EGYPT — timezone-aware time.

   Attendance is the reason these exist. Egypt observes summer time
   again as of 2023, so formatting a check-in with the server's own
   offset would shift every timestamp by an hour for half the year.
   Everything the user reads is resolved through Africa/Cairo.
   ============================================================ */

/** Wall-clock time at the site, whatever zone the server runs in. */
export function formatSiteTime(iso: string, locale: Locale = 'en') {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: COUNTRY.timezone,
  }).format(new Date(iso));
}

/** Calendar date at the site — the date an attendance record belongs to. */
export function formatSiteDate(iso: string, locale: Locale = 'en') {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-ca-gregory-nu-latn' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: COUNTRY.timezone,
  }).format(new Date(iso));
}

/** Day of week in Cairo, 0 = Sunday. Used to decide whether a missing
 *  attendance record is an absence or simply the weekend. */
export function siteWeekday(iso: string): number {
  const name = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: COUNTRY.timezone,
  }).format(new Date(iso));
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name);
}

/** Friday and Saturday are the Egyptian weekend. */
export function isSiteWeekend(iso: string): boolean {
  return WEEKEND_DAYS.includes(siteWeekday(iso));
}

/** Money with its currency mark, for places that need one string rather
 *  than the styled <Amount> parts — exports, tooltips, page titles. */
export function formatMoney(value: number, locale: Locale = 'en', currency = CURRENCY.code) {
  const { negative, integer, fraction, decimal } = splitAmount(value, locale);
  return `${negative ? '−' : ''}${currency} ${integer}${decimal}${fraction}`;
}
