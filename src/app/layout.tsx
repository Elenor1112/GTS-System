import type { Metadata } from 'next';
import { gtsFontVars } from '../../design-system/fonts';
import './globals.css';

export const metadata: Metadata = {
  title: 'GTS — Business Operating System',
  description: 'Accounts, storage, projects, clients, vendors, bills and attendance.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // lang/dir drive the whole dual-script system. Switch to
    // lang="ar" dir="rtl" and every screen mirrors correctly.
    // `en-GB`, not `en`: the browser formats <input type="date"> from
    // the document language, and bare "en" gives the US month-first
    // order. Egypt writes dates day-first, and a due date read as
    // 08/09 instead of 09/08 is a month's difference on an invoice.
    <html lang="en-GB" dir="ltr" className={gtsFontVars} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
