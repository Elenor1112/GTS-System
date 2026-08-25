/**
 * GTS — Next.js font loading.
 * Import in app/layout.tsx and apply `gtsFontVars` to <html>.
 * next/font self-hosts these at build time: no external request,
 * no CLS, and the CSP in production stays clean.
 */
import { Instrument_Sans, Fraunces, IBM_Plex_Sans_Arabic, Roboto_Flex, Barlow_Condensed, Inter } from 'next/font/google';

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

// Dispatch-board dashboard identity: a condensed, heavy grotesque for
// stamped section labels, and a plain grotesque for body/data — no
// serif anywhere, deliberately distinct from the paper-ledger voice
// the rest of the app uses.
export const barlowCondensed = Barlow_Condensed({
  subsets: ['latin', 'latin-ext'],
  weight: ['600', '700', '800'],
  display: 'swap',
  variable: '--font-barlow-condensed',
});

export const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-inter',
  adjustFontFallback: true,
});

export const gtsFontVars = [
  archivo.variable,
  newsreader.variable,
  plexArabic.variable,
  robotoFlex.variable,
  barlowCondensed.variable,
  inter.variable,
].join(' ');

/**
 * Material Symbols Outlined — self-hosted, not loaded via next/font
 * (the variable-font ligature icon set isn't exposed by next/font/google).
 * The woff2 lives in /public/fonts; @font-face is declared once in
 * globals.css against this same URL so both stay in sync.
 */

