/**
 * GTS — Next.js font loading.
 * Import in app/layout.tsx and apply `gtsFontVars` to <html>.
 * next/font self-hosts these at build time: no external request,
 * no CLS, and the CSP in production stays clean.
 */
import { Instrument_Sans, Fraunces, IBM_Plex_Sans_Arabic, Roboto_Flex } from 'next/font/google';

export const archivo = Instrument_Sans({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-archivo',
  // Metric-compatible fallback: prevents layout shift before swap.
  adjustFontFallback: true,
});

export const newsreader = Fraunces({
  subsets: ['latin', 'latin-ext'],
  axes: ['opsz', 'SOFT', 'WONK'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-newsreader',
});

export const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-plex-arabic',
});

export const robotoFlex = Roboto_Flex({
  subsets: ['latin'],
  axes: ['opsz', 'GRAD'],
  display: 'swap',
  variable: '--font-roboto-flex',
});

export const gtsFontVars = [
  archivo.variable,
  newsreader.variable,
  plexArabic.variable,
  robotoFlex.variable,
].join(' ');
