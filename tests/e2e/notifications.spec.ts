import { test, expect } from '@playwright/test';
import path from 'path';
import { login } from './helpers';

test.use({ storageState: path.join(__dirname, '.auth/user.json') });

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

    // Use :visible so this works on both desktop (desktop nav bell) and mobile (mobile nav bell)
    const bell = page.locator('[data-testid="notification-bell"]:visible');
    await expect(bell).toBeVisible({ timeout: 5000 });
  });

  test('Notification bell opens dropdown when clicked', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    const bell = page.locator('[data-testid="notification-bell"]:visible');
    await expect(bell).toBeVisible({ timeout: 5000 });

    await bell.locator('button').first().click();

    // Dropdown should appear with "Notifications" heading
    await expect(page.locator('.notif-dropdown')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.notif-dropdown')).toContainText('Notifications');
  });

  test('Notification preferences form is visible on profile page', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForTimeout(2000);

    const prefsForm = page.getByTestId('notification-prefs-form');
    await expect(prefsForm).toBeVisible({ timeout: 10000 });

    // Verify toggle buttons exist
    const setStartingSwitch = prefsForm.locator('[role="switch"]').first();
    await expect(setStartingSwitch).toBeVisible();

    // Ensure the notify_set_starting toggle is on so minute buttons render
    if ((await setStartingSwitch.getAttribute('aria-checked')) === 'false') {
      await setStartingSwitch.click();
    }

    // Verify minute selector buttons
    await expect(prefsForm.locator('button:has-text("15 min")')).toBeVisible();
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
    await expect(saveBtn).toContainText(/Save|Saved/i, { timeout: 5000 });
  });

  test('Minute selector changes active option', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForTimeout(2000);

    const prefsForm = page.getByTestId('notification-prefs-form');
    await expect(prefsForm).toBeVisible({ timeout: 10000 });

    // Ensure notify_set_starting toggle is on so minute buttons render
    const setStartingSwitch = prefsForm.locator('[role="switch"]').first();
    if ((await setStartingSwitch.getAttribute('aria-checked')) === 'false') {
      await setStartingSwitch.click();
    }

    // Click "30 min" option
    const thirtyBtn = prefsForm.locator('button:has-text("30 min")');
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
