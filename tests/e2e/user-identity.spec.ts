import { test, expect } from '@playwright/test';

test.describe('Anonymous Session', () => {
  test('creates a session and shows user profile bar on document list', async ({ page }) => {
    // Clear any stored token
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('altdocs_session_token'));

    // Navigate fresh
    await page.goto('/');
    await page.waitForSelector('.doc-list-header');

    // User profile bar should appear
    const profileBar = page.locator('#user-profile-bar');
    await expect(profileBar).toBeVisible({ timeout: 5000 });

    // Should have a color dot
    const colorDot = profileBar.locator('.user-color-dot');
    await expect(colorDot).toBeVisible();

    // Should have a display name starting with "Anonymous"
    const displayName = profileBar.locator('.user-display-name');
    await expect(displayName).toBeVisible();
    const name = await displayName.textContent();
    expect(name).toMatch(/^Anonymous /);
  });

  test('persists session across page reloads', async ({ page }) => {
    // Clear token and load to create fresh session
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('altdocs_session_token'));
    await page.goto('/');
    await page.waitForSelector('#user-profile-bar');

    // Get the current display name
    const name1 = await page.locator('.user-display-name').textContent();

    // Reload the page
    await page.reload();
    await page.waitForSelector('#user-profile-bar');

    // Same display name should persist
    const name2 = await page.locator('.user-display-name').textContent();
    expect(name2).toBe(name1);
  });

  test('stores session token in localStorage', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('altdocs_session_token'));
    await page.goto('/');
    await page.waitForSelector('#user-profile-bar');

    const token = await page.evaluate(() => localStorage.getItem('altdocs_session_token'));
    expect(token).toBeTruthy();
    expect(token!.length).toBe(64);
  });

  test('shows user profile bar on editor view', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('altdocs_session_token'));
    await page.goto('/');
    await page.waitForSelector('#user-profile-bar');

    // Navigate to a document
    const docId = `user-test-${Date.now()}`;
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    // Profile bar should still be visible
    await expect(page.locator('#user-profile-bar')).toBeVisible();
  });
});

test.describe('Display Name Editing', () => {
  test('clicking display name opens edit input', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('altdocs_session_token'));
    await page.goto('/');
    await page.waitForSelector('#user-profile-bar');

    // Click on the display name
    await page.locator('.user-display-name').click();

    // Should show an input field
    const input = page.locator('.user-name-input');
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
  });

  test('editing display name and pressing Enter saves it', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('altdocs_session_token'));
    await page.goto('/');
    await page.waitForSelector('#user-profile-bar');

    // Click to edit
    await page.locator('.user-display-name').click();
    const input = page.locator('.user-name-input');
    await expect(input).toBeVisible();

    // Clear and type a new name
    await input.fill('Test User');
    await input.press('Enter');

    // Input should be replaced with the span showing the new name
    await expect(page.locator('.user-display-name')).toBeVisible();
    await expect(page.locator('.user-display-name')).toHaveText('Test User');

    // Toast should show success
    await expect(page.locator('.toast-success')).toBeVisible({ timeout: 3000 });
  });

  test('edited name persists after page reload', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('altdocs_session_token'));
    await page.goto('/');
    await page.waitForSelector('#user-profile-bar');

    // Edit name
    await page.locator('.user-display-name').click();
    await page.locator('.user-name-input').fill('Persistent Name');
    await page.locator('.user-name-input').press('Enter');
    await expect(page.locator('.user-display-name')).toHaveText('Persistent Name');

    // Reload
    await page.reload();
    await page.waitForSelector('#user-profile-bar');

    // Name should still be "Persistent Name"
    await expect(page.locator('.user-display-name')).toHaveText('Persistent Name');
  });

  test('pressing Escape cancels name editing', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('altdocs_session_token'));
    await page.goto('/');
    await page.waitForSelector('#user-profile-bar');

    const originalName = await page.locator('.user-display-name').textContent();

    // Click to edit
    await page.locator('.user-display-name').click();
    const input = page.locator('.user-name-input');
    await input.fill('Changed Name');
    await input.press('Escape');

    // Should revert to original name
    await expect(page.locator('.user-display-name')).toHaveText(originalName!);
  });
});
