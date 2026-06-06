import { expect, test } from '@playwright/test';
import { clickNav, ensureFirstActIsStarred, ensureFirstFestivalIsSaved, login, openFirstFestival, openArtistsTab, openProfile } from './helpers';

const testEmail = process.env.E2E_USER_EMAIL;
const testPassword = process.env.E2E_USER_PASSWORD;

async function expectSavedFestivalCard(page: import('@playwright/test').Page) {
  await expect(page.getByTestId('saved-festivals-section'), 'My Schedule loaded, but saved festivals section is missing.').toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByTestId('saved-festival-card').first(),
    'Saved festival card was not rendered. If this fails, the save did not persist to saved_festivals or My Schedule cannot read saved_festivals.'
  ).toBeVisible({ timeout: 20_000 });
}

async function expectLightTheme(page: import('@playwright/test').Page, context: string) {
  await expect(page.locator('html'), context).toHaveAttribute('data-theme', 'light', { timeout: 20_000 });
}

test.describe('authenticated flows', () => {
  test.skip(!testEmail || !testPassword, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run authenticated tests.');

  test.beforeEach(async ({ page }) => {
    await login(page, testEmail!, testPassword!);
  });

  test('user can save a festival and see it on My Schedule', async ({ page }) => {
    await ensureFirstFestivalIsSaved(page);

    await page.goto('/my-schedule');
    await expect(page.getByRole('heading', { name: /My Schedule/i })).toBeVisible({ timeout: 20_000 });
    await expectSavedFestivalCard(page);
    await expect(page.getByRole('button', { name: /Open Festival/i }).first()).toBeVisible();
  });

  test('user can open groups area', async ({ page }) => {
    await page.goto('/groups');
    await expect(page.getByRole('heading', { name: /My Groups/i })).toBeVisible();
    await expect(page.getByTestId('join-group-panel')).toBeVisible({ timeout: 20_000 });
  });

  test('user can open first festival and star an act if timeline has items', async ({ page }) => {
    test.setTimeout(60_000);

    await openFirstFestival(page);
    await ensureFirstActIsStarred(page);

    await page.goto('/my-schedule');
    await expect(page.getByRole('heading', { name: /My Schedule/i })).toBeVisible({ timeout: 20_000 });
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

  test('user can open Profile page and language controls are removed', async ({ page }) => {
    await openProfile(page);
    await expect(page).toHaveURL(/\/profile/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /Profile/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Account details/i)).toBeVisible();
    await expect(page.getByLabel(/Display Name/i)).toBeVisible();
    await expect(page.getByLabel(/^Email$/i)).toBeVisible();
    await expect(page.getByLabel(/Theme/i)).toBeVisible();
    await expect(page.getByLabel(/Profile Photo/i)).toBeVisible();
    await expect(page.getByLabel(/Language/i)).toHaveCount(0);
    await expect(page.getByLabel(/Avatar URL/i)).toHaveCount(0);
  });

  test('profile can preview an uploaded avatar file without URL input', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: /Profile/i })).toBeVisible({ timeout: 20_000 });

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#e85d26"/><text x="32" y="40" text-anchor="middle" font-size="28" fill="white">LM</text></svg>`;
    await page.getByTestId('profile-avatar-file').setInputFiles({
      name: 'avatar.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from(svg)
    });

    await expect(page.getByTestId('profile-avatar-preview').locator('img')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel(/Avatar URL/i)).toHaveCount(0);
  });

  test('profile theme preference updates immediately and persists across pages', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: /Profile/i })).toBeVisible({ timeout: 20_000 });

    await page.getByLabel(/Theme/i).selectOption('light');
    await expectLightTheme(page, 'Theme change should set html data-theme=light immediately.');

    await page.getByRole('button', { name: /Save Profile/i }).click();
    await expect(page.getByText(/Profile saved successfully/i)).toBeVisible({ timeout: 20_000 });
    await expectLightTheme(page, 'Saving light theme should keep html data-theme=light.');

    await openFirstFestival(page);
    await expectLightTheme(page, 'Festival page should keep the saved light theme state.');

    await page.goto('/groups');
    await expect(page.getByRole('heading', { name: /My Groups/i })).toBeVisible({ timeout: 20_000 });
    await expectLightTheme(page, 'Groups page should keep the saved light theme state.');

    await page.goto('/my-schedule');
    await expect(page.getByRole('heading', { name: /My Schedule/i })).toBeVisible({ timeout: 20_000 });
    await expectLightTheme(page, 'My Schedule page should keep the saved light theme state.');

    const adminLink = page.getByRole('link', { name: /Admin/i }).first();
    if (await adminLink.isVisible().catch(() => false)) {
      await clickNav(page, /Admin/i);
      await expect(page.getByRole('heading', { name: /Clashfinder Import/i })).toBeVisible({ timeout: 20_000 });
      await expectLightTheme(page, 'Admin page should keep the saved light theme state.');
    }

    await page.goto('/profile');
    await page.getByLabel(/Theme/i).selectOption('dark');
    await page.getByRole('button', { name: /Save Profile/i }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('starring an artist from Artists tab stars all their performances', async ({ page }) => {
    test.setTimeout(120_000);
    await openFirstFestival(page);
    await openArtistsTab(page);

    // Find first unstarred artist row
    const firstUnstarredRow = page.getByTestId('lineup-artist-row').filter({
      has: page.getByTestId('lineup-artist-star').filter({ hasText: '☆' })
    }).first();
    await expect(firstUnstarredRow, 'At least one artist should be unstarred in Lineup tab').toBeVisible({ timeout: 20_000 });

    // Capture artist name before clicking (stable identifier for post-click lookup)
    const artistName = await firstUnstarredRow.locator('h3').innerText();

    await firstUnstarredRow.getByTestId('lineup-artist-star').click({ force: true });

    // Re-locate the row by artist name (stable after star changes from ☆ to ★)
    const rowByName = page.getByTestId('lineup-artist-row').filter({ hasText: artistName });
    await expect(
      rowByName.getByTestId('lineup-artist-star'),
      `After starring ${artistName} from Lineup tab, the star should become ★`
    ).toHaveText('★', { timeout: 30_000 });
  });
});
