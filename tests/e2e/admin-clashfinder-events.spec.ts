import { expect, test } from '@playwright/test';
import { login } from './helpers';

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const userEmail = process.env.E2E_USER_EMAIL;
const userPassword = process.env.E2E_USER_PASSWORD;

test.describe('admin Clashfinder event browser', () => {
  test.skip(!adminEmail || !adminPassword, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run Clashfinder event browser tests.');

  test.beforeEach(async ({ page }) => {
    await login(page, adminEmail!, adminPassword!);
  });

  test('admin can search Clashfinder events, select Ozora, and preview it', async ({ page }) => {
    await page.getByRole('link', { name: /Admin/i }).click();
    await expect(page.getByRole('heading', { name: /Clashfinder Import & Sync/i })).toBeVisible();

    await page.getByTestId('clashfinder-events-search').fill('Ozora');
    await page.getByTestId('clashfinder-events-scope').selectOption('all');
    await page.getByTestId('load-clashfinder-events').click();

    await expect(page.getByTestId('clashfinder-events-results')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('clashfinder-event-row').filter({ hasText: /ozora/i }).first()).toBeVisible();

    const ozoraRow = page.getByTestId('clashfinder-event-row').filter({ hasText: /ozora2026/i }).first();
    if (await ozoraRow.isVisible()) {
      await ozoraRow.getByRole('button', { name: /^Select$/i }).click();
    } else {
      await page.getByTestId('clashfinder-event-row').filter({ hasText: /ozora/i }).first().getByRole('button', { name: /^Select$/i }).click();
    }

    await expect(page.getByTestId('clashfinder-slug-input')).not.toHaveValue('');
    await expect(page.getByTestId('selected-clashfinder-event')).toBeVisible();

    await page.getByTestId('preview-clashfinder').click();
    await expect(page.getByTestId('clashfinder-preview-result')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText(/Detected:/i)).toBeVisible();
    await expect(page.getByTestId('sample-performances-table')).toBeVisible();
  });

  test('Ozora preview exposes multiple real stages and does not classify locations as a stage', async ({ page }) => {
    await page.goto('/admin');
    await page.getByTestId('clashfinder-slug-input').fill('ozora2026');
    await page.getByTestId('preview-clashfinder').click();

    await expect(page.getByTestId('clashfinder-preview-result')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId('detected-stages')).toBeVisible();

    const stageText = await page.getByTestId('detected-stages').innerText();
    const stageCount = Number(stageText.match(/\d+/)?.[0] || '0');
    expect(stageCount).toBeGreaterThan(1);

    const sampleStages = await page.getByTestId('sample-stages').innerText();
    expect(sampleStages.toLowerCase()).not.toContain('locations');
  });
});

test.describe('Clashfinder events API authorization', () => {
  test('guest cannot load Clashfinder events API', async ({ request }) => {
    const response = await request.get('/api/admin/clashfinder-events?scope=all&search=ozora&limit=10');
    expect(response.status()).toBeGreaterThanOrEqual(401);
  });

  test('regular user cannot load Clashfinder events API', async ({ page }) => {
    test.skip(!userEmail || !userPassword, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run regular-user API authorization test.');

    await login(page, userEmail!, userPassword!);
    const token = await page.evaluate(() => {
      const key = Object.keys(localStorage).find((item) => item.includes('auth-token'));
      if (!key) return null;
      const parsed = JSON.parse(localStorage.getItem(key) || '{}');
      return parsed?.access_token || parsed?.currentSession?.access_token || null;
    });

    expect(token).toBeTruthy();

    const response = await page.request.get('/api/admin/clashfinder-events?scope=all&search=ozora&limit=10', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    expect(response.status()).toBe(403);
  });
});
