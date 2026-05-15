import { expect, type Page } from '@playwright/test';

export function localPart(email: string) {
  return email.split('@')[0];
}

export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /^Sign in$/i }).click();
  await expect(page).toHaveURL('/', { timeout: 20_000 });
  await expect(page.getByTestId('user-profile-link').or(page.getByRole('button', { name: /Sign out/i })).or(page.getByLabel(/Open menu/i))).toBeVisible({ timeout: 15_000 });
}

export async function openMobileMenu(page: Page) {
  const openMenuButton = page.getByLabel(/Open menu/i);
  if (await openMenuButton.isVisible().catch(() => false)) {
    await openMenuButton.click();
    await expect(page.getByLabel(/Close menu/i)).toBeVisible({ timeout: 10_000 });
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
  await expect(drawerLink).toBeVisible({ timeout: 10_000 });
  await drawerLink.click();
}

export async function signOut(page: Page) {
  const signOutButton = page.getByRole('button', { name: /Sign out/i }).first();
  if (!(await signOutButton.isVisible().catch(() => false))) {
    await openMobileMenu(page);
  }

  await page.getByRole('button', { name: /Sign out/i }).first().click();
  await expect(page.getByRole('link', { name: /^Login$/i }).or(page.getByRole('button', { name: /^Login$/i }))).toBeVisible({ timeout: 20_000 });
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
  await expect(page.getByRole('button', { name: /View Lineup|צפה בליינאפ/i }).first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /View Lineup|צפה בליינאפ/i }).first().click();
  await expect(page.getByRole('button', { name: /timeline/i })).toBeVisible({ timeout: 20_000 });
  return page.url();
}

export async function ensureFirstActIsStarred(page: Page) {
  const starButton = page.getByRole('button', { name: /Add to my schedule|Remove from my schedule/i }).first();
  await expect(starButton).toBeVisible({ timeout: 20_000 });

  const label = await starButton.getAttribute('aria-label');
  if (label?.toLowerCase().includes('add')) {
    await starButton.click();
    await expect(page.getByRole('button', { name: /Remove from my schedule/i }).first()).toBeVisible({ timeout: 15_000 });
  }
}

export async function ensureFirstFestivalIsSaved(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /View Lineup|צפה בליינאפ/i }).first()).toBeVisible({ timeout: 20_000 });

  const firstSaveOrSavedButton = page.getByRole('button', { name: /Save Festival|Saved!|שמור פסטיבל|נשמר/i }).first();
  await expect(firstSaveOrSavedButton).toBeVisible({ timeout: 20_000 });

  const label = (await firstSaveOrSavedButton.innerText()).trim();
  if (/Save Festival|שמור פסטיבל/i.test(label)) {
    await firstSaveOrSavedButton.click();
  }

  await expect(page.getByRole('button', { name: /Saved!|נשמר/i }).first()).toBeVisible({ timeout: 20_000 });
}
