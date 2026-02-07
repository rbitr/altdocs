import { test, expect } from '@playwright/test';

test('page loads with AltDocs title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('AltDocs');
});

test('page displays AltDocs heading', async ({ page }) => {
  await page.goto('/');
  const heading = page.locator('h1');
  await expect(heading).toHaveText('AltDocs');
});
