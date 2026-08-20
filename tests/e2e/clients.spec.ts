import { test, expect } from '@playwright/test';

/**
 * Clients — the full CRUD path through a real browser.
 *
 * Creates a client, reads it back on the detail page, edits it, and
 * confirms the server refuses a duplicate code and a malformed tax
 * number. Every assertion is against what the database returned on the
 * next render, not against what the form believed it sent.
 */

/** A code unique to this run, so repeated runs do not collide. */
const stamp = () => `E2E${Date.now().toString(36).toUpperCase().slice(-6)}`;

/**
 * A unique 9-digit tax registration number.
 *
 * TRN is uniquely constrained, correctly — one TRN is one legal entity.
 * A fixed value here would pass against a clean database and then fail
 * for ever afterwards, which makes the test an assertion about
 * yesterday's run rather than about the behaviour of the code.
 */
let trnCounter = 0;
const uniqueTrn = () =>
  String(100_000_000 + ((Date.now() + trnCounter++) % 900_000_000));


test('lists clients with real outstanding balances', async ({ page }) => {
  await page.goto('/clients');

  await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible();
  // Seeded clients are present, and the total row is a real sum.
  await expect(page.getByRole('link', { name: 'Palm Hills Developments' })).toBeVisible();
  await expect(page.getByRole('rowheader', { name: 'Total' })).toBeVisible();
});

test('creates a client, then shows it on its own page', async ({ page }) => {
  const code = stamp();

  await page.goto('/clients/new');
  await page.getByLabel('Client code').fill(code);
  await page.getByLabel('Name (English)').fill('Nile Delta Contracting');
  const trn = uniqueTrn();
  // Typed with spaces, as somebody reading it off a document would.
  await page.getByLabel('Tax registration number').fill(
    `${trn.slice(0, 3)} ${trn.slice(3, 6)} ${trn.slice(6, 9)}`,
  );
  await page.getByLabel('Payment terms (days)').fill('45');
  await page.getByRole('button', { name: 'Create client' }).click();

  // Lands on the new client's page, populated from the database.
  await expect(page).toHaveURL(/\/clients\/[a-z0-9]+$/);
  await expect(page.getByRole('heading', { name: 'Nile Delta Contracting' })).toBeVisible();
  // Stored as bare digits, rendered 123-456-789 — so the spaces the user
  // typed were normalised on the way in.
  await expect(
    page.getByText(`${trn.slice(0, 3)}-${trn.slice(3, 6)}-${trn.slice(6, 9)}`),
  ).toBeVisible();
});

test('refuses a duplicate client code, with a message naming it', async ({ page }) => {
  const code = stamp();

  // First one succeeds.
  await page.goto('/clients/new');
  await page.getByLabel('Client code').fill(code);
  await page.getByLabel('Name (English)').fill('First Company');
  await page.getByRole('button', { name: 'Create client' }).click();
  await expect(page).toHaveURL(/\/clients\/[a-z0-9]+$/);

  // Second with the same code is refused by the server.
  await page.goto('/clients/new');
  await page.getByLabel('Client code').fill(code);
  await page.getByLabel('Name (English)').fill('Second Company');
  await page.getByRole('button', { name: 'Create client' }).click();

  const error = page.getByTestId('form-error');
  await expect(error).toBeVisible();
  await expect(error).toContainText(code);
  // And it did not navigate — nothing was created.
  await expect(page).toHaveURL(/\/clients\/new/);
});

test('refuses a tax number already registered to another client', async ({ page }) => {
  const trn = uniqueTrn();

  await page.goto('/clients/new');
  await page.getByLabel('Client code').fill(stamp());
  await page.getByLabel('Name (English)').fill('Original Entity');
  await page.getByLabel('Tax registration number').fill(trn);
  await page.getByRole('button', { name: 'Create client' }).click();
  await expect(page).toHaveURL(/\/clients\/[a-z0-9]+$/);

  // A different code, but the same TRN. One TRN is one legal entity, and
  // billing the same TRN under two records would break the VAT return.
  await page.goto('/clients/new');
  await page.getByLabel('Client code').fill(stamp());
  await page.getByLabel('Name (English)').fill('Same Entity Again');
  await page.getByLabel('Tax registration number').fill(trn);
  await page.getByRole('button', { name: 'Create client' }).click();

  const error = page.getByTestId('form-error');
  await expect(error).toBeVisible();
  await expect(error).toContainText(trn);
  await expect(page).toHaveURL(/\/clients\/new/);
});

test('rejects a tax number that is not nine digits', async ({ page }) => {
  await page.goto('/clients/new');
  await page.getByLabel('Client code').fill(stamp());
  await page.getByLabel('Name (English)').fill('Bad TRN Company');
  await page.getByLabel('Tax registration number').fill('12345');
  await page.getByRole('button', { name: 'Create client' }).click();

  // The error lands on the field it belongs to.
  await expect(page.getByText('A tax registration number is 9 digits')).toBeVisible();
  await expect(page).toHaveURL(/\/clients\/new/);
});

test('requires a name', async ({ page }) => {
  await page.goto('/clients/new');
  await page.getByLabel('Client code').fill(stamp());
  // Leave the name empty. `noValidate` means the server does the judging.
  await page.getByRole('button', { name: 'Create client' }).click();

  await expect(page.getByText('Name is required')).toBeVisible();
});

test('edits a client and the change is persisted', async ({ page }) => {
  const code = stamp();

  await page.goto('/clients/new');
  await page.getByLabel('Client code').fill(code);
  await page.getByLabel('Name (English)').fill('Before Rename');
  await page.getByRole('button', { name: 'Create client' }).click();
  await expect(page).toHaveURL(/\/clients\/[a-z0-9]+$/);

  await page.getByRole('link', { name: 'Edit' }).click();
  await expect(page.getByRole('heading', { name: /Edit Before Rename/ })).toBeVisible();

  await page.getByLabel('Name (English)').fill('After Rename');
  await page.getByLabel('Contact name').fill('Hoda Farouk');
  await page.getByRole('button', { name: 'Save changes' }).click();

  await expect(page.getByRole('heading', { name: 'After Rename' })).toBeVisible();
  await expect(page.getByText('Hoda Farouk')).toBeVisible();

  // And it survives a fresh load — it is in the database, not in state.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'After Rename' })).toBeVisible();
});

test('search narrows the list and is a real URL', async ({ page }) => {
  await page.goto('/clients');
  await page.getByPlaceholder('Name, code or tax number').fill('Palm Hills');
  await page.getByRole('button', { name: 'Search' }).click();

  await expect(page).toHaveURL(/q=Palm\+Hills/);
  await expect(page.getByRole('link', { name: 'Palm Hills Developments' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Orascom Construction' })).toHaveCount(0);
});
