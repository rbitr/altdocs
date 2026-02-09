import { test, expect } from '@playwright/test';

function uniqueId() {
  return `vh-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

async function createDocViaApi(page: any, id: string, title: string, content = '[]') {
  await page.request.post('http://localhost:3000/api/documents', {
    data: { id, title, content },
  });
}

async function updateDocViaApi(page: any, id: string, title: string, content: string) {
  await page.request.put(`http://localhost:3000/api/documents/${id}`, {
    data: { title, content },
  });
}

test.describe('Version History Panel', () => {
  test('version history button is visible in toolbar', async ({ page }) => {
    const docId = uniqueId();
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    const historyBtn = page.locator('[data-toolbar-action="version-history"]');
    await expect(historyBtn).toBeVisible();
  });

  test('clicking version history opens the panel', async ({ page }) => {
    const docId = uniqueId();
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    await page.locator('[data-toolbar-action="version-history"]').click();
    await expect(page.locator('.version-overlay')).toBeVisible();
    await expect(page.locator('.version-panel-header h2')).toHaveText('Version History');
  });

  test('shows empty message when no versions exist', async ({ page }) => {
    // Create a doc with real content so the initial editor save doesn't change anything
    const docId = uniqueId();
    const content = JSON.stringify([{
      id: 'b1', type: 'paragraph', alignment: 'left',
      runs: [{ text: '', style: {} }],
    }]);
    await createDocViaApi(page, docId, 'Untitled', content);
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');
    // Wait for initial save to complete
    await page.waitForTimeout(500);

    await page.locator('[data-toolbar-action="version-history"]').click();
    await expect(page.locator('.version-panel-empty')).toBeVisible();
    await expect(page.locator('.version-panel-empty')).toContainText('No version history yet');
  });

  test('shows version list after saves', async ({ page }) => {
    const docId = uniqueId();
    const content1 = JSON.stringify([{
      id: 'b1', type: 'paragraph', alignment: 'left',
      runs: [{ text: 'First version', style: {} }],
    }]);
    const content2 = JSON.stringify([{
      id: 'b1', type: 'paragraph', alignment: 'left',
      runs: [{ text: 'Second version', style: {} }],
    }]);

    await createDocViaApi(page, docId, 'Version Doc');
    await updateDocViaApi(page, docId, 'Version Doc V1', content1);
    await updateDocViaApi(page, docId, 'Version Doc V2', content2);

    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    await page.locator('[data-toolbar-action="version-history"]').click();
    await page.waitForSelector('.version-list');

    const items = page.locator('.version-item');
    await expect(items).toHaveCount(2);

    // Versions listed newest first
    await expect(items.nth(0).locator('.version-item-label')).toHaveText('Version 2');
    await expect(items.nth(1).locator('.version-item-label')).toHaveText('Version 1');
  });

  test('close button closes the panel', async ({ page }) => {
    const docId = uniqueId();
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    await page.locator('[data-toolbar-action="version-history"]').click();
    await expect(page.locator('.version-overlay')).toBeVisible();

    await page.locator('.version-panel-close').click();
    await expect(page.locator('.version-overlay')).toHaveCount(0);
  });

  test('clicking overlay background closes the panel', async ({ page }) => {
    const docId = uniqueId();
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    await page.locator('[data-toolbar-action="version-history"]').click();
    await expect(page.locator('.version-overlay')).toBeVisible();

    // Click on the overlay background (outside the panel)
    await page.locator('.version-overlay').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('.version-overlay')).toHaveCount(0);
  });

  test('restoring a version updates the editor content', async ({ page }) => {
    const docId = uniqueId();
    const content1 = JSON.stringify([{
      id: 'b1', type: 'paragraph', alignment: 'left',
      runs: [{ text: 'Original content', style: {} }],
    }]);
    const content2 = JSON.stringify([{
      id: 'b1', type: 'paragraph', alignment: 'left',
      runs: [{ text: 'Updated content', style: {} }],
    }]);

    await createDocViaApi(page, docId, 'Restore Test');
    await updateDocViaApi(page, docId, 'Restore V1', content1);
    await updateDocViaApi(page, docId, 'Restore V2', content2);

    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    // Editor should show latest content
    await expect(page.locator('.altdocs-editor')).toContainText('Updated content');

    // Open version history and restore version 1
    await page.locator('[data-toolbar-action="version-history"]').click();
    await page.waitForSelector('.version-list');

    // Click restore on version 1 (second item in the list)
    await page.locator('.version-item[data-version="1"] .version-restore-btn').click();

    // Panel should close
    await expect(page.locator('.version-overlay')).toHaveCount(0);

    // Editor should now show restored content
    await expect(page.locator('.altdocs-editor')).toContainText('Original content');

    // Title should be updated
    await expect(page.locator('.doc-title-input')).toHaveValue('Restore V1');
  });

  test('restore creates a new version in history', async ({ page }) => {
    const docId = uniqueId();
    const content1 = JSON.stringify([{
      id: 'b1', type: 'paragraph', alignment: 'left',
      runs: [{ text: 'V1 text', style: {} }],
    }]);
    const content2 = JSON.stringify([{
      id: 'b1', type: 'paragraph', alignment: 'left',
      runs: [{ text: 'V2 text', style: {} }],
    }]);

    await createDocViaApi(page, docId, 'Restore History Test');
    await updateDocViaApi(page, docId, 'V1 Title', content1);
    await updateDocViaApi(page, docId, 'V2 Title', content2);

    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    // Restore version 1
    await page.locator('[data-toolbar-action="version-history"]').click();
    await page.waitForSelector('.version-list');
    await page.locator('.version-item[data-version="1"] .version-restore-btn').click();
    await expect(page.locator('.version-overlay')).toHaveCount(0);

    // Open version history again — should have 3 versions now (restore creates a new one)
    await page.locator('[data-toolbar-action="version-history"]').click();
    await page.waitForSelector('.version-list');

    const items = page.locator('.version-item');
    await expect(items).toHaveCount(3);
    await expect(items.nth(0).locator('.version-item-label')).toHaveText('Version 3');
  });
});
