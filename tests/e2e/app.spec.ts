import { test, expect } from '@playwright/test';

const docUrl = '/#/doc/e2e-app-test';

test('page loads with AltDocs title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('AltDocs');
});

test('document list page shows header and new document button', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.doc-list-header');
  await expect(page.locator('.doc-list-header h1')).toHaveText('AltDocs');
  await expect(page.locator('.new-doc-btn')).toBeVisible();
});

test('editor container is visible and contenteditable', async ({ page }) => {
  await page.goto(docUrl);
  const editor = page.locator('.altdocs-editor');
  await expect(editor).toBeVisible();
  await expect(editor).toHaveAttribute('contenteditable', 'true');
});

test('typing inserts text into the editor', async ({ page }) => {
  await page.goto(docUrl);
  await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

  const firstP = page.locator('.altdocs-editor p').first();
  await firstP.click();
  await page.waitForTimeout(50);

  await page.keyboard.type('Hello from Playwright');

  await expect(firstP).toContainText('Hello from Playwright');
});

test('Enter key creates a new block', async ({ page }) => {
  await page.goto(docUrl);
  await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

  const initialCount = await page.locator('.altdocs-editor p').count();

  const firstP = page.locator('.altdocs-editor p').first();
  await firstP.click();
  await page.waitForTimeout(50);

  await page.keyboard.type('First line');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Second line');

  const finalCount = await page.locator('.altdocs-editor p').count();
  expect(finalCount).toBe(initialCount + 1);
});

test('Backspace deletes a character', async ({ page }) => {
  await page.goto(docUrl);
  await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

  const firstP = page.locator('.altdocs-editor p').first();
  await firstP.click();
  await page.waitForTimeout(50);

  await page.keyboard.type('abc');
  await page.keyboard.press('Backspace');

  await expect(page.locator('.altdocs-editor p').first()).toContainText('ab');
});
