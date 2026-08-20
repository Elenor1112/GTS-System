import { test, expect } from '@playwright/test';

/**
 * The Egypt localisation, checked against the rendered application.
 *
 * These assert what a user or a tax inspector would actually see, so a
 * regression that reintroduces the previous market's currency, tax rate
 * or identifiers fails here rather than in production.
 *
 * Every route is now behind authentication. The session comes from
 * `auth.setup.ts` via the project's storageState, so these tests start
 * signed in — a localisation assertion against a redirect to the
 * sign-in page would pass by accident, having read no application
 * content at all.
 *
 * STATUS. These were written against the fixture prototype, where every
 * screen rendered hardcoded data. The modules are being converted to
 * real database queries one at a time, and the assertions below that
 * target a not-yet-converted screen are skipped with `fixture()` rather
 * than deleted or weakened. Each one names the module it is waiting for,
 * and un-skipping it is part of finishing that module — a test quietly
 * softened to pass is worse than one honestly marked pending.
 */

/**
 * Skip until the named module reads from the database.
 * Delete the call — never the assertion — when that module lands.
 */
const pendingModule = (module: string) =>
  test.skip(true, `Waiting on the ${module} module to be wired to the database.`);

test.describe('currency and market', () => {
  test('no page shows the previous market’s currency or places', async ({ page }) => {
    // This one test navigates all fourteen routes, and the dev server
    // compiles each on first request. The default 30s budget is for a
    // single interaction, not a fourteen-page sweep.
    test.slow();

    const routes = [
      '/dashboard', '/accounts', '/bills', '/clients', '/vendors',
      '/projects', '/storage', '/products', '/attendance', '/leave',
      '/reports', '/users', '/permissions', '/admin',
    ];

    for (const route of routes) {
      await page.goto(route);

      // Read the page's CONTENT only.
      //
      // Two things are deliberately excluded. <select> options, because
      // Chromium's innerText expands them and the currency selector
      // legitimately still offers SAR and AED for export contracts —
      // those are choices a user may make, not prices the system quotes.
      // And <script>, because Next.js inlines its hydration payload
      // there, which is data rather than anything a user reads.
      const body = await page.evaluate(() => {
        const clone = document.body.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('select, option, script, style').forEach((el) => el.remove());
        return clone.innerText;
      });

      // The Saudi market this was originally built for must be gone.
      expect(body, `${route} still prices in SAR`).not.toMatch(/\bSAR\b/);
      expect(body, `${route} still mentions ZATCA`).not.toContain('ZATCA');
      expect(body, `${route} still mentions Riyadh`).not.toContain('Riyadh');
      expect(body, `${route} still mentions Jeddah`).not.toContain('Jeddah');
      expect(body, `${route} still shows a 15% VAT rate`).not.toContain('VAT 15%');
    }
  });

  test('financial figures carry the Egyptian pound', async ({ page }) => {
    await page.goto('/bills');
    await expect(page.getByText('EGP').first()).toBeVisible();
  });
});

test.describe('tax', () => {
  test('the standard rate is 14%, not 15%', async ({ page }) => {
    await page.goto('/bills');
    const body = await page.locator('body').innerText();
    expect(body).toContain('VAT 14%');
    expect(body).not.toContain('VAT 15%');
  });

  test('a rendered bill agrees with the arithmetic done by hand', async ({ page }) => {
    // Against a REAL bill rather than a fixture with known constants:
    // the register is now database-backed, so the figures change with
    // the seed. What must hold is the RELATIONSHIP between them, which
    // is what the totals engine actually guarantees.
    await page.goto('/bills');
    await page.locator('tbody a[href^="/bills/"]').first().click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    /**
     * Read one totals row by its EXACT label.
     *
     * A substring match is wrong here: "Net" also matches "Net payable",
     * and reading the post-withholding figure as the taxable base makes
     * the identity below fail for a reason that has nothing to do with
     * the engine.
     */
    const read = async (label: string) => {
      const row = page
        .locator('.gts-totals-row')
        .filter({ has: page.getByText(label, { exact: true }) })
        .first();
      const text = await row.locator('.gts-num').innerText();
      return Number(text.replace(/[^0-9.−-]/g, '').replace('−', '-'));
    };

    const [net, vat, total] = await Promise.all([read('Net'), read('VAT'), read('Total')]);

    // Net + VAT = Total, to the piastre. A rounding bug anywhere in the
    // engine breaks this identity.
    expect(Math.abs(net + vat - total)).toBeLessThan(0.01);

    // And the VAT is a plausible Egyptian rate of the net — 14% standard,
    // less if the document mixes in zero-rated lines, never more.
    expect(vat).toBeLessThanOrEqual(net * 0.1401);
    expect(vat).toBeGreaterThan(0);
  });

  test('withholding reduces the receipt but never the total', async ({ page }) => {
    await page.goto('/bills');
    await page.locator('tbody a[href^="/bills/"]').first().click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const body = await page.locator('body').innerText();

    // Withholding appears only on documents above the ETA threshold, so
    // its absence on a small bill is correct rather than a failure.
    if (!body.includes('Withheld')) {
      test.skip(true, 'This bill carries no withholding — nothing to assert.');
      return;
    }

    // The sentence that stops it being misread as a discount.
    expect(body).toContain('reduces the cash received');
    // And the net payable is stated separately from the total, never
    // substituted for it.
    expect(body).toContain('Net payable');
  });
});

test.describe('statutory identifiers', () => {
  test('parties carry a 9-digit tax registration number', async ({ page }) => {
    // The parties are on the DOCUMENT, not on the register that lists
    // documents — so this has to open one.
    await page.goto('/bills');
    await page.locator('tbody a[href^="/bills/"]').first().click();
    await expect(page.getByRole('heading', { name: 'Parties' })).toBeVisible();

    const body = await page.locator('body').innerText();

    // The page spells the label out; `TRN.labelEn` is the single source
    // for that wording, so asserting the abbreviation would test a
    // string the application never shows.
    expect(body).toContain('Tax registration number');

    // Egyptian TRNs are 9 digits, conventionally grouped 123-456-789.
    expect(body).toMatch(/\b\d{3}-\d{3}-\d{3}\b/);

    // The 15-digit Saudi VAT format must not survive anywhere.
    expect(body).not.toMatch(/\b3\d{14}\b/);
  });
});

test.describe('e-invoicing honesty', () => {
  test('the ETA panel does not claim a connection it does not have', async ({ page }) => {
    await page.goto('/admin');

    await expect(
      page.getByRole('heading', { name: 'Egyptian Tax Authority e-invoicing' }),
    ).toBeVisible();

    // The document format is real; the transmission is not, and the
    // panel distinguishes them rather than implying a compliance link.
    await expect(page.getByText('Not configured')).toBeVisible();
    await expect(page.getByText('not transmitted')).toBeVisible();

    // A fabricated "Connected" status on a compliance integration is the
    // exact failure this asserts against.
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('Phase 2 compliant');
    expect(body).not.toContain('ZATCA');
  });

  test('the currency selector still offers foreign billing currencies', async ({ page }) => {
    // The currency is chosen per DOCUMENT, on the bill form — not once
    // in settings, because an export contract and a domestic sale can
    // be billed in different currencies in the same week.
    await page.goto('/bills/new');

    const currency = page.getByLabel('Currency');
    await expect(currency).toHaveValue('EGP');
    // Export contracts are billed in hard currency, so these must remain.
    await expect(currency.locator('option')).toContainText([/EGP/, /USD/]);
  });

  test('the default VAT rate is the Egyptian standard', async ({ page }) => {
    await page.goto('/bills/new');

    // A new line starts at the standard rate. The others stay available
    // for zero-rated exports and exempt supplies.
    await expect(page.getByLabel('VAT').first()).toHaveValue('14');
    await expect(page.getByLabel('VAT').first().locator('option')).toContainText([
      /Standard 14%/,
      /Zero-rated/,
    ]);
  });

  test('an unsubmitted document shows no invented ETA identifier', async ({ page }) => {
    await page.goto('/bills');
    await page.locator('tbody a[href^="/bills/"]').first().click();
    await expect(page.getByRole('heading', { name: 'Egyptian Tax Authority' })).toBeVisible();

    const body = await page.locator('body').innerText();

    // No integration exists, and the panel says so rather than implying
    // a compliance link that is not there.
    expect(body).toContain('Not submitted');
    expect(body).toContain('not transmitted');

    // No fabricated UUID: the placeholder is an em dash, not a hex string.
    expect(body).not.toMatch(/UUID\s+[0-9a-f]{6,}/i);
  });
});

test.describe('working calendar', () => {
  test('the working day and late threshold come from settings', async ({ page }) => {
    await page.goto('/attendance');

    // The attendance screen states the configured working hours, which
    // is what the Sunday–Thursday week is enforced against server-side.
    // (The weekend rule itself is unit-tested in tests/server: Friday and
    // Saturday are excluded from leave working-day counts and from
    // absence, where asserting on real dates is precise rather than
    // dependent on which day the suite happens to run.)
    await expect(page.getByText(/Working day starts/)).toBeVisible();
    await expect(page.getByText(/late after/)).toBeVisible();
  });
});

test.describe('geolocation', () => {
  test('the site offers navigation from the project’s own coordinates', async ({ page }) => {
    // Navigation is offered from the PROJECT record, so this reads the
    // project page — which is where an administrator sets it — rather
    // than depending on who the signed-in user is assigned to.
    await page.goto('/projects');
    await page.locator('tbody a[href^="/projects/"]').first().click();
    await expect(page.getByRole('heading', { name: 'Site location' })).toBeVisible();

    const maps = page.getByRole('link', { name: /Open in Google Maps/i }).first();
    await expect(maps).toBeVisible();

    const href = await maps.getAttribute('href');
    expect(href).toContain('google.com/maps');

    // The destination is a real coordinate pair from the project record.
    // The employee never supplies it, so they cannot navigate themselves
    // somewhere else and check in against it.
    expect(href).toMatch(/destination=\d{2}\.\d+%2C\d{2}\.\d+/);
  });
});
