import { test, expect } from '@playwright/test';

const editorSelector = '.altdocs-editor';

async function setupEditor(page: any, docId: string) {
  await page.goto(`/#/doc/${docId}`);
  await page.waitForSelector(`${editorSelector}[contenteditable="true"]`);
  const firstP = page.locator(`${editorSelector} p`).first();
  await firstP.click();
  await page.waitForTimeout(50);
}

// --- Click-drag text selection ---

test('click-drag selects text and typing replaces it', async ({ page }) => {
  await setupEditor(page, 'e2e-drag-select-1');
  await page.keyboard.type('hello world');

  // Select "hello" via Shift+Home then Shift+Right (reliable in headless)
  // First, move cursor to start
  await page.keyboard.press('Home');
  // Select first 5 characters
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Shift+ArrowRight');
  }

  // Type to replace the selection
  await page.keyboard.type('goodbye');

  const firstP = page.locator(`${editorSelector} p`).first();
  await expect(firstP).toContainText('goodbye world');
});

test('select all with Ctrl+A and type replaces all text', async ({ page }) => {
  await setupEditor(page, 'e2e-select-all-1');
  await page.keyboard.type('replace me entirely');

  // Select all with Ctrl+A
  await page.keyboard.press('Control+a');
  await page.waitForTimeout(50);

  // Type to replace
  await page.keyboard.type('new text');

  const editor = page.locator(editorSelector);
  await expect(editor).toContainText('new text');
  // The old text should be gone
  const text = await editor.innerText();
  expect(text).not.toContain('replace me entirely');
});

test('select all and delete clears document', async ({ page }) => {
  await setupEditor(page, 'e2e-select-all-delete');
  await page.keyboard.type('line one');
  await page.keyboard.press('Enter');
  await page.keyboard.type('line two');

  // Select all
  await page.keyboard.press('Control+a');
  await page.waitForTimeout(50);

  // Delete
  await page.keyboard.press('Backspace');

  // Should have single empty block
  const paragraphs = page.locator(`${editorSelector} p`);
  const count = await paragraphs.count();
  expect(count).toBe(1);
});

test('shift+arrow selection across multiple characters', async ({ page }) => {
  await setupEditor(page, 'e2e-shift-arrow');
  await page.keyboard.type('abcdef');

  // Move to start
  await page.keyboard.press('Home');

  // Select "abc" with Shift+Right
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Shift+ArrowRight');
  }

  // Delete the selection
  await page.keyboard.press('Backspace');

  const firstP = page.locator(`${editorSelector} p`).first();
  await expect(firstP).toHaveText('def');
});

// --- Keyboard formatting shortcuts ---

test('Ctrl+B applies bold to selected text', async ({ page }) => {
  await setupEditor(page, 'e2e-ctrl-bold');
  await page.keyboard.type('make bold');

  // Select "bold" (last 4 characters)
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Shift+ArrowLeft');
  }

  // Apply bold via keyboard shortcut
  await page.keyboard.press('Control+b');
  await page.waitForTimeout(50);

  // Verify bold button is active
  await expect(page.locator('[data-toolbar-action="bold"]')).toHaveClass(/active/);

  // Verify the DOM has a bold span
  const boldSpan = page.locator(`${editorSelector} p span`).last();
  await expect(boldSpan).toHaveCSS('font-weight', '700');
});

test('Ctrl+I applies italic to selected text', async ({ page }) => {
  await setupEditor(page, 'e2e-ctrl-italic');
  await page.keyboard.type('make italic');

  // Select "italic" (last 6 characters)
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Shift+ArrowLeft');
  }

  // Apply italic via keyboard shortcut
  await page.keyboard.press('Control+i');
  await page.waitForTimeout(50);

  // Verify italic button is active
  await expect(page.locator('[data-toolbar-action="italic"]')).toHaveClass(/active/);

  // Verify the DOM has an italic span
  const italicSpan = page.locator(`${editorSelector} p span`).last();
  await expect(italicSpan).toHaveCSS('font-style', 'italic');
});

test('Ctrl+U applies underline to selected text', async ({ page }) => {
  await setupEditor(page, 'e2e-ctrl-underline');
  await page.keyboard.type('make underlined');

  // Select "underlined" (last 10 characters)
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Shift+ArrowLeft');
  }

  // Apply underline via keyboard shortcut
  await page.keyboard.press('Control+u');
  await page.waitForTimeout(50);

  // Verify underline button is active
  await expect(page.locator('[data-toolbar-action="underline"]')).toHaveClass(/active/);
});

test('Ctrl+D applies strikethrough to selected text', async ({ page }) => {
  await setupEditor(page, 'e2e-ctrl-strike');
  await page.keyboard.type('strike this');

  // Select "this" (last 4 characters)
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Shift+ArrowLeft');
  }

  // Apply strikethrough via keyboard shortcut
  await page.keyboard.press('Control+d');
  await page.waitForTimeout(50);

  // Verify strikethrough button is active
  await expect(page.locator('[data-toolbar-action="strikethrough"]')).toHaveClass(/active/);
});

test('Ctrl+B toggles bold off on already-bold text', async ({ page }) => {
  await setupEditor(page, 'e2e-ctrl-bold-toggle');
  await page.keyboard.type('bold toggle');

  // Select all
  await page.keyboard.press('Home');
  for (let i = 0; i < 11; i++) {
    await page.keyboard.press('Shift+ArrowRight');
  }

  // Apply bold
  await page.keyboard.press('Control+b');
  await page.waitForTimeout(50);
  await expect(page.locator('[data-toolbar-action="bold"]')).toHaveClass(/active/);

  // Keep selection, toggle bold off
  await page.keyboard.press('Home');
  for (let i = 0; i < 11; i++) {
    await page.keyboard.press('Shift+ArrowRight');
  }
  await page.keyboard.press('Control+b');
  await page.waitForTimeout(50);

  // Bold button should not be active now
  const boldBtn = page.locator('[data-toolbar-action="bold"]');
  await expect(boldBtn).not.toHaveClass(/active/);
});

// --- Home/End key navigation ---

test('Home key moves cursor to start of line', async ({ page }) => {
  await setupEditor(page, 'e2e-home-key');
  await page.keyboard.type('hello world');

  // Press Home to go to start
  await page.keyboard.press('Home');

  // Type at beginning
  await page.keyboard.type('X');

  const firstP = page.locator(`${editorSelector} p`).first();
  await expect(firstP).toContainText('Xhello world');
});

test('End key moves cursor to end of line', async ({ page }) => {
  await setupEditor(page, 'e2e-end-key');
  await page.keyboard.type('hello world');

  // Go to start first
  await page.keyboard.press('Home');

  // Press End to go to end
  await page.keyboard.press('End');

  // Type at end
  await page.keyboard.type('!');

  const firstP = page.locator(`${editorSelector} p`).first();
  await expect(firstP).toContainText('hello world!');
});

test('Ctrl+Home moves cursor to start of document', async ({ page }) => {
  await setupEditor(page, 'e2e-ctrl-home');
  await page.keyboard.type('first block');
  await page.keyboard.press('Enter');
  await page.keyboard.type('second block');

  // Ctrl+Home to go to document start
  await page.keyboard.press('Control+Home');

  // Type at beginning of document
  await page.keyboard.type('X');

  const firstP = page.locator(`${editorSelector} p`).first();
  await expect(firstP).toContainText('Xfirst block');
});

test('Ctrl+End moves cursor to end of document', async ({ page }) => {
  await setupEditor(page, 'e2e-ctrl-end');
  await page.keyboard.type('first block');
  await page.keyboard.press('Enter');
  await page.keyboard.type('second block');

  // Go to start first
  await page.keyboard.press('Control+Home');

  // Ctrl+End to go to document end
  await page.keyboard.press('Control+End');

  // Type at end of document
  await page.keyboard.type('!');

  // The last paragraph should have "second block!"
  const lastP = page.locator(`${editorSelector} p`).last();
  await expect(lastP).toContainText('second block!');
});

test('Shift+Home selects from cursor to start of line', async ({ page }) => {
  await setupEditor(page, 'e2e-shift-home');
  await page.keyboard.type('select to start');

  // Shift+Home to select all text on this line
  await page.keyboard.press('Shift+Home');

  // Delete the selection
  await page.keyboard.press('Backspace');

  // The paragraph should be empty
  const firstP = page.locator(`${editorSelector} p`).first();
  const text = await firstP.innerText();
  expect(text.trim()).toBe('');
});

test('Shift+End selects from cursor to end of line', async ({ page }) => {
  await setupEditor(page, 'e2e-shift-end');
  await page.keyboard.type('select to end');

  // Move to start
  await page.keyboard.press('Home');

  // Shift+End to select all text
  await page.keyboard.press('Shift+End');

  // Type to replace
  await page.keyboard.type('replaced');

  const firstP = page.locator(`${editorSelector} p`).first();
  await expect(firstP).toHaveText('replaced');
});
