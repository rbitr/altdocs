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

test('editor container is visible and contenteditable', async ({ page }) => {
  await page.goto('/');
  const editor = page.locator('.altdocs-editor');
  await expect(editor).toBeVisible();
  await expect(editor).toHaveAttribute('contenteditable', 'true');
});

test('renders formatted text with bold', async ({ page }) => {
  await page.goto('/');
  const boldSpan = page.locator('.altdocs-editor p span').nth(1);
  await expect(boldSpan).toHaveText('from-scratch');
  await expect(boldSpan).toHaveCSS('font-weight', '700');
});

test('typing inserts text into the editor', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

  // Click on the empty third paragraph to position cursor there
  const lastP = page.locator('.altdocs-editor p').last();
  await lastP.click();
  await page.waitForTimeout(50);

  // Type some text
  await page.keyboard.type('Hello from Playwright');

  // Verify the text appears in the last paragraph
  await expect(lastP).toContainText('Hello from Playwright');
});

test('Enter key creates a new block', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

  const initialCount = await page.locator('.altdocs-editor p').count();

  const lastP = page.locator('.altdocs-editor p').last();
  await lastP.click();
  await page.waitForTimeout(50);

  await page.keyboard.type('First line');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Second line');

  const finalCount = await page.locator('.altdocs-editor p').count();
  expect(finalCount).toBe(initialCount + 1);
});

test('Backspace deletes a character', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

  const lastP = page.locator('.altdocs-editor p').last();
  await lastP.click();
  await page.waitForTimeout(50);

  await page.keyboard.type('abc');
  await page.keyboard.press('Backspace');

  await expect(page.locator('.altdocs-editor p').last()).toContainText('ab');
});
