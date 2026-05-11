import { expect, test } from '@playwright/test';
import { ensureFirstActIsStarred, login, localPart, openFirstFestival, signOut } from './helpers';

const ownerEmail = process.env.E2E_ADMIN_EMAIL;
const ownerPassword = process.env.E2E_ADMIN_PASSWORD;
const memberEmail = process.env.E2E_USER_EMAIL;
const memberPassword = process.env.E2E_USER_PASSWORD;

test.describe.serial('group collaboration flows', () => {
  test.skip(
    !ownerEmail || !ownerPassword || !memberEmail || !memberPassword,
    'Set E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_USER_EMAIL and E2E_USER_PASSWORD to run group tests.'
  );

  test('owner creates a group, second user joins with invite code, and group schedule shows both members picks', async ({ page }) => {
    const groupName = `E2E Group ${Date.now()}`;

    await login(page, ownerEmail!, ownerPassword!);
    const festivalUrl = await openFirstFestival(page);
    await ensureFirstActIsStarred(page);

    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('prompt');
      await dialog.accept(groupName);
    });
    await page.getByRole('button', { name: /^Create Group$/i }).click();

    await expect(page).toHaveURL(/\/group\/\d+/);
    await expect(page.getByRole('heading', { name: groupName })).toBeVisible();

    const inviteCode = (await page.locator('code').first().innerText()).trim();
    expect(inviteCode.length).toBeGreaterThan(4);
    await expect(page.getByText(localPart(ownerEmail!)).first()).toBeVisible();

    await signOut(page);
    await login(page, memberEmail!, memberPassword!);
    await page.goto(festivalUrl);
    await ensureFirstActIsStarred(page);

    await page.getByPlaceholder(/Invite code/i).fill(inviteCode);
    await page.getByRole('button', { name: /^Join$/i }).click();

    await expect(page).toHaveURL(/\/group\/\d+/);
    await expect(page.getByRole('heading', { name: groupName })).toBeVisible();
    await expect(page.getByText(localPart(ownerEmail!)).first()).toBeVisible();
    await expect(page.getByText(localPart(memberEmail!)).first()).toBeVisible();

    await expect(page.getByRole('columnheader', { name: /Going/i })).toBeVisible();
    await expect(page.getByRole('cell', { name: new RegExp(localPart(ownerEmail!), 'i') }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: new RegExp(localPart(memberEmail!), 'i') }).first()).toBeVisible();
  });
});
