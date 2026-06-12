import { test, expect } from '@playwright/test';
import { login } from './helpers';

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

test.describe('mobile navigation', () => {
  test.describe('authenticated', () => {
    test.skip(!email || !password, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run authenticated mobile navigation tests.');

    test.beforeEach(async ({ page }) => {
      await login(page, email!, password!);
    });

    test('BottomNav is visible on mobile', async ({ page, isMobile }) => {
      if (!isMobile) { test.skip(); return; }
      await page.goto('/');
      await expect(page.getByTestId('bottom-nav')).toBeVisible();
    });

    test('BottomNav is hidden on desktop', async ({ page, isMobile }) => {
      if (isMobile) { test.skip(); return; }
      await page.goto('/');
      const nav = page.getByTestId('bottom-nav');
      const count = await nav.count();
      if (count > 0) {
        await expect(nav).toBeHidden();
      }
    });

    test('BottomNav home link navigates to /', async ({ page, isMobile }) => {
      if (!isMobile) { test.skip(); return; }
      await page.goto('/groups');
      const homeLink = page.getByTestId('bottom-nav').getByRole('link').first();
      await homeLink.click();
      await expect(page).toHaveURL(/\/$|\/\?/);
    });
  });

  test('viewport meta tag has viewport-fit=cover', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const viewport = await page.$eval(
      'meta[name="viewport"]',
      (el) => el.getAttribute('content')
    );
    expect(viewport).toContain('viewport-fit=cover');
  });
});
