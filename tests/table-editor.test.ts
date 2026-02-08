// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { Editor } from '../src/client/editor.js';
import { generateBlockId, resetBlockIdCounter } from '../src/shared/model.js';
import type { Document, Block, TableCell, Operation } from '../src/shared/model.js';

function makeTableBlock(rows = 2, cols = 2, content?: string[][]): Block {
  const tableData: TableCell[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: TableCell[] = [];
    for (let c = 0; c < cols; c++) {
      const text = content?.[r]?.[c] || '';
      row.push({ runs: [{ text, style: {} }] });
    }
    tableData.push(row);
  }
  return {
    id: generateBlockId(),
    type: 'table',
    alignment: 'left',
    runs: [{ text: '', style: {} }],
    tableData,
  };
}

function makeDoc(blocks: Block[]): Document {
  return { id: 'test', title: 'Test', blocks };
}

function createEditorWithTable(): { editor: Editor; container: HTMLElement } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const doc = makeDoc([
    { id: generateBlockId(), type: 'paragraph', alignment: 'left', runs: [{ text: 'Before', style: {} }] },
    makeTableBlock(2, 2, [['A1', 'B1'], ['A2', 'B2']]),
    { id: generateBlockId(), type: 'paragraph', alignment: 'left', runs: [{ text: 'After', style: {} }] },
  ]);
  const editor = new Editor(container, doc);
  return { editor, container };
}

describe('Table Editor Integration', () => {
  beforeEach(() => {
    resetBlockIdCounter();
    document.body.innerHTML = '';
  });

  describe('insertTable', () => {
    it('inserts a 2x2 table after the current block', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const editor = new Editor(container);

      editor.insertTable();

      expect(editor.doc.blocks.length).toBe(3); // original paragraph + table + new paragraph
      expect(editor.doc.blocks[1].type).toBe('table');
      expect(editor.doc.blocks[1].tableData).toBeDefined();
      expect(editor.doc.blocks[1].tableData!.length).toBe(2);
      expect(editor.doc.blocks[1].tableData![0].length).toBe(2);
      expect(editor.doc.blocks[2].type).toBe('paragraph');
    });

    it('inserts a table with custom dimensions', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const editor = new Editor(container);

      editor.insertTable(3, 4);

      const table = editor.doc.blocks[1];
      expect(table.type).toBe('table');
      expect(table.tableData!.length).toBe(3);
      expect(table.tableData![0].length).toBe(4);
    });

    it('moves cursor to paragraph after table', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const editor = new Editor(container);

      editor.insertTable();

      expect(editor.cursor.focus.blockIndex).toBe(2);
      expect(editor.cursor.focus.offset).toBe(0);
    });

    it('fires operation callbacks', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const editor = new Editor(container);
      const ops: Operation[] = [];
      editor.onOperation((op) => ops.push(op));

      editor.insertTable();

      // Should fire: insert_block (table), insert_block (paragraph)
      expect(ops.length).toBe(2);
      expect(ops[0].type).toBe('insert_block');
      expect(ops[1].type).toBe('insert_block');
    });
  });

  describe('table cell editing', () => {
    it('setActiveTableCell sets the active cell', () => {
      const { editor } = createEditorWithTable();

      editor.setActiveTableCell(1, 0, 1);

      expect(editor.getActiveTableCell()).toEqual({ blockIndex: 1, row: 0, col: 1 });
    });

    it('setActiveTableCell validates bounds', () => {
      const { editor } = createEditorWithTable();

      editor.setActiveTableCell(1, 10, 0); // row out of bounds
      expect(editor.getActiveTableCell()).toBeNull();

      editor.setActiveTableCell(1, 0, 10); // col out of bounds
      expect(editor.getActiveTableCell()).toBeNull();

      editor.setActiveTableCell(0, 0, 0); // not a table block
      expect(editor.getActiveTableCell()).toBeNull();
    });

    it('clearActiveTableCell clears the cell', () => {
      const { editor } = createEditorWithTable();

      editor.setActiveTableCell(1, 0, 0);
      expect(editor.getActiveTableCell()).not.toBeNull();

      editor.clearActiveTableCell();
      expect(editor.getActiveTableCell()).toBeNull();
    });

    it('typing in active cell appends text', () => {
      const { editor } = createEditorWithTable();
      editor.setActiveTableCell(1, 0, 0);

      // Simulate typing 'X'
      editor.handleKeyDown(new KeyboardEvent('keydown', { key: 'X' }));

      const cell = editor.doc.blocks[1].tableData![0][0];
      expect(cell.runs[0].text).toBe('A1X');
    });

    it('typing multiple characters accumulates', () => {
      const { editor } = createEditorWithTable();
      editor.setActiveTableCell(1, 1, 1);

      editor.handleKeyDown(new KeyboardEvent('keydown', { key: 'x' }));
      editor.handleKeyDown(new KeyboardEvent('keydown', { key: 'y' }));

      const cell = editor.doc.blocks[1].tableData![1][1];
      expect(cell.runs[0].text).toBe('B2xy');
    });

    it('backspace in active cell removes last character', () => {
      const { editor } = createEditorWithTable();
      editor.setActiveTableCell(1, 0, 0); // cell has 'A1'

      editor.handleKeyDown(new KeyboardEvent('keydown', { key: 'Backspace' }));

      const cell = editor.doc.blocks[1].tableData![0][0];
      expect(cell.runs[0].text).toBe('A');
    });

    it('backspace in empty cell does nothing', () => {
      const { editor } = createEditorWithTable();
      // Set the cell to empty first
      const emptyTableData: TableCell[][] = [
        [{ runs: [{ text: '', style: {} }] }, { runs: [{ text: '', style: {} }] }],
        [{ runs: [{ text: '', style: {} }] }, { runs: [{ text: '', style: {} }] }],
      ];
      editor.doc.blocks[1].tableData = emptyTableData;
      editor.setActiveTableCell(1, 0, 0);

      editor.handleKeyDown(new KeyboardEvent('keydown', { key: 'Backspace' }));

      const cell = editor.doc.blocks[1].tableData![0][0];
      expect(cell.runs[0].text).toBe('');
    });

    it('text input blocked on table when no active cell', () => {
      const { editor } = createEditorWithTable();
      // Move cursor to the table block but don't activate a cell
      editor.cursor = { anchor: { blockIndex: 1, offset: 0 }, focus: { blockIndex: 1, offset: 0 } };

      const docBefore = JSON.stringify(editor.doc.blocks[1].tableData);
      editor.handleKeyDown(new KeyboardEvent('keydown', { key: 'x' }));
      const docAfter = JSON.stringify(editor.doc.blocks[1].tableData);

      expect(docAfter).toBe(docBefore);
    });
  });

  describe('table cell navigation', () => {
    it('Tab moves to next cell in same row', () => {
      const { editor } = createEditorWithTable();
      editor.setActiveTableCell(1, 0, 0);

      editor.handleKeyDown(new KeyboardEvent('keydown', { key: 'Tab' }));

      expect(editor.getActiveTableCell()).toEqual({ blockIndex: 1, row: 0, col: 1 });
    });

    it('Tab wraps to next row', () => {
      const { editor } = createEditorWithTable();
      editor.setActiveTableCell(1, 0, 1); // last col in first row

      editor.handleKeyDown(new KeyboardEvent('keydown', { key: 'Tab' }));

      expect(editor.getActiveTableCell()).toEqual({ blockIndex: 1, row: 1, col: 0 });
    });

    it('Tab at last cell does nothing', () => {
      const { editor } = createEditorWithTable();
      editor.setActiveTableCell(1, 1, 1); // last cell

      editor.handleKeyDown(new KeyboardEvent('keydown', { key: 'Tab' }));

      expect(editor.getActiveTableCell()).toEqual({ blockIndex: 1, row: 1, col: 1 });
    });

    it('Shift+Tab moves to previous cell', () => {
      const { editor } = createEditorWithTable();
      editor.setActiveTableCell(1, 0, 1);

      editor.handleKeyDown(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }));

      expect(editor.getActiveTableCell()).toEqual({ blockIndex: 1, row: 0, col: 0 });
    });

    it('Shift+Tab wraps to previous row', () => {
      const { editor } = createEditorWithTable();
      editor.setActiveTableCell(1, 1, 0); // first col in second row

      editor.handleKeyDown(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }));

      expect(editor.getActiveTableCell()).toEqual({ blockIndex: 1, row: 0, col: 1 });
    });

    it('Shift+Tab at first cell does nothing', () => {
      const { editor } = createEditorWithTable();
      editor.setActiveTableCell(1, 0, 0);

      editor.handleKeyDown(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }));

      expect(editor.getActiveTableCell()).toEqual({ blockIndex: 1, row: 0, col: 0 });
    });
  });

  describe('table row/column management', () => {
    it('addTableRow adds a row', () => {
      const { editor } = createEditorWithTable();

      editor.addTableRow(1);

      const table = editor.doc.blocks[1].tableData!;
      expect(table.length).toBe(3);
      expect(table[2].length).toBe(2);
      expect(table[2][0].runs[0].text).toBe('');
    });

    it('addTableColumn adds a column', () => {
      const { editor } = createEditorWithTable();

      editor.addTableColumn(1);

      const table = editor.doc.blocks[1].tableData!;
      expect(table[0].length).toBe(3);
      expect(table[1].length).toBe(3);
      expect(table[0][2].runs[0].text).toBe('');
    });

    it('removeTableRow removes a row', () => {
      const { editor } = createEditorWithTable();

      editor.removeTableRow(1, 0);

      const table = editor.doc.blocks[1].tableData!;
      expect(table.length).toBe(1);
      expect(table[0][0].runs[0].text).toBe('A2');
    });

    it('removeTableRow preserves minimum 1 row', () => {
      const { editor } = createEditorWithTable();
      editor.removeTableRow(1, 0); // now 1 row

      editor.removeTableRow(1, 0); // should do nothing

      expect(editor.doc.blocks[1].tableData!.length).toBe(1);
    });

    it('removeTableColumn removes a column', () => {
      const { editor } = createEditorWithTable();

      editor.removeTableColumn(1, 0);

      const table = editor.doc.blocks[1].tableData!;
      expect(table[0].length).toBe(1);
      expect(table[0][0].runs[0].text).toBe('B1');
      expect(table[1][0].runs[0].text).toBe('B2');
    });

    it('removeTableColumn preserves minimum 1 column', () => {
      const { editor } = createEditorWithTable();
      editor.removeTableColumn(1, 0); // now 1 col

      editor.removeTableColumn(1, 0); // should do nothing

      expect(editor.doc.blocks[1].tableData![0].length).toBe(1);
    });

    it('removeTableRow adjusts active cell if needed', () => {
      const { editor } = createEditorWithTable();
      editor.setActiveTableCell(1, 1, 0); // row 1

      editor.removeTableRow(1, 1); // remove row 1

      expect(editor.getActiveTableCell()!.row).toBe(0); // adjusted to last row
    });

    it('removeTableColumn adjusts active cell if needed', () => {
      const { editor } = createEditorWithTable();
      editor.setActiveTableCell(1, 0, 1); // col 1

      editor.removeTableColumn(1, 1); // remove col 1

      expect(editor.getActiveTableCell()!.col).toBe(0); // adjusted to last col
    });

    it('addTableRow does nothing for non-table block', () => {
      const { editor } = createEditorWithTable();

      editor.addTableRow(0); // paragraph block

      // Should not crash, paragraph unaffected
      expect(editor.doc.blocks[0].type).toBe('paragraph');
    });
  });

  describe('table block void-like behavior', () => {
    it('Enter on table block inserts paragraph after', () => {
      const { editor } = createEditorWithTable();
      editor.cursor = { anchor: { blockIndex: 1, offset: 0 }, focus: { blockIndex: 1, offset: 0 } };
      editor.clearActiveTableCell();

      editor.handleKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));

      // Should insert a paragraph after the table
      expect(editor.doc.blocks[2].type).toBe('paragraph');
      expect(editor.cursor.focus.blockIndex).toBe(2);
    });

    it('Backspace on table block (no active cell) deletes the table', () => {
      const { editor } = createEditorWithTable();
      editor.cursor = { anchor: { blockIndex: 1, offset: 0 }, focus: { blockIndex: 1, offset: 0 } };
      editor.clearActiveTableCell();

      const blockCountBefore = editor.doc.blocks.length;
      editor.handleKeyDown(new KeyboardEvent('keydown', { key: 'Backspace' }));

      expect(editor.doc.blocks.length).toBe(blockCountBefore - 1);
      // Table should be gone
      expect(editor.doc.blocks.every((b) => b.type !== 'table')).toBe(true);
    });
  });

  describe('undo/redo with tables', () => {
    it('typing in table cell can be undone', () => {
      const { editor } = createEditorWithTable();
      editor.setActiveTableCell(1, 0, 0);

      editor.handleKeyDown(new KeyboardEvent('keydown', { key: 'X' }));
      expect(editor.doc.blocks[1].tableData![0][0].runs[0].text).toBe('A1X');

      editor.undo();
      expect(editor.doc.blocks[1].tableData![0][0].runs[0].text).toBe('A1');
    });

    it('addTableRow can be undone', () => {
      const { editor } = createEditorWithTable();

      editor.addTableRow(1);
      expect(editor.doc.blocks[1].tableData!.length).toBe(3);

      editor.undo();
      expect(editor.doc.blocks[1].tableData!.length).toBe(2);
    });

    it('insertTable can be undone', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const editor = new Editor(container);

      editor.insertTable();
      expect(editor.doc.blocks.length).toBe(3);

      editor.undo();
      expect(editor.doc.blocks.length).toBe(1);
      expect(editor.doc.blocks[0].type).toBe('paragraph');
    });
  });
});
