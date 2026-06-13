import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../.auth/user.json');

setup('authenticate as user', async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;
  if (!email || !password) {
    console.warn('E2E_USER_EMAIL / E2E_USER_PASSWORD not set — skipping user auth setup');
    return;
  }

  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email').fill(email);
  await page.getByRole('textbox', { name: /password/i }).fill(password);
  await page.getByRole('button', { name: /^Sign in$/i }).click();
  await expect(page).toHaveURL('/', { timeout: 20_000 });

  await page.context().storageState({ path: authFile });
});
