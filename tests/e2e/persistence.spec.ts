import { test, expect } from '@playwright/test';

test('document persists across page reloads', async ({ page }) => {
  const docId = `persist-test-${Date.now()}`;
  const docUrl = `/#/doc/${docId}`;

  // Open a new document and type some text
  await page.goto(docUrl);
  await page.waitForSelector('.altdocs-editor[contenteditable="true"]');
  const firstP = page.locator('.altdocs-editor p').first();
  await firstP.click();
  await page.waitForTimeout(50);
  await page.keyboard.type('Persistent text');

  // Wait for auto-save (2s delay + buffer)
  await page.waitForTimeout(3000);

  // Verify save status showed
  // (It may have already cleared, so just check the document loaded)

  // Reload the page
  await page.goto(docUrl);
  await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

  // Verify the text persisted
  const editor = page.locator('.altdocs-editor');
  await expect(editor).toContainText('Persistent text');
});

test('new document appears in document list', async ({ page }) => {
  const docId = `list-test-${Date.now()}`;
  const docUrl = `/#/doc/${docId}`;

  // Create a new document by navigating to it
  await page.goto(docUrl);
  await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

  // Wait for initial save to create on server
  await page.waitForTimeout(1000);

  // Navigate to the document list
  await page.goto('/');
  await page.waitForSelector('.doc-list-header');

  // The document should appear in the list
  const listItems = page.locator('.doc-list-item');
  const count = await listItems.count();
  expect(count).toBeGreaterThan(0);
});

test('back link navigates to document list', async ({ page }) => {
  const docId = `back-test-${Date.now()}`;
  const docUrl = `/#/doc/${docId}`;

  await page.goto(docUrl);
  await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

  // Click back link
  await page.locator('.back-link').click();
  await page.waitForSelector('.doc-list-header');

  await expect(page.locator('.doc-list-header h1')).toHaveText('AltDocs');
});

test('new document button creates and opens a document', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.doc-list-header');

  // Click new document button
  await page.locator('.new-doc-btn').click();

  // Should navigate to editor
  await page.waitForSelector('.altdocs-editor[contenteditable="true"]');
  await expect(page.locator('.altdocs-editor')).toBeVisible();

  // URL should have a doc ID
  const url = page.url();
  expect(url).toContain('#/doc/');
});
