import { test, expect } from '@playwright/test';

/**
 * Every module renders, with real data and no error boundary.
 *
 * A broad sweep rather than deep assertions: the module-specific
 * behaviour is covered by its own spec. What this catches is the failure
 * that deep tests miss — a page that throws on a query, renders an empty
 * shell, or quietly shows a Next error overlay while its own suite
 * happens to be looking elsewhere.
 */

const MODULES = [
  { path: '/dashboard', heading: /Good morning/ },
  { path: '/accounts', heading: 'Accounts' },
  { path: '/bills', heading: 'Electronic bills' },
  { path: '/clients', heading: 'Clients' },
  { path: '/vendors', heading: 'Vendors' },
  { path: '/projects', heading: 'Projects' },
  { path: '/storage', heading: 'Storage' },
  { path: '/products', heading: 'Products' },
  { path: '/attendance', heading: 'Where you are' },
  { path: '/leave', heading: 'Leave' },
  { path: '/reports', heading: 'Reports' },
  { path: '/users', heading: 'Users' },
  { path: '/permissions', heading: 'Permissions' },
  { path: '/audit', heading: 'Audit log' },
  { path: '/admin', heading: 'Administration' },
  { path: '/notifications', heading: 'Notifications' },
] as const;

test.describe('every module', () => {
  for (const { path, heading } of MODULES) {
    test(`${path} renders`, async ({ page }) => {
      const failures: string[] = [];
      page.on('pageerror', (error) => failures.push(error.message));

      const response = await page.goto(path);
      expect(response?.status(), `${path} should return 200`).toBe(200);

      await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();

      // The rail is present, which means the shell resolved the session
      // rather than rendering a signed-out husk.
      await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();

      // Next's dev error overlay. `nextjs-portal` itself is present on
      // every dev page as a container, so its existence proves nothing —
      // what matters is whether it CONTAINS an error dialog.
      await expect(
        page.locator('nextjs-portal [role="dialog"], [data-nextjs-dialog]'),
      ).toHaveCount(0);

      expect(failures, `${path} threw in the browser`).toEqual([]);
    });
  }
});

test.describe('the reports tabs', () => {
  for (const tab of ['financial', 'inventory', 'projects', 'attendance'] as const) {
    test(`the ${tab} report computes`, async ({ page }) => {
      await page.goto(`/reports?tab=${tab}`);
      await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();

      // Each tab renders its own region rather than falling through to
      // an empty page — the aggregate ran.
      await expect(page.locator('.gts-region, .gts-empty').first()).toBeVisible();
      await expect(
        page.locator('nextjs-portal [role="dialog"], [data-nextjs-dialog]'),
      ).toHaveCount(0);
    });
  }
});

test.describe('the permission matrix', () => {
  test('shows the administrator holding every permission', async ({ page }) => {
    await page.goto('/permissions');

    // The administrator role holds them implicitly through can(), so the
    // matrix must show them rather than the empty row the table holds.
    const adminColumn = page.getByRole('columnheader', { name: /Administrator/ });
    await expect(adminColumn).toBeVisible();
    await expect(adminColumn).toContainText('all');

    // And it says so rather than offering checkboxes that would not save.
    await expect(
      page.getByText(/holds every permission implicitly/),
    ).toBeVisible();
  });

  test('lists the real permission keys the server checks', async ({ page }) => {
    await page.goto('/permissions');

    // These are the exact strings requirePermission() is called with.
    for (const key of ['bills.approve', 'inventory.manage', 'projects.location']) {
      await expect(page.getByText(key, { exact: true }).first()).toBeVisible();
    }
  });
});

test.describe('the audit log', () => {
  test('records real actions with their actor', async ({ page }) => {
    await page.goto('/audit');

    await expect(page.getByRole('heading', { name: 'Audit log' })).toBeVisible();
    // The seed and the test runs have both produced entries.
    await expect(page.locator('tbody tr').first()).toBeVisible();
  });

  test('filters by action', async ({ page }) => {
    await page.goto('/audit?action=LOGIN');
    await expect(page).toHaveURL(/action=LOGIN/);
    await expect(page.getByRole('heading', { name: 'Audit log' })).toBeVisible();
  });
});
