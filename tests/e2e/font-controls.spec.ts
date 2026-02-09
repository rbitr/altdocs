import { test, expect } from '@playwright/test';

const docUrl = '/#/doc/e2e-font-test';

test('toolbar has font size select', async ({ page }) => {
  await page.goto(docUrl);
  const select = page.locator('[data-toolbar-action="font-size"]');
  await expect(select).toBeVisible();
});

test('toolbar has font family select', async ({ page }) => {
  await page.goto(docUrl);
  const select = page.locator('[data-toolbar-action="font-family"]');
  await expect(select).toBeVisible();
});

test('font size select has preset size options', async ({ page }) => {
  await page.goto(docUrl);
  const select = page.locator('[data-toolbar-action="font-size"]');
  await expect(select).toBeVisible();
  const options = select.locator('option');
  const values = await options.evaluateAll((opts: HTMLOptionElement[]) =>
    opts.map((o) => o.value)
  );
  expect(values).toContain('');
  expect(values).toContain('8');
  expect(values).toContain('12');
  expect(values).toContain('24');
  expect(values).toContain('48');
});

test('font family select has web-safe font options', async ({ page }) => {
  await page.goto(docUrl);
  const select = page.locator('[data-toolbar-action="font-family"]');
  await expect(select).toBeVisible();
  const options = select.locator('option');
  const values = await options.evaluateAll((opts: HTMLOptionElement[]) =>
    opts.map((o) => o.value)
  );
  expect(values).toContain('');
  expect(values).toContain('Arial');
  expect(values).toContain('Times New Roman');
  expect(values).toContain('Courier New');
  expect(values).toContain('Georgia');
});

test('font size applies to selected text', async ({ page }) => {
  await page.goto(docUrl);
  await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

  const firstP = page.locator('.altdocs-editor p').first();
  await firstP.click();
  await page.waitForTimeout(50);
  await page.keyboard.type('size test');

  // Select "size" (first 4 chars)
  for (let i = 0; i < 9; i++) await page.keyboard.press('ArrowLeft');
  for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+ArrowRight');

  // Apply font size 24
  const select = page.locator('[data-toolbar-action="font-size"]');
  await select.selectOption('24');
  await page.waitForTimeout(50);

  // Verify the span has font-size 24px
  const styledSpan = page.locator('.altdocs-editor p span').first();
  await expect(styledSpan).toHaveCSS('font-size', '24px');
});

test('font family applies to selected text', async ({ page }) => {
  await page.goto(docUrl);
  await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

  const firstP = page.locator('.altdocs-editor p').first();
  await firstP.click();
  await page.waitForTimeout(50);
  await page.keyboard.type('font test');

  // Select "font" (first 4 chars)
  for (let i = 0; i < 9; i++) await page.keyboard.press('ArrowLeft');
  for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+ArrowRight');

  // Apply font family Georgia
  const select = page.locator('[data-toolbar-action="font-family"]');
  await select.selectOption('Georgia');
  await page.waitForTimeout(50);

  // Verify the span has font-family Georgia
  const styledSpan = page.locator('.altdocs-editor p span').first();
  await expect(styledSpan).toHaveCSS('font-family', 'Georgia');
});

test('font size select reflects active font size', async ({ page }) => {
  await page.goto(docUrl);
  await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

  const firstP = page.locator('.altdocs-editor p').first();
  await firstP.click();
  await page.waitForTimeout(50);
  await page.keyboard.type('check');

  // Select all and apply font size 18
  await page.keyboard.press('Home');
  for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+ArrowRight');

  const sizeSelect = page.locator('[data-toolbar-action="font-size"]');
  await sizeSelect.selectOption('18');
  await page.waitForTimeout(50);

  // Click into the styled text
  const styledSpan = page.locator('.altdocs-editor p span').first();
  await styledSpan.click();
  await page.waitForTimeout(100);

  // Font size select should show 18
  await expect(sizeSelect).toHaveValue('18');
});

test('font size defaults to empty when no font size set', async ({ page }) => {
  await page.goto(docUrl);
  await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

  const sizeSelect = page.locator('[data-toolbar-action="font-size"]');
  // Default text has no font size set
  await expect(sizeSelect).toHaveValue('');
});
