import { describe, it, expect } from 'vitest';
import { transformOperation, transformSingle } from '../src/shared/ot.js';
import type { Operation, TableCell } from '../src/shared/model.js';

function emptyTableData(): TableCell[][] {
  return [
    [{ runs: [{ text: '', style: {} }] }, { runs: [{ text: '', style: {} }] }],
    [{ runs: [{ text: '', style: {} }] }, { runs: [{ text: '', style: {} }] }],
  ];
}

function tableDataWith(text: string): TableCell[][] {
  return [
    [{ runs: [{ text, style: {} }] }],
  ];
}

describe('Table OT - set_table_data transformations', () => {
  describe('concurrent set_table_data on same block', () => {
    it('priority op wins (a has priority)', () => {
      const a: Operation = {
        type: 'set_table_data',
        blockIndex: 1,
        tableData: tableDataWith('from A'),
      };
      const b: Operation = {
        type: 'set_table_data',
        blockIndex: 1,
        tableData: tableDataWith('from B'),
      };

      const [aPrime, bPrime] = transformOperation(a, b);
      // a has priority, so a' keeps its data
      expect((aPrime as any).tableData[0][0].runs[0].text).toBe('from A');
      // b loses priority, adopts a's data
      expect((bPrime as any).tableData[0][0].runs[0].text).toBe('from A');
    });
  });

  describe('concurrent set_table_data on different blocks', () => {
    it('both keep their data', () => {
      const a: Operation = {
        type: 'set_table_data',
        blockIndex: 1,
        tableData: tableDataWith('A'),
      };
      const b: Operation = {
        type: 'set_table_data',
        blockIndex: 2,
        tableData: tableDataWith('B'),
      };

      const [aPrime, bPrime] = transformOperation(a, b);
      expect((aPrime as any).tableData[0][0].runs[0].text).toBe('A');
      expect((bPrime as any).tableData[0][0].runs[0].text).toBe('B');
    });
  });

  describe('set_table_data vs split_block', () => {
    it('blockIndex shifts when split is before', () => {
      const a: Operation = {
        type: 'set_table_data',
        blockIndex: 2,
        tableData: emptyTableData(),
      };
      const b: Operation = {
        type: 'split_block',
        position: { blockIndex: 0, offset: 3 },
      };

      const [aPrime] = transformOperation(a, b);
      expect((aPrime as any).blockIndex).toBe(3);
    });

    it('blockIndex unchanged when split is after', () => {
      const a: Operation = {
        type: 'set_table_data',
        blockIndex: 1,
        tableData: emptyTableData(),
      };
      const b: Operation = {
        type: 'split_block',
        position: { blockIndex: 3, offset: 0 },
      };

      const [aPrime] = transformOperation(a, b);
      expect((aPrime as any).blockIndex).toBe(1);
    });
  });

  describe('set_table_data vs merge_block', () => {
    it('blockIndex decreases when merge is before', () => {
      const a: Operation = {
        type: 'set_table_data',
        blockIndex: 3,
        tableData: emptyTableData(),
      };
      const b: Operation = {
        type: 'merge_block',
        blockIndex: 1,
      };

      const [aPrime] = transformOperation(a, b);
      expect((aPrime as any).blockIndex).toBe(2);
    });
  });

  describe('set_table_data vs insert_block', () => {
    it('blockIndex shifts when insert is before', () => {
      const a: Operation = {
        type: 'set_table_data',
        blockIndex: 2,
        tableData: emptyTableData(),
      };
      const b: Operation = {
        type: 'insert_block',
        afterBlockIndex: 0,
        blockType: 'paragraph',
      };

      const [aPrime] = transformOperation(a, b);
      expect((aPrime as any).blockIndex).toBe(3);
    });
  });

  describe('set_table_data vs delete_block', () => {
    it('blockIndex decreases when delete is before', () => {
      const a: Operation = {
        type: 'set_table_data',
        blockIndex: 3,
        tableData: emptyTableData(),
      };
      const b: Operation = {
        type: 'delete_block',
        blockIndex: 1,
      };

      const [aPrime] = transformOperation(a, b);
      expect((aPrime as any).blockIndex).toBe(2);
    });

    it('blockIndex stays when deleted block is the table (op becomes harmless)', () => {
      const a: Operation = {
        type: 'set_table_data',
        blockIndex: 2,
        tableData: emptyTableData(),
      };
      const b: Operation = {
        type: 'delete_block',
        blockIndex: 2,
      };

      const [aPrime] = transformOperation(a, b);
      // blockIndex stays, the set_table_data becomes harmless (block gone)
      expect((aPrime as any).blockIndex).toBe(2);
    });
  });

  describe('transformSingle with set_table_data', () => {
    it('gives priority to already-applied op', () => {
      const incoming: Operation = {
        type: 'set_table_data',
        blockIndex: 1,
        tableData: tableDataWith('incoming'),
      };
      const alreadyApplied: Operation = {
        type: 'set_table_data',
        blockIndex: 1,
        tableData: tableDataWith('applied'),
      };

      const result = transformSingle(incoming, alreadyApplied);
      // incoming loses priority, adopts applied's data
      expect((result as any).tableData[0][0].runs[0].text).toBe('applied');
    });
  });

  describe('other ops vs set_table_data', () => {
    it('insert_text is unaffected by set_table_data', () => {
      const a: Operation = {
        type: 'insert_text',
        position: { blockIndex: 0, offset: 3 },
        text: 'hello',
      };
      const b: Operation = {
        type: 'set_table_data',
        blockIndex: 1,
        tableData: emptyTableData(),
      };

      const [aPrime] = transformOperation(a, b);
      expect(aPrime).toEqual(a);
    });

    it('delete_text is unaffected by set_table_data', () => {
      const a: Operation = {
        type: 'delete_text',
        range: {
          start: { blockIndex: 0, offset: 0 },
          end: { blockIndex: 0, offset: 3 },
        },
      };
      const b: Operation = {
        type: 'set_table_data',
        blockIndex: 1,
        tableData: emptyTableData(),
      };

      const [aPrime] = transformOperation(a, b);
      expect(aPrime).toEqual(a);
    });
  });
});
