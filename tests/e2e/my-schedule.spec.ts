import { expect, test } from '@playwright/test';
import { ensureFirstActIsStarred, login, openFirstFestival } from './helpers';

const testEmail = process.env.E2E_USER_EMAIL;
const testPassword = process.env.E2E_USER_PASSWORD;

test.describe('my schedule management', () => {
  test.skip(!testEmail || !testPassword, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run My Schedule tests.');

  test.beforeEach(async ({ page }) => {
    await login(page, testEmail!, testPassword!);
  });

  test('user can remove one saved act from My Schedule', async ({ page }) => {
    await openFirstFestival(page);
    await ensureFirstActIsStarred(page);

    await page.getByRole('link', { name: /My Schedule/i }).click();
    await expect(page.getByRole('heading', { name: /My Schedule/i })).toBeVisible();

    const removeButton = page.getByRole('button', { name: /^Remove$/i }).first();
    await expect(removeButton).toBeVisible();
    await removeButton.click();

    await expect(page.getByRole('button', { name: /^Removing/i })).toHaveCount(0);
  });

  test('user can clear all saved acts from My Schedule', async ({ page }) => {
    await openFirstFestival(page);
    await ensureFirstActIsStarred(page);

    await page.getByRole('link', { name: /My Schedule/i }).click();
    await expect(page.getByRole('heading', { name: /My Schedule/i })).toBeVisible();

    await page.getByRole('button', { name: /Clear All/i }).click();
    await page.getByRole('button', { name: /Yes, clear all/i }).click();
    await expect(page.getByText(/No saved acts yet/i)).toBeVisible();
  });
});
