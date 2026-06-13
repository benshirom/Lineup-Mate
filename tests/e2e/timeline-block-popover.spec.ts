import { test, expect } from '@playwright/test';
import { openFirstFestival } from './helpers';

test.describe('Timeline block popover', () => {
  test.beforeEach(async ({ page }) => {
    await openFirstFestival(page);
    // Timeline is now the first tab — click it to be sure
    await page.click('button:has-text("Timeline")');
    await page.waitForSelector('[data-testid="festival-performance-block"]', { timeout: 15000 });
  });

  test('clicking a performance block opens the detail popover', async ({ page }) => {
    const block = page.getByTestId('festival-performance-block').first();
    await block.click();

    const popover = page.getByTestId('performance-detail-popover');
    await expect(popover).toBeVisible({ timeout: 3000 });

    // Popover should contain stage name and time range text
    await expect(popover).not.toBeEmpty();
  });

  test('popover closes when clicking outside', async ({ page }) => {
    const block = page.getByTestId('festival-performance-block').first();
    await block.click();

    const popover = page.getByTestId('performance-detail-popover');
    await expect(popover).toBeVisible({ timeout: 3000 });

    // Click somewhere outside the popover
    await page.mouse.click(10, 10);
    await expect(popover).not.toBeVisible({ timeout: 2000 });
  });

  test('clicking the same block again closes the popover', async ({ page }) => {
    const block = page.getByTestId('festival-performance-block').first();
    await block.click();

    const popover = page.getByTestId('performance-detail-popover');
    await expect(popover).toBeVisible({ timeout: 3000 });

    await block.click();
    await expect(popover).not.toBeVisible({ timeout: 2000 });
  });

  test('clicking × button closes the popover', async ({ page }) => {
    const block = page.getByTestId('festival-performance-block').first();
    await block.click();

    const popover = page.getByTestId('performance-detail-popover');
    await expect(popover).toBeVisible({ timeout: 3000 });

    await popover.locator('button:has-text("×")').click();
    await expect(popover).not.toBeVisible({ timeout: 2000 });
  });
});
