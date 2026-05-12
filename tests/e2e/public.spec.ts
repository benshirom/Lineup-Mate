import { expect, test } from '@playwright/test';

test.describe('public browsing', () => {
  test('home page loads and shows public festival browsing UI', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Lineup-Mate').first()).toBeVisible();
    await expect(page.getByText(/Never miss a set again/i)).toBeVisible();
    await expect(page.getByPlaceholder(/Search events/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /View Lineup/i }).first()).toBeVisible();
  });

  test('guest can open a festival and see schedule tabs', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /View Lineup/i }).first().click();

    await expect(page.getByRole('button', { name: /timeline/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /lineup/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /info/i })).toBeVisible();
  });

  test('guest is sent to login when trying to save a festival', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /Save Festival/i }).first().click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: /Welcome back|Create an account/i })).toBeVisible();
  });
});
