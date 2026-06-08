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
    test.setTimeout(60_000);

    await test.step('star an act', async () => {
      await openFirstFestival(page);
      await ensureFirstActIsStarred(page);
    });

    await test.step('open My Schedule directly and remove one act', async () => {
      await page.goto('/my-schedule');
      await expect(page.getByRole('heading', { name: /My Schedule/i })).toBeVisible({ timeout: 20_000 });
      await expect(
        page.getByTestId('saved-acts-section'),
        'Saved acts section is missing after starring an act. If this fails, check user_performance_preferences persistence/read.'
      ).toBeVisible({ timeout: 20_000 });

      const removeButton = page.getByRole('button', { name: /^Remove$/i }).first();
      await expect(removeButton, 'A saved act should expose a Remove button in My Schedule.').toBeVisible();
      await removeButton.click();
      await expect(page.getByRole('button', { name: /^Removing/i })).toHaveCount(0);
    });
  });

  test('user can clear all saved acts from My Schedule', async ({ page }) => {
    test.setTimeout(60_000);

    await test.step('star an act', async () => {
      await openFirstFestival(page);
      await ensureFirstActIsStarred(page);
    });

    await test.step('open My Schedule directly and clear saved acts', async () => {
      await page.goto('/my-schedule');
      await expect(page.getByRole('heading', { name: /My Schedule/i })).toBeVisible({ timeout: 20_000 });
      await expect(
        page.getByTestId('saved-acts-section'),
        'Clear All requires at least one saved act, but saved-acts-section did not render.'
      ).toBeVisible({ timeout: 20_000 });

      await page.getByRole('button', { name: /Clear All/i }).click();
      await page.getByRole('button', { name: /Yes, clear all/i }).click();
      await expect(page.getByText(/No saved acts yet/i)).toBeVisible({ timeout: 20_000 });
    });
  });
});
