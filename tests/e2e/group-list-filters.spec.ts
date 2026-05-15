import { expect, test } from '@playwright/test';
import { login, selectFirstFestivalInForm } from './helpers';

const email = process.env.E2E_ADMIN_EMAIL || process.env.E2E_USER_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD || process.env.E2E_USER_PASSWORD;

async function openOrCreateGroup(page: import('@playwright/test').Page) {
  await page.goto('/groups');
  await expect(page.getByRole('heading', { name: /My Groups/i })).toBeVisible({ timeout: 20_000 });

  const existingGroup = page.getByTestId('group-card').first();
  if (await existingGroup.isVisible().catch(() => false)) {
    await existingGroup.getByTestId('open-group-schedule').click();
    await expect(page).toHaveURL(/\/group\/\d+/, { timeout: 20_000 });
    return;
  }

  const openModal = page.getByTestId('open-create-group-modal');
  if (await openModal.isVisible().catch(() => false)) await openModal.click();

  const form = page.locator('[data-testid="create-group-panel"]:visible').last();
  await expect(form).toBeVisible({ timeout: 20_000 });
  await selectFirstFestivalInForm(page, form);
  await form.getByTestId('group-name-input').fill(`E2E List Filters ${Date.now()}`);
  await form.getByTestId('create-group-submit').click();
  await expect(page).toHaveURL(/\/group\/\d+/, { timeout: 20_000 });
}

test.describe('group list filtering', () => {
  test.skip(!email || !password, 'Set E2E auth variables to run group list filter tests.');

  test('List view follows selected day and stage filters and keeps group picks contained', async ({ page }) => {
    await login(page, email!, password!);
    await openOrCreateGroup(page);

    await expect(page.getByTestId('group-schedule-title')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /^List$/i }).click();
    await expect(page.getByTestId('group-schedule-list')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('group-list-row').first()).toBeVisible({ timeout: 20_000 });

    const firstStage = (await page.getByTestId('group-stage-filter').first().innerText()).trim();
    const stageFilters = page.getByTestId('group-stage-filter');
    for (let index = 1; index < await stageFilters.count(); index += 1) {
      await stageFilters.nth(index).click();
    }
    await expect(page.getByTestId('group-list-row').first()).toContainText(firstStage);

    const dayTabs = page.getByTestId('group-day-tab');
    if (await dayTabs.count() > 1) {
      const firstDayLabel = (await dayTabs.first().innerText()).trim().split(',').pop()?.trim() || '';
      await expect(page.getByTestId('group-list-row').first()).toContainText(firstDayLabel.split(' ')[0]);
      await dayTabs.nth(1).click();
      await expect(page.getByTestId('group-schedule-list')).toBeVisible();
      await expect(page.getByTestId('group-list-row').first()).toBeVisible({ timeout: 20_000 });
    }

    const picks = page.getByTestId('group-performance-picks').first();
    if (await picks.isVisible().catch(() => false)) {
      const maxHeight = await picks.evaluate((element) => window.getComputedStyle(element).maxHeight);
      expect(maxHeight).not.toBe('none');
    }
  });
});
