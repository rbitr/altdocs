import { test, expect } from '@playwright/test';

// Helper: create a document via API and return its ID
async function createDocWithContent(
  page: any,
  title: string,
  blocks: Array<{ id: string; type: string; alignment: string; indentLevel?: number; runs: Array<{ text: string; style: Record<string, unknown> }> }>
): Promise<string> {
  const id = `indent-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await page.request.post('http://localhost:3000/api/documents', {
    data: { id, title, content: JSON.stringify(blocks) },
  });
  return id;
}

test.describe('Block Indentation', () => {
  test('Tab key indents the current block', async ({ page }) => {
    const docId = `indent-tab-${Date.now()}`;
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    // Type some text
    const editor = page.locator('.altdocs-editor');
    await editor.click();
    await page.waitForTimeout(50);
    await page.keyboard.type('Hello world');

    // Press Tab to indent
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);

    // The paragraph should now have data-indent="1"
    const p = editor.locator('p[data-indent="1"]');
    await expect(p).toBeVisible();
    await expect(p).toContainText('Hello world');
  });

  test('Shift+Tab outdents the current block', async ({ page }) => {
    const docId = `indent-outdent-${Date.now()}`;
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    const editor = page.locator('.altdocs-editor');
    await editor.click();
    await page.waitForTimeout(50);
    await page.keyboard.type('Hello');

    // Indent twice
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);

    // Should be at indent level 2
    let p = editor.locator('p[data-indent="2"]');
    await expect(p).toBeVisible();

    // Outdent once
    await page.keyboard.press('Shift+Tab');
    await page.waitForTimeout(100);

    // Should be at indent level 1
    p = editor.locator('p[data-indent="1"]');
    await expect(p).toBeVisible();
  });

  test('toolbar indent button works', async ({ page }) => {
    const docId = `indent-toolbar-${Date.now()}`;
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    const editor = page.locator('.altdocs-editor');
    await editor.click();
    await page.waitForTimeout(50);
    await page.keyboard.type('Test');

    // Click the indent button
    const indentBtn = page.locator('[data-toolbar-action="indent"]');
    await indentBtn.click();
    await page.waitForTimeout(100);

    const p = editor.locator('p[data-indent="1"]');
    await expect(p).toBeVisible();
  });

  test('toolbar outdent button works', async ({ page }) => {
    const docId = `outdent-toolbar-${Date.now()}`;
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    const editor = page.locator('.altdocs-editor');
    await editor.click();
    await page.waitForTimeout(50);
    await page.keyboard.type('Test');

    // Indent first
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);

    // Click the outdent button
    const outdentBtn = page.locator('[data-toolbar-action="outdent"]');
    await outdentBtn.click();
    await page.waitForTimeout(100);

    // Should be back to indent level 0 — no data-indent attribute
    const p = editor.locator('p');
    await expect(p).toBeVisible();
    // data-indent should not be present
    const indent = await p.getAttribute('data-indent');
    expect(indent).toBeNull();
  });

  test('list items render nested when indented', async ({ page }) => {
    const blocks = [
      { id: 'b1', type: 'bullet-list-item', alignment: 'left', indentLevel: 0, runs: [{ text: 'Item 1', style: {} }] },
      { id: 'b2', type: 'bullet-list-item', alignment: 'left', indentLevel: 1, runs: [{ text: 'Sub-item', style: {} }] },
      { id: 'b3', type: 'bullet-list-item', alignment: 'left', indentLevel: 0, runs: [{ text: 'Item 2', style: {} }] },
    ];
    const title = `Nested List ${Date.now()}`;
    const docId = await createDocWithContent(page, title, blocks);
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    const editor = page.locator('.altdocs-editor');

    // Top-level ul should exist
    const topUl = editor.locator(':scope > ul');
    await expect(topUl).toBeVisible();

    // Should have a nested ul inside the first li
    const nestedUl = editor.locator('ul ul');
    await expect(nestedUl).toBeVisible();

    // The sub-item text should be present
    await expect(editor).toContainText('Sub-item');

    // Top level should have 2 direct li children
    const topLis = topUl.locator(':scope > li');
    await expect(topLis).toHaveCount(2);
  });

  test('indentation persists after save and reload', async ({ page }) => {
    const docId = `indent-persist-${Date.now()}`;
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    const editor = page.locator('.altdocs-editor');
    await editor.click();
    await page.waitForTimeout(50);
    await page.keyboard.type('Indented text');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);

    // Verify indent is applied
    let p = editor.locator('p[data-indent="2"]');
    await expect(p).toBeVisible();

    // Wait for auto-save (2s debounce + buffer)
    await page.waitForTimeout(3000);

    // Reload the page
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    // Indent should persist
    p = page.locator('.altdocs-editor p[data-indent="2"]');
    await expect(p).toBeVisible();
    await expect(p).toContainText('Indented text');
  });

  test('undo reverts indentation', async ({ page }) => {
    const docId = `indent-undo-${Date.now()}`;
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    const editor = page.locator('.altdocs-editor');
    await editor.click();
    await page.waitForTimeout(50);
    await page.keyboard.type('Test');

    // Indent
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    let p = editor.locator('p[data-indent="1"]');
    await expect(p).toBeVisible();

    // Undo
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(100);

    // Should be back to no indent
    p = editor.locator('p');
    const indent = await p.getAttribute('data-indent');
    expect(indent).toBeNull();
  });
});
