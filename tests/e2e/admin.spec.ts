import { expect, test } from '@playwright/test';
import { clickNav, login } from './helpers';

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

async function mainBackground(page: import('@playwright/test').Page) {
  return page.locator('main').first().evaluate((element) => window.getComputedStyle(element).backgroundColor);
}

test.describe('admin smoke tests', () => {
  test.skip(!adminEmail || !adminPassword, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run admin tests.');

  test.beforeEach(async ({ page }) => {
    await login(page, adminEmail!, adminPassword!);
  });

  test('admin can open import page', async ({ page }) => {
    await clickNav(page, /Admin/i);
    await expect(page.getByRole('heading', { name: /Clashfinder Import/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /Preview/i })).toBeVisible();
  });

  test('admin page follows saved light theme', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: /Profile|פרופיל/i })).toBeVisible({ timeout: 20_000 });
    await page.getByLabel(/Language/i).selectOption('en');
    await page.getByLabel(/Theme/i).selectOption('light');
    await page.getByRole('button', { name: /Save Profile/i }).click();
    await expect(page.getByText(/Profile saved successfully/i)).toBeVisible({ timeout: 20_000 });

    await clickNav(page, /Admin/i);
    await expect(page.getByRole('heading', { name: /Clashfinder Import/i })).toBeVisible({ timeout: 20_000 });
    expect(await mainBackground(page)).not.toBe('rgb(13, 13, 28)');

    await page.goto('/profile');
    await page.getByLabel(/Theme/i).selectOption('dark');
    await page.getByRole('button', { name: /Save Profile/i }).click();
  });
});