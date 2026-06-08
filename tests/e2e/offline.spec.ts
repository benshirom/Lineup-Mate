import { test, expect } from '@playwright/test';

test.describe('offline page', () => {
  test('GET /offline returns 200 with content', async ({ request }) => {
    const r = await request.get('/offline');
    expect(r.status()).toBe(200);
    const body = await r.text();
    expect(body).toMatch(/No internet connection|offline/i);
  });

  test('offline page renders retry button', async ({ page }) => {
    await page.goto('/offline');
    await expect(page.getByRole('button', { name: /Try again/i })).toBeVisible();
  });
});
