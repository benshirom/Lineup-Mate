import { expect, test } from '@playwright/test';
import {
  ensureFirstActIsStarred,
  login,
  openFirstFestival,
  selectFirstFestivalInForm,
  signOut
} from './helpers';

const ownerEmail = process.env.E2E_ADMIN_EMAIL;
const ownerPassword = process.env.E2E_ADMIN_PASSWORD;
const memberEmail = process.env.E2E_USER_EMAIL;
const memberPassword = process.env.E2E_USER_PASSWORD;

const groupPageCodeTestId = ['group-page', 'invite-code'].join('-');
const groupCardCodeTestId = ['group', 'invite-code'].join('-');

async function openCreateGroupForm(page: import('@playwright/test').Page) {
  const modalButton = page.getByTestId('open-create-group-modal');
  if (await modalButton.isVisible().catch(() => false)) {
    await modalButton.click();
    await expect(page.getByTestId('create-group-modal')).toBeVisible({ timeout: 20_000 });
  }
  await expect(page.getByTestId('create-group-panel')).toBeVisible({ timeout: 20_000 });
}

async function prepareOwnerForGroupCreation(page: import('@playwright/test').Page) {
  await login(page, ownerEmail!, ownerPassword!);
}

async function expectSavedFestival(page: import('@playwright/test').Page) {
  await page.goto('/my-schedule');
  await expect(page.getByRole('heading', { name: /My Schedule|הלוח שלי/i })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('saved-festivals-section')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('saved-festival-card').first()).toBeVisible({ timeout: 20_000 });
}

test.describe.serial('group collaboration flows', () => {
  test.skip(!ownerEmail || !ownerPassword || !memberEmail || !memberPassword, 'Set E2E auth variables to run group tests.');

  test('Groups page lets an owner create a group and auto-save the festival', async ({ page }) => {
    const groupName = `E2E Groups Page ${Date.now()}`;

    await prepareOwnerForGroupCreation(page);
    await page.goto('/groups');

    await expect(page.getByRole('heading', { name: /My Groups/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('join-group-panel')).toBeVisible();

    await openCreateGroupForm(page);
    await selectFirstFestivalInForm(page);
    await page.getByTestId('group-name-input').fill(groupName);
    await expect(page.getByTestId('create-group-submit')).toBeEnabled({ timeout: 5_000 });
    await page.getByTestId('create-group-submit').click();

    await expect(page).toHaveURL(/\/group\/\d+/, { timeout: 20_000 });
    await expect(page.getByTestId('group-schedule-title')).toHaveText(groupName, { timeout: 20_000 });
    await expect(page.getByTestId(groupPageCodeTestId)).toBeVisible();
    await expect(page.getByTestId('group-member-pill').first()).toBeVisible();
    await expectSavedFestival(page);

    await page.goto('/groups');
    await expect(page.getByTestId('group-card').filter({ hasText: groupName })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('open-create-group-modal')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('group-card').filter({ hasText: groupName }).getByTestId(groupCardCodeTestId)).toBeVisible();
    await expect(page.getByTestId('group-card').filter({ hasText: groupName }).getByTestId('open-group-schedule')).toBeVisible();
  });

  test('owner creates a group, second user joins, and group schedule shows timeline', async ({ page }) => {
    const groupName = `E2E Group ${Date.now()}`;

    await prepareOwnerForGroupCreation(page);
    const festivalUrl = await openFirstFestival(page);
    await ensureFirstActIsStarred(page);

    await page.goto('/groups');
    await openCreateGroupForm(page);
    await selectFirstFestivalInForm(page);
    await page.getByTestId('group-name-input').fill(groupName);
    await expect(page.getByTestId('create-group-submit')).toBeEnabled({ timeout: 5_000 });
    await page.getByTestId('create-group-submit').click();

    await expect(page).toHaveURL(/\/group\/\d+/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: groupName })).toBeVisible({ timeout: 20_000 });

    const joinCode = (await page.getByTestId(groupPageCodeTestId).innerText()).trim();
    expect(joinCode.length).toBeGreaterThan(4);
    await expect(page.getByTestId('group-member-pill').first()).toBeVisible();

    await signOut(page);
    await login(page, memberEmail!, memberPassword!);
    await page.goto('/groups');
    await expect(page.getByTestId('join-group-panel')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('join-group-code-input').fill(joinCode);
    await page.getByTestId('join-group-submit').click();

    await expect(page).toHaveURL(/\/group\/\d+/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: groupName })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('group-member-pill')).toHaveCount(2, { timeout: 20_000 });
    await expectSavedFestival(page);

    await page.goto(festivalUrl);
    await ensureFirstActIsStarred(page);
    await page.goto('/groups');
    await page.getByTestId('group-card').filter({ hasText: groupName }).getByTestId('open-group-schedule').click();

    await expect(page.getByRole('button', { name: /^Timeline$/i })).toBeVisible();
    await expect(page.getByTestId('group-day-tabs')).toBeVisible();
    await expect(page.getByTestId('group-stage-filters')).toBeVisible();
    await expect(page.getByTestId('group-timeline')).toBeVisible();
    await expect(page.getByTestId('group-timeline-scroll')).toBeVisible();
    await expect(page.getByTestId('group-performance-block').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('group-performance-picks').first()).toBeVisible({ timeout: 20_000 });

    const timelineBlocks = await page.getByTestId('group-performance-block').count();
    const pickedBlocks = await page.getByTestId('group-performance-picks').count();
    expect(timelineBlocks).toBeGreaterThan(pickedBlocks);

    const stageFilters = await page.getByTestId('group-stage-filter').count();
    const stageRows = await page.getByTestId('group-stage-row').count();
    expect(stageFilters).toBeGreaterThanOrEqual(stageRows);

    await page.getByRole('button', { name: /^List$/i }).click();
    await expect(page.getByTestId('group-schedule-list')).toBeVisible();
    await expect(page.getByText(/Group picks/i)).toBeVisible();
    await expect(page.getByText(/No group picks/i).first()).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: /My Groups/i }).click();
    await expect(page.getByTestId('group-card').filter({ hasText: groupName })).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('group-card').filter({ hasText: groupName }).getByTestId('open-group-schedule').click();
    await expect(page.getByTestId('group-schedule-title')).toHaveText(groupName, { timeout: 20_000 });
  });
});
