import { expect, test } from '@playwright/test';

test.describe('public browsing', () => {
  test('home page loads and shows public festival browsing UI', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText(/Plan your festival schedule\. Together\.|תכנון לוח פסטיבל/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByPlaceholder(/Search festivals|Search events|חפש/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /Open schedule|View Lineup|צפה בליינאפ/i }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('genre-filter-row')).toBeVisible({ timeout: 20_000 });
  });

  test('mobile home page exposes the premium preview and bottom-safe layout', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-only layout check');

    await page.goto('/');

    await expect(page.getByText(/Premium festival planner/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('product-preview-card')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('link', { name: /Explore festivals/i })).toBeVisible({ timeout: 20_000 });
  });

  test('guest can open a festival and see schedule tabs', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('button', { name: /Open schedule|View Lineup|צפה בליינאפ/i }).first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Open schedule|View Lineup|צפה בליינאפ/i }).first().click();

    await expect(page.getByRole('button', { name: /timeline|schedule/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /lineup|artists/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /info/i })).toBeVisible();
  });

  test('guest is sent to login when trying to save a festival', async ({ page }) => {
    await page.goto('/');

    const saveButton = page.getByRole('button', { name: /Save|Save Festival|שמור פסטיבל/i }).first();
    await expect(saveButton).toBeVisible({ timeout: 20_000 });
    await saveButton.click();

    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /Welcome back|Create an account/i })).toBeVisible({ timeout: 20_000 });
  });
});
