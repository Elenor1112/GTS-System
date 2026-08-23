import type { Metadata } from 'next';
import { gtsFontVars } from '../../design-system/fonts';
import { getTheme, getLocale } from '@/lib/preferences';
import './globals.css';

export const metadata: Metadata = {
  title: 'GTS — Business Operating System',
  description: 'Accounts, storage, projects, clients, vendors, bills and attendance.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [theme, locale] = await Promise.all([getTheme(), getLocale()]);

  // `en-GB`, not `en`: the browser formats <input type="date"> from the
  // document language, and bare "en" gives the US month-first order.
  // Egypt writes dates day-first, and a due date read as 08/09 instead
  // of 09/08 is a month's difference on an invoice.
  const lang = locale === 'ar' ? 'ar' : 'en-GB';
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  // `data-theme` is set only for an explicit choice. Left absent for
  // 'system', so the `@media (prefers-color-scheme)` block in color.css
  // — not this attribute — decides. The preference is read from a
  // cookie server-side, so the correct attribute is in the initial HTML
  // and no anti-FOUC script is needed.
  const dataTheme = theme === 'system' ? undefined : theme;

  return (
    <html lang={lang} dir={dir} data-theme={dataTheme} className={gtsFontVars} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
