import { test, expect } from '@playwright/test';

/** Create a document with pre-defined blocks via API */
async function createDoc(
  page: any,
  title: string,
  blocks: Array<Record<string, unknown>>
): Promise<string> {
  const id = `table-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await page.request.post('http://localhost:3000/api/documents', {
    data: { id, title, content: JSON.stringify(blocks) },
  });
  return id;
}

/** Wait for editor to be ready */
async function waitForEditor(page: any): Promise<void> {
  await page.waitForSelector('.altdocs-editor[contenteditable="true"]', { timeout: 10000 });
}

test.describe('Table Support', () => {
  test('insert a table via toolbar button', async ({ page }) => {
    const docId = `table-insert-${Date.now()}`;
    await page.goto(`/#/doc/${docId}`);
    await waitForEditor(page);

    const editor = page.locator('.altdocs-editor');
    await editor.click();
    await page.waitForTimeout(50);

    // Click the insert-table toolbar button
    const insertTableBtn = page.locator('[data-toolbar-action="insert-table"]');
    await insertTableBtn.click();
    await page.waitForTimeout(200);

    // A table should appear in the editor
    const table = editor.locator('table.altdocs-table');
    await expect(table).toBeVisible();

    // Default 2x2 table: 2 rows with 2 cells each
    const rows = table.locator('tbody tr');
    await expect(rows).toHaveCount(2);

    const cells = table.locator('td');
    await expect(cells).toHaveCount(4);
  });

  test('click a table cell to activate it', async ({ page }) => {
    const blocks = [
      {
        id: 'b1', type: 'table', alignment: 'left',
        runs: [{ text: '', style: {} }],
        tableData: [
          [{ runs: [{ text: 'A1', style: {} }] }, { runs: [{ text: 'B1', style: {} }] }],
          [{ runs: [{ text: 'A2', style: {} }] }, { runs: [{ text: 'B2', style: {} }] }],
        ],
      },
    ];
    const title = `Table Click ${Date.now()}`;
    const docId = await createDoc(page, title, blocks);
    await page.goto(`/#/doc/${docId}`);
    await waitForEditor(page);

    // Verify table is rendered with content
    const editor = page.locator('.altdocs-editor');
    await expect(editor.locator('table.altdocs-table')).toBeVisible();
    await expect(editor).toContainText('A1');
    await expect(editor).toContainText('B2');

    // Click on cell A1 (row=0, col=0)
    const cellA1 = editor.locator('td[data-row="0"][data-col="0"]');
    await cellA1.click();
    await page.waitForTimeout(100);

    // Cell should have active-cell class
    await expect(cellA1).toHaveClass(/active-cell/);
  });

  test('type text into a table cell', async ({ page }) => {
    const docId = `table-type-${Date.now()}`;
    await page.goto(`/#/doc/${docId}`);
    await waitForEditor(page);

    const editor = page.locator('.altdocs-editor');
    await editor.click();
    await page.waitForTimeout(50);

    // Insert a table
    const insertTableBtn = page.locator('[data-toolbar-action="insert-table"]');
    await insertTableBtn.click();
    await page.waitForTimeout(200);

    // Click the first cell (row=0, col=0)
    const cell = editor.locator('td[data-row="0"][data-col="0"]');
    await cell.click();
    await page.waitForTimeout(100);

    // Type text
    await page.keyboard.type('Hello');
    await page.waitForTimeout(100);

    // Cell should contain the typed text
    const updatedCell = editor.locator('td[data-row="0"][data-col="0"]');
    await expect(updatedCell).toContainText('Hello');
  });

  test('backspace deletes text from a table cell', async ({ page }) => {
    const blocks = [
      {
        id: 'b1', type: 'table', alignment: 'left',
        runs: [{ text: '', style: {} }],
        tableData: [
          [{ runs: [{ text: 'ABC', style: {} }] }, { runs: [{ text: '', style: {} }] }],
          [{ runs: [{ text: '', style: {} }] }, { runs: [{ text: '', style: {} }] }],
        ],
      },
    ];
    const title = `Table Backspace ${Date.now()}`;
    const docId = await createDoc(page, title, blocks);
    await page.goto(`/#/doc/${docId}`);
    await waitForEditor(page);

    const editor = page.locator('.altdocs-editor');

    // Click cell A1
    const cell = editor.locator('td[data-row="0"][data-col="0"]');
    await cell.click();
    await page.waitForTimeout(100);

    // Press Backspace to delete last character
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(100);

    // Cell should now show "AB"
    const updatedCell = editor.locator('td[data-row="0"][data-col="0"]');
    await expect(updatedCell).toContainText('AB');

    // Press Backspace twice more
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(100);

    // Cell should now be empty (containing <br>)
    const finalCell = editor.locator('td[data-row="0"][data-col="0"]');
    const text = await finalCell.textContent();
    expect(text?.trim()).toBe('');
  });

  test('Tab navigates to next cell', async ({ page }) => {
    const blocks = [
      {
        id: 'b1', type: 'table', alignment: 'left',
        runs: [{ text: '', style: {} }],
        tableData: [
          [{ runs: [{ text: 'A1', style: {} }] }, { runs: [{ text: 'B1', style: {} }] }],
          [{ runs: [{ text: 'A2', style: {} }] }, { runs: [{ text: 'B2', style: {} }] }],
        ],
      },
    ];
    const title = `Table Tab ${Date.now()}`;
    const docId = await createDoc(page, title, blocks);
    await page.goto(`/#/doc/${docId}`);
    await waitForEditor(page);

    const editor = page.locator('.altdocs-editor');

    // Click cell A1
    const cellA1 = editor.locator('td[data-row="0"][data-col="0"]');
    await cellA1.click();
    await page.waitForTimeout(100);
    await expect(cellA1).toHaveClass(/active-cell/);

    // Press Tab to move to B1
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);

    const cellB1 = editor.locator('td[data-row="0"][data-col="1"]');
    await expect(cellB1).toHaveClass(/active-cell/);

    // Press Tab to move to A2 (next row)
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);

    const cellA2 = editor.locator('td[data-row="1"][data-col="0"]');
    await expect(cellA2).toHaveClass(/active-cell/);
  });

  test('Shift+Tab navigates to previous cell', async ({ page }) => {
    const blocks = [
      {
        id: 'b1', type: 'table', alignment: 'left',
        runs: [{ text: '', style: {} }],
        tableData: [
          [{ runs: [{ text: 'A1', style: {} }] }, { runs: [{ text: 'B1', style: {} }] }],
          [{ runs: [{ text: 'A2', style: {} }] }, { runs: [{ text: 'B2', style: {} }] }],
        ],
      },
    ];
    const title = `Table ShiftTab ${Date.now()}`;
    const docId = await createDoc(page, title, blocks);
    await page.goto(`/#/doc/${docId}`);
    await waitForEditor(page);

    const editor = page.locator('.altdocs-editor');

    // Click cell B2 (last cell)
    const cellB2 = editor.locator('td[data-row="1"][data-col="1"]');
    await cellB2.click();
    await page.waitForTimeout(100);
    await expect(cellB2).toHaveClass(/active-cell/);

    // Press Shift+Tab to move to A2
    await page.keyboard.press('Shift+Tab');
    await page.waitForTimeout(100);

    const cellA2 = editor.locator('td[data-row="1"][data-col="0"]');
    await expect(cellA2).toHaveClass(/active-cell/);

    // Press Shift+Tab to move to B1 (previous row)
    await page.keyboard.press('Shift+Tab');
    await page.waitForTimeout(100);

    const cellB1 = editor.locator('td[data-row="0"][data-col="1"]');
    await expect(cellB1).toHaveClass(/active-cell/);
  });

  test('+ Row button adds a new row', async ({ page }) => {
    const blocks = [
      {
        id: 'b1', type: 'table', alignment: 'left',
        runs: [{ text: '', style: {} }],
        tableData: [
          [{ runs: [{ text: 'A', style: {} }] }, { runs: [{ text: 'B', style: {} }] }],
        ],
      },
    ];
    const title = `Table Add Row ${Date.now()}`;
    const docId = await createDoc(page, title, blocks);
    await page.goto(`/#/doc/${docId}`);
    await waitForEditor(page);

    const editor = page.locator('.altdocs-editor');
    const table = editor.locator('table.altdocs-table');

    // Initially 1 row
    await expect(table.locator('tbody tr')).toHaveCount(1);

    // Click the "+ Row" button
    const addRowBtn = editor.locator('.table-add-row');
    await addRowBtn.click();
    await page.waitForTimeout(200);

    // Now should have 2 rows
    await expect(table.locator('tbody tr')).toHaveCount(2);

    // New row should have the same number of columns
    const newRowCells = table.locator('tbody tr:nth-child(2) td');
    await expect(newRowCells).toHaveCount(2);
  });

  test('+ Col button adds a new column', async ({ page }) => {
    const blocks = [
      {
        id: 'b1', type: 'table', alignment: 'left',
        runs: [{ text: '', style: {} }],
        tableData: [
          [{ runs: [{ text: 'A', style: {} }] }],
          [{ runs: [{ text: 'B', style: {} }] }],
        ],
      },
    ];
    const title = `Table Add Col ${Date.now()}`;
    const docId = await createDoc(page, title, blocks);
    await page.goto(`/#/doc/${docId}`);
    await waitForEditor(page);

    const editor = page.locator('.altdocs-editor');
    const table = editor.locator('table.altdocs-table');

    // Initially each row has 1 cell
    await expect(table.locator('tbody tr:first-child td')).toHaveCount(1);

    // Click the "+ Col" button
    const addColBtn = editor.locator('.table-add-col');
    await addColBtn.click();
    await page.waitForTimeout(200);

    // Each row should now have 2 cells
    await expect(table.locator('tbody tr:first-child td')).toHaveCount(2);
    await expect(table.locator('tbody tr:nth-child(2) td')).toHaveCount(2);
  });

  test('table persists after save and reload', async ({ page }) => {
    const docId = `table-persist-${Date.now()}`;
    await page.goto(`/#/doc/${docId}`);
    await waitForEditor(page);

    const editor = page.locator('.altdocs-editor');
    await editor.click();
    await page.waitForTimeout(50);

    // Insert a table
    const insertTableBtn = page.locator('[data-toolbar-action="insert-table"]');
    await insertTableBtn.click();
    await page.waitForTimeout(200);

    // Type text in first cell
    const cell = editor.locator('td[data-row="0"][data-col="0"]');
    await cell.click();
    await page.waitForTimeout(100);
    await page.keyboard.type('Persisted');
    await page.waitForTimeout(100);

    // Wait for auto-save (2s debounce + buffer)
    await page.waitForTimeout(3000);

    // Reload the page
    await page.goto(`/#/doc/${docId}`);
    await waitForEditor(page);

    // Table should be visible with the persisted text
    const reloadedEditor = page.locator('.altdocs-editor');
    await expect(reloadedEditor.locator('table.altdocs-table')).toBeVisible();
    await expect(reloadedEditor).toContainText('Persisted');
  });

  test('undo reverts table cell text input', async ({ page }) => {
    const docId = `table-undo-${Date.now()}`;
    await page.goto(`/#/doc/${docId}`);
    await waitForEditor(page);

    const editor = page.locator('.altdocs-editor');
    await editor.click();
    await page.waitForTimeout(50);

    // Insert a table
    const insertTableBtn = page.locator('[data-toolbar-action="insert-table"]');
    await insertTableBtn.click();
    await page.waitForTimeout(200);

    // Type text in first cell
    const cell = editor.locator('td[data-row="0"][data-col="0"]');
    await cell.click();
    await page.waitForTimeout(100);
    await page.keyboard.type('X');
    await page.waitForTimeout(100);

    // Verify text is in the cell
    await expect(cell).toContainText('X');

    // Undo
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);

    // Cell should be empty again
    const undoneCell = editor.locator('td[data-row="0"][data-col="0"]');
    const text = await undoneCell.textContent();
    expect(text?.trim()).toBe('');
  });

  test('table with pre-existing data renders correctly', async ({ page }) => {
    const blocks = [
      {
        id: 'b1', type: 'paragraph', alignment: 'left',
        runs: [{ text: 'Before table', style: {} }],
      },
      {
        id: 'b2', type: 'table', alignment: 'left',
        runs: [{ text: '', style: {} }],
        tableData: [
          [
            { runs: [{ text: 'Name', style: { bold: true } }] },
            { runs: [{ text: 'Age', style: { bold: true } }] },
            { runs: [{ text: 'City', style: { bold: true } }] },
          ],
          [
            { runs: [{ text: 'Alice', style: {} }] },
            { runs: [{ text: '30', style: {} }] },
            { runs: [{ text: 'NYC', style: {} }] },
          ],
          [
            { runs: [{ text: 'Bob', style: {} }] },
            { runs: [{ text: '25', style: {} }] },
            { runs: [{ text: 'LA', style: {} }] },
          ],
        ],
      },
      {
        id: 'b3', type: 'paragraph', alignment: 'left',
        runs: [{ text: 'After table', style: {} }],
      },
    ];
    const title = `Table Data ${Date.now()}`;
    const docId = await createDoc(page, title, blocks);
    await page.goto(`/#/doc/${docId}`);
    await waitForEditor(page);

    const editor = page.locator('.altdocs-editor');

    // Table should be visible
    const table = editor.locator('table.altdocs-table');
    await expect(table).toBeVisible();

    // Should have 3 rows, 3 cols each
    await expect(table.locator('tbody tr')).toHaveCount(3);
    await expect(table.locator('td')).toHaveCount(9);

    // Verify content
    await expect(editor).toContainText('Name');
    await expect(editor).toContainText('Alice');
    await expect(editor).toContainText('Bob');
    await expect(editor).toContainText('NYC');

    // Surrounding paragraphs should also be visible
    await expect(editor).toContainText('Before table');
    await expect(editor).toContainText('After table');
  });

  test('clicking outside table deactivates cell', async ({ page }) => {
    const blocks = [
      {
        id: 'b1', type: 'paragraph', alignment: 'left',
        runs: [{ text: 'Some text', style: {} }],
      },
      {
        id: 'b2', type: 'table', alignment: 'left',
        runs: [{ text: '', style: {} }],
        tableData: [
          [{ runs: [{ text: 'Cell', style: {} }] }, { runs: [{ text: '', style: {} }] }],
        ],
      },
    ];
    const title = `Table Deactivate ${Date.now()}`;
    const docId = await createDoc(page, title, blocks);
    await page.goto(`/#/doc/${docId}`);
    await waitForEditor(page);

    const editor = page.locator('.altdocs-editor');

    // Click a table cell
    const cell = editor.locator('td[data-row="0"][data-col="0"]');
    await cell.click();
    await page.waitForTimeout(100);
    await expect(cell).toHaveClass(/active-cell/);

    // Click on the paragraph text above
    const paragraph = editor.locator('p');
    await paragraph.click();
    await page.waitForTimeout(100);

    // No cell should be active
    const activeCells = editor.locator('td.active-cell');
    await expect(activeCells).toHaveCount(0);
  });

  test('+ Row and + Col buttons are present on table', async ({ page }) => {
    const blocks = [
      {
        id: 'b1', type: 'table', alignment: 'left',
        runs: [{ text: '', style: {} }],
        tableData: [
          [{ runs: [{ text: '', style: {} }] }, { runs: [{ text: '', style: {} }] }],
        ],
      },
    ];
    const title = `Table Buttons ${Date.now()}`;
    const docId = await createDoc(page, title, blocks);
    await page.goto(`/#/doc/${docId}`);
    await waitForEditor(page);

    const editor = page.locator('.altdocs-editor');

    // Both buttons should be visible
    const addRowBtn = editor.locator('.table-add-row');
    await expect(addRowBtn).toBeVisible();
    await expect(addRowBtn).toHaveText('+ Row');

    const addColBtn = editor.locator('.table-add-col');
    await expect(addColBtn).toBeVisible();
    await expect(addColBtn).toHaveText('+ Col');
  });
});
