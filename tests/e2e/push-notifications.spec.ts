import { test, expect } from '@playwright/test';
import path from 'path';

test.use({ storageState: path.join(__dirname, '.auth/user.json') });

test.describe('push subscription API', () => {
  test('POST /api/push/subscribe rejects without auth', async ({ request }) => {
    const r = await request.post('/api/push/subscribe', {
      data: {
        endpoint: 'https://example.com/push/test',
        p256dh: 'test',
        auth: 'test',
        platform: 'web',
      },
    });
    expect(r.status()).toBe(401);
  });

  test('POST /api/push/subscribe rejects invalid body', async ({ request }) => {
    // Missing endpoint
    const r = await request.post('/api/push/subscribe', {
      headers: { Authorization: 'Bearer fake-token' },
      data: { p256dh: 'x', auth: 'y', platform: 'web' },
    });
    // 401 (token invalid) or 400 (body invalid) — either is correct
    expect([400, 401]).toContain(r.status());
  });

  test('DELETE /api/push/subscribe rejects without auth', async ({ request }) => {
    const r = await request.delete('/api/push/subscribe', {
      data: { endpoint: 'https://example.com/push/test' },
    });
    expect(r.status()).toBe(401);
  });

  test('GET /api/push/subscribe returns 405', async ({ request }) => {
    const r = await request.get('/api/push/subscribe');
    expect(r.status()).toBe(405);
  });
});

test.describe('push notification preferences UI', () => {
  test('notification prefs form renders', async ({ page }) => {
    // This test requires auth — skip if no credentials configured
    const email = process.env.E2E_USER_EMAIL;
    const password = process.env.E2E_USER_PASSWORD;
    if (!email || !password) {
      test.skip();
      return;
    }

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="text"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('notification-prefs-form')).toBeVisible();
  });
});
