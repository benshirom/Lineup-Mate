import { expect, test } from '@playwright/test';

const testEmail = process.env.E2E_USER_EMAIL;
const testPassword = process.env.E2E_USER_PASSWORD;

test.describe('authenticated flows', () => {
  test.skip(!testEmail || !testPassword, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run authenticated tests.');

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(testEmail!);
    await page.getByLabel('Password').fill(testPassword!);
    await page.getByRole('button', { name: /^Login$/ }).click();
    await expect(page).toHaveURL('/');
  });

  test('user can save a festival and open My Schedule', async ({ page }) => {
    await expect(page.getByText(testEmail!).first()).toBeVisible();

    const saveButton = page.getByRole('button', { name: /Save Festival/i }).first();
    if (await saveButton.isVisible()) {
      await saveButton.click();
    }

    await page.getByRole('link', { name: /My Schedule/i }).click();
    await expect(page.getByRole('heading', { name: /My Schedule/i })).toBeVisible();
  });

  test('user can open groups area', async ({ page }) => {
    await page.getByRole('link', { name: /Groups/i }).click();
    await expect(page.getByRole('heading', { name: /My Groups/i })).toBeVisible();
  });

  test('user can open first festival and star an act if timeline has items', async ({ page }) => {
    await page.getByRole('button', { name: /View Lineup/i }).first().click();
    await expect(page.getByRole('button', { name: /timeline/i })).toBeVisible();

    const starButton = page.getByRole('button', { name: /Add to my schedule|Remove from my schedule/i }).first();
    if (await starButton.isVisible()) {
      await starButton.click();
      await page.getByRole('link', { name: /My Schedule/i }).click();
      await expect(page.getByRole('heading', { name: /My Schedule/i })).toBeVisible();
    }
  });
});
