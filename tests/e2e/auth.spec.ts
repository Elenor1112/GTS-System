import { test, expect } from '@playwright/test';

/**
 * Authentication and route protection, through a real browser.
 *
 * These drive the actual application: a real form post, a real session
 * cookie, a real database lookup. Nothing is stubbed, because the thing
 * worth verifying is precisely that the whole chain holds together.
 */

const ADMIN = { email: 'admin@gts.example', password: 'Admin!2026' };

test.describe('route protection', () => {
  test('sends a signed-out visitor to sign-in and remembers where they were going', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/sign-in/);
    expect(page.url()).toContain('from=%2Fdashboard');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('protects every module route', async ({ page }) => {
    for (const route of ['/accounts', '/bills', '/clients', '/projects', '/storage', '/admin']) {
      await page.goto(route);
      await expect(page, `${route} should require a session`).toHaveURL(/\/sign-in/);
    }
  });
});

test.describe('signing in', () => {
  test('refuses a wrong password without revealing whether the account exists', async ({ page }) => {
    await page.goto('/sign-in');

    await page.getByLabel('Email address').fill(ADMIN.email);
    await page.getByLabel('Password').fill('definitely-not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    const error = page.getByTestId('sign-in-error');
    await expect(error).toBeVisible();
    await expect(error).toHaveText(/do not match/i);

    // Still on the sign-in page, still no session.
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test('gives an unknown address the same message as a wrong password', async ({ page }) => {
    await page.goto('/sign-in');

    /*
     * A fresh address every run.
     *
     * The rate limiter keys on account plus origin and locks out after
     * eight failures in fifteen minutes — correctly. A fixed address
     * accumulates one failure per run, so after eight runs this test
     * starts reading "Too many failed attempts" instead of the message
     * it is actually asserting on, and looks like a regression in the
     * error wording rather than the limiter doing its job.
     */
    await page.getByLabel('Email address').fill(`nobody-${Date.now()}@gts.example`);
    await page.getByLabel('Password').fill('anything-at-all');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Identical wording: the message must not become an oracle for which
    // addresses are registered.
    await expect(page.getByTestId('sign-in-error')).toHaveText(/do not match/i);
  });

  test('signs in and lands on the dashboard', async ({ page }) => {
    await page.goto('/sign-in');

    await page.getByLabel('Email address').fill(ADMIN.email);
    await page.getByLabel('Password').fill(ADMIN.password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: /Good morning/ })).toBeVisible();
  });

  test('resumes the route the visitor originally asked for', async ({ page }) => {
    await page.goto('/clients');
    await expect(page).toHaveURL(/\/sign-in/);

    await page.getByLabel('Email address').fill(ADMIN.email);
    await page.getByLabel('Password').fill(ADMIN.password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/clients/);
  });

  test('issues an httpOnly session cookie', async ({ page, context }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Email address').fill(ADMIN.email);
    await page.getByLabel('Password').fill(ADMIN.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    const cookie = (await context.cookies()).find((c) => c.name === 'gts_session');
    expect(cookie, 'a session cookie should be set').toBeDefined();
    // Unreadable to script, so an XSS cannot exfiltrate the session.
    expect(cookie!.httpOnly).toBe(true);
    expect(cookie!.sameSite).toBe('Lax');
  });
});

test.describe('signed in', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Email address').fill(ADMIN.email);
    await page.getByLabel('Password').fill(ADMIN.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('shows who is signed in, and their role', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Nadia Shalaby/ })).toBeVisible();
    await expect(page.getByText('Administrator')).toBeVisible();
  });

  test('skips the sign-in form for someone already signed in', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('signs out and ends the session', async ({ page }) => {
    await page.getByRole('button', { name: /Nadia Shalaby/ }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();

    await expect(page).toHaveURL(/\/sign-in/);

    // The session is genuinely gone, not merely navigated away from.
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
