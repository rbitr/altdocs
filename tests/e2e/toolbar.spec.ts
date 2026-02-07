import { test, expect } from '@playwright/test';

const docUrl = '/#/doc/e2e-toolbar-test';

test('toolbar is visible on page load', async ({ page }) => {
  await page.goto(docUrl);
  const toolbar = page.locator('.altdocs-toolbar');
  await expect(toolbar).toBeVisible();
});

test('toolbar has bold, italic, underline, strikethrough buttons', async ({ page }) => {
  await page.goto(docUrl);
  await expect(page.locator('[data-toolbar-action="bold"]')).toBeVisible();
  await expect(page.locator('[data-toolbar-action="italic"]')).toBeVisible();
  await expect(page.locator('[data-toolbar-action="underline"]')).toBeVisible();
  await expect(page.locator('[data-toolbar-action="strikethrough"]')).toBeVisible();
});

test('toolbar has alignment buttons', async ({ page }) => {
  await page.goto(docUrl);
  await expect(page.locator('[data-toolbar-action="align-left"]')).toBeVisible();
  await expect(page.locator('[data-toolbar-action="align-center"]')).toBeVisible();
  await expect(page.locator('[data-toolbar-action="align-right"]')).toBeVisible();
});

test('toolbar has block type select', async ({ page }) => {
  await page.goto(docUrl);
  const select = page.locator('[data-toolbar-action="block-type"]');
  await expect(select).toBeVisible();
});

test('bold button applies bold to selected text', async ({ page }) => {
  await page.goto(docUrl);
  await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

  const firstP = page.locator('.altdocs-editor p').first();
  await firstP.click();
  await page.waitForTimeout(50);
  await page.keyboard.type('bold test');

  // Select the text "bold" (first 4 chars)
  for (let i = 0; i < 9; i++) await page.keyboard.press('ArrowLeft');
  for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+ArrowRight');

  // Click bold button
  await page.locator('[data-toolbar-action="bold"]').click();
  await page.waitForTimeout(50);

  // Verify bold button is active
  await expect(page.locator('[data-toolbar-action="bold"]')).toHaveClass(/active/);
});

test('block type select changes block type', async ({ page }) => {
  await page.goto(docUrl);
  await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

  const firstP = page.locator('.altdocs-editor p').first();
  await firstP.click();
  await page.waitForTimeout(50);
  await page.keyboard.type('heading text');

  // Change block type to heading1
  const select = page.locator('[data-toolbar-action="block-type"]');
  await select.selectOption('heading1');
  await page.waitForTimeout(50);

  // The text should now be in an h1
  const h1 = page.locator('.altdocs-editor h1').last();
  await expect(h1).toContainText('heading text');
});

test('alignment button changes text alignment', async ({ page }) => {
  await page.goto(docUrl);
  await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

  const firstP = page.locator('.altdocs-editor p').first();
  await firstP.click();
  await page.waitForTimeout(50);
  await page.keyboard.type('centered text');

  // Click center alignment
  await page.locator('[data-toolbar-action="align-center"]').click();
  await page.waitForTimeout(50);

  // Verify the paragraph has center alignment
  const alignedP = page.locator('.altdocs-editor p').first();
  await expect(alignedP).toHaveCSS('text-align', 'center');
});

test('bold button shows active state when cursor is in bold text', async ({ page }) => {
  await page.goto(docUrl);
  await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

  const firstP = page.locator('.altdocs-editor p').first();
  await firstP.click();
  await page.waitForTimeout(50);

  // Type text, select it, make it bold
  await page.keyboard.type('boldtext');
  await page.keyboard.press('Home');
  for (let i = 0; i < 8; i++) await page.keyboard.press('Shift+ArrowRight');
  await page.locator('[data-toolbar-action="bold"]').click();
  await page.waitForTimeout(50);

  // Click back into the bold text
  const boldSpan = page.locator('.altdocs-editor p span').first();
  await boldSpan.click();
  await page.waitForTimeout(100);

  // Bold button should be active
  await expect(page.locator('[data-toolbar-action="bold"]')).toHaveClass(/active/);
});

test('block type select shows heading1 for H1 block', async ({ page }) => {
  await page.goto(docUrl);
  await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

  const firstP = page.locator('.altdocs-editor p').first();
  await firstP.click();
  await page.waitForTimeout(50);
  await page.keyboard.type('heading');

  // Change to heading1
  const select = page.locator('[data-toolbar-action="block-type"]');
  await select.selectOption('heading1');
  await page.waitForTimeout(50);

  // Click on the h1
  const h1 = page.locator('.altdocs-editor h1');
  await h1.click();
  await page.waitForTimeout(100);

  // Block type select should show heading1
  await expect(select).toHaveValue('heading1');
});
