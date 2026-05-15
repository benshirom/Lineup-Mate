import { expect, type Page } from '@playwright/test';

export function localPart(email: string) {
  return email.split('@')[0];
}

export async function expectAuthenticated(page: Page) {
  const desktopProfileLink = page.getByTestId('user-profile-link');
  if (await desktopProfileLink.isVisible().catch(() => false)) return;

  const openMenuButton = page.getByLabel(/Open menu/i);
  if (await openMenuButton.isVisible().catch(() => false)) {
    await expect(openMenuButton, 'Authenticated mobile users should see the hamburger menu').toBeVisible({ timeout: 15_000 });
    return;
  }

  await expect(
    page.getByRole('link', { name: /Profile|Schedule|Groups/i }).first(),
    'Expected an authenticated navigation element after login, but none was visible.'
  ).toBeVisible({ timeout: 15_000 });
}

export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /^Sign in$/i }).click();
  await expect(page, `Login failed for ${email}. Check GitHub Secrets and Supabase email confirmation.`).toHaveURL('/', { timeout: 20_000 });
  await expectAuthenticated(page);
}

export async function openMobileMenu(page: Page) {
  const openMenuButton = page.getByLabel(/Open menu/i);
  if (await openMenuButton.isVisible().catch(() => false)) {
    await openMenuButton.click();
    await expect(page.getByLabel(/Close menu/i), 'Mobile menu should open after tapping hamburger').toBeVisible({ timeout: 10_000 });
  }
}

export async function clickNav(page: Page, name: RegExp) {
  const directLink = page.getByRole('link', { name }).first();
  if (await directLink.isVisible().catch(() => false)) {
    await directLink.click();
    return;
  }

  await openMobileMenu(page);
  const drawerLink = page.getByRole('link', { name }).first();
  await expect(drawerLink, `Could not find navigation link matching ${name} in desktop nav or mobile drawer.`).toBeVisible({ timeout: 10_000 });
  await drawerLink.click();
}

export async function signOut(page: Page) {
  const signOutButton = page.getByRole('button', { name: /Sign out/i }).first();
  if (!(await signOutButton.isVisible().catch(() => false))) await openMobileMenu(page);

  await page.getByRole('button', { name: /Sign out/i }).first().click();
  await page.waitForURL('/', { timeout: 20_000 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(
    page.getByRole('link', { name: /^Login$/i }).or(page.getByRole('button', { name: /^Login$/i })).first(),
    'After sign out and reload, the public Login action should be visible.'
  ).toBeVisible({ timeout: 20_000 });
}

export async function openProfile(page: Page) {
  const profileBadge = page.getByTestId('user-profile-link');
  if (await profileBadge.isVisible().catch(() => false)) {
    await profileBadge.click();
    return;
  }

  const bottomProfileLink = page.getByRole('link', { name: /Profile/i }).first();
  if (await bottomProfileLink.isVisible().catch(() => false)) {
    await bottomProfileLink.click();
    return;
  }

  await clickNav(page, /Profile|פרופיל/i);
}

export async function openFirstFestival(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /View Lineup|צפה בליינאפ/i }).first(), 'Home page should expose at least one festival card with View Lineup').toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /View Lineup|צפה בליינאפ/i }).first().click();
  await expect(page.getByRole('button', { name: /timeline/i }), 'Festival page should render schedule tabs after opening first festival').toBeVisible({ timeout: 20_000 });
  return page.url();
}

export async function ensureFirstActIsStarred(page: Page) {
  const starButton = page.getByRole('button', { name: /Add to my schedule|Remove from my schedule/i }).first();
  await expect(starButton, 'Festival timeline should contain a star action for at least one act').toBeVisible({ timeout: 20_000 });

  const label = await starButton.getAttribute('aria-label');
  if (label?.toLowerCase().includes('add')) {
    await starButton.click();
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await expect(page.getByRole('button', { name: /Remove from my schedule/i }).first(), 'Starred act should change to Remove from my schedule after saving').toBeVisible({ timeout: 15_000 });
  }
}

export async function ensureFirstFestivalIsSaved(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /View Lineup|צפה בליינאפ/i }).first(), 'Home page should expose at least one festival before saving').toBeVisible({ timeout: 20_000 });

  const firstSaveOrSavedButton = page.getByRole('button', { name: /\+ Save|✓ Saved|Save Festival|Saved!|Saved|נשמר/i }).first();
  await expect(firstSaveOrSavedButton, 'Home page should expose a save/saved festival button').toBeVisible({ timeout: 20_000 });

  const label = (await firstSaveOrSavedButton.innerText()).trim();
  if (/\+ Save|Save Festival|שמור פסטיבל/i.test(label)) {
    await firstSaveOrSavedButton.click();
    await page.waitForLoadState('networkidle').catch(() => undefined);
  }

  await expect(
    page.getByRole('button', { name: /✓ Saved|Saved!|Saved|נשמר/i }).first(),
    'Festival save should persist in UI as Saved after clicking save.'
  ).toBeVisible({ timeout: 20_000 });
}

export async function selectFirstFestivalInForm(page: Page) {
  const select = page.getByTestId('group-festival-select');
  await expect(select, 'Create group form should include a festival dropdown').toBeVisible({ timeout: 15_000 });

  await expect
    .poll(
      async () => {
        return select.evaluate((el) => {
          const selectEl = el as HTMLSelectElement;
          return Array.from(selectEl.options)
            .map((option) => ({ value: option.value, label: option.textContent?.trim() || '' }))
            .filter((option) => option.value !== '');
        });
      },
      {
        timeout: 20_000,
        message: 'Expected group-festival-select to contain at least one real festival option. If empty, check /groups festival loading and Supabase RLS for public.festivals.'
      }
    )
    .not.toHaveLength(0);

  const options = await select.evaluate((el) => {
    const selectEl = el as HTMLSelectElement;
    return Array.from(selectEl.options)
      .map((option) => ({ value: option.value, label: option.textContent?.trim() || '' }))
      .filter((option) => option.value !== '');
  });

  const firstValue = options[0]?.value;
  if (!firstValue) throw new Error(`No festival options found in group form. Current options: ${JSON.stringify(options)}`);
  await select.selectOption(firstValue);
}
