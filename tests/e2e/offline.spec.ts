import { test, expect } from '@playwright/test';

test.describe('offline page', () => {
  test('GET /offline returns 200 with Hebrew content', async ({ request }) => {
    const r = await request.get('/offline');
    expect(r.status()).toBe(200);
    const body = await r.text();
    expect(body).toMatch(/אין חיבור|offline/i);
  });

  test('offline page renders retry button', async ({ page }) => {
    await page.goto('/offline');
    await expect(page.getByRole('button', { name: /נסה שוב/i })).toBeVisible();
  });
});
