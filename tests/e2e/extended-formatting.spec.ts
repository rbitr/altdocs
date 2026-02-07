import { test, expect } from '@playwright/test';

// Use a unique document ID per run to avoid collisions
const docId = `e2e-ext-fmt-${Date.now()}`;
const docUrl = `/#/doc/${docId}`;

test.describe('Block quote', () => {
  test('block type select includes Block Quote option', async ({ page }) => {
    await page.goto(docUrl);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');
    const select = page.locator('[data-toolbar-action="block-type"]');
    const option = select.locator('option[value="blockquote"]');
    await expect(option).toHaveCount(1);
    await expect(option).toHaveText('Block Quote');
  });

  test('changing block type to blockquote renders a blockquote element', async ({ page }) => {
    await page.goto(docUrl);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    const firstP = page.locator('.altdocs-editor p').first();
    await firstP.click();
    await page.waitForTimeout(50);
    await page.keyboard.type('A quoted passage');

    const select = page.locator('[data-toolbar-action="block-type"]');
    await select.selectOption('blockquote');
    await page.waitForTimeout(50);

    const bq = page.locator('.altdocs-editor blockquote');
    await expect(bq).toBeVisible();
    await expect(bq).toContainText('A quoted passage');
  });

  test('block type select shows blockquote when cursor is in blockquote', async ({ page }) => {
    await page.goto(docUrl);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    const firstP = page.locator('.altdocs-editor p').first();
    await firstP.click();
    await page.waitForTimeout(50);
    await page.keyboard.type('quote text');

    const select = page.locator('[data-toolbar-action="block-type"]');
    await select.selectOption('blockquote');
    await page.waitForTimeout(50);

    // Click on the blockquote
    const bq = page.locator('.altdocs-editor blockquote');
    await bq.click();
    await page.waitForTimeout(100);

    await expect(select).toHaveValue('blockquote');
  });
});

test.describe('Code block', () => {
  test('block type select includes Code Block option', async ({ page }) => {
    await page.goto(docUrl);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');
    const select = page.locator('[data-toolbar-action="block-type"]');
    const option = select.locator('option[value="code-block"]');
    await expect(option).toHaveCount(1);
    await expect(option).toHaveText('Code Block');
  });

  test('changing block type to code-block renders a pre element', async ({ page }) => {
    await page.goto(docUrl);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    const firstP = page.locator('.altdocs-editor p').first();
    await firstP.click();
    await page.waitForTimeout(50);
    await page.keyboard.type('const x = 42;');

    const select = page.locator('[data-toolbar-action="block-type"]');
    await select.selectOption('code-block');
    await page.waitForTimeout(50);

    const pre = page.locator('.altdocs-editor pre');
    await expect(pre).toBeVisible();
    await expect(pre).toContainText('const x = 42;');

    // Should contain a <code> child
    const code = pre.locator('code');
    await expect(code).toBeVisible();
  });
});

test.describe('Horizontal rule', () => {
  test('toolbar has horizontal rule button', async ({ page }) => {
    await page.goto(docUrl);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');
    await expect(page.locator('[data-toolbar-action="horizontal-rule"]')).toBeVisible();
  });

  test('clicking HR button inserts a horizontal rule', async ({ page }) => {
    await page.goto(docUrl);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    const firstP = page.locator('.altdocs-editor p').first();
    await firstP.click();
    await page.waitForTimeout(50);
    await page.keyboard.type('before rule');

    // Click the HR button
    await page.locator('[data-toolbar-action="horizontal-rule"]').click();
    await page.waitForTimeout(50);

    // Should have an HR in the editor
    const hr = page.locator('.altdocs-editor hr');
    await expect(hr).toBeVisible();

    // Cursor should be in a new paragraph after the HR — type to verify
    await page.keyboard.type('after rule');
    await page.waitForTimeout(50);

    // Get all top-level elements
    const editorChildren = page.locator('.altdocs-editor > *');
    const count = await editorChildren.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });
});

test.describe('Inline code', () => {
  test('toolbar has inline code button', async ({ page }) => {
    await page.goto(docUrl);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');
    await expect(page.locator('[data-toolbar-action="code"]')).toBeVisible();
  });

  test('Ctrl+` toggles inline code on selection', async ({ page }) => {
    await page.goto(docUrl);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    const firstP = page.locator('.altdocs-editor p').first();
    await firstP.click();
    await page.waitForTimeout(50);
    await page.keyboard.type('use console.log here');

    // Select "console.log" (characters 4-15)
    await page.keyboard.press('Home');
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
    for (let i = 0; i < 11; i++) await page.keyboard.press('Shift+ArrowRight');

    // Toggle inline code with Ctrl+`
    await page.keyboard.press('Control+`');
    await page.waitForTimeout(50);

    // Should render a <code> element
    const codeEl = page.locator('.altdocs-editor p code');
    await expect(codeEl).toBeVisible();
    await expect(codeEl).toContainText('console.log');
  });

  test('inline code button applies code formatting', async ({ page }) => {
    await page.goto(docUrl);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    const firstP = page.locator('.altdocs-editor p').first();
    await firstP.click();
    await page.waitForTimeout(50);
    await page.keyboard.type('my variable');

    // Select "variable"
    await page.keyboard.press('Home');
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
    for (let i = 0; i < 8; i++) await page.keyboard.press('Shift+ArrowRight');

    // Click code button
    await page.locator('[data-toolbar-action="code"]').click();
    await page.waitForTimeout(50);

    // Should render a <code> element
    const codeEl = page.locator('.altdocs-editor p code');
    await expect(codeEl).toBeVisible();
    await expect(codeEl).toContainText('variable');
  });
});
