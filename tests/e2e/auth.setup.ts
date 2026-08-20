import { test as setup, expect } from '@playwright/test';
import { ADMIN_STATE } from '../../playwright.config';

/**
 * Sign in ONCE and save the session for every other spec to reuse.
 *
 * Argon2id is deliberately expensive — that is the whole point of it —
 * and a dozen parallel workers each performing their own sign-in turn a
 * password hash into a self-inflicted load test. Worse, they turn a
 * legitimate rate limit into a suite that fails for reasons unrelated to
 * what any test is checking.
 *
 * `auth.spec.ts` deliberately does NOT use this state: it is the suite
 * that tests signing in, so it must start signed out.
 */

const ADMIN = { email: 'admin@gts.example', password: 'Admin!2026' };

setup('authenticate as administrator', async ({ page }) => {
  /*
   * This is the FIRST request the dev server sees, so it pays for
   * compiling /sign-in, the sign-in action and /dashboard on demand,
   * on top of the argon2id verification and a round trip to Neon in
   * us-east-2. The suite's 15s assertion budget is sized for a warm
   * server; a cold start needs its own allowance.
   */
  setup.setTimeout(180_000);

  /*
   * Warm the routes this run will touch.
   *
   * Next compiles a route on its first request, and a protected route
   * redirects to /sign-in BEFORE compiling — so simply pinging it does
   * not warm it. Signing in first, then visiting them, is what actually
   * pays that cost here, once, rather than inside a test whose timeout
   * is sized for an interaction.
   */
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(ADMIN.email);
  await page.getByLabel('Password').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Wait for the destination to render, not merely for the URL to change:
  // saving the cookie before the session is established would store an
  // empty jar.
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 120_000 });
  await expect(page.getByRole('heading', { name: /Good morning/ })).toBeVisible({ timeout: 60_000 });

  await page.context().storageState({ path: ADMIN_STATE });

  // Now signed in, compile the rest of the routes the suite visits, so
  // the first test to reach one is not the test that pays for it.
  for (const route of ['/projects', '/attendance', '/clients', '/bills', '/admin']) {
    await page.goto(route, { waitUntil: 'commit' }).catch(() => {});
  }
});
