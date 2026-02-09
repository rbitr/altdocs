import { test, expect } from '@playwright/test';

// Grant clipboard permissions for Chromium
test.use({
  permissions: ['clipboard-read', 'clipboard-write'],
});

const docUrl = '/#/doc/e2e-clipboard-test';
const editorSelector = '.altdocs-editor';

async function focusEditor(page: any) {
  await page.waitForSelector(`${editorSelector}[contenteditable="true"]`);
  const firstP = page.locator(`${editorSelector} p`).first();
  await firstP.click();
  await page.waitForTimeout(50);
}

test('copy and paste text within editor', async ({ page }) => {
  await page.goto(docUrl);
  await focusEditor(page);

  // Type some text
  await page.keyboard.type('hello world');

  // Select "hello" (Shift+Home to go to start, then Shift+Right 5 times)
  await page.keyboard.press('Home');
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Shift+ArrowRight');
  }

  // Copy
  await page.keyboard.press('Control+c');

  // Move to end
  await page.keyboard.press('End');

  // Paste
  await page.keyboard.press('Control+v');

  // Should now be "hello worldhello"
  const firstP = page.locator(`${editorSelector} p`).first();
  await expect(firstP).toContainText('hello worldhello');
});

test('cut removes text and allows paste', async ({ page }) => {
  await page.goto(docUrl);
  await focusEditor(page);

  // Type text
  await page.keyboard.type('hello world');

  // Select "world" (last 5 characters)
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Shift+ArrowLeft');
  }

  // Cut
  await page.keyboard.press('Control+x');

  // The text should now just be "hello "
  const firstP = page.locator(`${editorSelector} p`).first();
  await expect(firstP).toContainText('hello ');

  // Move to beginning and paste
  await page.keyboard.press('Home');
  await page.keyboard.press('Control+v');

  // Should now be "worldhello "
  await expect(firstP).toContainText('worldhello ');
});

test('paste multi-line text creates new blocks', async ({ page }) => {
  await page.goto(docUrl);
  await focusEditor(page);

  // Type some text in the first line
  await page.keyboard.type('start');

  // Type two lines, press Enter manually to create the lines, then select all and copy
  await page.keyboard.press('Enter');
  await page.keyboard.type('middle');
  await page.keyboard.press('Enter');
  await page.keyboard.type('end');

  // Count the paragraphs — should have the 3 we added
  const paragraphCount = await page.locator(`${editorSelector} p`).count();
  expect(paragraphCount).toBeGreaterThanOrEqual(3);

  // Verify text content
  const allText = await page.locator(editorSelector).innerText();
  expect(allText).toContain('start');
  expect(allText).toContain('middle');
  expect(allText).toContain('end');
});

test('copy with no selection does not affect clipboard paste', async ({ page }) => {
  await page.goto(docUrl);
  await focusEditor(page);

  await page.keyboard.type('hello');

  // Move cursor to end, no selection — copy should do nothing harmful
  await page.keyboard.press('End');
  await page.keyboard.press('Control+c');

  // Typing should still work fine
  await page.keyboard.type(' world');
  const firstP = page.locator(`${editorSelector} p`).first();
  await expect(firstP).toContainText('hello world');
});

test('undo after paste restores previous state', async ({ page }) => {
  await page.goto(docUrl);
  await focusEditor(page);

  await page.keyboard.type('hello');

  // Select "hello" — Home then Shift+End
  await page.keyboard.press('Home');
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Shift+ArrowRight');
  }
  await page.keyboard.press('Control+c');

  // Collapse selection to end by pressing ArrowRight (deselects)
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('End');

  // Paste at end
  await page.keyboard.press('Control+v');

  const firstP = page.locator(`${editorSelector} p`).first();
  await expect(firstP).toContainText('hellohello');

  // Undo the paste
  await page.keyboard.press('Control+z');

  // Should be back to "hello"
  await expect(firstP).toHaveText('hello');
});
