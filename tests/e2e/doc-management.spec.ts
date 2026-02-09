import { test, expect } from '@playwright/test';

// Helper: create a document via API and return its ID
async function createDoc(page: ReturnType<typeof test.info>['_test'] extends never ? never : any, title: string, content = '[]'): Promise<string> {
  const id = `mgmt-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await page.request.post('http://localhost:3000/api/documents', {
    data: { id, title, content },
  });
  return id;
}

test.describe('Document Title Editing', () => {
  test('title input is shown in editor view', async ({ page }) => {
    const docId = `title-test-${Date.now()}`;
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    const titleInput = page.locator('.doc-title-input');
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toHaveAttribute('placeholder', 'Untitled');
  });

  test('editing title saves it to the server', async ({ page }) => {
    const docId = `title-save-${Date.now()}`;
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    // Type a title
    const titleInput = page.locator('.doc-title-input');
    await titleInput.click();
    await titleInput.fill('My Custom Title');

    // Wait for debounced title save (500ms + buffer)
    await page.waitForTimeout(1500);

    // Navigate to doc list and verify title is shown
    await page.goto('/');
    await page.waitForSelector('.doc-list-header');

    const docLinks = page.locator('.doc-list-item a');
    const titles: string[] = [];
    const count = await docLinks.count();
    for (let i = 0; i < count; i++) {
      titles.push(await docLinks.nth(i).textContent() || '');
    }
    expect(titles).toContain('My Custom Title');
  });

  test('title persists across page reloads', async ({ page }) => {
    const docId = `title-persist-${Date.now()}`;
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    const titleInput = page.locator('.doc-title-input');
    await titleInput.fill('Persistent Title');
    await page.waitForTimeout(1500);

    // Reload
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    await expect(page.locator('.doc-title-input')).toHaveValue('Persistent Title');
  });
});

test.describe('Document Delete', () => {
  test('delete button removes document from list', async ({ page }) => {
    const docId = await createDoc(page, 'To Be Deleted');

    await page.goto('/');
    await page.waitForSelector('.doc-list-header');

    // Find the doc and its delete button
    const listItem = page.locator('.doc-list-item', { has: page.locator(`a[href="#/doc/${docId}"]`) });
    await expect(listItem).toBeVisible();

    // Accept the confirm dialog
    page.on('dialog', (dialog) => dialog.accept());

    // Click delete
    await listItem.locator('.doc-action-btn-danger').click();

    // Wait for list to refresh
    await page.waitForTimeout(500);

    // Document should be gone
    const deletedItem = page.locator('.doc-list-item', { has: page.locator(`a[href="#/doc/${docId}"]`) });
    await expect(deletedItem).toHaveCount(0);
  });

  test('cancel delete keeps document in list', async ({ page }) => {
    const docId = await createDoc(page, 'Keep This');

    await page.goto('/');
    await page.waitForSelector('.doc-list-header');

    const listItem = page.locator('.doc-list-item', { has: page.locator(`a[href="#/doc/${docId}"]`) });
    await expect(listItem).toBeVisible();

    // Dismiss the confirm dialog
    page.on('dialog', (dialog) => dialog.dismiss());

    await listItem.locator('.doc-action-btn-danger').click();
    await page.waitForTimeout(500);

    // Document should still be there
    await expect(listItem).toBeVisible();
  });
});

test.describe('Document Duplicate', () => {
  test('duplicate creates a copy of the document', async ({ page }) => {
    const suffix = Date.now().toString(36);
    const title = `OrigDoc-${suffix}`;
    const content = JSON.stringify([{
      id: 'b1',
      type: 'paragraph',
      alignment: 'left',
      runs: [{ text: 'Original content', style: {} }],
    }]);
    const docId = await createDoc(page, title, content);

    await page.goto('/');
    await page.waitForSelector('.doc-list-header');

    const listItem = page.locator('.doc-list-item', { has: page.locator(`a[href="#/doc/${docId}"]`) });
    await expect(listItem).toBeVisible();

    // Click duplicate
    await listItem.locator('.doc-action-btn', { hasText: 'Duplicate' }).click();

    // Wait for list refresh
    await page.waitForTimeout(500);

    // A new document with "(Copy)" in the title should appear
    const copyItem = page.locator('.doc-list-item a', { hasText: `${title} (Copy)` });
    await expect(copyItem).toBeVisible();
  });

  test('duplicated document has the same content', async ({ page }) => {
    const suffix = Date.now().toString(36);
    const title = `SrcDoc-${suffix}`;
    const content = JSON.stringify([{
      id: 'b1',
      type: 'paragraph',
      alignment: 'left',
      runs: [{ text: 'Duplicated content here', style: {} }],
    }]);
    const docId = await createDoc(page, title, content);

    await page.goto('/');
    await page.waitForSelector('.doc-list-header');

    const listItem = page.locator('.doc-list-item', { has: page.locator(`a[href="#/doc/${docId}"]`) });

    // Click duplicate
    await listItem.locator('.doc-action-btn', { hasText: 'Duplicate' }).click();
    await page.waitForTimeout(500);

    // Navigate to the duplicated document
    const copyLink = page.locator('.doc-list-item a', { hasText: `${title} (Copy)` });
    await copyLink.click();
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    // Verify the content was copied
    const editor = page.locator('.altdocs-editor');
    await expect(editor).toContainText('Duplicated content here');
  });
});

test.describe('Document List Actions', () => {
  test('untitled documents show italic styling', async ({ page }) => {
    await createDoc(page, 'Untitled');

    await page.goto('/');
    await page.waitForSelector('.doc-list-header');

    const untitledLink = page.locator('.doc-title-untitled');
    const count = await untitledLink.count();
    expect(count).toBeGreaterThan(0);
  });

  test('action buttons are visible on document list items', async ({ page }) => {
    await createDoc(page, 'Action Test');

    await page.goto('/');
    await page.waitForSelector('.doc-list-header');

    const listItem = page.locator('.doc-list-item').first();
    await expect(listItem.locator('.doc-action-btn', { hasText: 'Duplicate' })).toBeVisible();
    await expect(listItem.locator('.doc-action-btn', { hasText: 'Delete' })).toBeVisible();
  });
});
