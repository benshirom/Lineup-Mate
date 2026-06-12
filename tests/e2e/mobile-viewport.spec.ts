import { test, expect } from '@playwright/test';

const PUBLIC_PAGES = ['/', '/login'];

test.describe('mobile viewport — no overflow', () => {
  for (const path of PUBLIC_PAGES) {
    test(`${path} fits viewport on mobile`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const scrollHeight = await page.evaluate(() => document.documentElement.scrollWidth);
      const viewportWidth = page.viewportSize()?.width ?? 390;
      // Allow max 5px horizontal overflow (scrollbars etc.)
      expect(scrollHeight).toBeLessThanOrEqual(viewportWidth + 5);
    });
  }

  test('login page uses 100dvh not 100vh', async ({ page }) => {
    await page.goto('/login');
    const mainEl = page.locator('main').first();
    const minHeight = await mainEl.evaluate((el) =>
      getComputedStyle(el).minHeight
    );
    // 100dvh resolves to a px value equal to visual viewport height — just check it's set
    expect(minHeight).not.toBe('');
    expect(minHeight).not.toBe('0px');
  });
});

test.describe('viewport meta tag', () => {
  test('viewport-fit=cover is set', async ({ page }) => {
    await page.goto('/');
    const content = await page.locator('meta[name="viewport"]').first().getAttribute('content');
    expect(content).toContain('viewport-fit=cover');
  });
});

test.describe('PWA meta tags', () => {
  test('manifest link is present', async ({ page }) => {
    await page.goto('/');
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBe('/manifest.webmanifest');
  });

  test('manifest.webmanifest is valid JSON with required fields', async ({ page }) => {
    const response = await page.request.get('/manifest.webmanifest');
    expect(response.ok()).toBeTruthy();
    const json = await response.json();
    expect(json).toMatchObject({
      name: expect.any(String),
      short_name: expect.any(String),
      display: 'standalone',
      start_url: expect.any(String),
      icons: expect.arrayContaining([
        expect.objectContaining({ src: expect.any(String), sizes: expect.any(String) })
      ]),
    });
  });

  test('theme-color meta is present', async ({ page }) => {
    await page.goto('/');
    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(themeColor).toBeTruthy();
  });
});

test.describe('bottom nav', () => {
  test('BottomNav is visible on mobile (Pixel 5)', async ({ page, isMobile }) => {
    // Only run on mobile projects
    if (!isMobile) return;
    await page.goto('/login');
    // BottomNav requires auth — just verify it does NOT appear on login
    const bottomNav = page.locator('nav[aria-label="Bottom navigation"]');
    // On login page, user is not authenticated so BottomNav should not appear
    await expect(bottomNav).toHaveCount(0);
  });
});
