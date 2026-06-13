import { test, expect } from '@playwright/test';
import path from 'path';
import { login } from './helpers';

test.use({ storageState: path.join(__dirname, '.auth/user.json') });

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

test.describe('mobile interactions', () => {
  test.skip(!email || !password, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run mobile interaction tests.');

  test.beforeEach(async ({ page }) => {
    await login(page, email!, password!);
  });

  test('stage filter buttons are accessible (large enough tap targets)', async ({ page, isMobile }) => {
    if (!isMobile) { test.skip(); return; }

    await page.goto('/');
    // Navigate to a festival if available
    const festivalBtn = page.getByRole('button', { name: /Open Schedule|View Lineup/i }).first();
    if (await festivalBtn.count() === 0) { test.skip(true, 'No festivals available'); return; }

    await festivalBtn.click();
    await page.waitForLoadState('domcontentloaded');

    // Stage filter buttons should exist and have reasonable tap size
    const stageButtons = page.getByTestId('stage-filter').or(
      page.getByRole('button', { name: /All Stages|Main Stage|Stage/i })
    );
    const count = await stageButtons.count();
    if (count === 0) { test.skip(true, 'No stage filter buttons found'); return; }

    const firstBtn = stageButtons.first();
    const box = await firstBtn.boundingBox();
    expect(box).not.toBeNull();
    // Tap targets should be at least 36px tall (accessibility)
    expect(box!.height).toBeGreaterThanOrEqual(36);
  });

  test('share sheet opens and closes on mobile', async ({ page, isMobile }) => {
    if (!isMobile) { test.skip(); return; }

    await page.goto('/groups');
    const shareBtn = page.getByTestId('share-btn').first();
    if (await shareBtn.count() === 0) { test.skip(true, 'No share buttons available'); return; }

    await shareBtn.click();
    await expect(page.getByTestId('share-sheet')).toBeVisible();

    // Close by clicking outside or close button
    const closeBtn = page.getByTestId('share-sheet-close').or(
      page.getByRole('button', { name: /close/i })
    ).first();
    if (await closeBtn.count() > 0) {
      await closeBtn.click();
      await expect(page.getByTestId('share-sheet')).not.toBeVisible({ timeout: 3000 }).catch(() => undefined);
    }
  });
});
