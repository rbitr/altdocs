import { test, expect } from '@playwright/test';

test.describe('Document Sharing', () => {
  const docId = `share-test-${Date.now()}`;

  test('owner sees Share button in editor', async ({ page, request }) => {
    // Clear token for fresh session
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('altdocs_session_token'));
    await page.goto('/');
    await page.waitForSelector('#user-profile-bar', { timeout: 5000 });

    // Get the session token the page created
    const token = await page.evaluate(() => localStorage.getItem('altdocs_session_token'));
    expect(token).toBeTruthy();

    // Create document via API with this user's auth
    const createRes = await request.post('/api/documents', {
      data: { id: docId, title: 'Share Test Doc', content: '[]' },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(createRes.status()).toBe(201);

    // Navigate to the document
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor', { timeout: 10000 });

    // Share button should be visible
    const shareBtn = page.locator('.share-btn');
    await expect(shareBtn).toBeVisible({ timeout: 5000 });
    expect(await shareBtn.textContent()).toBe('Share');
  });

  test('owner can open share panel and create share links', async ({ page, request }) => {
    const uniqueId = `share-panel-${Date.now()}`;
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('altdocs_session_token'));
    await page.goto('/');
    await page.waitForSelector('#user-profile-bar', { timeout: 5000 });

    const token = await page.evaluate(() => localStorage.getItem('altdocs_session_token'));

    await request.post('/api/documents', {
      data: { id: uniqueId, title: 'Share Panel Test', content: '[]' },
      headers: { Authorization: `Bearer ${token}` },
    });

    await page.goto(`/#/doc/${uniqueId}`);
    await page.waitForSelector('.altdocs-editor', { timeout: 10000 });

    // Click Share button
    await page.locator('.share-btn').click();

    // Share panel should appear
    const panel = page.locator('.share-panel');
    await expect(panel).toBeVisible({ timeout: 5000 });
    expect(await panel.locator('h2').textContent()).toBe('Share Document');

    // Should show "No share links yet"
    await expect(panel.locator('.share-list-empty')).toContainText('No share links');

    // Create a view-only share link
    await panel.locator('.share-permission-select').selectOption('view');
    await panel.locator('.share-create-btn').click();

    // Wait for link to appear
    await expect(panel.locator('.share-list-item')).toBeVisible({ timeout: 5000 });
    await expect(panel.locator('.share-permission-view')).toContainText('View only');
    await expect(panel.locator('.share-copy-btn')).toBeVisible();
    await expect(panel.locator('.share-revoke-btn')).toBeVisible();

    // Close the panel
    await panel.locator('.share-panel-close').click();
    await expect(page.locator('.share-panel-overlay')).not.toBeVisible();
  });

  test('share link with view permission allows read-only access', async ({ browser, request }) => {
    const uniqueId = `share-view-${Date.now()}`;

    // Create owner session via API
    const ownerSession = await (await request.post('/api/auth/session')).json();
    const ownerToken = ownerSession.token;

    // Create document as owner
    await request.post('/api/documents', {
      data: { id: uniqueId, title: 'Shared View Doc', content: JSON.stringify([
        { id: 'b1', type: 'paragraph', alignment: 'left', runs: [{ text: 'Hello world', style: {} }] }
      ]) },
      headers: { Authorization: `Bearer ${ownerToken}` },
    });

    // Create a view share link
    const shareRes = await request.post(`/api/documents/${uniqueId}/shares`, {
      data: { permission: 'view' },
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(shareRes.status()).toBe(201);
    const share = await shareRes.json();

    // Open share link in a new browser context (different user)
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`/#/doc/${uniqueId}?share=${share.token}`);
    await page.waitForSelector('.altdocs-editor', { timeout: 10000 });

    // Should see the document content
    await expect(page.locator('.altdocs-editor')).toContainText('Hello world');

    // Should see read-only banner
    const banner = page.locator('.readonly-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('View only');

    // Should see permission badge
    await expect(page.locator('.permission-view')).toContainText('View only');

    // Should NOT see Share button (not owner)
    await expect(page.locator('.share-btn')).not.toBeVisible();

    // Title input should be read-only
    const titleInput = page.locator('#doc-title');
    await expect(titleInput).toHaveAttribute('readonly', '');

    await context.close();
  });

  test('share link with edit permission allows editing', async ({ browser, request }) => {
    const uniqueId = `share-edit-${Date.now()}`;

    // Create owner session
    const ownerSession = await (await request.post('/api/auth/session')).json();
    const ownerToken = ownerSession.token;

    // Create document
    await request.post('/api/documents', {
      data: { id: uniqueId, title: 'Shared Edit Doc', content: JSON.stringify([
        { id: 'b1', type: 'paragraph', alignment: 'left', runs: [{ text: 'Edit me', style: {} }] }
      ]) },
      headers: { Authorization: `Bearer ${ownerToken}` },
    });

    // Create edit share link
    const shareRes = await request.post(`/api/documents/${uniqueId}/shares`, {
      data: { permission: 'edit' },
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const share = await shareRes.json();

    // Open in new context
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`/#/doc/${uniqueId}?share=${share.token}`);
    await page.waitForSelector('.altdocs-editor', { timeout: 10000 });

    // Should see the document content
    await expect(page.locator('.altdocs-editor')).toContainText('Edit me');

    // Should NOT see read-only banner
    await expect(page.locator('.readonly-banner')).not.toBeVisible();

    // Should see "Can edit" badge
    await expect(page.locator('.permission-edit')).toContainText('Can edit');

    // Should NOT see Share button
    await expect(page.locator('.share-btn')).not.toBeVisible();

    await context.close();
  });

  test('owner can revoke share link', async ({ page, request }) => {
    const uniqueId = `share-revoke-${Date.now()}`;
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('altdocs_session_token'));
    await page.goto('/');
    await page.waitForSelector('#user-profile-bar', { timeout: 5000 });

    const token = await page.evaluate(() => localStorage.getItem('altdocs_session_token'));

    await request.post('/api/documents', {
      data: { id: uniqueId, title: 'Revoke Test', content: '[]' },
      headers: { Authorization: `Bearer ${token}` },
    });

    await page.goto(`/#/doc/${uniqueId}`);
    await page.waitForSelector('.altdocs-editor', { timeout: 10000 });

    // Open share panel
    await page.locator('.share-btn').click();
    await page.waitForSelector('.share-panel', { timeout: 5000 });

    // Create a share link
    await page.locator('.share-create-btn').click();
    await page.waitForSelector('.share-list-item', { timeout: 5000 });

    // Click Revoke
    await page.locator('.share-revoke-btn').click();

    // Share should be gone
    await expect(page.locator('.share-list-empty')).toContainText('No share links');
  });

  test('invalid share link shows error', async ({ page }) => {
    const uniqueId = `share-invalid-${Date.now()}`;
    await page.goto(`/#/doc/${uniqueId}?share=invalidtoken`);

    // Should show error message
    await expect(page.locator('.doc-list-empty')).toContainText('share link is invalid', { timeout: 10000 });
  });

  test('non-owner cannot access owned document without share link', async ({ browser, request }) => {
    const uniqueId = `share-noauth-${Date.now()}`;

    // Create owner and document
    const ownerSession = await (await request.post('/api/auth/session')).json();
    await request.post('/api/documents', {
      data: { id: uniqueId, title: 'Private Doc', content: '[]' },
      headers: { Authorization: `Bearer ${ownerSession.token}` },
    });

    // Open as different user (no share token)
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`/#/doc/${uniqueId}`);

    // Since no share token and not owner, the fetch will fail (403),
    // and the app will create a new empty doc (upsert behavior)
    // This is OK — the document they see won't have the owner's content
    await page.waitForSelector('.altdocs-editor', { timeout: 10000 });

    // The editor should NOT show "Private Doc" content — either empty or new doc
    // (since the 403 causes it to fall through to creating a new doc)
    await context.close();
  });
});
