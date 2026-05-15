import { expect, test } from '@playwright/test';
import { login } from './helpers';

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

test.describe('admin Clashfinder import tools', () => {
  test.skip(!adminEmail || !adminPassword, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run admin import tests.');

  test.beforeEach(async ({ page }) => {
    await login(page, adminEmail!, adminPassword!);
  });

  test('admin can run Clashfinder Preview without importing data', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: /Clashfinder Import/i })).toBeVisible({ timeout: 20_000 });

    const slugInput = page.getByTestId('clashfinder-slug-input').or(page.getByLabel(/Clashfinder slug/i));
    await slugInput.fill('ozora2026');

    await page.getByTestId('preview-clashfinder').or(page.getByRole('button', { name: /^Preview$/i })).click();

    await expect(page.getByRole('heading', { name: /Result/i })).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText(/Detected:/i)).toBeVisible();
  });
});