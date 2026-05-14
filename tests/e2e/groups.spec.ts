import { expect, test } from '@playwright/test';
import { ensureFirstActIsStarred, login, localPart, openFirstFestival, signOut } from './helpers';

const ownerEmail = process.env.E2E_ADMIN_EMAIL;
const ownerPassword = process.env.E2E_ADMIN_PASSWORD;
const memberEmail = process.env.E2E_USER_EMAIL;
const memberPassword = process.env.E2E_USER_PASSWORD;

const hasBothUsers = !!(ownerEmail && ownerPassword && memberEmail && memberPassword);
const hasOwner = !!(ownerEmail && ownerPassword);

// ─── Full collaboration flow (requires two accounts) ─────────────────────────

test.describe.serial('group collaboration flows', () => {
  test.skip(!hasBothUsers, 'Set E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_USER_EMAIL and E2E_USER_PASSWORD to run group tests.');

  test('owner creates a group, second user joins with invite code, and group schedule shows both members picks', async ({ page }) => {
    const groupName = `E2E Group ${Date.now()}`;

    await login(page, ownerEmail!, ownerPassword!);
    const festivalUrl = await openFirstFestival(page);
    await ensureFirstActIsStarred(page);

    await page.getByRole('button', { name: /^Create Group$/i }).click();
    await page.getByPlaceholder(/e\.g\. Ozora Squad/i).fill(groupName);
    await page.getByRole('button', { name: /^Create$/i }).click();

    await expect(page).toHaveURL(/\/group\/\d+/);
    await expect(page.getByRole('heading', { name: groupName })).toBeVisible();

    const inviteCode = (await page.locator('[data-testid="invite-code"]').innerText()).trim();
    expect(inviteCode.length).toBeGreaterThan(4);
    await expect(page.getByRole('listitem').filter({ hasText: localPart(ownerEmail!) }).first()).toBeVisible();

    await signOut(page);
    await login(page, memberEmail!, memberPassword!);
    await page.goto(festivalUrl);
    await ensureFirstActIsStarred(page);

    await page.getByPlaceholder(/Invite code/i).fill(inviteCode);
    await page.getByRole('button', { name: /^Join$/i }).click();

    await expect(page).toHaveURL(/\/group\/\d+/);
    await expect(page.getByRole('heading', { name: groupName })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: localPart(ownerEmail!) }).first()).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: localPart(memberEmail!) }).first()).toBeVisible();

    await expect(page.getByRole('columnheader', { name: /Going/i })).toBeVisible();
    await expect(page.getByRole('cell', { name: new RegExp(localPart(ownerEmail!), 'i') }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: new RegExp(localPart(memberEmail!), 'i') }).first()).toBeVisible();
  });
});

// ─── Group page UI (owner-only; one account is enough) ───────────────────────

test.describe.serial('group page UI', () => {
  test.skip(!hasOwner, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run group page UI tests.');

  let groupPageUrl: string;
  let inviteCode: string;
  let groupName: string;

  test.beforeAll(async ({ browser }) => {
    // Create a fresh group so every UI test has a clean subject
    const page = await browser.newPage();
    groupName = `UI Test Group ${Date.now()}`;

    await login(page, ownerEmail!, ownerPassword!);
    const festivalUrl = await openFirstFestival(page);
    await ensureFirstActIsStarred(page);

    await page.getByRole('button', { name: /^Create Group$/i }).click();
    await page.getByPlaceholder(/e\.g\. Ozora Squad/i).fill(groupName);
    await page.getByRole('button', { name: /^Create$/i }).click();

    await expect(page).toHaveURL(/\/group\/\d+/);
    groupPageUrl = page.url();
    inviteCode = (await page.locator('[data-testid="invite-code"]').innerText()).trim();

    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await login(page, ownerEmail!, ownerPassword!);
    await page.goto(groupPageUrl);
    await expect(page.getByRole('heading', { name: groupName })).toBeVisible();
  });

  // Group page structure

  test('group page shows the festival badge', async ({ page }) => {
    await expect(page.locator('[data-testid="group-festival-link"]')).toBeVisible();
  });

  test('festival badge links back to the festival page', async ({ page }) => {
    await page.locator('[data-testid="group-festival-link"]').click();
    await expect(page).toHaveURL(/\/festival\//);
  });

  test('group page shows invite code', async ({ page }) => {
    const codeEl = page.locator('[data-testid="invite-code"]');
    await expect(codeEl).toBeVisible();
    const text = (await codeEl.innerText()).trim();
    expect(text.length).toBeGreaterThan(4);
    expect(text).toBe(inviteCode);
  });

  test('copy invite code button changes label to Copied!', async ({ page }) => {
    await page.locator('[data-testid="copy-invite-code"]').click();
    await expect(page.locator('[data-testid="copy-invite-code"]')).toHaveText('Copied!');
  });

  test('WhatsApp share button is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="share-whatsapp"]')).toBeVisible();
  });

  test('members list shows the owner', async ({ page }) => {
    const membersList = page.locator('[data-testid="members-list"]');
    await expect(membersList).toBeVisible();
    await expect(membersList.getByRole('listitem').first()).toBeVisible();
  });

  test('"← My Groups" button navigates to /groups', async ({ page }) => {
    await page.locator('[data-testid="back-to-groups"]').click();
    await expect(page).toHaveURL('/groups');
  });

  // My Groups list

  test('My Groups page lists the created group', async ({ page }) => {
    await page.goto('/groups');
    await expect(page.getByText(groupName)).toBeVisible();
  });

  test('My Groups page has an "Open" link that navigates to the group page', async ({ page }) => {
    await page.goto('/groups');
    // Find the row containing our group name, then click its "Open" button
    const groupRow = page.locator('li, article, tr, div').filter({ hasText: groupName }).first();
    await groupRow.getByRole('link', { name: /Open|View|Manage/i }).first().click();
    await expect(page).toHaveURL(/\/group\/\d+/);
  });

  // Inline confirm: owner deletes group

  test('owner sees "Delete Group" button and can cancel without deleting', async ({ page }) => {
    await expect(page.locator('[data-testid="leave-group-btn"]')).toHaveText('Delete Group');
    await page.locator('[data-testid="leave-group-btn"]').click();
    await expect(page.locator('[data-testid="confirm-leave-btn"]')).toBeVisible();
    await page.getByRole('button', { name: /^Cancel$/i }).click();
    // After cancel the confirm button should disappear and the Delete Group button should reappear
    await expect(page.locator('[data-testid="leave-group-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="confirm-leave-btn"]')).not.toBeVisible();
  });

  test('shared schedule table has correct column headers', async ({ page }) => {
    const table = page.locator('[data-testid="shared-schedule-table"]');
    // Table is only rendered when there are preferences; check if visible first
    const isVisible = await table.isVisible();
    if (isVisible) {
      await expect(table.getByRole('columnheader', { name: /Going/i })).toBeVisible();
      await expect(table.getByRole('columnheader', { name: /Maybe/i })).toBeVisible();
      await expect(table.getByRole('columnheader', { name: /Artist/i })).toBeVisible();
      await expect(table.getByRole('columnheader', { name: /Stage/i })).toBeVisible();
    } else {
      // No preferences yet — the empty state message should appear
      await expect(page.getByText(/No preferences yet/i)).toBeVisible();
    }
  });
});

// ─── Member leave flow (requires two accounts) ───────────────────────────────

test.describe.serial('member leave flow', () => {
  test.skip(!hasBothUsers, 'Set E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_USER_EMAIL and E2E_USER_PASSWORD to run member leave tests.');

  test('member can leave a group using inline confirm', async ({ page }) => {
    const groupName = `Leave Test ${Date.now()}`;

    // Owner creates group
    await login(page, ownerEmail!, ownerPassword!);
    const festivalUrl = await openFirstFestival(page);

    await page.getByRole('button', { name: /^Create Group$/i }).click();
    await page.getByPlaceholder(/e\.g\. Ozora Squad/i).fill(groupName);
    await page.getByRole('button', { name: /^Create$/i }).click();

    await expect(page).toHaveURL(/\/group\/\d+/);
    const inviteCode = (await page.locator('[data-testid="invite-code"]').innerText()).trim();

    // Member joins
    await signOut(page);
    await login(page, memberEmail!, memberPassword!);
    await page.goto(festivalUrl);
    await page.getByPlaceholder(/Invite code/i).fill(inviteCode);
    await page.getByRole('button', { name: /^Join$/i }).click();

    await expect(page).toHaveURL(/\/group\/\d+/);
    await expect(page.getByRole('heading', { name: groupName })).toBeVisible();

    // Member sees "Leave Group" button
    await expect(page.locator('[data-testid="leave-group-btn"]')).toHaveText('Leave Group');

    // Member clicks leave and then cancels
    await page.locator('[data-testid="leave-group-btn"]').click();
    await expect(page.locator('[data-testid="confirm-leave-btn"]')).toBeVisible();
    await page.getByRole('button', { name: /^Cancel$/i }).click();
    await expect(page.locator('[data-testid="leave-group-btn"]')).toBeVisible();

    // Member confirms leave
    await page.locator('[data-testid="leave-group-btn"]').click();
    await page.locator('[data-testid="confirm-leave-btn"]').click();
    await expect(page).toHaveURL('/groups');
  });
});
