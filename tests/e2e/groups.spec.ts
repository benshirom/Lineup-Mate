import { expect, test } from '@playwright/test';
import { ensureFirstActIsStarred, login, openFirstFestival, signOut } from './helpers';

const ownerEmail = process.env.E2E_ADMIN_EMAIL;
const ownerPassword = process.env.E2E_ADMIN_PASSWORD;
const memberEmail = process.env.E2E_USER_EMAIL;
const memberPassword = process.env.E2E_USER_PASSWORD;

test.describe.serial('group collaboration flows', () => {
  test.skip(
    !ownerEmail || !ownerPassword || !memberEmail || !memberPassword,
    'Set E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_USER_EMAIL and E2E_USER_PASSWORD to run group tests.'
  );

  test('Groups page lets an owner create a group, copy invite, open it and see management tools', async ({ page }) => {
    const groupName = `E2E Groups Page ${Date.now()}`;

    await login(page, ownerEmail!, ownerPassword!);
    await page.goto('/groups');

    await expect(page.getByRole('heading', { name: /My Groups/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('create-group-panel')).toBeVisible();
    await expect(page.getByTestId('join-group-panel')).toBeVisible();
    await expect(page.getByTestId('group-festival-select')).toBeVisible();

    await page.getByTestId('group-name-input').fill(groupName);
    await page.getByTestId('create-group-submit').click();

    await expect(page).toHaveURL(/\/group\/\d+/, { timeout: 20_000 });
    await expect(page.getByTestId('group-schedule-title')).toHaveText(groupName, { timeout: 20_000 });
    await expect(page.getByText(/Invite friends/i)).toBeVisible();
    await expect(page.getByTestId('group-page-invite-code')).toBeVisible();
    await expect(page.getByTestId('group-member-pill').first()).toBeVisible();

    await page.getByRole('button', { name: /My Groups/i }).click();
    await expect(page).toHaveURL(/\/groups/, { timeout: 20_000 });
    await expect(page.getByTestId('group-card').filter({ hasText: groupName })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('group-card').filter({ hasText: groupName }).getByTestId('group-invite-code')).toBeVisible();
    await expect(page.getByTestId('group-card').filter({ hasText: groupName }).getByTestId('open-group-schedule')).toBeVisible();
  });

  test('owner creates a group, second user joins with invite code from Groups page, and group schedule shows festival-style timeline', async ({ page }) => {
    const groupName = `E2E Group ${Date.now()}`;

    await login(page, ownerEmail!, ownerPassword!);
    const festivalUrl = await openFirstFestival(page);
    await ensureFirstActIsStarred(page);

    await page.goto('/groups');
    await page.getByTestId('group-name-input').fill(groupName);
    await page.getByTestId('create-group-submit').click();

    await expect(page).toHaveURL(/\/group\/\d+/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: groupName })).toBeVisible({ timeout: 20_000 });

    const inviteCode = (await page.getByTestId('group-page-invite-code').innerText()).trim();
    expect(inviteCode.length).toBeGreaterThan(4);
    await expect(page.getByTestId('group-member-pill').first()).toBeVisible();

    await signOut(page);
    await login(page, memberEmail!, memberPassword!);
    await page.goto(festivalUrl);
    await ensureFirstActIsStarred(page);

    await page.goto('/groups');
    await expect(page.getByTestId('join-group-panel')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('join-group-code-input').fill(inviteCode);
    await page.getByTestId('join-group-submit').click();

    await expect(page).toHaveURL(/\/group\/\d+/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: groupName })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('group-member-pill')).toHaveCount(2, { timeout: 20_000 });

    await expect(page.getByRole('button', { name: /^Timeline$/i })).toBeVisible();
    await expect(page.getByTestId('group-day-tabs')).toBeVisible();
    await expect(page.getByTestId('group-stage-filters')).toBeVisible();
    await expect(page.getByTestId('group-timeline')).toBeVisible();
    await expect(page.getByTestId('group-performance-block').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('group-performance-picks').first()).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: /^List$/i }).click();
    await expect(page.getByTestId('group-schedule-list')).toBeVisible();
    await expect(page.getByText(/Going/i)).toBeVisible();

    await page.getByRole('button', { name: /My Groups/i }).click();
    await expect(page.getByTestId('group-card').filter({ hasText: groupName })).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('group-card').filter({ hasText: groupName }).getByTestId('open-group-schedule').click();
    await expect(page.getByTestId('group-schedule-title')).toHaveText(groupName, { timeout: 20_000 });
  });
});