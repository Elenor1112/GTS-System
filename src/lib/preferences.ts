import 'server-only';

import { cookies } from 'next/headers';
import { cache } from 'react';

/**
 * GTS — display preferences.
 *
 * Theme and language live in cookies, not on the `User` row: both must
 * resolve on the sign-in page, before there is an actor to attach them
 * to, and a cookie needs no migration. Wrapped in React `cache()` the
 * same way `getActor` is, so a page that reads either more than once
 * per request still costs one read.
 */

export type Theme = 'light' | 'dark' | 'system';
export type Locale = 'en' | 'ar';

export const THEME_COOKIE = 'gts_theme';
export const LOCALE_COOKIE = 'gts_locale';

const THEMES: readonly Theme[] = ['light', 'dark', 'system'];
const LOCALES: readonly Locale[] = ['en', 'ar'];

export const getTheme = cache(async (): Promise<Theme> => {
  const jar = await cookies();
  const value = jar.get(THEME_COOKIE)?.value;
  return THEMES.includes(value as Theme) ? (value as Theme) : 'system';
});

export const getLocale = cache(async (): Promise<Locale> => {
  const jar = await cookies();
  const value = jar.get(LOCALE_COOKIE)?.value;
  return LOCALES.includes(value as Locale) ? (value as Locale) : 'en';
});
