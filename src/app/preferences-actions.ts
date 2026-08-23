'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { THEME_COOKIE, LOCALE_COOKIE, type Theme, type Locale } from '@/lib/preferences';

/**
 * Theme and language, set from the user menu.
 *
 * No `action()` wrapper: a display preference has no authorization
 * dimension — it is not tied to a permission or a record, just a cookie
 * on the visitor's own browser — so the only thing worth guarding is the
 * value itself.
 */

const YEAR = 60 * 60 * 24 * 365;

export async function setTheme(formData: FormData): Promise<void> {
  const value = formData.get('theme');
  if (value !== 'light' && value !== 'dark' && value !== 'system') return;

  const theme: Theme = value;
  const jar = await cookies();
  jar.set(THEME_COOKIE, theme, {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: YEAR,
  });
  revalidatePath('/', 'layout');
}

export async function setLocale(formData: FormData): Promise<void> {
  const value = formData.get('locale');
  if (value !== 'en' && value !== 'ar') return;

  const locale: Locale = value;
  const jar = await cookies();
  jar.set(LOCALE_COOKIE, locale, {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: YEAR,
  });
  revalidatePath('/', 'layout');
}
