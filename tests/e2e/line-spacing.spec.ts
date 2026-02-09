import { test, expect } from '@playwright/test';

// Helper: create a document via API and return its ID
async function createDocWithContent(
  page: any,
  title: string,
  blocks: Array<{ id: string; type: string; alignment: string; lineSpacing?: number; runs: Array<{ text: string; style: Record<string, unknown> }> }>
): Promise<string> {
  const id = `spacing-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await page.request.post('http://localhost:3000/api/documents', {
    data: { id, title, content: JSON.stringify(blocks) },
  });
  return id;
}

test.describe('Line Spacing', () => {
  test('line spacing select changes block line-height', async ({ page }) => {
    const docId = `spacing-select-${Date.now()}`;
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    const editor = page.locator('.altdocs-editor');
    await editor.click();
    await page.waitForTimeout(50);
    await page.keyboard.type('Hello world');

    // Select "Double" line spacing from the dropdown
    const spacingSelect = page.locator('[data-toolbar-action="line-spacing"]');
    await spacingSelect.selectOption('2');
    await page.waitForTimeout(100);

    // The paragraph should have line-height: 2
    const p = editor.locator('p');
    const lineHeight = await p.evaluate((el: HTMLElement) => el.style.lineHeight);
    expect(lineHeight).toBe('2');
  });

  test('line spacing select shows 1.5 option', async ({ page }) => {
    const docId = `spacing-1.5-${Date.now()}`;
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    const editor = page.locator('.altdocs-editor');
    await editor.click();
    await page.waitForTimeout(50);
    await page.keyboard.type('Test text');

    // Select 1.5 line spacing
    const spacingSelect = page.locator('[data-toolbar-action="line-spacing"]');
    await spacingSelect.selectOption('1.5');
    await page.waitForTimeout(100);

    const p = editor.locator('p');
    const lineHeight = await p.evaluate((el: HTMLElement) => el.style.lineHeight);
    expect(lineHeight).toBe('1.5');
  });

  test('line spacing renders from persisted content', async ({ page }) => {
    const blocks = [
      { id: 'b1', type: 'paragraph', alignment: 'left', lineSpacing: 2, runs: [{ text: 'Double spaced text', style: {} }] },
    ];
    const title = `Persisted Spacing ${Date.now()}`;
    const docId = await createDocWithContent(page, title, blocks);
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    const editor = page.locator('.altdocs-editor');
    const p = editor.locator('p');
    const lineHeight = await p.evaluate((el: HTMLElement) => el.style.lineHeight);
    expect(lineHeight).toBe('2');
  });

  test('line spacing dropdown reflects current block spacing', async ({ page }) => {
    const blocks = [
      { id: 'b1', type: 'paragraph', alignment: 'left', lineSpacing: 1.5, runs: [{ text: 'Spaced text', style: {} }] },
    ];
    const title = `Spacing Sync ${Date.now()}`;
    const docId = await createDocWithContent(page, title, blocks);
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    // Click into the editor to trigger update
    const editor = page.locator('.altdocs-editor');
    await editor.click();
    await page.waitForTimeout(100);

    // The dropdown should show 1.5
    const spacingSelect = page.locator('[data-toolbar-action="line-spacing"]');
    const selectedValue = await spacingSelect.inputValue();
    expect(selectedValue).toBe('1.5');
  });

  test('line spacing persists after save and reload', async ({ page }) => {
    const docId = `spacing-persist-${Date.now()}`;
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    const editor = page.locator('.altdocs-editor');
    await editor.click();
    await page.waitForTimeout(50);
    await page.keyboard.type('Double spaced');

    // Set to double spacing
    const spacingSelect = page.locator('[data-toolbar-action="line-spacing"]');
    await spacingSelect.selectOption('2');
    await page.waitForTimeout(100);

    // Wait for auto-save (2s debounce + buffer)
    await page.waitForTimeout(3000);

    // Reload the page
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    // Line spacing should persist
    const p = page.locator('.altdocs-editor p');
    const lineHeight = await p.evaluate((el: HTMLElement) => el.style.lineHeight);
    expect(lineHeight).toBe('2');
  });

  test('undo reverts line spacing change', async ({ page }) => {
    const docId = `spacing-undo-${Date.now()}`;
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    const editor = page.locator('.altdocs-editor');
    await editor.click();
    await page.waitForTimeout(50);
    await page.keyboard.type('Test');

    // Set line spacing
    const spacingSelect = page.locator('[data-toolbar-action="line-spacing"]');
    await spacingSelect.selectOption('2');
    await page.waitForTimeout(100);

    // Verify it was applied
    let p = editor.locator('p');
    let lineHeight = await p.evaluate((el: HTMLElement) => el.style.lineHeight);
    expect(lineHeight).toBe('2');

    // Undo
    await editor.click();
    await page.waitForTimeout(50);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(100);

    // Line spacing should be reverted (empty = default)
    p = editor.locator('p');
    lineHeight = await p.evaluate((el: HTMLElement) => el.style.lineHeight);
    expect(lineHeight).toBe('');
  });

  test('different blocks can have different line spacings', async ({ page }) => {
    const blocks = [
      { id: 'b1', type: 'paragraph', alignment: 'left', lineSpacing: 1, runs: [{ text: 'Single spaced', style: {} }] },
      { id: 'b2', type: 'paragraph', alignment: 'left', lineSpacing: 2, runs: [{ text: 'Double spaced', style: {} }] },
    ];
    const title = `Mixed Spacing ${Date.now()}`;
    const docId = await createDocWithContent(page, title, blocks);
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    const editor = page.locator('.altdocs-editor');
    const paragraphs = editor.locator('p');
    await expect(paragraphs).toHaveCount(2);

    const lineHeight1 = await paragraphs.nth(0).evaluate((el: HTMLElement) => el.style.lineHeight);
    const lineHeight2 = await paragraphs.nth(1).evaluate((el: HTMLElement) => el.style.lineHeight);
    expect(lineHeight1).toBe('1');
    expect(lineHeight2).toBe('2');
  });
});
