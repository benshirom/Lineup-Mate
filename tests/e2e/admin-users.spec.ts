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
    await page.locator('[data-testid="users-role-filter"]').selectOption('admin');
    await page.waitForTimeout(800);
    // After filtering to 'admin', there should be no 'user' role buttons
    const userButtons = page.getByRole('button', { name: /^user$/i });
    expect(await userButtons.count()).toBe(0);
  });

  test('blocked filter shows only blocked users', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: /Email/i })).toBeVisible({ timeout: 15_000 });
    await page.locator('[data-testid="users-blocked-filter"]').selectOption('true');
    await page.waitForTimeout(800);
    // After filtering to blocked only, there should be no 'Active' badges
    const activeSpans = page.locator('span', { hasText: /^Active$/ });
    expect(await activeSpans.count()).toBe(0);
  });

  test('shows pagination info', async ({ page }) => {
    await expect(page.getByText(/Showing|No results/i)).toBeVisible({ timeout: 15_000 });
  });
});
