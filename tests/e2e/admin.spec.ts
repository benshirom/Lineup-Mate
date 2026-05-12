import { expect, test } from '@playwright/test';
import { login } from './helpers';

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

test.describe('admin smoke tests', () => {
  test.skip(!adminEmail || !adminPassword, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run admin tests.');

  test.beforeEach(async ({ page }) => {
    await login(page, adminEmail!, adminPassword!);
  });

  test('admin can open import page', async ({ page }) => {
    await expect(page.getByRole('link', { name: /Admin/i })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('link', { name: /Admin/i }).click();
    await expect(page.getByRole('heading', { name: /Clashfinder Import/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /Preview/i })).toBeVisible();
  });
});
