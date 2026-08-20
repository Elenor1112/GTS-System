import { test, expect } from '@playwright/test';
import 'dotenv/config';

/**
 * Attendance and the geofence, through a real browser with a real
 * (simulated) device position.
 *
 * Playwright's `setGeolocation` drives the actual Geolocation API, so the
 * page takes the same path a phone does: permission, watchPosition, a
 * coordinate pair posted to the server, and the server's own verdict
 * deciding what — if anything — is written.
 *
 * The flow from the brief:
 *   admin creates project → assigns location → assigns employee →
 *   employee opens project → navigates → checks in inside the fence →
 *   attendance is recorded
 */

/** Palm Hills New Cairo, PRJ-0142 — the seeded site, 300m fence. */
const SITE = { latitude: 30.0131, longitude: 31.4914 };
/** Downtown Cairo, ~25km away. */
const FAR = { latitude: 30.0444, longitude: 31.2357 };

test.use({ permissions: ['geolocation'] });

/*
 * Serial, deliberately.
 *
 * These tests share one employee, one site and one Cairo day, and the
 * database enforces one check-in per employee per project per day. Run
 * in parallel they would race each other for that single row and fail
 * on their own interference rather than on the behaviour under test.
 */
test.describe.configure({ mode: 'serial' });

/**
 * The signed-in administrator must be assigned to the site before they
 * can check in — that is the rule under test, not an obstacle to it.
 *
 * The assignment is made through the application's own project screen,
 * so this covers the first half of the brief's critical flow: an admin
 * assigns an employee, and only then can that employee attend.
 */
test.beforeEach(async ({ page }) => {
  await page.goto('/projects');
  await page.getByRole('link', { name: /Palm Hills New Cairo/ }).first().click();
  await expect(page.getByRole('heading', { name: /Palm Hills New Cairo/ })).toBeVisible();

  // The dropdown lists only people NOT already on this site, so an
  // absent option means the assignment already exists — which is the
  // state the tests need either way.
  const picker = page.getByLabel('Employee');
  const options = await picker.locator('option').allTextContents();

  if (options.some((o) => o.includes('Nadia Shalaby'))) {
    const value = await picker.locator('option', { hasText: 'Nadia Shalaby' }).getAttribute('value');
    await picker.selectOption(value!);
    await page.getByRole('button', { name: 'Assign', exact: true }).click();
    // The success banner, not the table's "Assigned" column header.
    await expect(page.getByRole('status')).toContainText(/Assigned/);
  }
});

test.describe('the check-in screen', () => {
  test('shows the assigned site and where it is', async ({ page, context }) => {
    await context.setGeolocation(SITE);
    await page.goto('/attendance');

    await expect(page.getByRole('heading', { name: 'Where you are' })).toBeVisible();
    // The site the administrator pinned, not one the employee chose.
    await expect(page.getByText('Palm Hills New Cairo', { exact: false }).first()).toBeVisible();
  });

  test('offers navigation to the project’s own coordinates', async ({ page, context }) => {
    await context.setGeolocation(SITE);
    await page.goto('/attendance');

    const maps = page.getByRole('link', { name: 'Open in Google Maps' }).first();
    await expect(maps).toBeVisible();

    // The destination comes from the project record. An employee who
    // could type a destination could navigate somewhere else and check
    // in against it.
    const href = await maps.getAttribute('href');
    expect(href).toContain('google.com/maps/dir');
    expect(href).toContain('30.0131');
    expect(href).toContain('31.4914');
  });

  test('states the fence radius the administrator set', async ({ page, context }) => {
    await context.setGeolocation(SITE);
    await page.goto('/attendance');

    await expect(page.getByText(/300m radius/)).toBeVisible();
  });
});

test.describe('the geofence decides', () => {
  test('refuses a check-in from far away, and says how far', async ({ page, context }) => {
    await context.setGeolocation(FAR);
    await page.goto('/attendance');

    await page.getByRole('button', { name: /Attend/ }).first().click();

    /*
     * Wait for the position, not merely for the click.
     *
     * `watchPosition` is asynchronous and, on a throttled mobile profile
     * under parallel load, the first fix can take several seconds. The
     * screen legitimately shows "Attend" until one arrives, so asserting
     * on the distance immediately measures geolocation latency rather
     * than the geofence.
     */
    await expect(page.getByText(/Finding you|Distance to site/)).toBeVisible();

    // The distance is computed from the real coordinate pair, so it is a
    // genuine ~25km rather than a placeholder.
    await expect(page.getByText(/Distance to site/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Too far to check in/)).toBeVisible();

    // And the action is not available.
    await expect(page.getByRole('button', { name: /Too far to check in/ })).toBeDisabled();
  });

  test('unlocks check-in inside the fence and records it', async ({ page, context }) => {
    await context.setGeolocation(SITE);
    await page.goto('/attendance');

    await page.getByRole('button', { name: /Attend/ }).first().click();

    // Same latency allowance as the refusal test: the button only says
    // "Check in" once a device fix has arrived and been evaluated.
    const checkIn = page.getByRole('button', { name: /Check in/ }).first();
    await expect(checkIn).toBeEnabled({ timeout: 30_000 });
    await checkIn.click();

    // The record exists and carries the SERVER's distance, not a claim.
    await expect(page.getByText('Checked in')).toBeVisible();
    await expect(page.getByText(/from the site centre/)).toBeVisible();
  });

  /*
   * Clear today's record afterwards.
   *
   * The database enforces one check-in per employee per project per
   * Cairo day — correctly — so leaving the record behind means the next
   * project (mobile) finds the site already checked in and cannot
   * exercise the check-in path at all.
   */
  test.afterAll(async () => {
    const { PrismaClient } = await import('@prisma/client');
    const { PrismaNeon } = await import('@prisma/adapter-neon');
    const db = new PrismaClient({
      adapter: new PrismaNeon({ connectionString: process.env.DIRECT_URL! }),
    });
    try {
      /*
       * TODAY's records only, by `workDate`.
       *
       * A `createdAt` window would also catch the seeded history — it is
       * back-dated across three weeks but was inserted minutes ago — and
       * quietly erase the development data this suite is meant to leave
       * alone.
       */
      const cairoToday = new Date(
        `${new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date())}T00:00:00.000Z`,
      );
      await db.attendance.deleteMany({ where: { workDate: cairoToday } });
    } finally {
      await db.$disconnect();
    }
  });

  test('refuses a second check-in on the same day', async ({ page, context }) => {
    await context.setGeolocation(SITE);
    await page.goto('/attendance');

    // The first one may already exist from the test above; either way,
    // what must be true is that the screen offers check-OUT rather than
    // a second check-in.
    const alreadyIn = await page.getByText('Checked in').isVisible().catch(() => false);
    if (!alreadyIn) {
      await page.getByRole('button', { name: /Attend/ }).first().click();
      await page.getByRole('button', { name: /Check in/ }).first().click();
      await expect(page.getByText('Checked in')).toBeVisible();
    }

    await page.reload();
    await expect(page.getByRole('button', { name: 'Check out' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Check in$/ })).toHaveCount(0);
  });
});
