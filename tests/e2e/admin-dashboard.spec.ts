import { expect, test } from '@playwright/test';
import { login, dismissPreviewOverlays } from './helpers';

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const regularEmail = process.env.E2E_USER_EMAIL;
const regularPassword = process.env.E2E_USER_PASSWORD;

test.describe('admin dashboard', () => {
  test.skip(!adminEmail || !adminPassword, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run admin tests.');

  test.beforeEach(async ({ page }) => {
    await login(page, adminEmail!, adminPassword!);
  });

  test('admin can navigate to dashboard directly', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await dismissPreviewOverlays(page);
    await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible({ timeout: 20_000 });
  });

  test('dashboard shows stat cards', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await dismissPreviewOverlays(page);
    await expect(page.getByText(/Total Users/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Active Festivals/i)).toBeVisible();
    await expect(page.getByText(/Total Groups/i)).toBeVisible();
  });

  test('dashboard shows data tables', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await dismissPreviewOverlays(page);
    await expect(page.getByText(/Recent Signups/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Most Active Users/i)).toBeVisible();
  });

  test('dashboard sub-nav links are visible', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await dismissPreviewOverlays(page);
    await expect(page.getByRole('link', { name: /Dashboard/i }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: /Users/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Groups/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Import/i }).first()).toBeVisible();
  });
});

test.describe('admin dashboard – access control', () => {
  test.skip(!regularEmail || !regularPassword, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run access control tests.');

  test('regular user is redirected away from /admin/dashboard', async ({ page }) => {
    await login(page, regularEmail!, regularPassword!);
    await page.goto('/admin/dashboard');
    await expect(page).not.toHaveURL(/\/admin\/dashboard/, { timeout: 10_000 });
  });
});
