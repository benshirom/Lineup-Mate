import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pages = [
  { name: 'home', path: '/' },
  { name: 'login', path: '/login' },
  { name: 'privacy', path: '/privacy' },
  { name: 'terms', path: '/terms' },
  { name: 'accessibility', path: '/accessibility' },
  { name: 'delete-account', path: '/delete-account' },
];

for (const { name, path } of pages) {
  test(`a11y: ${name} page has no WCAG 2.1 AA violations`, async ({ page }) => {
    await page.goto(path);
    // Wait for the page to settle
    await page.waitForLoadState('networkidle').catch(() => {});

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    if (results.violations.length > 0) {
      const summary = results.violations.map((v) =>
        `[${v.id}] ${v.description} (${v.nodes.length} node${v.nodes.length > 1 ? 's' : ''})`
      ).join('\n');
      expect(results.violations, `Accessibility violations on /${name}:\n${summary}`).toEqual([]);
    }
  });
}
