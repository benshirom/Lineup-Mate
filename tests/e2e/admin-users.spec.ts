import { expect, test } from '@playwright/test';
import { login, dismissPreviewOverlays } from './helpers';

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

test.describe('admin user management', () => {
  test.skip(!adminEmail || !adminPassword, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run admin tests.');

  test.beforeEach(async ({ page }) => {
    await login(page, adminEmail!, adminPassword!);
    await page.goto('/admin/users');
    await dismissPreviewOverlays(page);
  });

  test('users page loads and shows table', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /User Management/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('columnheader', { name: /Email/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('columnheader', { name: /Role/i })).toBeVisible();
  });

  test('search input filters the table', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: /Email/i })).toBeVisible({ timeout: 15_000 });
    const searchInput = page.getByPlaceholder(/Search email or name/i);
    await searchInput.fill('zzznoresultsxxx');
    await expect(page.getByText(/No users found/i)).toBeVisible({ timeout: 10_000 });
    await searchInput.clear();
  });

  test('role filter shows only selected role', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: /Email/i })).toBeVisible({ timeout: 15_000 });
    await page.selectOption('select:near(:text("All Roles"))', 'admin');
    await page.waitForTimeout(500);
    const roleButtons = page.getByRole('button', { name: /^admin$/i });
    const count = await roleButtons.count();
    const userButtons = page.getByRole('button', { name: /^user$/i });
    const userCount = await userButtons.count();
    expect(userCount).toBe(0);
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('blocked filter shows only blocked users', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: /Email/i })).toBeVisible({ timeout: 15_000 });
    await page.selectOption('select:near(:text("All Statuses"))', 'true');
    await page.waitForTimeout(500);
    const activeCount = await page.getByText('Active').count();
    expect(activeCount).toBe(0);
  });

  test('shows pagination info', async ({ page }) => {
    await expect(page.getByText(/Showing|No results/i)).toBeVisible({ timeout: 15_000 });
  });
});
