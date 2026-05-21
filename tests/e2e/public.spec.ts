import { expect, test } from '@playwright/test';

test.describe('public browsing', () => {
  test('home page loads and shows public festival browsing UI', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText(/Your festival plan, without the chaos|Plan your festival schedule/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Built for festival crews/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('product-preview-card')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('link', { name: /^FAQ$/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByPlaceholder(/Search festivals|Search events|חפש אירועים/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /Open Schedule|View Lineup|צפה בליינאפ/i }).first()).toBeVisible({ timeout: 20_000 });
  });

  test('guest can open the FAQ page from the homepage and continue to the planning guide', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('link', { name: /^FAQ$/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('link', { name: /^FAQ$/i }).first().click();

    await expect(page).toHaveURL(/\/faq/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /Festival planning, explained clearly/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('faq-list')).toBeVisible();
    await expect(page.getByText(/What is Lineup·Mate/i)).toBeVisible();

    await page.getByRole('link', { name: /Read the planning guide/i }).click();
    await expect(page).toHaveURL(/\/guides\/festival-lineup-planning/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /How to plan a festival lineup/i })).toBeVisible({ timeout: 20_000 });
  });

  test('guest can open a festival and see schedule tabs', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('button', { name: /Open Schedule|View Lineup|צפה בליינאפ/i }).first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Open Schedule|View Lineup|צפה בליינאפ/i }).first().click();

    await expect(page.getByRole('button', { name: /^Artists$/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /^Timeline$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Info$/i })).toBeVisible();
    await expect(page.getByTestId('festival-performance-block').first()).toBeVisible({ timeout: 20_000 });
  });

  test('festival stage filters keep neutral premium surface styling', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('button', { name: /Open Schedule|View Lineup|צפה בליינאפ/i }).first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Open Schedule|View Lineup|צפה בליינאפ/i }).first().click();

    const firstStageFilter = page.getByTestId('festival-stage-filter').first();
    await expect(firstStageFilter).toBeVisible({ timeout: 20_000 });

    const backgroundColor = await firstStageFilter.evaluate((element) => window.getComputedStyle(element).backgroundColor);
    expect(backgroundColor).toBe('rgb(21, 30, 46)');
  });

  test('guest gets a save-account nudge when trying to save a festival', async ({ page }) => {
    await page.goto('/');

    const saveButton = page.getByRole('button', { name: /\+ Save|Save Festival|שמור פסטיבל/i }).first();
    await expect(saveButton).toBeVisible({ timeout: 20_000 });
    await saveButton.click();

    await expect(page.getByRole('heading', { name: /Create a free account first/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /Continue/i })).toBeVisible();
    await page.getByRole('button', { name: /Continue/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  });
});
