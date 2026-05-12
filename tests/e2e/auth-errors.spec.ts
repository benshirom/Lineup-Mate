import { expect, test } from '@playwright/test';

const unconfirmedEmail = process.env.E2E_UNCONFIRMED_EMAIL;
const unconfirmedPassword = process.env.E2E_UNCONFIRMED_PASSWORD;

test.describe('auth errors and email confirmation', () => {
  test('signup form validates obviously invalid email before sending to Supabase', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /No account yet/i }).click();

    await page.getByLabel('Email').fill('not-an-email');
    await page.getByLabel('Password').fill('bs12345');
    await page.getByRole('button', { name: /^Create account$/i }).click();

    await expect(page.getByText(/Enter a valid email address/i)).toBeVisible();
  });

  test('signup form validates short password before sending to Supabase', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /No account yet/i }).click();

    await page.getByLabel('Email').fill('playwright.invalid@example.com');
    await page.getByLabel('Password').fill('123');
    await page.getByRole('button', { name: /^Create account$/i }).click();

    await expect(page.getByText(/Password must be at least 6 characters/i)).toBeVisible();
  });

  test('unconfirmed email login shows confirmation guidance', async ({ page }) => {
    test.skip(!unconfirmedEmail || !unconfirmedPassword, 'Set E2E_UNCONFIRMED_EMAIL and E2E_UNCONFIRMED_PASSWORD to run this test.');

    await page.goto('/login');
    await page.getByLabel('Email').fill(unconfirmedEmail!);
    await page.getByLabel('Password').fill(unconfirmedPassword!);
    await page.getByRole('button', { name: /^Sign in$/i }).click();

    await expect(page.getByText(/email is not confirmed|confirm/i)).toBeVisible();
  });
});
