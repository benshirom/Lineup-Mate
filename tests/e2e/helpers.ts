import { expect, type Page } from '@playwright/test';

export function localPart(email: string) {
  return email.split('@')[0];
}

export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /^Sign in$/i }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('button', { name: /Sign out/i })).toBeVisible();
}

export async function signOut(page: Page) {
  await page.getByRole('button', { name: /Sign out/i }).click();
  await expect(page.getByRole('link', { name: /^Login$/i })).toBeVisible();
}

export async function openFirstFestival(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /View Lineup/i }).first().click();
  await expect(page.getByRole('button', { name: /timeline/i })).toBeVisible();
  return page.url();
}

export async function ensureFirstActIsStarred(page: Page) {
  const starButton = page.getByRole('button', { name: /Add to my schedule|Remove from my schedule/i }).first();
  await expect(starButton).toBeVisible();

  const label = await starButton.getAttribute('aria-label');
  if (label?.toLowerCase().includes('add')) {
    await starButton.click();
    await expect(page.getByRole('button', { name: /Remove from my schedule/i }).first()).toBeVisible();
  }
}

export async function ensureFirstFestivalIsSaved(page: Page) {
  await page.goto('/');
  const saveButton = page.getByRole('button', { name: /Save Festival/i }).first();

  if (await saveButton.isVisible()) {
    await saveButton.click();
  }

  await expect(page.getByText(/Saved!/i).first()).toBeVisible();
}
