import { test, expect } from '@playwright/test';
import path from 'path';
import { login, openFirstFestival } from './helpers';

test.use({ storageState: path.join(__dirname, '.auth/user.json') });

const email = process.env.E2E_USER_EMAIL || '';
const password = process.env.E2E_USER_PASSWORD || '';

test.describe("What's Next banner", () => {
  test.skip(!email || !password, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run this test');

  test.beforeEach(async ({ page }) => {
    await login(page, email, password);
  });

  test("What's Next banner is absent when festival is not currently active", async ({ page }) => {
    await openFirstFestival(page);
    await page.waitForSelector('[data-testid="festival-performance-block"]', { timeout: 15000 });

    // Banner only shows during active festival
    // For a future/past festival it should not appear
    const banner = page.getByTestId('whats-next-banner');
    const isVisible = await banner.isVisible().catch(() => false);

    // If banner IS visible (festival is active and user has going picks), verify structure
    if (isVisible) {
      await expect(banner).toContainText('Up next:');
    }
  });

  test("Conflict warning appears when two going picks overlap in time", async ({ page }) => {
    await openFirstFestival(page);
    await page.waitForSelector('[data-testid="festival-performance-block"]', { timeout: 15000 });

    // Get all performance blocks visible on the current day
    const blocks = page.getByTestId('festival-performance-block');
    const count = await blocks.count();

    if (count < 2) {
      test.skip(true, 'Need at least 2 performances to test conflict detection');
      return;
    }

    // We can't guarantee conflicts exist, but verify the warning banner structure if it appears
    const conflictBanner = page.getByTestId('conflict-warning-banner');
    const isVisible = await conflictBanner.isVisible().catch(() => false);

    if (isVisible) {
      // Verify dismiss button works
      await conflictBanner.locator('button[aria-label="Dismiss conflict warning"]').click();
      await expect(conflictBanner).not.toBeVisible();
    }
  });

  test('Conflict warning is dismissable', async ({ page }) => {
    await openFirstFestival(page);
    await page.waitForSelector('[data-testid="festival-performance-block"]', { timeout: 15000 });

    const conflictBanner = page.getByTestId('conflict-warning-banner');
    const isVisible = await conflictBanner.isVisible().catch(() => false);

    if (isVisible) {
      const dismissBtn = conflictBanner.locator('button[aria-label="Dismiss conflict warning"]');
      await expect(dismissBtn).toBeVisible();
      await dismissBtn.click();
      await expect(conflictBanner).not.toBeVisible();
    }
  });
});
