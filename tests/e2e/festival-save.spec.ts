import { expect, test } from '@playwright/test';
import path from 'path';
import { ensureFirstFestivalIsSaved, login } from './helpers';

test.use({ storageState: path.join(__dirname, '.auth/user.json') });

const testEmail = process.env.E2E_USER_EMAIL;
const testPassword = process.env.E2E_USER_PASSWORD;

test.describe('saved festivals', () => {
  test.skip(!testEmail || !testPassword, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run saved festival tests.');

  test.beforeEach(async ({ page }) => {
    await login(page, testEmail!, testPassword!);
  });

  test('saving a festival persists after reload', async ({ page }) => {
    await ensureFirstFestivalIsSaved(page);
    await page.reload();

    await expect(page.getByRole('button', { name: /✓ Saved|Saved!/i }).first()).toBeVisible({ timeout: 20_000 });
  });
});
