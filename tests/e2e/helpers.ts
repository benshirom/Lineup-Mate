import { expect, type Locator, type Page } from '@playwright/test';

export function localPart(email: string) {
  return email.split('@')[0];
}

export function festivalIdFromUrl(url: string) {
  return new URL(url).pathname.match(/\/festival\/(\d+)/)?.[1] || null;
}

export async function dismissPreviewOverlays(page: Page) {
  await page.addStyleTag({
    content: `
      div[data-netlify-deploy-id][data-netlify-site-id],
      iframe[title="Netlify Drawer"] {
        display: none !important;
        pointer-events: none !important;
        visibility: hidden !important;
      }
    `
  }).catch(() => undefined);
}

export async function expectAuthenticated(page: Page) {
  await dismissPreviewOverlays(page);

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
  await dismissPreviewOverlays(page);
  await page.getByLabel('Email').fill(email);
  await page.getByRole('textbox', { name: /password/i }).fill(password);
  await page.getByRole('button', { name: /^Sign in$/i }).click();
  await expect(page, `Login failed for ${email}. Check GitHub Secrets and Supabase email confirmation.`).toHaveURL('/', { timeout: 20_000 });
  await dismissPreviewOverlays(page);
  await expectAuthenticated(page);
}

export async function openMobileMenu(page: Page) {
  await dismissPreviewOverlays(page);
  const openMenuButton = page.getByLabel(/Open menu/i);
  if (await openMenuButton.isVisible().catch(() => false)) {
    await openMenuButton.click();
    await expect(page.getByLabel(/Close menu/i), 'Mobile menu should open after tapping hamburger').toBeVisible({ timeout: 10_000 });
  }
}

export async function clickNav(page: Page, name: RegExp) {
  await dismissPreviewOverlays(page);
  const directLink = page.getByRole('link', { name }).first();
  if (await directLink.isVisible().catch(() => false)) {
    await directLink.click();
    await dismissPreviewOverlays(page);
    return;
  }

  await openMobileMenu(page);
  const drawerLink = page.getByRole('link', { name }).first();
  await expect(drawerLink, `Could not find navigation link matching ${name} in desktop nav or mobile drawer.`).toBeVisible({ timeout: 10_000 });
  await drawerLink.click();
  await dismissPreviewOverlays(page);
}

export async function signOut(page: Page) {
  await dismissPreviewOverlays(page);
  const signOutButton = page.getByRole('button', { name: /Sign out/i }).first();
  if (!(await signOutButton.isVisible().catch(() => false))) await openMobileMenu(page);

  await page.getByRole('button', { name: /Sign out/i }).first().click();
  await page.waitForURL(/\/(login)?$/, { timeout: 20_000 }).catch(() => undefined);

  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await dismissPreviewOverlays(page);
  await expect(
    page.getByLabel('Email').or(page.getByRole('button', { name: /^Sign in$/i })).first(),
    'After sign out, the login form should be reachable.'
  ).toBeVisible({ timeout: 20_000 });
}

export async function openProfile(page: Page) {
  await dismissPreviewOverlays(page);
  const profileBadge = page.getByTestId('user-profile-link');
  if (await profileBadge.isVisible().catch(() => false)) {
    await profileBadge.click();
    await dismissPreviewOverlays(page);
    return;
  }

  const bottomProfileLink = page.getByRole('link', { name: /Profile/i }).first();
  if (await bottomProfileLink.isVisible().catch(() => false)) {
    await bottomProfileLink.click({ force: true });
    await dismissPreviewOverlays(page);
    return;
  }

  await clickNav(page, /Profile|פרופיל/i);
}

export async function openFirstFestival(page: Page) {
  await page.goto('/');
  await dismissPreviewOverlays(page);
  await expect(page.getByRole('button', { name: /Open Schedule|View Lineup|צפה בליינאפ/i }).first(), 'Home page should expose at least one festival card with Open Schedule').toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /Open Schedule|View Lineup|צפה בליינאפ/i }).first().click();
  await dismissPreviewOverlays(page);
  await expect(page.getByRole('button', { name: /timeline/i }), 'Festival page should render schedule tabs after opening first festival').toBeVisible({ timeout: 20_000 });
  return page.url();
}

export async function ensureFirstActIsStarred(page: Page) {
  await dismissPreviewOverlays(page);
  const starButton = page.getByRole('button', { name: /Add to my schedule|Remove from my schedule/i }).first();
  await expect(starButton, 'Festival timeline should contain a star action for at least one act').toBeVisible({ timeout: 20_000 });

  const label = await starButton.getAttribute('aria-label');
  if (label?.toLowerCase().includes('add')) {
    await starButton.click({ force: true });
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.waitForTimeout(750);
    await page.getByRole('button', { name: /Remove from my schedule/i }).first().waitFor({ state: 'visible', timeout: 5_000 }).catch(() => undefined);
  }
}

export async function ensureFirstFestivalIsSaved(page: Page) {
  await page.goto('/');
  await dismissPreviewOverlays(page);
  await expect(page.getByRole('button', { name: /Open Schedule|View Lineup|צפה בליינאפ/i }).first(), 'Home page should expose at least one festival before saving').toBeVisible({ timeout: 20_000 });

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

async function getGroupFormDiagnostics(page: Page) {
  return page.evaluate(() => {
    const panels = Array.from(document.querySelectorAll('[data-testid="create-group-panel"]'));
    const selects = Array.from(document.querySelectorAll('[data-testid="group-festival-select"]'));
    const error = document.querySelector('[data-testid="groups-error"]')?.textContent?.trim() || null;

    return {
      groupsError: error,
      panelCount: panels.length,
      visiblePanels: panels.map((panel, index) => {
        const rect = panel.getBoundingClientRect();
        const style = window.getComputedStyle(panel);
        return {
          index,
          visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
          text: panel.textContent?.replace(/\s+/g, ' ').trim().slice(0, 240) || ''
        };
      }),
      selects: selects.map((select, index) => {
        const selectEl = select as HTMLSelectElement;
        const rect = selectEl.getBoundingClientRect();
        const style = window.getComputedStyle(selectEl);
        return {
          index,
          visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
          value: selectEl.value,
          options: Array.from(selectEl.options).map((option) => ({ value: option.value, label: option.textContent?.trim() || '' }))
        };
      })
    };
  });
}

export async function selectFirstFestivalInForm(page: Page, form?: Locator, preferredFestivalId?: string | null) {
  const visibleForm = form ?? page.locator('[data-testid="create-group-panel"]:visible').last();
  await expect(visibleForm, 'Create group form should be visible before selecting a festival.').toBeVisible({ timeout: 15_000 });

  const select = visibleForm.getByTestId('group-festival-select');
  await expect(select, 'The visible create group form should include a festival dropdown.').toBeVisible({ timeout: 15_000 });

  try {
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
          timeout: 30_000,
          message: 'Expected the visible group-festival-select to contain at least one real festival option.'
        }
      )
      .not.toHaveLength(0);
  } catch (error) {
    const diagnostics = await getGroupFormDiagnostics(page).catch((diagError) => ({ diagnosticsError: String(diagError) }));
    throw new Error(
      `No festival options found in the visible create group form. This usually means the test selected a hidden/stale form or /groups did not load festivals. Diagnostics: ${JSON.stringify(diagnostics, null, 2)}`
    );
  }

  const options = await select.evaluate((el) => {
    const selectEl = el as HTMLSelectElement;
    return Array.from(selectEl.options)
      .map((option) => ({ value: option.value, label: option.textContent?.trim() || '' }))
      .filter((option) => option.value !== '');
  });

  const firstValue = preferredFestivalId && options.some((option) => option.value === preferredFestivalId)
    ? preferredFestivalId
    : options[0]?.value;

  if (!firstValue) throw new Error(`No festival options found in group form after polling. Current options: ${JSON.stringify(options)}`);
  await select.selectOption(firstValue);
}
