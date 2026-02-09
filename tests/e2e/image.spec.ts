import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// Helper: create a document via API and return its ID
async function createDocWithContent(
  page: any,
  title: string,
  blocks: Array<{
    id: string;
    type: string;
    alignment: string;
    imageUrl?: string;
    runs: Array<{ text: string; style: Record<string, unknown> }>;
  }>
): Promise<string> {
  const id = `img-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await page.request.post('http://localhost:3000/api/documents', {
    data: { id, title, content: JSON.stringify(blocks) },
  });
  return id;
}

test.describe('Image Block Rendering', () => {
  test('renders image block with src when imageUrl is set', async ({ page }) => {
    const blocks = [
      { id: 'b1', type: 'paragraph', alignment: 'left', runs: [{ text: 'Before image', style: {} }] },
      { id: 'b2', type: 'image', alignment: 'left', imageUrl: '/uploads/test-image.png', runs: [{ text: '', style: {} }] },
      { id: 'b3', type: 'paragraph', alignment: 'left', runs: [{ text: 'After image', style: {} }] },
    ];
    const title = `Image Render ${Date.now()}`;
    const docId = await createDocWithContent(page, title, blocks);
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    const editor = page.locator('.altdocs-editor');

    // Should render a figure.image-block element
    const figure = editor.locator('figure.image-block');
    await expect(figure).toBeVisible();

    // Should contain an img element with the correct src
    const img = figure.locator('img');
    await expect(img).toBeVisible();
    const src = await img.getAttribute('src');
    expect(src).toBe('/uploads/test-image.png');

    // Surrounding text should be present
    await expect(editor).toContainText('Before image');
    await expect(editor).toContainText('After image');
  });

  test('renders placeholder when imageUrl is not set', async ({ page }) => {
    const blocks = [
      { id: 'b1', type: 'image', alignment: 'left', runs: [{ text: '', style: {} }] },
    ];
    const title = `Image Placeholder ${Date.now()}`;
    const docId = await createDocWithContent(page, title, blocks);
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    const editor = page.locator('.altdocs-editor');

    // Should have a figure element
    const figure = editor.locator('figure.image-block');
    await expect(figure).toBeVisible();

    // Should show placeholder text
    const placeholder = figure.locator('.image-placeholder');
    await expect(placeholder).toBeVisible();
    await expect(placeholder).toContainText('Image loading');
  });
});

test.describe('Image Block Keyboard Behavior', () => {
  test('text input is blocked on image blocks', async ({ page }) => {
    const blocks = [
      { id: 'b1', type: 'paragraph', alignment: 'left', runs: [{ text: 'Above', style: {} }] },
      { id: 'b2', type: 'image', alignment: 'left', imageUrl: '/uploads/test.png', runs: [{ text: '', style: {} }] },
      { id: 'b3', type: 'paragraph', alignment: 'left', runs: [{ text: '', style: {} }] },
    ];
    const title = `Image No Type ${Date.now()}`;
    const docId = await createDocWithContent(page, title, blocks);
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    const editor = page.locator('.altdocs-editor');

    // Navigate to image block using arrow keys from the paragraph above
    const firstP = editor.locator('p').first();
    await firstP.click();
    await page.waitForTimeout(50);
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(50);

    // Try typing — should not insert text into the image block
    await page.keyboard.type('abc');
    await page.waitForTimeout(100);

    // Image block should still be present and unchanged
    const figure = editor.locator('figure.image-block');
    await expect(figure).toBeVisible();
    // The image block should not contain typed text
    const figureText = await figure.textContent();
    expect(figureText).not.toContain('abc');
  });

  test('Enter on image block creates a new paragraph after it', async ({ page }) => {
    const blocks = [
      { id: 'b1', type: 'paragraph', alignment: 'left', runs: [{ text: 'Above', style: {} }] },
      { id: 'b2', type: 'image', alignment: 'left', imageUrl: '/uploads/test.png', runs: [{ text: '', style: {} }] },
    ];
    const title = `Image Enter ${Date.now()}`;
    const docId = await createDocWithContent(page, title, blocks);
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    const editor = page.locator('.altdocs-editor');

    // Navigate to image block via arrow key from paragraph above
    const firstP = editor.locator('p').first();
    await firstP.click();
    await page.waitForTimeout(50);
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(50);

    // Press Enter to create a new paragraph after the image
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);

    // Should now have a paragraph after the image block
    // Type in the new paragraph to confirm cursor is there
    await page.keyboard.type('new text');
    await page.waitForTimeout(100);

    await expect(editor).toContainText('new text');
    // Image should still be present
    const figure = editor.locator('figure.image-block');
    await expect(figure).toBeVisible();
  });

  test('Backspace on image block deletes it', async ({ page }) => {
    const blocks = [
      { id: 'b1', type: 'paragraph', alignment: 'left', runs: [{ text: 'Before', style: {} }] },
      { id: 'b2', type: 'image', alignment: 'left', imageUrl: '/uploads/test.png', runs: [{ text: '', style: {} }] },
      { id: 'b3', type: 'paragraph', alignment: 'left', runs: [{ text: 'After', style: {} }] },
    ];
    const title = `Image Backspace ${Date.now()}`;
    const docId = await createDocWithContent(page, title, blocks);
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    const editor = page.locator('.altdocs-editor');

    // Confirm image is visible
    const figure = editor.locator('figure.image-block');
    await expect(figure).toBeVisible();

    // Navigate to image block using arrow keys from the paragraph above
    const firstP = editor.locator('p').first();
    await firstP.click();
    await page.waitForTimeout(50);
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(50);

    // Press Backspace to delete the image
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(100);

    // Image should be removed
    await expect(figure).not.toBeVisible();

    // Surrounding text should remain
    await expect(editor).toContainText('Before');
    await expect(editor).toContainText('After');
  });

  test('Backspace at start of paragraph after image deletes the image', async ({ page }) => {
    const blocks = [
      { id: 'b1', type: 'image', alignment: 'left', imageUrl: '/uploads/test.png', runs: [{ text: '', style: {} }] },
      { id: 'b2', type: 'paragraph', alignment: 'left', runs: [{ text: 'After', style: {} }] },
    ];
    const title = `Image Backspace After ${Date.now()}`;
    const docId = await createDocWithContent(page, title, blocks);
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    const editor = page.locator('.altdocs-editor');

    // Click on the "After" paragraph
    const afterP = editor.locator('p');
    await afterP.click();
    await page.waitForTimeout(50);

    // Move cursor to start of paragraph
    await page.keyboard.press('Home');
    await page.waitForTimeout(50);

    // Press Backspace — should delete the image block above
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(100);

    // Image should be removed
    const figure = editor.locator('figure.image-block');
    await expect(figure).not.toBeVisible();

    // Text should remain
    await expect(editor).toContainText('After');
  });
});

test.describe('Image Toolbar Button', () => {
  test('toolbar has insert-image button', async ({ page }) => {
    const docId = `img-toolbar-${Date.now()}`;
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    const btn = page.locator('[data-toolbar-action="insert-image"]');
    await expect(btn).toBeVisible();
  });
});

test.describe('Image Upload via File Chooser', () => {
  test('clicking insert-image button and selecting a file creates an image block', async ({ page }) => {
    const docId = `img-upload-${Date.now()}`;
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    const editor = page.locator('.altdocs-editor');
    await editor.click();
    await page.waitForTimeout(50);
    await page.keyboard.type('before image');

    // Create a small test PNG file (1x1 pixel)
    const testImagePath = path.join('/tmp', `test-image-${Date.now()}.png`);
    // Minimal valid PNG (1x1 white pixel)
    const pngData = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      'base64'
    );
    fs.writeFileSync(testImagePath, pngData);

    // Listen for file chooser before clicking the button
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.locator('[data-toolbar-action="insert-image"]').click(),
    ]);

    // Select the test file
    await fileChooser.setFiles(testImagePath);

    // Wait for upload to complete and image to render
    await page.waitForTimeout(2000);

    // Should have an image block with a figure element
    const figure = editor.locator('figure.image-block');
    await expect(figure).toBeVisible();

    // The image should have a src pointing to an uploaded file
    const img = figure.locator('img');
    await expect(img).toBeVisible();
    const src = await img.getAttribute('src');
    expect(src).toMatch(/^\/uploads\/.+\.png$/);

    // Clean up temp file
    fs.unlinkSync(testImagePath);
  });

  test('uploaded image persists after reload', async ({ page }) => {
    const docId = `img-persist-${Date.now()}`;
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    const editor = page.locator('.altdocs-editor');
    await editor.click();
    await page.waitForTimeout(50);
    await page.keyboard.type('persistent text');

    // Create a small test PNG file
    const testImagePath = path.join('/tmp', `test-persist-${Date.now()}.png`);
    const pngData = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      'base64'
    );
    fs.writeFileSync(testImagePath, pngData);

    // Upload an image
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.locator('[data-toolbar-action="insert-image"]').click(),
    ]);
    await fileChooser.setFiles(testImagePath);
    await page.waitForTimeout(2000);

    // Verify image appeared
    const figure = editor.locator('figure.image-block');
    await expect(figure).toBeVisible();
    const img = figure.locator('img');
    const originalSrc = await img.getAttribute('src');

    // Wait for auto-save (2s debounce + buffer)
    await page.waitForTimeout(3000);

    // Reload the page
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    // Image should persist
    const reloadedFigure = page.locator('.altdocs-editor figure.image-block');
    await expect(reloadedFigure).toBeVisible();
    const reloadedImg = reloadedFigure.locator('img');
    await expect(reloadedImg).toBeVisible();
    const reloadedSrc = await reloadedImg.getAttribute('src');
    expect(reloadedSrc).toBe(originalSrc);

    // Text should persist too
    await expect(page.locator('.altdocs-editor')).toContainText('persistent text');

    // Clean up temp file
    fs.unlinkSync(testImagePath);
  });
});

test.describe('Image Block with Mixed Content', () => {
  test('image block renders correctly between different block types', async ({ page }) => {
    const blocks = [
      { id: 'b1', type: 'heading1', alignment: 'left', runs: [{ text: 'Title', style: {} }] },
      { id: 'b2', type: 'image', alignment: 'left', imageUrl: '/uploads/test.png', runs: [{ text: '', style: {} }] },
      { id: 'b3', type: 'bullet-list-item', alignment: 'left', runs: [{ text: 'List item', style: {} }] },
    ];
    const title = `Image Mixed ${Date.now()}`;
    const docId = await createDocWithContent(page, title, blocks);
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    const editor = page.locator('.altdocs-editor');

    // All block types should render
    await expect(editor.locator('h1')).toContainText('Title');
    await expect(editor.locator('figure.image-block')).toBeVisible();
    await expect(editor).toContainText('List item');
  });

  test('multiple image blocks render independently', async ({ page }) => {
    const blocks = [
      { id: 'b1', type: 'image', alignment: 'left', imageUrl: '/uploads/img1.png', runs: [{ text: '', style: {} }] },
      { id: 'b2', type: 'paragraph', alignment: 'left', runs: [{ text: 'Between', style: {} }] },
      { id: 'b3', type: 'image', alignment: 'left', imageUrl: '/uploads/img2.png', runs: [{ text: '', style: {} }] },
    ];
    const title = `Multi Image ${Date.now()}`;
    const docId = await createDocWithContent(page, title, blocks);
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    const editor = page.locator('.altdocs-editor');

    // Should have two image blocks
    const figures = editor.locator('figure.image-block');
    await expect(figures).toHaveCount(2);

    // Each should have its own img with different src
    const imgs = editor.locator('figure.image-block img');
    await expect(imgs).toHaveCount(2);

    const src1 = await imgs.nth(0).getAttribute('src');
    const src2 = await imgs.nth(1).getAttribute('src');
    expect(src1).toBe('/uploads/img1.png');
    expect(src2).toBe('/uploads/img2.png');
  });

  test('deleting only image block converts it to empty paragraph', async ({ page }) => {
    const blocks = [
      { id: 'b1', type: 'paragraph', alignment: 'left', runs: [{ text: '', style: {} }] },
      { id: 'b2', type: 'image', alignment: 'left', imageUrl: '/uploads/test.png', runs: [{ text: '', style: {} }] },
    ];
    const title = `Image Only Delete ${Date.now()}`;
    const docId = await createDocWithContent(page, title, blocks);
    await page.goto(`/#/doc/${docId}`);
    await page.waitForSelector('.altdocs-editor[contenteditable="true"]');

    const editor = page.locator('.altdocs-editor');

    // Navigate to image block using arrow key from the empty paragraph above
    const firstP = editor.locator('p').first();
    await firstP.click();
    await page.waitForTimeout(50);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(50);

    // Press Backspace — should delete the image block
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(100);

    // Image should be gone
    const figure = editor.locator('figure.image-block');
    await expect(figure).not.toBeVisible();

    // Should have a paragraph (editor always needs at least one block)
    const p = editor.locator('p');
    await expect(p).toBeVisible();

    // Should be able to type in the remaining paragraph
    await page.keyboard.type('replaced image');
    await page.waitForTimeout(100);
    await expect(editor).toContainText('replaced image');
  });
});
