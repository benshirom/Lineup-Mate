import { expect, test } from '@playwright/test';
import { login, dismissPreviewOverlays, cleanupTestAdminData, TEST_ADMIN_PREFIX } from './helpers';

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';

test.describe('admin group management', () => {
  test.skip(!adminEmail || !adminPassword, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run admin tests.');

  let adminToken: string = '';

  test.beforeEach(async ({ page }) => {
    await login(page, adminEmail!, adminPassword!);
    adminToken = await page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.includes('access_token')) {
          try { return JSON.parse(localStorage.getItem(key)!); } catch (_) { return localStorage.getItem(key)!; }
        }
      }
      return '';
    });
    await page.goto('/admin/groups');
    await dismissPreviewOverlays(page);
  });

  test.afterAll(async () => {
    if (adminToken) await cleanupTestAdminData(baseURL, adminToken);
  });

  test('groups page loads and shows table', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Group Management/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('columnheader', { name: /Group Name/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('columnheader', { name: /Festival/i })).toBeVisible();
  });

  test('search input filters groups', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: /Group Name/i })).toBeVisible({ timeout: 15_000 });
    const searchInput = page.getByPlaceholder(/Search group name/i);
    await searchInput.fill(`${TEST_ADMIN_PREFIX} nonexistent group 9999`);
    await expect(page.getByText(/No groups found/i)).toBeVisible({ timeout: 10_000 });
    await searchInput.clear();
  });

  test('members panel opens and closes', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: /Group Name/i })).toBeVisible({ timeout: 15_000 });
    const membersButtons = page.getByRole('button', { name: /^Members$/i });
    const count = await membersButtons.count();
    if (count > 0) {
      await membersButtons.first().click();
      await expect(page.getByText(/Members of /i)).toBeVisible({ timeout: 10_000 });
      await page.getByRole('button', { name: /Hide Members/i }).first().click();
      await expect(page.getByText(/Members of /i)).not.toBeVisible({ timeout: 5_000 });
    }
  });

  test('blocked filter shows only blocked groups', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: /Group Name/i })).toBeVisible({ timeout: 15_000 });
    await page.locator('[data-testid="groups-blocked-filter"]').selectOption('true');
    await page.waitForTimeout(800);
    // After filtering to blocked only, there should be no 'Active' badges
    const activeSpans = page.locator('span', { hasText: /^Active$/ });
    expect(await activeSpans.count()).toBe(0);
  });

  test('shows pagination info', async ({ page }) => {
    await expect(page.getByText(/Showing|No results/i)).toBeVisible({ timeout: 15_000 });
  });
});
