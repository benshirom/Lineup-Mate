import { expect, test } from '@playwright/test';

test.describe('Google login entry point', () => {
  test('Google button starts OAuth redirect flow', async ({ page }) => {
    await page.goto('/login');

    const googleButton = page.getByRole('button', { name: /Continue with Google/i });
    await expect(googleButton).toBeVisible();
    await googleButton.click();

    await page.waitForURL(/accounts\.google\.com|supabase\.co\/auth\/v1\/authorize/, { timeout: 15_000 });
    await expect(page).toHaveURL(/accounts\.google\.com|supabase\.co\/auth\/v1\/authorize/);
  });
});
