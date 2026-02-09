import { test, expect } from '@playwright/test';

const docUrl = '/#/doc/e2e-color-test';

test('toolbar has text color picker', async ({ page }) => {
  await page.goto(docUrl);
  const picker = page.locator('[data-toolbar-action="text-color"]');
  await expect(picker).toBeVisible();
});

test('toolbar has highlight color picker', async ({ page }) => {
  await page.goto(docUrl);
  const picker = page.locator('[data-toolbar-action="highlight-color"]');
  await expect(picker).toBeVisible();
});

test('text color dropdown opens on click', async ({ page }) => {
  await page.goto(docUrl);
  await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

  const btn = page.locator('[data-toolbar-action="text-color-btn"]');
  await btn.click();

  const dropdown = page.locator('[data-toolbar-action="text-color"] .toolbar-color-dropdown');
  await expect(dropdown).toBeVisible();
});

test('highlight color dropdown opens on click', async ({ page }) => {
  await page.goto(docUrl);
  await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

  const btn = page.locator('[data-toolbar-action="highlight-color-btn"]');
  await btn.click();

  const dropdown = page.locator('[data-toolbar-action="highlight-color"] .toolbar-color-dropdown');
  await expect(dropdown).toBeVisible();
});

test('text color dropdown has color swatches', async ({ page }) => {
  await page.goto(docUrl);
  await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

  const btn = page.locator('[data-toolbar-action="text-color-btn"]');
  await btn.click();

  const swatches = page.locator('[data-toolbar-action="text-color"] .toolbar-color-swatch');
  const count = await swatches.count();
  expect(count).toBe(20);
});

test('text color dropdown has default/remove button', async ({ page }) => {
  await page.goto(docUrl);
  await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

  const btn = page.locator('[data-toolbar-action="text-color-btn"]');
  await btn.click();

  const removeBtn = page.locator('[data-toolbar-action="text-color"] .toolbar-color-remove');
  await expect(removeBtn).toBeVisible();
  await expect(removeBtn).toHaveText('Default');
});

test('highlight color dropdown has none/remove button', async ({ page }) => {
  await page.goto(docUrl);
  await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

  const btn = page.locator('[data-toolbar-action="highlight-color-btn"]');
  await btn.click();

  const removeBtn = page.locator('[data-toolbar-action="highlight-color"] .toolbar-color-remove');
  await expect(removeBtn).toBeVisible();
  await expect(removeBtn).toHaveText('None');
});

test('text color applies to selected text', async ({ page }) => {
  await page.goto(docUrl);
  await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

  const firstP = page.locator('.altdocs-editor p').first();
  await firstP.click();
  await page.waitForTimeout(50);
  await page.keyboard.type('color test');

  // Select "color" (first 5 chars)
  for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowLeft');
  for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+ArrowRight');

  // Open text color picker and click red
  const btn = page.locator('[data-toolbar-action="text-color-btn"]');
  await btn.click();

  const redSwatch = page.locator('[data-toolbar-action="text-color"] .toolbar-color-swatch[data-color="#c0392b"]');
  await redSwatch.click();
  await page.waitForTimeout(50);

  // Verify the span has the red color
  const styledSpan = page.locator('.altdocs-editor p span').first();
  await expect(styledSpan).toHaveCSS('color', 'rgb(192, 57, 43)');
});

test('highlight color applies to selected text', async ({ page }) => {
  await page.goto(docUrl);
  await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

  const firstP = page.locator('.altdocs-editor p').first();
  await firstP.click();
  await page.waitForTimeout(50);
  await page.keyboard.type('highlight test');

  // Select "highlight" (first 9 chars)
  for (let i = 0; i < 14; i++) await page.keyboard.press('ArrowLeft');
  for (let i = 0; i < 9; i++) await page.keyboard.press('Shift+ArrowRight');

  // Open highlight color picker and click yellow
  const btn = page.locator('[data-toolbar-action="highlight-color-btn"]');
  await btn.click();

  const yellowSwatch = page.locator('[data-toolbar-action="highlight-color"] .toolbar-color-swatch[data-color="#ffff00"]');
  await yellowSwatch.click();
  await page.waitForTimeout(50);

  // Verify the span has the yellow background
  const styledSpan = page.locator('.altdocs-editor p span').first();
  await expect(styledSpan).toHaveCSS('background-color', 'rgb(255, 255, 0)');
});

test('dropdown closes after selecting a color', async ({ page }) => {
  await page.goto(docUrl);
  await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

  const firstP = page.locator('.altdocs-editor p').first();
  await firstP.click();
  await page.waitForTimeout(50);
  await page.keyboard.type('test');

  // Select all text
  await page.keyboard.press('Home');
  for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+ArrowRight');

  // Open text color picker
  const btn = page.locator('[data-toolbar-action="text-color-btn"]');
  await btn.click();

  const dropdown = page.locator('[data-toolbar-action="text-color"] .toolbar-color-dropdown');
  await expect(dropdown).toBeVisible();

  // Click a swatch
  const swatch = page.locator('[data-toolbar-action="text-color"] .toolbar-color-swatch').first();
  await swatch.click();

  // Dropdown should close
  await expect(dropdown).not.toBeVisible();
});

test('dropdown closes when clicking outside', async ({ page }) => {
  await page.goto(docUrl);
  await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

  // Open text color picker
  const btn = page.locator('[data-toolbar-action="text-color-btn"]');
  await btn.click();

  const dropdown = page.locator('[data-toolbar-action="text-color"] .toolbar-color-dropdown');
  await expect(dropdown).toBeVisible();

  // Click on the editor area
  const editor = page.locator('.altdocs-editor');
  await editor.click();

  // Dropdown should close
  await expect(dropdown).not.toBeVisible();
});
