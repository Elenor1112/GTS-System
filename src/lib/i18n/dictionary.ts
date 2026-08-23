/**
 * GTS — the UI text dictionary.
 *
 * Composed from one file per module under `./dict/`, each exporting its
 * own typed `en`/`ar` slice — typing `ar` against the same interface as
 * `en` makes a missing Arabic translation a compile error, not a silent
 * English leak into an Arabic screen. Splitting by module rather than one
 * flat file means a page can be translated without touching any other
 * page's strings.
 *
 * This does not replace `nameEn`/`nameAr` on data rows — a client's own
 * name is not UI text and is handled by `pickName()` in `./index.ts`.
 * This dictionary is for the chrome: labels, buttons, headings, hints.
 */

import * as shell from './dict/shell';
import * as admin from './dict/admin';
import * as overview from './dict/overview';
import * as people from './dict/people';
import * as catalogue from './dict/catalogue';
import * as operations from './dict/operations';
import * as finance from './dict/finance';

export const en = {
  ...shell.en,
  ...admin.en,
  ...overview.en,
  ...people.en,
  ...catalogue.en,
  ...operations.en,
  ...finance.en,
};

export const ar: typeof en = {
  ...shell.ar,
  ...admin.ar,
  ...overview.ar,
  ...people.ar,
  ...catalogue.ar,
  ...operations.ar,
  ...finance.ar,
};
