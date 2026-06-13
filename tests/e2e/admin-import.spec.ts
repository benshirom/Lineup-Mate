import { expect, test } from '@playwright/test';
import path from 'path';
import { login } from './helpers';

test.use({ storageState: path.join(__dirname, '.auth/admin.json') });

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

test.describe('admin Clashfinder import tools', () => {
  test.skip(!adminEmail || !adminPassword, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run admin import tests.');

  test.beforeEach(async ({ page }) => {
    await login(page, adminEmail!, adminPassword!);
  });

  test('admin can run Clashfinder Preview without importing data', async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: /Clashfinder Import/i })).toBeVisible({ timeout: 20_000 });

    const slugInput = page.getByTestId('clashfinder-slug-input').or(page.getByLabel(/Clashfinder slug/i));
    await slugInput.fill('ozora2026');

    await page.getByTestId('preview-clashfinder').or(page.getByRole('button', { name: /^Preview$/i })).click();

    await expect(
      page.getByTestId('clashfinder-preview-result'),
      'Preview should render the stable preview result container. If this fails, the Clashfinder preview API is slow or returned an error.'
    ).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText(/Detected:/i)).toBeVisible({ timeout: 10_000 });
  });
});