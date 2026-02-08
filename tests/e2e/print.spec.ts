import { test, expect } from '@playwright/test';

const docUrl = '/#/doc/e2e-print-test';

test.describe('print styles', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(docUrl);
    await page.waitForSelector('.altdocs-editor');
    await page.emulateMedia({ media: 'print' });
  });

  test('toolbar is hidden in print mode', async ({ page }) => {
    const toolbar = page.locator('.altdocs-toolbar');
    await expect(toolbar).toBeHidden();
  });

  test('status bar is hidden in print mode', async ({ page }) => {
    const statusBar = page.locator('.status-bar');
    await expect(statusBar).toBeHidden();
  });

  test('document title is visible in print mode', async ({ page }) => {
    const title = page.locator('.doc-title-input');
    await expect(title).toBeVisible();
  });

  test('editor content is visible in print mode', async ({ page }) => {
    const editor = page.locator('.altdocs-editor');
    await expect(editor).toBeVisible();
  });

  test('editor has no border in print mode', async ({ page }) => {
    const editor = page.locator('.altdocs-editor');
    const border = await editor.evaluate((el) => getComputedStyle(el).borderStyle);
    expect(border).toBe('none');
  });

  test('editor has no background in print mode', async ({ page }) => {
    const editor = page.locator('.altdocs-editor');
    const bg = await editor.evaluate((el) => getComputedStyle(el).backgroundColor);
    // 'transparent' or 'rgba(0, 0, 0, 0)' — both mean no background
    expect(bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)').toBe(true);
  });

  test('editor has no fixed min-height in print mode', async ({ page }) => {
    const editor = page.locator('.altdocs-editor');
    const minHeight = await editor.evaluate((el) => getComputedStyle(el).minHeight);
    // 'auto' computes to '0px' — either means no forced minimum height
    expect(minHeight === 'auto' || minHeight === '0px').toBe(true);
  });

  test('headings avoid page break after', async ({ page }) => {
    // Type a heading in the editor
    await page.emulateMedia({ media: 'screen' });
    const editor = page.locator('.altdocs-editor');
    await editor.click();
    await page.waitForTimeout(50);

    await page.emulateMedia({ media: 'print' });
    // Check heading CSS rule - h1 should have break-after: avoid
    const h1Break = await page.evaluate(() => {
      // Create a temporary h1 inside the editor to test computed style
      const editorEl = document.querySelector('.altdocs-editor');
      if (!editorEl) return '';
      const h1 = document.createElement('h1');
      h1.textContent = 'Test';
      editorEl.appendChild(h1);
      const style = getComputedStyle(h1);
      const result = style.breakAfter || style.pageBreakAfter;
      h1.remove();
      return result;
    });
    expect(h1Break).toBe('avoid');
  });
});

test.describe('print styles on document list', () => {
  test.beforeEach(async ({ page }) => {
    // Make sure there's at least one doc by visiting editor first
    await page.goto(docUrl);
    await page.waitForSelector('.altdocs-editor');
    await page.goto('/');
    await page.waitForSelector('.doc-list-header');
    await page.emulateMedia({ media: 'print' });
  });

  test('new document button is hidden in print mode', async ({ page }) => {
    const newBtn = page.locator('.new-doc-btn');
    await expect(newBtn).toBeHidden();
  });

  test('action buttons are hidden in print mode', async ({ page }) => {
    const actions = page.locator('.doc-item-actions').first();
    const count = await page.locator('.doc-item-actions').count();
    if (count > 0) {
      await expect(actions).toBeHidden();
    }
  });
});
