import { test, expect } from '@playwright/test';

const editorSelector = '.altdocs-editor';

async function setupEditor(page: any, docId: string) {
  await page.goto(`/#/doc/${docId}`);
  await page.waitForSelector(`${editorSelector}[contenteditable="true"]`);
  const firstP = page.locator(`${editorSelector} p`).first();
  await firstP.click();
  await page.waitForTimeout(50);
}

// ── Ctrl+Backspace: Delete previous word ──

test('Ctrl+Backspace deletes the previous word', async ({ page }) => {
  await setupEditor(page, `e2e-ctrl-bksp-${Date.now()}`);
  await page.keyboard.type('hello world');
  await page.keyboard.press('Control+Backspace');

  const firstP = page.locator(`${editorSelector} p`).first();
  await expect(firstP).toHaveText('hello ');
});

test('Ctrl+Backspace deletes multiple times', async ({ page }) => {
  await setupEditor(page, `e2e-ctrl-bksp-multi-${Date.now()}`);
  await page.keyboard.type('one two three');
  await page.keyboard.press('Control+Backspace');
  await page.keyboard.press('Control+Backspace');

  const firstP = page.locator(`${editorSelector} p`).first();
  await expect(firstP).toHaveText('one ');
});

// ── Ctrl+Delete: Delete next word ──

test('Ctrl+Delete deletes the next word', async ({ page }) => {
  await setupEditor(page, `e2e-ctrl-del-${Date.now()}`);
  await page.keyboard.type('hello world');
  await page.keyboard.press('Home');
  await page.keyboard.press('Control+Delete');

  const firstP = page.locator(`${editorSelector} p`).first();
  await expect(firstP).toHaveText('world');
});

// ── Ctrl+F: Find bar ──

test('Ctrl+F opens find bar', async ({ page }) => {
  await setupEditor(page, `e2e-find-bar-${Date.now()}`);
  await page.keyboard.type('hello world');
  await page.keyboard.press('Control+f');

  // Find bar should be visible
  const findBar = page.locator('.find-replace-bar');
  await expect(findBar).toBeVisible();

  // Find input should be focused
  const findInput = page.locator('.find-input').first();
  await expect(findInput).toBeFocused();
});

test('Escape closes find bar', async ({ page }) => {
  await setupEditor(page, `e2e-find-close-${Date.now()}`);
  await page.keyboard.type('hello');
  await page.keyboard.press('Control+f');
  await expect(page.locator('.find-replace-bar')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('.find-replace-bar')).not.toBeVisible();
});

test('find highlights matches and shows count', async ({ page }) => {
  await setupEditor(page, `e2e-find-matches-${Date.now()}`);
  await page.keyboard.type('hello world hello');

  await page.keyboard.press('Control+f');
  const findInput = page.locator('.find-input').first();
  await findInput.fill('hello');
  await page.waitForTimeout(100);

  // Should show match count
  const matchCount = page.locator('.find-match-count');
  await expect(matchCount).toHaveText('1 of 2');

  // Should have highlight elements
  const highlights = page.locator('.find-highlight');
  await expect(highlights).toHaveCount(2);
});

test('Enter navigates to next match', async ({ page }) => {
  await setupEditor(page, `e2e-find-next-${Date.now()}`);
  await page.keyboard.type('abc def abc');

  await page.keyboard.press('Control+f');
  const findInput = page.locator('.find-input').first();
  await findInput.fill('abc');
  await page.waitForTimeout(100);

  // Should start at "1 of 2"
  const matchCount = page.locator('.find-match-count');
  await expect(matchCount).toHaveText('1 of 2');

  // Press Enter to go to next
  await page.keyboard.press('Enter');
  await expect(matchCount).toHaveText('2 of 2');

  // Wraps around
  await page.keyboard.press('Enter');
  await expect(matchCount).toHaveText('1 of 2');
});

test('Shift+Enter navigates to previous match', async ({ page }) => {
  await setupEditor(page, `e2e-find-prev-${Date.now()}`);
  await page.keyboard.type('abc def abc');

  await page.keyboard.press('Control+f');
  const findInput = page.locator('.find-input').first();
  await findInput.fill('abc');
  await page.waitForTimeout(100);

  await expect(page.locator('.find-match-count')).toHaveText('1 of 2');
  await page.keyboard.press('Shift+Enter');
  await expect(page.locator('.find-match-count')).toHaveText('2 of 2');
});

test('find shows "No results" for no matches', async ({ page }) => {
  await setupEditor(page, `e2e-find-none-${Date.now()}`);
  await page.keyboard.type('hello world');

  await page.keyboard.press('Control+f');
  const findInput = page.locator('.find-input').first();
  await findInput.fill('xyz');
  await page.waitForTimeout(100);

  await expect(page.locator('.find-match-count')).toHaveText('No results');
});

// ── Ctrl+H: Find & Replace ──

test('Ctrl+H opens find & replace bar with replace row', async ({ page }) => {
  await setupEditor(page, `e2e-replace-bar-${Date.now()}`);
  await page.keyboard.type('hello');
  await page.keyboard.press('Control+h');

  const findBar = page.locator('.find-replace-bar');
  await expect(findBar).toBeVisible();

  // Should have two rows (find and replace)
  const rows = page.locator('.find-replace-row');
  await expect(rows).toHaveCount(2);

  // Replace row should be visible
  const replaceRow = rows.nth(1);
  await expect(replaceRow).toBeVisible();
});

test('Replace replaces current match', async ({ page }) => {
  await setupEditor(page, `e2e-replace-one-${Date.now()}`);
  await page.keyboard.type('hello world hello');

  await page.keyboard.press('Control+h');
  const findInput = page.locator('.find-input').first();
  await findInput.fill('hello');
  await page.waitForTimeout(100);

  // Fill replace input
  const replaceInput = page.locator('.find-input').nth(1);
  await replaceInput.fill('goodbye');

  // Click Replace button
  await page.locator('.find-btn', { hasText: 'Replace' }).click();
  await page.waitForTimeout(100);

  const firstP = page.locator(`${editorSelector} p`).first();
  const text = await firstP.textContent();
  expect(text).toContain('goodbye');
  // Should still have one "hello" left
  expect(text).toContain('hello');
});

test('Replace All replaces all matches', async ({ page }) => {
  await setupEditor(page, `e2e-replace-all-${Date.now()}`);
  await page.keyboard.type('cat and cat and cat');

  await page.keyboard.press('Control+h');
  const findInput = page.locator('.find-input').first();
  await findInput.fill('cat');
  await page.waitForTimeout(100);

  const replaceInput = page.locator('.find-input').nth(1);
  await replaceInput.fill('dog');

  // Click Replace All
  await page.locator('.find-btn', { hasText: 'All' }).click();
  await page.waitForTimeout(100);

  const firstP = page.locator(`${editorSelector} p`).first();
  await expect(firstP).toHaveText('dog and dog and dog');
});

test('find is case-insensitive', async ({ page }) => {
  await setupEditor(page, `e2e-find-case-${Date.now()}`);
  await page.keyboard.type('Hello HELLO hello');

  await page.keyboard.press('Control+f');
  const findInput = page.locator('.find-input').first();
  await findInput.fill('hello');
  await page.waitForTimeout(100);

  await expect(page.locator('.find-match-count')).toHaveText('1 of 3');
});

test('Ctrl+F pre-fills with selected text', async ({ page }) => {
  await setupEditor(page, `e2e-find-prefill-${Date.now()}`);
  await page.keyboard.type('hello world');

  // Select "world" using keyboard
  await page.keyboard.press('Home');
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Shift+ArrowRight');
  }

  await page.keyboard.press('Control+f');
  const findInput = page.locator('.find-input').first();
  await expect(findInput).toHaveValue('hello');
});
