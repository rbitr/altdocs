import { test, expect } from '@playwright/test';

test.describe('Real-Time Collaboration', () => {
  const uniqueDocId = `collab-test-${Date.now()}`;

  test.beforeEach(async ({ request }) => {
    // Create a test document via API
    await request.post('/api/documents', {
      data: {
        id: uniqueDocId,
        title: 'Collab Test',
        content: JSON.stringify([
          {
            id: 'b1',
            type: 'paragraph',
            alignment: 'left',
            runs: [{ text: 'Start', style: {} }],
          },
        ]),
      },
    });
  });

  test('two users editing same document see each other\'s changes', async ({ browser }) => {
    // Create two separate browser contexts (separate sessions)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Both pages open the same document
      await page1.goto(`/#/doc/${uniqueDocId}`);
      await page2.goto(`/#/doc/${uniqueDocId}`);

      // Wait for editors to load
      await page1.waitForSelector('.altdocs-editor', { timeout: 10000 });
      await page2.waitForSelector('.altdocs-editor', { timeout: 10000 });

      // Wait for collaboration to connect
      await page1.waitForSelector('.collab-status-connected', { timeout: 10000 });
      await page2.waitForSelector('.collab-status-connected', { timeout: 10000 });

      // Verify both show initial text
      await expect(page1.locator('.altdocs-editor')).toContainText('Start');
      await expect(page2.locator('.altdocs-editor')).toContainText('Start');

      // Page 1: click at end of text and type
      const editor1 = page1.locator('.altdocs-editor');
      await editor1.click();
      await page1.waitForTimeout(50);

      // Move to end of text
      await page1.keyboard.press('End');
      await page1.waitForTimeout(50);

      // Type text on page 1
      await page1.keyboard.type(' Hello');
      await page1.waitForTimeout(500); // Wait for WS propagation

      // Page 2 should see the text from page 1
      await expect(page2.locator('.altdocs-editor')).toContainText('Hello', { timeout: 5000 });

      // Page 2: type text
      const editor2 = page2.locator('.altdocs-editor');
      await editor2.click();
      await page2.waitForTimeout(50);
      await page2.keyboard.press('End');
      await page2.waitForTimeout(50);
      await page2.keyboard.type(' World');
      await page2.waitForTimeout(500);

      // Page 1 should see the text from page 2
      await expect(page1.locator('.altdocs-editor')).toContainText('World', { timeout: 5000 });

      // Both should have the complete text
      const text1 = await editor1.textContent();
      const text2 = await editor2.textContent();
      expect(text1).toContain('Start');
      expect(text1).toContain('Hello');
      expect(text1).toContain('World');
      // Both editors should converge to the same text
      expect(text1).toBe(text2);
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('shows collaboration status indicator', async ({ page }) => {
    await page.goto(`/#/doc/${uniqueDocId}`);
    await page.waitForSelector('.altdocs-editor', { timeout: 10000 });

    // Should show connected status
    const status = page.locator('.collab-status-connected');
    await expect(status).toBeVisible({ timeout: 10000 });
    await expect(status).toHaveText('Live');
  });

  test('shows remote user presence when second user joins', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Page 1 opens the document first
      await page1.goto(`/#/doc/${uniqueDocId}`);
      await page1.waitForSelector('.collab-status-connected', { timeout: 10000 });

      // Page 2 joins
      await page2.goto(`/#/doc/${uniqueDocId}`);
      await page2.waitForSelector('.collab-status-connected', { timeout: 10000 });

      // Page 1 should see a remote user dot
      await page1.waitForTimeout(500);
      const userDots = page1.locator('.collab-user-dot');
      await expect(userDots.first()).toBeVisible({ timeout: 5000 });
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('shows remote cursor when another user is editing', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Both pages open the same document
      await page1.goto(`/#/doc/${uniqueDocId}`);
      await page2.goto(`/#/doc/${uniqueDocId}`);

      // Wait for both editors and collaboration to connect
      await page1.waitForSelector('.collab-status-connected', { timeout: 10000 });
      await page2.waitForSelector('.collab-status-connected', { timeout: 10000 });

      // Page 2: click into the editor to send a cursor position
      const editor2 = page2.locator('.altdocs-editor');
      await editor2.click();
      await page2.waitForTimeout(200);

      // Page 1 should see a remote cursor overlay
      const remoteCaret = page1.locator('.remote-cursor-caret');
      await expect(remoteCaret.first()).toBeVisible({ timeout: 5000 });

      // Remote cursor label should show the user's display name
      const remoteLabel = page1.locator('.remote-cursor-label');
      await expect(remoteLabel.first()).toBeVisible({ timeout: 5000 });
      const labelText = await remoteLabel.first().textContent();
      expect(labelText).toBeTruthy();
      expect(labelText!.length).toBeGreaterThan(0);
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('remote cursor disappears when user leaves', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Both pages open the same document
      await page1.goto(`/#/doc/${uniqueDocId}`);
      await page2.goto(`/#/doc/${uniqueDocId}`);

      await page1.waitForSelector('.collab-status-connected', { timeout: 10000 });
      await page2.waitForSelector('.collab-status-connected', { timeout: 10000 });

      // Page 2: click to send cursor position
      await page2.locator('.altdocs-editor').click();
      await page2.waitForTimeout(200);

      // Verify remote cursor appears on page 1
      await expect(page1.locator('.remote-cursor-caret').first()).toBeVisible({ timeout: 5000 });

      // Page 2 navigates away — should trigger disconnect
      await page2.goto('/#/');
      await page2.waitForTimeout(500);

      // Page 1 should no longer show the remote cursor
      await expect(page1.locator('.remote-cursor-caret')).toHaveCount(0, { timeout: 5000 });
    } finally {
      await context1.close();
      await context2.close();
    }
  });
});
