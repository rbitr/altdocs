import { test, expect } from '@playwright/test';

const docUrl = '/#/doc/e2e-responsive-test';

test.describe('desktop viewport (1280px)', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('toolbar menu toggle is hidden on desktop', async ({ page }) => {
    await page.goto(docUrl);
    await page.waitForSelector('.altdocs-toolbar');
    const toggle = page.locator('.toolbar-menu-toggle');
    await expect(toggle).toBeHidden();
  });

  test('toolbar groups are visible on desktop', async ({ page }) => {
    await page.goto(docUrl);
    await page.waitForSelector('.altdocs-toolbar');
    const groups = page.locator('.toolbar-group');
    const count = await groups.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(groups.nth(i)).toBeVisible();
    }
  });
});

test.describe('tablet viewport (900px)', () => {
  test.use({ viewport: { width: 900, height: 600 } });

  test('app uses full width on tablet', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.doc-list-header');
    const app = page.locator('#app');
    const box = await app.boundingBox();
    expect(box).toBeTruthy();
    // App should fill most of the viewport width (no 800px max-width cap)
    expect(box!.width).toBeGreaterThan(800);
  });
});

test.describe('mobile viewport (375px)', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('toolbar menu toggle is visible on mobile', async ({ page }) => {
    await page.goto(docUrl);
    await page.waitForSelector('.altdocs-toolbar');
    const toggle = page.locator('.toolbar-menu-toggle');
    await expect(toggle).toBeVisible();
  });

  test('toolbar groups are hidden by default on mobile', async ({ page }) => {
    await page.goto(docUrl);
    await page.waitForSelector('.altdocs-toolbar');
    const firstGroup = page.locator('.toolbar-group').first();
    await expect(firstGroup).toBeHidden();
  });

  test('clicking menu toggle expands toolbar on mobile', async ({ page }) => {
    await page.goto(docUrl);
    await page.waitForSelector('.altdocs-toolbar');
    const toggle = page.locator('.toolbar-menu-toggle');
    await toggle.click();
    // After expanding, toolbar groups should be visible
    const firstGroup = page.locator('.toolbar-group').first();
    await expect(firstGroup).toBeVisible();
    // Toggle aria-expanded should be true
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  test('clicking menu toggle again collapses toolbar on mobile', async ({ page }) => {
    await page.goto(docUrl);
    await page.waitForSelector('.altdocs-toolbar');
    const toggle = page.locator('.toolbar-menu-toggle');
    // Expand
    await toggle.click();
    await expect(page.locator('.toolbar-group').first()).toBeVisible();
    // Collapse
    await toggle.click();
    await expect(page.locator('.toolbar-group').first()).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('toolbar buttons have touch-friendly size on mobile', async ({ page }) => {
    await page.goto(docUrl);
    await page.waitForSelector('.altdocs-toolbar');
    // Expand toolbar first
    await page.locator('.toolbar-menu-toggle').click();
    const boldBtn = page.locator('[data-toolbar-action="bold"]');
    await expect(boldBtn).toBeVisible();
    const box = await boldBtn.boundingBox();
    expect(box).toBeTruthy();
    // Touch target should be at least 44px
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  });

  test('document list items stack vertically on mobile', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.doc-list-header');
    // Create a document first so we have a list item
    await page.locator('.new-doc-btn').click();
    await page.waitForSelector('.altdocs-editor');
    // Go back to list
    await page.goto('/');
    await page.waitForSelector('.doc-list-header');
    const listItem = page.locator('.doc-list-item').first();
    // Check if list item exists (there should be at least the doc we just created)
    const count = await page.locator('.doc-list-item').count();
    if (count > 0) {
      await expect(listItem).toBeVisible();
      // On mobile, the actions should be below the title area
      const titleArea = listItem.locator('.doc-item-title-area');
      const actions = listItem.locator('.doc-item-actions');
      const titleBox = await titleArea.boundingBox();
      const actionsBox = await actions.boundingBox();
      if (titleBox && actionsBox) {
        // Actions should be below the title area (stacked vertically)
        expect(actionsBox.y).toBeGreaterThan(titleBox.y);
      }
    }
  });

  test('new document button has touch-friendly size on mobile', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.doc-list-header');
    const btn = page.locator('.new-doc-btn');
    const box = await btn.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});
