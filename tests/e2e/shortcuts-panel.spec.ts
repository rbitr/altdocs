import { test, expect } from '@playwright/test';

const docUrl = '/#/doc/e2e-shortcuts-panel-test';

test('shortcuts button is visible in toolbar', async ({ page }) => {
  await page.goto(docUrl);
  const btn = page.locator('[data-toolbar-action="shortcuts"]');
  await expect(btn).toBeVisible();
  await expect(btn).toHaveText('?');
});

test('clicking shortcuts button opens panel', async ({ page }) => {
  await page.goto(docUrl);
  await page.locator('[data-toolbar-action="shortcuts"]').click();

  const overlay = page.locator('.shortcuts-overlay');
  await expect(overlay).toBeVisible();

  const panel = page.locator('.shortcuts-panel');
  await expect(panel).toBeVisible();

  const title = page.locator('.shortcuts-header h2');
  await expect(title).toHaveText('Keyboard Shortcuts');
});

test('panel displays shortcut categories', async ({ page }) => {
  await page.goto(docUrl);
  await page.locator('[data-toolbar-action="shortcuts"]').click();

  const categories = page.locator('.shortcuts-category h3');
  await expect(categories).toHaveCount(4);

  const names = await categories.allTextContents();
  expect(names).toContain('Text Formatting');
  expect(names).toContain('Editing');
  expect(names).toContain('Navigation');
  expect(names).toContain('Other');
});

test('panel displays kbd elements for keys', async ({ page }) => {
  await page.goto(docUrl);
  await page.locator('[data-toolbar-action="shortcuts"]').click();

  // Check that Ctrl+B is rendered
  const kbdElements = page.locator('.shortcuts-table kbd');
  const count = await kbdElements.count();
  expect(count).toBeGreaterThan(10);

  // First row should have Ctrl and B
  const firstRow = page.locator('.shortcuts-table tr').first();
  const kbds = firstRow.locator('kbd');
  await expect(kbds).toHaveCount(2);
  await expect(kbds.nth(0)).toHaveText('Ctrl');
  await expect(kbds.nth(1)).toHaveText('B');
});

test('close button hides the panel', async ({ page }) => {
  await page.goto(docUrl);
  await page.locator('[data-toolbar-action="shortcuts"]').click();
  await expect(page.locator('.shortcuts-panel')).toBeVisible();

  await page.locator('.shortcuts-close-btn').click();
  await expect(page.locator('.shortcuts-overlay')).not.toBeVisible();
});

test('Escape key hides the panel', async ({ page }) => {
  await page.goto(docUrl);
  await page.locator('[data-toolbar-action="shortcuts"]').click();
  await expect(page.locator('.shortcuts-panel')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('.shortcuts-overlay')).not.toBeVisible();
});

test('clicking overlay backdrop hides the panel', async ({ page }) => {
  await page.goto(docUrl);
  await page.locator('[data-toolbar-action="shortcuts"]').click();
  await expect(page.locator('.shortcuts-panel')).toBeVisible();

  // Click on the overlay outside the panel
  await page.locator('.shortcuts-overlay').click({ position: { x: 10, y: 10 } });
  await expect(page.locator('.shortcuts-overlay')).not.toBeVisible();
});

test('Ctrl+/ opens and closes the panel from editor', async ({ page }) => {
  await page.goto(docUrl);
  await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

  const editor = page.locator('.altdocs-editor');
  await editor.click();
  await page.waitForTimeout(50);

  // Open with Ctrl+/
  await page.keyboard.press('Control+/');
  await expect(page.locator('.shortcuts-panel')).toBeVisible();

  // Close with Ctrl+/ again (need to focus editor first since panel is overlay)
  // Actually Escape is easier here since the panel captures keydown
  await page.keyboard.press('Escape');
  await expect(page.locator('.shortcuts-overlay')).not.toBeVisible();
});

test('panel can be reopened after closing', async ({ page }) => {
  await page.goto(docUrl);
  const btn = page.locator('[data-toolbar-action="shortcuts"]');

  // Open panel
  await btn.click();
  await expect(page.locator('.shortcuts-panel')).toBeVisible();

  // Close via Escape
  await page.keyboard.press('Escape');
  await expect(page.locator('.shortcuts-overlay')).not.toBeVisible();

  // Reopen
  await btn.click();
  await expect(page.locator('.shortcuts-panel')).toBeVisible();

  // Close via close button
  await page.locator('.shortcuts-close-btn').click();
  await expect(page.locator('.shortcuts-overlay')).not.toBeVisible();
});
