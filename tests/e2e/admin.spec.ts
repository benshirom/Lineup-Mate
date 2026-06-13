import { expect, test } from '@playwright/test';
import path from 'path';
import { clickNav, login } from './helpers';

test.use({ storageState: path.join(__dirname, '.auth/admin.json') });

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

test.describe('admin smoke tests', () => {
  test.skip(!adminEmail || !adminPassword, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run admin tests.');

  test.beforeEach(async ({ page }) => {
    await login(page, adminEmail!, adminPassword!);
  });

  test('admin can open import page', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: /Clashfinder Import/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /Preview/i })).toBeVisible();
  });

  test('admin page follows saved light theme', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: /Profile/i })).toBeVisible({ timeout: 20_000 });
    await page.getByLabel(/Theme/i).selectOption('light');
    await page.getByRole('button', { name: /Save Profile/i }).click();
    await expect(page.getByText(/Profile saved successfully/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('html'), 'Saving light theme should keep html data-theme=light.').toHaveAttribute('data-theme', 'light');

    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: /Clashfinder Import/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('html'), 'Admin page should keep the saved light theme state.').toHaveAttribute('data-theme', 'light', { timeout: 20_000 });

    await page.goto('/profile');
    await page.getByLabel(/Theme/i).selectOption('dark');
    await page.getByRole('button', { name: /Save Profile/i }).click();
  });
});
