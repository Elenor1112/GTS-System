import { test, expect, type Page } from '@playwright/test';

/**
 * The printed bill, in the Egyptian Tax Authority's own format.
 *
 * These assert the document a tax inspector would be handed, which is
 * why they run against the print MEDIA rather than the screen one: the
 * ETA layout's colours, page box and table repetition all live in
 * `@media print`, so a screen-only assertion would pass over exactly the
 * rules most likely to break.
 *
 * The suite deliberately covers both languages from one spec. The
 * document is a single bilingual component, and the whole point of the
 * rewrite was that Arabic and English cannot drift apart — a pair of
 * per-language specs would let them.
 */

const LOCALE_COOKIE = 'gts_locale';
const THEME_COOKIE = 'gts_theme';

/** Set the display cookies the way the app's own switcher does. */
async function withPreferences(page: Page, locale: 'en' | 'ar', theme?: 'light' | 'dark') {
  const cookies = [
    { name: LOCALE_COOKIE, value: locale, url: 'http://localhost:3400' },
    ...(theme ? [{ name: THEME_COOKIE, value: theme, url: 'http://localhost:3400' }] : []),
  ];
  await page.context().addCookies(cookies);
}

/**
 * The first bill in the list, as a print URL.
 *
 * Reads an id from the application rather than seeding one, so the test
 * exercises a bill created by the real code path. Returns null when the
 * database has none, which is a skip rather than a failure — an empty
 * table is a fixture problem, not a regression in the document.
 */
async function firstBillPrintUrl(page: Page): Promise<string | null> {
  await page.goto('/bills');
  // `.gts-cell-link` is the row link specifically. A bare href^="/bills/"
  // also matches the "New bill" action, whose /bills/new/print is a 404.
  const link = page.locator('a.gts-cell-link[href^="/bills/"]').first();
  if ((await link.count()) === 0) return null;
  const href = await link.getAttribute('href');
  if (!href || !/^\/bills\/[^/]+$/.test(href) || href === '/bills/new') return null;
  return `${href}/print`;
}

test.describe('ETA bill document', () => {
  test.beforeEach(async ({ page }) => {
    // The print route calls window.print() on arrival. Left unhandled the
    // dialog blocks the page and every assertion below times out on it.
    await page.addInitScript(() => {
      window.print = () => {};
    });
  });

  test('renders the ETA format in Arabic, right to left', async ({ page }) => {
    test.slow(); // the print route compiles on first request

    await withPreferences(page, 'ar');
    const url = await firstBillPrintUrl(page);
    test.skip(!url, 'No bill in the database to print.');

    await page.emulateMedia({ media: 'print' });
    await page.goto(url!);

    const doc = page.locator('.gts-eta-doc');
    await expect(doc).toBeVisible();
    await expect(doc).toHaveAttribute('dir', 'rtl');
    // `lang` as well as `dir`: it is what activates the Arabic type rules.
    await expect(doc).toHaveAttribute('lang', 'ar');

    await expect(page.locator('.gts-eta-doc-title')).toHaveText('فاتورة');
    await expect(page.locator('.gts-eta-doc-band-head').first()).toHaveText('البائع');
    await expect(page.locator('.gts-eta-doc-band-head--buyer')).toHaveText('المشتري');

    // The bands, the item table and the totals grid are the document.
    await expect(page.locator('.gts-eta-doc-items')).toBeVisible();
    await expect(page.locator('.gts-eta-doc-totals tr').last()).toContainText('اجمالي المبلغ');
  });

  test('renders the same document in English, left to right', async ({ page }) => {
    test.slow();

    await withPreferences(page, 'en');
    const url = await firstBillPrintUrl(page);
    test.skip(!url, 'No bill in the database to print.');

    await page.emulateMedia({ media: 'print' });
    await page.goto(url!);

    const doc = page.locator('.gts-eta-doc');
    await expect(doc).toBeVisible();
    await expect(doc).toHaveAttribute('dir', 'ltr');
    await expect(doc).toHaveAttribute('lang', 'en');

    await expect(page.locator('.gts-eta-doc-title')).toHaveText('Invoice');
    await expect(page.locator('.gts-eta-doc-band-head').first()).toHaveText('Seller');
    await expect(page.locator('.gts-eta-doc-band-head--buyer')).toHaveText('Buyer');
    await expect(page.locator('.gts-eta-doc-totals tr').last()).toContainText('Total amount');
  });

  /*
   * The regression the scoped literal palette exists to prevent.
   *
   * Every --gts-* token inverts under a dark theme. If the document ever
   * goes back to building on them, a user who prefers a dark UI prints a
   * dark tax document — so this asserts the paper is white regardless.
   */
  test('prints on white in a dark theme', async ({ page }) => {
    test.slow();

    await withPreferences(page, 'ar', 'dark');
    const url = await firstBillPrintUrl(page);
    test.skip(!url, 'No bill in the database to print.');

    await page.emulateMedia({ media: 'print' });
    await page.goto(url!);

    const doc = page.locator('.gts-eta-doc');
    await expect(doc).toBeVisible();
    await expect(doc).toHaveCSS('background-color', 'rgb(255, 255, 255)');

    // The seller bar keeps the authority's slate blue, not an inverted one.
    await expect(page.locator('.gts-eta-doc-band-head').first()).toHaveCSS(
      'background-color',
      'rgb(62, 80, 96)',
    );
  });

  /*
   * An unsubmitted bill must keep the layout a submitted one has. The
   * system has no ETA transmission integration, so it must NOT invent a
   * UUID or a QR — but the rows and the QR's box still occupy their
   * space, or the two documents would not be comparable.
   */
  test('keeps the ETA chrome when the bill was never submitted', async ({ page }) => {
    test.slow();

    await withPreferences(page, 'ar');
    const url = await firstBillPrintUrl(page);
    test.skip(!url, 'No bill in the database to print.');

    await page.emulateMedia({ media: 'print' });
    await page.goto(url!);

    const qrBox = page.locator('.gts-eta-doc-qr');
    await expect(qrBox).toBeVisible();

    // A seeded bill has no ETA UUID, so there must be no QR image inside
    // the box that is nonetheless still laid out.
    const hasQr = (await qrBox.locator('img').count()) > 0;
    expect(hasQr).toBe(false);

    // The reference rows are present and honestly empty.
    await expect(page.locator('.gts-eta-doc-refs')).toContainText('الرقم الإلكتروني');
    await expect(page.locator('.gts-eta-doc-band').first()).toBeVisible();
  });

  test('the classic layout stays reachable', async ({ page }) => {
    test.slow();

    await withPreferences(page, 'en');
    const url = await firstBillPrintUrl(page);
    test.skip(!url, 'No bill in the database to print.');

    await page.goto(`${url!}?layout=classic`);

    await expect(page.locator('.gts-eta-doc')).toHaveCount(0);
    await expect(page.locator('table.gts-table')).toBeVisible();
  });
});
