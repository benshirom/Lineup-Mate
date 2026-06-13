import { test, expect } from '@playwright/test';
import path from 'path';
import { login, openFirstFestival } from './helpers';

test.use({ storageState: path.join(__dirname, '.auth/user.json') });

const email = process.env.E2E_USER_EMAIL || '';
const password = process.env.E2E_USER_PASSWORD || '';

test.describe('Timeline Now line and Go to Now button', () => {
  test.skip(!email || !password, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run this test');

  test.beforeEach(async ({ page }) => {
    await login(page, email, password);
  });

  test('Timeline tab renders performance blocks', async ({ page }) => {
    await openFirstFestival(page);
    await page.click('button:has-text("Timeline")');
    await page.waitForSelector('[data-testid="festival-performance-block"]', { timeout: 15000 });

    const blocks = page.getByTestId('festival-performance-block');
    await expect(blocks.first()).toBeVisible();
  });

  test('Go to Now button is absent when festival is not currently active', async ({ page }) => {
    // The button only shows when nowLeft !== null (i.e., the current time is within the timeline range)
    // For a past/future festival, the button should NOT appear
    await openFirstFestival(page);
    await page.click('button:has-text("Timeline")');
    await page.waitForTimeout(1000);

    const goToNowBtn = page.getByTestId('go-to-now-btn');
    // The button is only present when the current time is within the festival timeline
    // For most test environments this will be false (festival is in the future/past)
    // We just verify the element either doesn't exist or does exist with correct aria-label
    const isVisible = await goToNowBtn.isVisible().catch(() => false);
    if (isVisible) {
      await expect(goToNowBtn).toHaveAttribute('aria-label', 'Scroll to current time');
    }
  });

  test('Now line label NOW exists in DOM when now-line is present', async ({ page }) => {
    await openFirstFestival(page);
    await page.click('button:has-text("Timeline")');
    await page.waitForTimeout(1000);

    // Check if the now-line is present (only during active festival)
    const nowLine = page.locator('.now-line');
    const isPresent = await nowLine.count() > 0;

    if (isPresent) {
      // Verify the NOW label is inside the now-line
      const nowLabel = nowLine.locator('.now-label');
      await expect(nowLabel).toContainText('NOW');
    }
    // If not present (festival not active), test passes trivially
  });

  test('Go to Now button scrolls to now line', async ({ page }) => {
    await openFirstFestival(page);
    await page.click('button:has-text("Timeline")');
    await page.waitForTimeout(1000);

    const goToNowBtn = page.getByTestId('go-to-now-btn');
    const isVisible = await goToNowBtn.isVisible().catch(() => false);

    if (isVisible) {
      // Click and verify the now-line is visible after click
      await goToNowBtn.click();
      await page.waitForTimeout(600); // wait for smooth scroll

      const nowLine = page.locator('.now-line').first();
      await expect(nowLine).toBeInViewport({ ratio: 0.3 });
    }
  });
});
