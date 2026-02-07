import { test, expect } from '@playwright/test';

test('page loads with AltDocs title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('AltDocs');
});

test('page displays AltDocs heading in editor', async ({ page }) => {
  await page.goto('/');
  const heading = page.locator('.altdocs-editor h1');
  await expect(heading).toHaveText('AltDocs');
});

test('editor container is visible', async ({ page }) => {
  await page.goto('/');
  const editor = page.locator('.altdocs-editor');
  await expect(editor).toBeVisible();
});

test('renders formatted text with bold', async ({ page }) => {
  await page.goto('/');
  const boldSpan = page.locator('.altdocs-editor p span').nth(1);
  await expect(boldSpan).toHaveText('from-scratch');
  await expect(boldSpan).toHaveCSS('font-weight', '700');
});
