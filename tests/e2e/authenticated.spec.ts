import { expect, test } from '@playwright/test';
import { ensureFirstActIsStarred, ensureFirstFestivalIsSaved, login, openFirstFestival } from './helpers';

const testEmail = process.env.E2E_USER_EMAIL;
const testPassword = process.env.E2E_USER_PASSWORD;

test.describe('authenticated flows', () => {
  test.skip(!testEmail || !testPassword, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run authenticated tests.');

  test.beforeEach(async ({ page }) => {
    await login(page, testEmail!, testPassword!);
  });

  test('user can save a festival and see it on My Schedule', async ({ page }) => {
    await expect(page.getByRole('link', { name: /My Schedule/i })).toBeVisible();
    await ensureFirstFestivalIsSaved(page);

    await page.getByRole('link', { name: /My Schedule/i }).click();
    await expect(page.getByRole('heading', { name: /My Schedule/i })).toBeVisible();
    await expect(page.getByTestId('saved-festivals-section')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('saved-festival-card').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /Open Festival/i }).first()).toBeVisible();
  });

  test('user can open groups area', async ({ page }) => {
    await page.getByRole('link', { name: /Groups/i }).click();
    await expect(page.getByRole('heading', { name: /My Groups/i })).toBeVisible();
  });

  test('user can open first festival and star an act if timeline has items', async ({ page }) => {
    await openFirstFestival(page);
    await ensureFirstActIsStarred(page);

    await page.getByRole('link', { name: /My Schedule/i }).click();
    await expect(page.getByRole('heading', { name: /My Schedule/i })).toBeVisible();
    await expect(page.getByTestId('saved-acts-section')).toBeVisible({ timeout: 20_000 });
  });
});
