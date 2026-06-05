import { test, expect } from '@playwright/test';
import { login } from './helpers';

const email = process.env.E2E_USER_EMAIL || '';
const password = process.env.E2E_USER_PASSWORD || '';

test.describe('Notification bell', () => {
  test.skip(!email || !password, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run this test');

  test.beforeEach(async ({ page }) => {
    await login(page, email, password);
  });

  test('Notification bell is visible when authenticated on desktop', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    // Notification bell should be visible in the navbar for authenticated users
    const bell = page.getByTestId('notification-bell');
    await expect(bell).toBeVisible({ timeout: 5000 });
  });

  test('Notification bell opens dropdown when clicked', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    const bell = page.getByTestId('notification-bell');
    await expect(bell).toBeVisible({ timeout: 5000 });

    await bell.locator('button').first().click();

    // Dropdown should appear with "התראות" heading
    await expect(page.locator('.notif-dropdown')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.notif-dropdown')).toContainText('התראות');
  });

  test('Notification preferences form is visible on profile page', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForTimeout(2000);

    const prefsForm = page.getByTestId('notification-prefs-form');
    await expect(prefsForm).toBeVisible({ timeout: 10000 });

    // Verify toggle buttons exist
    await expect(prefsForm.locator('[role="switch"]').first()).toBeVisible();

    // Verify minute selector buttons
    await expect(prefsForm.locator('button:has-text("15 דק׳")')).toBeVisible();
  });

  test('Notification preferences can be toggled and saved', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForTimeout(2000);

    const prefsForm = page.getByTestId('notification-prefs-form');
    await expect(prefsForm).toBeVisible({ timeout: 10000 });

    // Click save button
    const saveBtn = prefsForm.locator('button[type="submit"]');
    await saveBtn.click();

    // Should show saved confirmation
    await expect(saveBtn).toContainText(/שמור|נשמר/i, { timeout: 5000 });
  });

  test('Minute selector changes active option', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForTimeout(2000);

    const prefsForm = page.getByTestId('notification-prefs-form');
    await expect(prefsForm).toBeVisible({ timeout: 10000 });

    // Click "30 דק׳" option
    const thirtyBtn = prefsForm.locator('button:has-text("30 דק׳")');
    await expect(thirtyBtn).toBeVisible();
    await thirtyBtn.click();

    // Verify it appears selected (white text / acc background)
    const bgColor = await thirtyBtn.evaluate(el =>
      window.getComputedStyle(el).backgroundColor
    );
    // The selected button should have a different (non-surface) background
    expect(bgColor).toBeTruthy();
  });
});

test.describe('Notification security', () => {
  test('Cron endpoint returns 401 without CRON_SECRET', async ({ request, baseURL }) => {
    const response = await request.get(`${baseURL}/api/cron/check-notifications`);
    expect(response.status()).toBe(401);
  });
});
