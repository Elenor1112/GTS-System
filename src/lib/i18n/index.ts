import 'server-only';

import { cache } from 'react';

import { getLocale, type Locale } from '@/lib/preferences';
import { en, ar } from './dictionary';

export type Dictionary = typeof en;

const DICTIONARIES: Record<Locale, Dictionary> = { en, ar };

/** The resolved dictionary for the current request. */
export const t = cache(async (): Promise<Dictionary> => {
  const locale = await getLocale();
  return DICTIONARIES[locale];
});

/**
 * Pick a bilingual record's display name for the current locale.
 *
 * Not every row has an Arabic name filled in — `nameAr` is optional
 * throughout the schema — so Arabic falls back to the English name
 * rather than rendering blank.
 */
export function pickName<T extends { nameEn: string; nameAr?: string | null }>(
  row: T,
  locale: Locale,
): string {
  return locale === 'ar' && row.nameAr ? row.nameAr : row.nameEn;
}

export type { Locale };
