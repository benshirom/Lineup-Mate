import { expect, test } from '@playwright/test';
import { ensureFirstFestivalIsSaved, login } from './helpers';

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

    await expect(page.getByText(/Saved!/i).first()).toBeVisible();
  });
});
