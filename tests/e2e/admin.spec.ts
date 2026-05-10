import { expect, test } from '@playwright/test';

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

test.describe('admin smoke tests', () => {
  test.skip(!adminEmail || !adminPassword, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run admin tests.');

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(adminEmail!);
    await page.getByLabel('Password').fill(adminPassword!);
    await page.getByRole('button', { name: /^Login$/ }).click();
    await expect(page).toHaveURL('/');
  });

  test('admin can open import page', async ({ page }) => {
    await page.getByRole('link', { name: /Admin/i }).click();
    await expect(page.getByRole('heading', { name: /Clashfinder Import/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Preview/i })).toBeVisible();
  });
});
