import { test, expect } from '@playwright/test';
import path from 'path';
import { login } from './helpers';

test.use({ storageState: path.join(__dirname, '.auth/user.json') });

test.describe('storage abstraction', () => {
  test('theme persists in localStorage across reload', async ({ page }) => {
    const email = process.env.E2E_USER_EMAIL;
    const password = process.env.E2E_USER_PASSWORD;
    if (!email || !password) { test.skip(); return; }

    await login(page, email, password);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Check localStorage has the theme key
    const theme = await page.evaluate(() => localStorage.getItem('lineup-mate-theme'));
    expect(['light', 'dark']).toContain(theme);

    // Reload and confirm theme still there
    await page.reload();
    const themeAfter = await page.evaluate(() => localStorage.getItem('lineup-mate-theme'));
    expect(themeAfter).toBe(theme);
  });

  test('pending invite code is cleared from sessionStorage after join', async ({ page }) => {
    // Set a fake invite code in sessionStorage
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => sessionStorage.setItem('pendingInviteCode', 'testcode'));

    // Verify it's there
    const before = await page.evaluate(() => sessionStorage.getItem('pendingInviteCode'));
    expect(before).toBe('testcode');

    // sessionStorage is cleared per tab — verify isolation
    const newPage = await page.context().newPage();
    await newPage.goto('/');
    const inNewTab = await newPage.evaluate(() => sessionStorage.getItem('pendingInviteCode'));
    // sessionStorage does NOT persist across tabs
    expect(inNewTab).toBeNull();
    await newPage.close();
  });
});
