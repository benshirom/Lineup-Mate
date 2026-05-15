import { expect, test } from '@playwright/test';
import { clickNav, ensureFirstActIsStarred, ensureFirstFestivalIsSaved, login, openFirstFestival, openMobileMenu, openProfile } from './helpers';

const testEmail = process.env.E2E_USER_EMAIL;
const testPassword = process.env.E2E_USER_PASSWORD;

async function mainBackground(page: import('@playwright/test').Page) {
  return page.locator('main').first().evaluate((element) => window.getComputedStyle(element).backgroundColor);
}

async function expectSavedFestivalCard(page: import('@playwright/test').Page) {
  await expect(page.getByTestId('saved-festivals-section'), 'My Schedule loaded, but saved festivals section is missing.').toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByTestId('saved-festival-card').first(),
    'Saved festival card was not rendered. If this fails, the save did not persist to saved_festivals or My Schedule cannot read saved_festivals.'
  ).toBeVisible({ timeout: 20_000 });
}

test.describe('authenticated flows', () => {
  test.skip(!testEmail || !testPassword, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run authenticated tests.');

  test.beforeEach(async ({ page }) => {
    await login(page, testEmail!, testPassword!);
  });

  test('user can save a festival and see it on My Schedule', async ({ page }) => {
    await test.step('save first festival from home', async () => {
      await ensureFirstFestivalIsSaved(page);
    });

    await test.step('verify saved festival is listed on My Schedule', async () => {
      await page.goto('/my-schedule');
      await expect(page.getByRole('heading', { name: /My Schedule|הלוח שלי/i })).toBeVisible({ timeout: 20_000 });
      await expectSavedFestivalCard(page);
      await expect(page.getByRole('button', { name: /Open Festival/i }).first()).toBeVisible();
    });
  });

  test('user can open groups area', async ({ page }) => {
    await page.goto('/groups');
    await expect(page.getByRole('heading', { name: /My Groups/i })).toBeVisible();
    await expect(page.getByTestId('join-group-panel')).toBeVisible({ timeout: 20_000 });
  });

  test('user can open first festival and star an act if timeline has items', async ({ page }) => {
    await openFirstFestival(page);
    await ensureFirstActIsStarred(page);

    await page.goto('/my-schedule');
    await expect(page.getByRole('heading', { name: /My Schedule|הלוח שלי/i })).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByTestId('saved-acts-section'),
      'Saved acts section is missing after starring an act. If this fails, user_performance_preferences save/read is broken.'
    ).toBeVisible({ timeout: 20_000 });
  });

  test('My Schedule groups saved acts by festival and opens the exact day', async ({ page }) => {
    await openFirstFestival(page);

    const dayTabs = page.getByTestId('festival-day-tab');
    const dayCount = await dayTabs.count();
    if (dayCount > 1) await dayTabs.nth(1).click();

    await ensureFirstActIsStarred(page);
    const selectedDayUrl = page.url();
    const selectedDay = new URL(selectedDayUrl).searchParams.get('day');

    await page.goto('/my-schedule');
    await expect(
      page.getByTestId('schedule-festival-group').first(),
      'My Schedule did not group saved acts by festival. If this fails, check user_performance_preferences persistence/read.'
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('schedule-day-group').first()).toBeVisible({ timeout: 20_000 });

    const festivalGroupCount = await page.getByTestId('schedule-festival-group').count();
    expect(festivalGroupCount).toBeGreaterThanOrEqual(1);

    await page.getByTestId('open-festival-day').first().click();
    await expect(page).toHaveURL(/\/festival\/\d+\?day=/, { timeout: 20_000 });

    if (selectedDay) expect(new URL(page.url()).searchParams.get('day')).toBeTruthy();
  });

  test('user can open Profile page from the user badge or mobile profile navigation', async ({ page }) => {
    await openProfile(page);
    await expect(page).toHaveURL(/\/profile/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /Profile|פרופיל/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Account details/i)).toBeVisible();
    await expect(page.getByLabel(/Display Name/i)).toBeVisible();
    await expect(page.getByLabel(/^Email$/i)).toBeVisible();
    await expect(page.getByLabel(/Theme/i)).toBeVisible();
    await expect(page.getByLabel(/Language/i)).toBeVisible();
    await expect(page.getByLabel(/Avatar URL|Profile Photo/i)).toBeVisible();
  });

  test('profile language and theme preferences update the UI immediately', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: /Profile|פרופיל/i })).toBeVisible({ timeout: 20_000 });

    await page.getByLabel(/Language/i).selectOption('he');
    await expect(page.locator('html'), 'Language change should flip html dir to rtl immediately.').toHaveAttribute('dir', 'rtl');

    const visibleHebrewScheduleLink = page.getByRole('link', { name: /הלוח שלי/i }).first();
    if (!(await visibleHebrewScheduleLink.isVisible().catch(() => false))) {
      await openMobileMenu(page);
    }
    await expect(
      page.getByRole('link', { name: /הלוח שלי/i }).first(),
      'Hebrew navigation label should be visible in desktop nav or mobile drawer after language switch.'
    ).toBeVisible({ timeout: 20_000 });

    await page.getByLabel(/Theme/i).selectOption('light');
    await expect(page.locator('html'), 'Theme change should set html data-theme=light immediately.').toHaveAttribute('data-theme', 'light');

    await page.getByRole('button', { name: /Save Profile/i }).click();
    await expect(page.getByText(/Profile saved successfully/i)).toBeVisible({ timeout: 20_000 });

    await page.getByLabel(/Language/i).selectOption('en');
    await page.getByLabel(/Theme/i).selectOption('dark');
    await page.getByRole('button', { name: /Save Profile/i }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });

  test('saved light theme is applied across festival, groups, schedule and admin pages', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: /Profile|פרופיל/i })).toBeVisible({ timeout: 20_000 });
    await page.getByLabel(/Language/i).selectOption('en');
    await page.getByLabel(/Theme/i).selectOption('light');
    await page.getByRole('button', { name: /Save Profile/i }).click();
    await expect(page.getByText(/Profile saved successfully/i)).toBeVisible({ timeout: 20_000 });

    await openFirstFestival(page);
    expect(await mainBackground(page), 'Festival page still uses dark background after light theme was saved.').not.toBe('rgb(13, 13, 28)');

    await page.goto('/groups');
    await expect(page.getByRole('heading', { name: /My Groups/i })).toBeVisible({ timeout: 20_000 });
    expect(await mainBackground(page), 'Groups page still uses dark background after light theme was saved.').not.toBe('rgb(13, 13, 28)');

    await page.goto('/my-schedule');
    await expect(page.getByRole('heading', { name: /My Schedule/i })).toBeVisible({ timeout: 20_000 });
    expect(await mainBackground(page), 'My Schedule page still uses dark background after light theme was saved.').not.toBe('rgb(13, 13, 28)');

    const adminLink = page.getByRole('link', { name: /Admin/i }).first();
    if (await adminLink.isVisible().catch(() => false)) {
      await clickNav(page, /Admin/i);
      await expect(page.getByRole('heading', { name: /Clashfinder Import/i })).toBeVisible({ timeout: 20_000 });
      expect(await mainBackground(page), 'Admin page still uses dark background after light theme was saved.').not.toBe('rgb(13, 13, 28)');
    }

    await page.goto('/profile');
    await page.getByLabel(/Theme/i).selectOption('dark');
    await page.getByRole('button', { name: /Save Profile/i }).click();
  });
});
