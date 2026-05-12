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

  test('owner creates a group, second user joins with invite code, and group schedule shows festival-style timeline', async ({ page }) => {
    const groupName = `E2E Group ${Date.now()}`;

    await login(page, ownerEmail!, ownerPassword!);
    const festivalUrl = await openFirstFestival(page);
    await ensureFirstActIsStarred(page);

    await page.getByRole('button', { name: /^Create Group$/i }).click();
    await page.getByPlaceholder(/e\.g\. Ozora Squad/i).fill(groupName);
    await page.getByRole('button', { name: /^Create$/i }).click();

    await expect(page).toHaveURL(/\/group\/\d+/);
    await expect(page.getByRole('heading', { name: groupName })).toBeVisible();

    const inviteCode = (await page.locator('code').first().innerText()).trim();
    expect(inviteCode.length).toBeGreaterThan(4);
    await expect(page.getByTestId('group-member-pill').first()).toBeVisible();

    await signOut(page);
    await login(page, memberEmail!, memberPassword!);
    await page.goto(festivalUrl);
    await ensureFirstActIsStarred(page);

    await page.getByPlaceholder(/Invite code/i).fill(inviteCode);
    await page.getByRole('button', { name: /^Join$/i }).click();

    await expect(page).toHaveURL(/\/group\/\d+/);
    await expect(page.getByRole('heading', { name: groupName })).toBeVisible();
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
  });
});
