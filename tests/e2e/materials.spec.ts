import { test, expect } from '@playwright/test';

/**
 * Materials — allocating stock to a project, through the real screen.
 *
 * The inventory engine is covered against the real database in
 * `tests/server/inventory.test.ts`. What was NOT covered was the path a
 * person actually takes, and a bug lived in exactly that gap: the
 * allocate action required a `notes` field the form never rendered, so
 * every submission failed validation on an input the user could not see.
 * The action returned an error with nowhere to display it and the screen
 * simply did nothing — the button appeared dead.
 *
 * These tests assert the round trip: press Allocate, and the numbers on
 * the page and in the warehouse both move.
 */

/** A project that can still receive stock, with warehouses holding some. */
async function openAllocatableProject(page: import('@playwright/test').Page) {
  await page.goto('/projects');
  const links = page.locator('table a[href^="/projects/"]');
  const count = await links.count();

  for (let i = 0; i < count; i++) {
    const href = await links.nth(i).getAttribute('href');
    if (!href) continue;
    await page.goto(href);
    const product = page.locator('#allocate-productId');
    if (await product.count()) {
      // A product option beyond the "Select a product" placeholder.
      if ((await page.locator('#allocate-productId option').count()) > 1) return href;
    }
  }
  throw new Error('no project offered an allocatable product');
}

test('allocating stock moves it out of the warehouse and onto the project', async ({ page }) => {
  await openAllocatableProject(page);

  const productSelect = page.locator('#allocate-productId');
  const value = await productSelect.locator('option').nth(1).getAttribute('value');
  await productSelect.selectOption(value!);

  // The warehouse list narrows to shelves actually holding this product.
  const warehouse = page.locator('#allocate-warehouseId');
  await expect(warehouse).toBeEnabled();
  const whLabel = await warehouse.locator('option').nth(1).innerText();
  const availableBefore = Number(whLabel.match(/—\s*([\d.]+)/)?.[1]);
  expect(Number.isFinite(availableBefore)).toBe(true);
  await warehouse.selectOption({ index: 1 });

  await page.locator('#allocate-quantity').fill('3');
  await page.getByRole('button', { name: 'Allocate' }).click();

  // The action reports success — not silence, which was the bug.
  // Scoped to the live region: "Allocated" is also a column header, so a
  // bare text match is ambiguous.
  await expect(page.getByRole('status').filter({ hasText: /Allocated\./i }))
    .toBeVisible({ timeout: 45000 });

  // And the warehouse now offers 3 fewer units: the write reached the
  // database and the page re-read it, which is the sync that matters.
  await page.locator('#allocate-productId').selectOption(value!);
  const after = await page
    .locator('#allocate-warehouseId option')
    .nth(1)
    .innerText();
  expect(Number(after.match(/—\s*([\d.]+)/)?.[1])).toBe(availableBefore - 3);
});

test('an optional field the form does not render never blocks a submission', async ({ page }) => {
  // The regression itself, stated directly: the allocate form has no
  // notes input, and the submission must still be accepted.
  await openAllocatableProject(page);
  await expect(page.locator('#allocate-notes')).toHaveCount(0);

  const value = await page.locator('#allocate-productId option').nth(1).getAttribute('value');
  await page.locator('#allocate-productId').selectOption(value!);
  await page.locator('#allocate-warehouseId').selectOption({ index: 1 });
  await page.locator('#allocate-quantity').fill('1');

  const response = page.waitForResponse((r) => r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Allocate' }).click();
  const body = await (await response).text();

  expect(body).not.toContain('"code":"VALIDATION"');
  expect(body).not.toContain('notes');
});
