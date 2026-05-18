import { expect, test } from '@playwright/test';

test.describe('public browsing', () => {
  test('home page loads and shows public festival browsing UI', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText(/Plan your festival schedule|Never miss a set again|לעולם לא תפספס הופעה/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByPlaceholder(/Search events|חפש אירועים/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /Open Schedule|View Lineup|צפה בליינאפ/i }).first()).toBeVisible({ timeout: 20_000 });
  });

  test('guest can open a festival and see schedule tabs', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('button', { name: /Open Schedule|View Lineup|צפה בליינאפ/i }).first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Open Schedule|View Lineup|צפה בליינאפ/i }).first().click();

    await expect(page.getByRole('button', { name: /^Timeline$/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /^Artists$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Info$/i })).toBeVisible();
  });

  test('guest is sent to login when trying to save a festival', async ({ page }) => {
    await page.goto('/');

    const saveButton = page.getByRole('button', { name: /\+ Save|Save Festival|שמור פסטיבל/i }).first();
    await expect(saveButton).toBeVisible({ timeout: 20_000 });
    await saveButton.click();

    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /Welcome back|Create your lineup account|Create an account/i })).toBeVisible({ timeout: 20_000 });
  });
});
