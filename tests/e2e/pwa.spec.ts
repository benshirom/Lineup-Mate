import { test, expect } from '@playwright/test';

test.describe('PWA assets', () => {
  test('icons exist — 192 and 512', async ({ page }) => {
    const r192 = await page.request.get('/icons/icon-192.png');
    expect(r192.ok()).toBeTruthy();
    expect(r192.headers()['content-type']).toContain('image/png');

    const r512 = await page.request.get('/icons/icon-512.png');
    expect(r512.ok()).toBeTruthy();
  });

  test('maskable icon exists', async ({ page }) => {
    const r = await page.request.get('/icons/icon-512-maskable.png');
    expect(r.ok()).toBeTruthy();
  });

  test('apple-touch-icon link is present', async ({ page }) => {
    await page.goto('/');
    const appleIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
    expect(appleIcon).toBeTruthy();
  });

  test('apple-mobile-web-app-capable is set', async ({ page }) => {
    await page.goto('/');
    const capable = await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute('content');
    expect(capable).toBe('yes');
  });
});

test.describe('well-known files', () => {
  test('assetlinks.json is accessible', async ({ page }) => {
    const r = await page.request.get('/.well-known/assetlinks.json');
    expect(r.ok()).toBeTruthy();
    const json = await r.json();
    expect(Array.isArray(json)).toBeTruthy();
  });

  test('apple-app-site-association is accessible', async ({ page }) => {
    const r = await page.request.get('/.well-known/apple-app-site-association');
    expect(r.ok()).toBeTruthy();
    const json = await r.json();
    expect(json).toHaveProperty('applinks');
  });
});
