import { defineConfig, devices } from '@playwright/test';

import path from 'node:path';

/**
 * Where auth.setup.ts saves the signed-in session for the other
 * projects to reuse. Declared here rather than imported from the setup
 * file — Playwright loads this config with require(), which cannot pull
 * in a TypeScript test module.
 */
/*
 * Deliberately OUTSIDE `test-results/`.
 *
 * Playwright empties that directory at the start of a run. With the
 * session file inside it, the `setup` project writes the state and the
 * cleanup then removes it, so every context created afterwards fails
 * with ENOENT — which surfaces as dozens of unrelated tests failing at
 * once and looks like an application fault rather than a path choice.
 */
export const ADMIN_STATE = path.join('.playwright', 'admin-state.json');

/**
 * Playwright drives the real application, not a mock of it. The dev
 * server is started by the runner so a test run cannot silently pass
 * against a stale build.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Specs and the auth setup are collectable; global-teardown.ts, which
     also lives in this directory, is not a test and must not be run as
     one. Per-project testMatch narrows further from here. */
  testMatch: /.*\.(spec|setup)\.ts$/,
  globalTeardown: './tests/e2e/global-teardown.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : [['list'], ['html', { open: 'never' }]],

  /*
   * Navigation and assertion budgets, raised from the 5s default.
   *
   * A sign-in here is not a client-side route change: it is an argon2id
   * verification (deliberately ~50ms), a round trip to Neon in
   * us-east-2, and — in dev — Next compiling the destination route on
   * first request. 5s is a budget for a local interaction, not for that
   * chain, and failing on it tests the runner's patience rather than the
   * application.
   */
  expect: { timeout: 15_000 },
  timeout: 60_000,

  /*
   * Four workers, not one per core.
   *
   * These drive a single Next dev server that compiles routes on demand
   * and a single Neon connection pool. Past about four concurrent
   * browsers the bottleneck stops being the browser and becomes the
   * server: navigations queue, and tests fail on a timeout that measures
   * contention rather than anything about the application. Each spec
   * passes alone at any width — this is the number at which they also
   * pass together.
   */
  /*
   * Two workers.
   *
   * These drive a single Next dev server compiling routes on demand and
   * a single Neon pool over a network round trip. Beyond two concurrent
   * browsers the bottleneck stops being the browser: `getActor()` cannot
   * acquire a connection in time, and because a failed session lookup is
   * indistinguishable from a missing one, authenticated pages return 500
   * — a failure that looks like an auth bug and is really contention.
   *
   * Every spec passes alone at any width. Two is the number at which the
   * whole suite also passes together, which is the number that matters.
   */
  workers: 2,

  use: {
    baseURL: 'http://localhost:3400',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    /* Cairo, so any date or time assertion runs in the timezone the
       business actually operates in rather than the runner's. */
    timezoneId: 'Africa/Cairo',
    locale: 'en-GB',
  },

  projects: [
    /*
     * Signs in once; every project below reuses the saved session.
     *
     * Retried even locally. This is the first request a freshly started
     * dev server sees, so it pays for compiling /sign-in, the sign-in
     * action and /dashboard on demand. A first attempt can exceed the
     * budget on a cold server and the second then passes in seconds —
     * without the retry, that cold start fails the entire suite before
     * a single test runs.
     */
    { name: 'setup', testMatch: /auth\.setup\.ts/, retries: 2 },

    /*
     * The sign-in suite itself runs SIGNED OUT — it is the thing under
     * test, so handing it a session would make most of it vacuous.
     */
    {
      name: 'auth',
      testMatch: /auth\.spec\.ts/,
      /*
       * One worker. Every test here performs a real sign-in, and
       * argon2id is deliberately expensive — eight in parallel is a
       * self-inflicted load test that times out on the very hashing
       * cost the design intends. They also share the rate limiter's
       * per-account bucket, so running them concurrently makes one
       * test's deliberate failure count against another's success.
       */
      workers: 1,
      /*
       * Retried, like `setup`. These are the first requests a cold dev
       * server sees after the setup project's, and a sign-in that has to
       * wait on route compilation can exceed the 15s assertion budget.
       * The retry passes in seconds once the routes are warm — without
       * it, a cold start fails the whole run, because every project
       * downstream depends on this one.
       */
      retries: 2,
      use: { ...devices['Desktop Chrome'] },
      /*
       * Depends on setup not for its session — this project deliberately
       * starts signed out — but for its timing: setup absorbs the dev
       * server's cold compile, so these tests meet a warm server and can
       * hold the suite's ordinary 15s budget.
       *
       * Runs before `desktop` (which depends on it) so its repeated
       * argon2id sign-ins do not compete with the parallel desktop
       * workers for the same CPU.
       */
      dependencies: ['setup'],
    },

    {
      name: 'desktop',
      /* Specs only — the setup file is the `setup` project's job, and
         running it again here would re-authenticate per worker, which is
         precisely what the shared storageState exists to avoid. */
      testMatch: /.*\.spec\.ts$/,
      testIgnore: /auth\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: ADMIN_STATE },
      dependencies: ['setup', 'auth'],
    },

    /*
     * Attendance is used outdoors on a phone, so the mobile layout gets
     * genuinely exercised.
     *
     * It runs AFTER desktop, not alongside it. Both projects drive the
     * same database: run concurrently they race for the same generated
     * client codes and for the single "one check-in per employee per
     * project per day" row, and fail on each other's interference rather
     * than on anything about the mobile layout.
     *
     * Scoped to the specs where the mobile layout is the point. Re-running
     * the client CRUD suite on a phone viewport tests the same server
     * twice and doubles the fixtures it leaves behind.
     */
    {
      name: 'mobile',
      testMatch: /(attendance|egypt-locale)\.spec\.ts$/,
      use: { ...devices['Pixel 7'], storageState: ADMIN_STATE },
      dependencies: ['setup', 'desktop'],
    },
  ],

  webServer: {
    command: 'npm run dev',
    /* Wait on a route that does not require a session — /dashboard
       redirects when signed out, and a redirect is not readiness. */
    url: 'http://localhost:3400/sign-in',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
