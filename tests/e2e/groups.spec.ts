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

async function expectAuthenticatedMobileNav(page: import('@playwright/test').Page, isMobile: boolean) {
  if (!isMobile) return;
  await expect(page.getByRole('navigation', { name: /mobile bottom navigation/i })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('link', { name: /Festivals/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Schedule/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Groups/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Profile/i })).toBeVisible();
}

async function waitForGroupsPageReady(page: import('@playwright/test').Page) {
  await expect(page.getByRole('heading', { name: /My Groups/i })).toBeVisible({ timeout: 20_000 });
  await page.getByText(/Loading groups/i).waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => undefined);
  await expect(page.getByTestId('join-group-panel')).toBeVisible({ timeout: 20_000 });
}

async function openCreateGroupForm(page: import('@playwright/test').Page) {
  await waitForGroupsPageReady(page);

  const modalButton = page.getByTestId('open-create-group-modal');
  if (await modalButton.isVisible().catch(() => false)) {
    await modalButton.click();
    await expect(page.getByTestId('create-group-modal')).toBeVisible({ timeout: 20_000 });
  }

  const form = page.locator('[data-testid="create-group-panel"]:visible').last();
  await expect(form).toBeVisible({ timeout: 20_000 });
  return form;
}

async function prepareOwnerForGroupCreation(page: import('@playwright/test').Page) {
  await login(page, ownerEmail!, ownerPassword!);
}

async function expectSavedFestival(page: import('@playwright/test').Page) {
  await page.goto('/my-schedule');
  await expect(page.getByRole('heading', { name: /My Schedule/i })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('saved-festivals-section')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('saved-festival-card').first()).toBeVisible({ timeout: 20_000 });
}

test.describe.serial('group collaboration flows', () => {
  test.skip(!ownerEmail || !ownerPassword || !memberEmail || !memberPassword, 'Set E2E auth variables to run group tests.');

  test('Groups page lets an owner create a group and auto-save the festival', async ({ page, isMobile }) => {
    const groupName = `E2E Groups Page ${Date.now()}`;

    await prepareOwnerForGroupCreation(page);
    await page.goto('/groups');
    await expectAuthenticatedMobileNav(page, isMobile);

    await waitForGroupsPageReady(page);

    const form = await openCreateGroupForm(page);
    await selectFirstFestivalInForm(page, form);
    await form.getByTestId('group-name-input').fill(groupName);
    await expect(form.getByTestId('create-group-submit')).toBeEnabled({ timeout: 5_000 });
    await form.getByTestId('create-group-submit').click();

    await expect(page).toHaveURL(/\/group\/\d+/, { timeout: 20_000 });
    await expect(page.getByTestId('group-schedule-title')).toHaveText(groupName, { timeout: 20_000 });
    await expect(page.getByTestId(groupPageCodeTestId)).toBeVisible();
    await expect(page.getByTestId('group-member-pill').first()).toBeVisible();
    await expectSavedFestival(page);

    await page.goto('/groups');
    await waitForGroupsPageReady(page);
    await expect(page.getByTestId('group-card').filter({ hasText: groupName })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('open-create-group-modal')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('group-card').filter({ hasText: groupName }).getByTestId(groupCardCodeTestId)).toBeVisible();
    await expect(page.getByTestId('group-card').filter({ hasText: groupName }).getByTestId('open-group-schedule')).toBeVisible();
  });

  test('owner creates a group, another member joins, and group schedule defaults to list-first', async ({ page, isMobile }) => {
    const groupName = `E2E Group ${Date.now()}`;

    await prepareOwnerForGroupCreation(page);
    const festivalUrl = await openFirstFestival(page);
    await ensureFirstActIsStarred(page);

    await page.goto('/groups');
    await expectAuthenticatedMobileNav(page, isMobile);
    const form = await openCreateGroupForm(page);
    await selectFirstFestivalInForm(page, form);
    await form.getByTestId('group-name-input').fill(groupName);
    await expect(form.getByTestId('create-group-submit')).toBeEnabled({ timeout: 5_000 });
    await form.getByTestId('create-group-submit').click();

    await expect(page).toHaveURL(/\/group\/\d+/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: groupName })).toBeVisible({ timeout: 20_000 });

    const joinCode = (await page.getByTestId(groupPageCodeTestId).innerText()).trim();
    expect(joinCode.length).toBeGreaterThan(4);
    await expect(page.getByTestId('group-member-pill').first()).toBeVisible();

    await signOut(page);
    await login(page, memberEmail!, memberPassword!);
    await page.goto('/groups');
    await expectAuthenticatedMobileNav(page, isMobile);
    await waitForGroupsPageReady(page);
    await page.getByTestId('join-group-code-input').fill(joinCode);
    await expect(page.getByTestId('join-group-submit')).toBeEnabled({ timeout: 5_000 });
    await page.getByTestId('join-group-submit').click();

    await expect(page).toHaveURL(/\/group\/\d+/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: groupName })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/members/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /^List$/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('group-performance-block').first()).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: /^Timeline$/i }).click();
    await expect(page.getByTestId('group-performance-block').first()).toBeVisible({ timeout: 20_000 });

    await page.goto(festivalUrl);
    await expect(page.getByTestId('festival-performance-block').first()).toBeVisible({ timeout: 20_000 });
  });
});
