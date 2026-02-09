import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyOperation,
  createEmptyDocument,
  createTableData,
  generateBlockId,
  resetBlockIdCounter,
  blockToPlainText,
} from '../src/shared/model.js';
import type { Document, Operation, Block, TableCell } from '../src/shared/model.js';

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

describe('Table Operations', () => {
  beforeEach(() => {
    resetBlockIdCounter();
  });

  describe('insert_block with table type', () => {
    it('creates a table block with default 2x2 data', () => {
      const doc = createEmptyDocument('test', 'Test');
      const op: Operation = {
        type: 'insert_block',
        afterBlockIndex: 0,
        blockType: 'table',
      };
      const result = applyOperation(doc, op);
      expect(result.blocks.length).toBe(2);
      const tableBlock = result.blocks[1];
      expect(tableBlock.type).toBe('table');
      expect(tableBlock.tableData).toBeDefined();
      expect(tableBlock.tableData!.length).toBe(2);
      expect(tableBlock.tableData![0].length).toBe(2);
      expect(tableBlock.tableData![1].length).toBe(2);
    });

    it('each cell has an empty run', () => {
      const doc = createEmptyDocument('test', 'Test');
      const op: Operation = {
        type: 'insert_block',
        afterBlockIndex: 0,
        blockType: 'table',
      };
      const result = applyOperation(doc, op);
      const tableBlock = result.blocks[1];
      for (const row of tableBlock.tableData!) {
        for (const cell of row) {
          expect(cell.runs.length).toBe(1);
          expect(cell.runs[0].text).toBe('');
        }
      }
    });
  });

  describe('set_table_data', () => {
    it('sets tableData on a table block', () => {
      const doc = createEmptyDocument('test', 'Test');
      doc.blocks.push(makeTableBlock());

      const newTableData: TableCell[][] = [
        [
          { runs: [{ text: 'A1', style: {} }] },
          { runs: [{ text: 'B1', style: {} }] },
          { runs: [{ text: 'C1', style: {} }] },
        ],
        [
          { runs: [{ text: 'A2', style: {} }] },
          { runs: [{ text: 'B2', style: {} }] },
          { runs: [{ text: 'C2', style: {} }] },
        ],
      ];

      const op: Operation = {
        type: 'set_table_data',
        blockIndex: 1,
        tableData: newTableData,
      };
      const result = applyOperation(doc, op);
      const table = result.blocks[1].tableData!;
      expect(table.length).toBe(2);
      expect(table[0].length).toBe(3);
      expect(table[0][0].runs[0].text).toBe('A1');
      expect(table[0][2].runs[0].text).toBe('C1');
      expect(table[1][1].runs[0].text).toBe('B2');
    });

    it('does nothing for out-of-bounds blockIndex', () => {
      const doc = createEmptyDocument('test', 'Test');
      const op: Operation = {
        type: 'set_table_data',
        blockIndex: 99,
        tableData: [[{ runs: [{ text: '', style: {} }] }]],
      };
      const result = applyOperation(doc, op);
      expect(result.blocks.length).toBe(1);
      expect(result.blocks[0].tableData).toBeUndefined();
    });

    it('deep clones the tableData (no shared references)', () => {
      const doc = createEmptyDocument('test', 'Test');
      doc.blocks.push(makeTableBlock());

      const inputData: TableCell[][] = [
        [{ runs: [{ text: 'hello', style: {} }] }],
      ];
      const op: Operation = {
        type: 'set_table_data',
        blockIndex: 1,
        tableData: inputData,
      };
      const result = applyOperation(doc, op);

      // Mutate the input — result should not be affected
      inputData[0][0].runs[0].text = 'MUTATED';
      expect(result.blocks[1].tableData![0][0].runs[0].text).toBe('hello');
    });
  });

  describe('createTableData', () => {
    it('creates a table with specified dimensions', () => {
      const data = createTableData(3, 4);
      expect(data.length).toBe(3);
      for (const row of data) {
        expect(row.length).toBe(4);
        for (const cell of row) {
          expect(cell.runs.length).toBe(1);
          expect(cell.runs[0].text).toBe('');
        }
      }
    });

    it('creates 1x1 table', () => {
      const data = createTableData(1, 1);
      expect(data.length).toBe(1);
      expect(data[0].length).toBe(1);
    });
  });

  describe('delete_block on a table', () => {
    it('deletes a table block', () => {
      const doc = createEmptyDocument('test', 'Test');
      doc.blocks.push(makeTableBlock());
      expect(doc.blocks.length).toBe(2);

      const op: Operation = {
        type: 'delete_block',
        blockIndex: 1,
      };
      const result = applyOperation(doc, op);
      expect(result.blocks.length).toBe(1);
      expect(result.blocks[0].type).toBe('paragraph');
    });
  });

  describe('table block with other operations', () => {
    it('split_block after table increases block count', () => {
      const doc: Document = {
        id: 'test',
        title: 'Test',
        blocks: [
          makeTableBlock(),
          { id: generateBlockId(), type: 'paragraph', alignment: 'left', runs: [{ text: 'Hello', style: {} }] },
        ],
      };

      const op: Operation = {
        type: 'split_block',
        position: { blockIndex: 1, offset: 2 },
      };
      const result = applyOperation(doc, op);
      expect(result.blocks.length).toBe(3);
      expect(result.blocks[0].type).toBe('table');
      expect(blockToPlainText(result.blocks[1])).toBe('He');
      expect(blockToPlainText(result.blocks[2])).toBe('llo');
    });

    it('clone preserves tableData', () => {
      const doc: Document = {
        id: 'test',
        title: 'Test',
        blocks: [makeTableBlock(2, 2, [['A', 'B'], ['C', 'D']])],
      };

      // Apply a no-op to trigger clone
      const op: Operation = {
        type: 'change_block_alignment',
        blockIndex: 0,
        newAlignment: 'center',
      };
      const result = applyOperation(doc, op);
      expect(result.blocks[0].tableData).toBeDefined();
      expect(result.blocks[0].tableData![0][0].runs[0].text).toBe('A');
      expect(result.blocks[0].tableData![1][1].runs[0].text).toBe('D');
      // Verify deep clone: mutating original doesn't affect result
      doc.blocks[0].tableData![0][0].runs[0].text = 'MUTATED';
      expect(result.blocks[0].tableData![0][0].runs[0].text).toBe('A');
    });
  });
});
