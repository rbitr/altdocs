import { describe, it, expect, beforeEach } from 'vitest';
import {
  Document,
  Block,
  TextRun,
  Operation,
  applyOperation,
  blockTextLength,
  blockToPlainText,
  normalizeRuns,
  stylesEqual,
  createEmptyDocument,
  createBlock,
  resetBlockIdCounter,
  getTextInRange,
} from '../src/shared/model.js';

// ============================================================
// Test Helpers
// ============================================================

function makeDoc(blocks: Block[]): Document {
  return { id: 'test-doc', title: 'Test', blocks };
}

function makeBlock(text: string, type: Block['type'] = 'paragraph'): Block {
  return {
    id: `b${Math.random()}`,
    type,
    alignment: 'left',
    runs: [{ text, style: {} }],
  };
}

function makeStyledBlock(runs: TextRun[], type: Block['type'] = 'paragraph'): Block {
  return {
    id: `b${Math.random()}`,
    type,
    alignment: 'left',
    runs,
  };
}

function getBlockText(doc: Document, blockIndex: number): string {
  return blockToPlainText(doc.blocks[blockIndex]);
}

// ============================================================
// Tests
// ============================================================

beforeEach(() => {
  resetBlockIdCounter();
});

describe('helper functions', () => {
  describe('blockTextLength', () => {
    it('returns 0 for empty runs', () => {
      const block = makeBlock('');
      expect(blockTextLength(block)).toBe(0);
    });

    it('returns correct length for single run', () => {
      const block = makeBlock('hello');
      expect(blockTextLength(block)).toBe(5);
    });

    it('returns sum of all run lengths', () => {
      const block = makeStyledBlock([
        { text: 'hello', style: {} },
        { text: ' world', style: { bold: true } },
      ]);
      expect(blockTextLength(block)).toBe(11);
    });
  });

  describe('blockToPlainText', () => {
    it('concatenates all run texts', () => {
      const block = makeStyledBlock([
        { text: 'hello', style: {} },
        { text: ' ', style: {} },
        { text: 'world', style: { bold: true } },
      ]);
      expect(blockToPlainText(block)).toBe('hello world');
    });
  });

  describe('stylesEqual', () => {
    it('treats empty styles as equal', () => {
      expect(stylesEqual({}, {})).toBe(true);
    });

    it('treats undefined and false as equal', () => {
      expect(stylesEqual({ bold: false }, {})).toBe(true);
      expect(stylesEqual({}, { italic: false })).toBe(true);
    });

    it('detects different styles', () => {
      expect(stylesEqual({ bold: true }, {})).toBe(false);
      expect(stylesEqual({ bold: true }, { italic: true })).toBe(false);
    });

    it('matches identical styles', () => {
      expect(
        stylesEqual({ bold: true, italic: true }, { bold: true, italic: true })
      ).toBe(true);
    });

    it('detects different font sizes', () => {
      expect(stylesEqual({ fontSize: 14 }, {})).toBe(false);
      expect(stylesEqual({ fontSize: 14 }, { fontSize: 18 })).toBe(false);
    });

    it('matches identical font sizes', () => {
      expect(stylesEqual({ fontSize: 14 }, { fontSize: 14 })).toBe(true);
    });

    it('treats undefined fontSize as equal to no fontSize', () => {
      expect(stylesEqual({ fontSize: undefined }, {})).toBe(true);
    });

    it('detects different font families', () => {
      expect(stylesEqual({ fontFamily: 'Arial' }, {})).toBe(false);
      expect(stylesEqual({ fontFamily: 'Arial' }, { fontFamily: 'Georgia' })).toBe(false);
    });

    it('matches identical font families', () => {
      expect(stylesEqual({ fontFamily: 'Arial' }, { fontFamily: 'Arial' })).toBe(true);
    });

    it('treats undefined fontFamily as equal to no fontFamily', () => {
      expect(stylesEqual({ fontFamily: undefined }, {})).toBe(true);
    });

    it('detects different colors', () => {
      expect(stylesEqual({ color: '#ff0000' }, {})).toBe(false);
      expect(stylesEqual({ color: '#ff0000' }, { color: '#00ff00' })).toBe(false);
    });

    it('matches identical colors', () => {
      expect(stylesEqual({ color: '#ff0000' }, { color: '#ff0000' })).toBe(true);
    });

    it('treats undefined color as equal to no color', () => {
      expect(stylesEqual({ color: undefined }, {})).toBe(true);
    });

    it('detects different background colors', () => {
      expect(stylesEqual({ backgroundColor: '#ffff00' }, {})).toBe(false);
      expect(stylesEqual({ backgroundColor: '#ffff00' }, { backgroundColor: '#00ffff' })).toBe(false);
    });

    it('matches identical background colors', () => {
      expect(stylesEqual({ backgroundColor: '#ffff00' }, { backgroundColor: '#ffff00' })).toBe(true);
    });

    it('treats undefined backgroundColor as equal to no backgroundColor', () => {
      expect(stylesEqual({ backgroundColor: undefined }, {})).toBe(true);
    });
  });

  describe('normalizeRuns', () => {
    it('removes empty runs', () => {
      const result = normalizeRuns([
        { text: '', style: {} },
        { text: 'hello', style: {} },
        { text: '', style: { bold: true } },
      ]);
      expect(result).toEqual([{ text: 'hello', style: {} }]);
    });

    it('merges adjacent runs with same style', () => {
      const result = normalizeRuns([
        { text: 'hello', style: {} },
        { text: ' world', style: {} },
      ]);
      expect(result).toEqual([{ text: 'hello world', style: {} }]);
    });

    it('keeps runs with different styles separate', () => {
      const result = normalizeRuns([
        { text: 'hello', style: {} },
        { text: ' world', style: { bold: true } },
      ]);
      expect(result).toHaveLength(2);
      expect(result[0].text).toBe('hello');
      expect(result[1].text).toBe(' world');
    });
  });
});

describe('insert_text operation', () => {
  it('inserts text at the beginning of a block', () => {
    const doc = makeDoc([makeBlock('world')]);
    const result = applyOperation(doc, {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 0 },
      text: 'hello ',
    });
    expect(getBlockText(result, 0)).toBe('hello world');
  });

  it('inserts text at the end of a block', () => {
    const doc = makeDoc([makeBlock('hello')]);
    const result = applyOperation(doc, {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 5 },
      text: ' world',
    });
    expect(getBlockText(result, 0)).toBe('hello world');
  });

  it('inserts text in the middle of a block', () => {
    const doc = makeDoc([makeBlock('hllo')]);
    const result = applyOperation(doc, {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 1 },
      text: 'e',
    });
    expect(getBlockText(result, 0)).toBe('hello');
  });

  it('inserts text into an empty block', () => {
    const doc = makeDoc([makeBlock('')]);
    const result = applyOperation(doc, {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 0 },
      text: 'hello',
    });
    expect(getBlockText(result, 0)).toBe('hello');
  });

  it('inherits style from the insertion point', () => {
    const doc = makeDoc([
      makeStyledBlock([{ text: 'bold text', style: { bold: true } }]),
    ]);
    const result = applyOperation(doc, {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 4 },
      text: ' and',
    });
    expect(getBlockText(result, 0)).toBe('bold and text');
    // All runs should be bold since insertion inherits from the position
    for (const run of result.blocks[0].runs) {
      expect(run.style.bold).toBe(true);
    }
  });

  it('does not mutate the original document', () => {
    const doc = makeDoc([makeBlock('hello')]);
    const result = applyOperation(doc, {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 5 },
      text: ' world',
    });
    expect(getBlockText(doc, 0)).toBe('hello');
    expect(getBlockText(result, 0)).toBe('hello world');
  });

  it('handles inserting into second block', () => {
    const doc = makeDoc([makeBlock('first'), makeBlock('second')]);
    const result = applyOperation(doc, {
      type: 'insert_text',
      position: { blockIndex: 1, offset: 0 },
      text: 'the ',
    });
    expect(getBlockText(result, 0)).toBe('first');
    expect(getBlockText(result, 1)).toBe('the second');
  });
});

describe('delete_text operation', () => {
  it('deletes text from the beginning of a block', () => {
    const doc = makeDoc([makeBlock('hello world')]);
    const result = applyOperation(doc, {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 6 },
      },
    });
    expect(getBlockText(result, 0)).toBe('world');
  });

  it('deletes text from the end of a block', () => {
    const doc = makeDoc([makeBlock('hello world')]);
    const result = applyOperation(doc, {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 5 },
        end: { blockIndex: 0, offset: 11 },
      },
    });
    expect(getBlockText(result, 0)).toBe('hello');
  });

  it('deletes text from the middle of a block', () => {
    const doc = makeDoc([makeBlock('hello world')]);
    const result = applyOperation(doc, {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 2 },
        end: { blockIndex: 0, offset: 8 },
      },
    });
    expect(getBlockText(result, 0)).toBe('herld');
  });

  it('deletes a single character', () => {
    const doc = makeDoc([makeBlock('hello')]);
    const result = applyOperation(doc, {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 1 },
        end: { blockIndex: 0, offset: 2 },
      },
    });
    expect(getBlockText(result, 0)).toBe('hllo');
  });

  it('deletes all text in a block', () => {
    const doc = makeDoc([makeBlock('hello')]);
    const result = applyOperation(doc, {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 5 },
      },
    });
    expect(getBlockText(result, 0)).toBe('');
    expect(result.blocks[0].runs).toHaveLength(1);
  });

  it('deletes across multiple blocks', () => {
    const doc = makeDoc([
      makeBlock('first block'),
      makeBlock('second block'),
      makeBlock('third block'),
    ]);
    const result = applyOperation(doc, {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 5 },
        end: { blockIndex: 2, offset: 5 },
      },
    });
    expect(result.blocks).toHaveLength(1);
    expect(getBlockText(result, 0)).toBe('first block');
  });

  it('deletes across two blocks merging them', () => {
    const doc = makeDoc([makeBlock('hello'), makeBlock('world')]);
    const result = applyOperation(doc, {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 3 },
        end: { blockIndex: 1, offset: 2 },
      },
    });
    expect(result.blocks).toHaveLength(1);
    expect(getBlockText(result, 0)).toBe('helrld');
  });

  it('does not mutate the original document', () => {
    const doc = makeDoc([makeBlock('hello')]);
    applyOperation(doc, {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 3 },
      },
    });
    expect(getBlockText(doc, 0)).toBe('hello');
  });
});

describe('apply_formatting operation', () => {
  it('applies bold to a range', () => {
    const doc = makeDoc([makeBlock('hello world')]);
    const result = applyOperation(doc, {
      type: 'apply_formatting',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 5 },
      },
      style: { bold: true },
    });
    expect(result.blocks[0].runs.length).toBeGreaterThanOrEqual(1);
    // "hello" should be bold
    expect(result.blocks[0].runs[0].text).toBe('hello');
    expect(result.blocks[0].runs[0].style.bold).toBe(true);
    // " world" should not be bold
    expect(result.blocks[0].runs[1].text).toBe(' world');
    expect(result.blocks[0].runs[1].style.bold).toBeFalsy();
  });

  it('applies italic to entire block', () => {
    const doc = makeDoc([makeBlock('hello')]);
    const result = applyOperation(doc, {
      type: 'apply_formatting',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 5 },
      },
      style: { italic: true },
    });
    expect(result.blocks[0].runs).toHaveLength(1);
    expect(result.blocks[0].runs[0].style.italic).toBe(true);
  });

  it('applies formatting to middle of text', () => {
    const doc = makeDoc([makeBlock('hello world today')]);
    const result = applyOperation(doc, {
      type: 'apply_formatting',
      range: {
        start: { blockIndex: 0, offset: 6 },
        end: { blockIndex: 0, offset: 11 },
      },
      style: { underline: true },
    });
    expect(result.blocks[0].runs).toHaveLength(3);
    expect(result.blocks[0].runs[0].text).toBe('hello ');
    expect(result.blocks[0].runs[0].style.underline).toBeFalsy();
    expect(result.blocks[0].runs[1].text).toBe('world');
    expect(result.blocks[0].runs[1].style.underline).toBe(true);
    expect(result.blocks[0].runs[2].text).toBe(' today');
    expect(result.blocks[0].runs[2].style.underline).toBeFalsy();
  });

  it('applies formatting across multiple blocks', () => {
    const doc = makeDoc([makeBlock('first block'), makeBlock('second block')]);
    const result = applyOperation(doc, {
      type: 'apply_formatting',
      range: {
        start: { blockIndex: 0, offset: 6 },
        end: { blockIndex: 1, offset: 6 },
      },
      style: { bold: true },
    });
    // First block: "first " (not bold) + "block" (bold)
    expect(result.blocks[0].runs[0].text).toBe('first ');
    expect(result.blocks[0].runs[0].style.bold).toBeFalsy();
    expect(result.blocks[0].runs[1].text).toBe('block');
    expect(result.blocks[0].runs[1].style.bold).toBe(true);
    // Second block: "second" (bold) + " block" (not bold)
    expect(result.blocks[1].runs[0].text).toBe('second');
    expect(result.blocks[1].runs[0].style.bold).toBe(true);
    expect(result.blocks[1].runs[1].text).toBe(' block');
    expect(result.blocks[1].runs[1].style.bold).toBeFalsy();
  });

  it('stacks multiple style flags', () => {
    const doc = makeDoc([makeBlock('hello')]);
    let result = applyOperation(doc, {
      type: 'apply_formatting',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 5 },
      },
      style: { bold: true },
    });
    result = applyOperation(result, {
      type: 'apply_formatting',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 5 },
      },
      style: { italic: true },
    });
    expect(result.blocks[0].runs[0].style.bold).toBe(true);
    expect(result.blocks[0].runs[0].style.italic).toBe(true);
  });

  it('does not mutate original document', () => {
    const doc = makeDoc([makeBlock('hello')]);
    applyOperation(doc, {
      type: 'apply_formatting',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 5 },
      },
      style: { bold: true },
    });
    expect(doc.blocks[0].runs[0].style.bold).toBeFalsy();
  });

  it('applies fontSize to a range', () => {
    const doc = makeDoc([makeBlock('hello world')]);
    const result = applyOperation(doc, {
      type: 'apply_formatting',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 5 },
      },
      style: { fontSize: 24 },
    });
    expect(result.blocks[0].runs[0].text).toBe('hello');
    expect(result.blocks[0].runs[0].style.fontSize).toBe(24);
    expect(result.blocks[0].runs[1].text).toBe(' world');
    expect(result.blocks[0].runs[1].style.fontSize).toBeUndefined();
  });

  it('applies fontFamily to a range', () => {
    const doc = makeDoc([makeBlock('hello world')]);
    const result = applyOperation(doc, {
      type: 'apply_formatting',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 5 },
      },
      style: { fontFamily: 'Georgia' },
    });
    expect(result.blocks[0].runs[0].text).toBe('hello');
    expect(result.blocks[0].runs[0].style.fontFamily).toBe('Georgia');
    expect(result.blocks[0].runs[1].text).toBe(' world');
    expect(result.blocks[0].runs[1].style.fontFamily).toBeUndefined();
  });

  it('applies fontSize and fontFamily together', () => {
    const doc = makeDoc([makeBlock('hello')]);
    const result = applyOperation(doc, {
      type: 'apply_formatting',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 5 },
      },
      style: { fontSize: 18, fontFamily: 'Arial' },
    });
    expect(result.blocks[0].runs[0].style.fontSize).toBe(18);
    expect(result.blocks[0].runs[0].style.fontFamily).toBe('Arial');
  });

  it('applies color to a range', () => {
    const doc = makeDoc([makeBlock('hello world')]);
    const result = applyOperation(doc, {
      type: 'apply_formatting',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 5 },
      },
      style: { color: '#c0392b' },
    });
    expect(result.blocks[0].runs[0].text).toBe('hello');
    expect(result.blocks[0].runs[0].style.color).toBe('#c0392b');
    expect(result.blocks[0].runs[1].text).toBe(' world');
    expect(result.blocks[0].runs[1].style.color).toBeUndefined();
  });

  it('applies backgroundColor to a range', () => {
    const doc = makeDoc([makeBlock('hello world')]);
    const result = applyOperation(doc, {
      type: 'apply_formatting',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 5 },
      },
      style: { backgroundColor: '#ffff00' },
    });
    expect(result.blocks[0].runs[0].text).toBe('hello');
    expect(result.blocks[0].runs[0].style.backgroundColor).toBe('#ffff00');
    expect(result.blocks[0].runs[1].text).toBe(' world');
    expect(result.blocks[0].runs[1].style.backgroundColor).toBeUndefined();
  });

  it('applies color and backgroundColor together', () => {
    const doc = makeDoc([makeBlock('hello')]);
    const result = applyOperation(doc, {
      type: 'apply_formatting',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 5 },
      },
      style: { color: '#ff0000', backgroundColor: '#ffff00' },
    });
    expect(result.blocks[0].runs[0].style.color).toBe('#ff0000');
    expect(result.blocks[0].runs[0].style.backgroundColor).toBe('#ffff00');
  });

  it('preserves color when applying bold', () => {
    const doc = makeDoc([
      makeStyledBlock([{ text: 'hello', style: { color: '#ff0000' } }]),
    ]);
    const result = applyOperation(doc, {
      type: 'apply_formatting',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 5 },
      },
      style: { bold: true },
    });
    expect(result.blocks[0].runs[0].style.bold).toBe(true);
    expect(result.blocks[0].runs[0].style.color).toBe('#ff0000');
  });

  it('preserves fontSize when applying bold', () => {
    const doc = makeDoc([
      makeStyledBlock([{ text: 'hello', style: { fontSize: 24 } }]),
    ]);
    const result = applyOperation(doc, {
      type: 'apply_formatting',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 5 },
      },
      style: { bold: true },
    });
    expect(result.blocks[0].runs[0].style.bold).toBe(true);
    expect(result.blocks[0].runs[0].style.fontSize).toBe(24);
  });
});

describe('remove_formatting operation', () => {
  it('removes bold from a range', () => {
    const doc = makeDoc([
      makeStyledBlock([{ text: 'hello world', style: { bold: true } }]),
    ]);
    const result = applyOperation(doc, {
      type: 'remove_formatting',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 5 },
      },
      style: { bold: true },
    });
    expect(result.blocks[0].runs[0].text).toBe('hello');
    expect(result.blocks[0].runs[0].style.bold).toBe(false);
    expect(result.blocks[0].runs[1].text).toBe(' world');
    expect(result.blocks[0].runs[1].style.bold).toBe(true);
  });

  it('only removes specified flags, keeps others', () => {
    const doc = makeDoc([
      makeStyledBlock([
        { text: 'hello', style: { bold: true, italic: true, underline: true } },
      ]),
    ]);
    const result = applyOperation(doc, {
      type: 'remove_formatting',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 5 },
      },
      style: { bold: true },
    });
    expect(result.blocks[0].runs[0].style.bold).toBe(false);
    expect(result.blocks[0].runs[0].style.italic).toBe(true);
    expect(result.blocks[0].runs[0].style.underline).toBe(true);
  });

  it('removes fontSize from a range', () => {
    const doc = makeDoc([
      makeStyledBlock([{ text: 'hello', style: { fontSize: 24, bold: true } }]),
    ]);
    const result = applyOperation(doc, {
      type: 'remove_formatting',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 5 },
      },
      style: { fontSize: 0 },
    });
    expect(result.blocks[0].runs[0].style.fontSize).toBeUndefined();
    expect(result.blocks[0].runs[0].style.bold).toBe(true);
  });

  it('removes fontFamily from a range', () => {
    const doc = makeDoc([
      makeStyledBlock([{ text: 'hello', style: { fontFamily: 'Arial', italic: true } }]),
    ]);
    const result = applyOperation(doc, {
      type: 'remove_formatting',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 5 },
      },
      style: { fontFamily: '' },
    });
    expect(result.blocks[0].runs[0].style.fontFamily).toBeUndefined();
    expect(result.blocks[0].runs[0].style.italic).toBe(true);
  });

  it('removes color from a range', () => {
    const doc = makeDoc([
      makeStyledBlock([{ text: 'hello', style: { color: '#ff0000', bold: true } }]),
    ]);
    const result = applyOperation(doc, {
      type: 'remove_formatting',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 5 },
      },
      style: { color: '' },
    });
    expect(result.blocks[0].runs[0].style.color).toBeUndefined();
    expect(result.blocks[0].runs[0].style.bold).toBe(true);
  });

  it('removes backgroundColor from a range', () => {
    const doc = makeDoc([
      makeStyledBlock([{ text: 'hello', style: { backgroundColor: '#ffff00', italic: true } }]),
    ]);
    const result = applyOperation(doc, {
      type: 'remove_formatting',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 5 },
      },
      style: { backgroundColor: '' },
    });
    expect(result.blocks[0].runs[0].style.backgroundColor).toBeUndefined();
    expect(result.blocks[0].runs[0].style.italic).toBe(true);
  });
});

describe('split_block operation', () => {
  it('splits a block at the middle', () => {
    const doc = makeDoc([makeBlock('hello world')]);
    const result = applyOperation(doc, {
      type: 'split_block',
      position: { blockIndex: 0, offset: 5 },
    });
    expect(result.blocks).toHaveLength(2);
    expect(getBlockText(result, 0)).toBe('hello');
    expect(getBlockText(result, 1)).toBe(' world');
  });

  it('splits at the beginning (creating empty block before)', () => {
    const doc = makeDoc([makeBlock('hello')]);
    const result = applyOperation(doc, {
      type: 'split_block',
      position: { blockIndex: 0, offset: 0 },
    });
    expect(result.blocks).toHaveLength(2);
    expect(getBlockText(result, 0)).toBe('');
    expect(getBlockText(result, 1)).toBe('hello');
  });

  it('splits at the end (creating empty block after)', () => {
    const doc = makeDoc([makeBlock('hello')]);
    const result = applyOperation(doc, {
      type: 'split_block',
      position: { blockIndex: 0, offset: 5 },
    });
    expect(result.blocks).toHaveLength(2);
    expect(getBlockText(result, 0)).toBe('hello');
    expect(getBlockText(result, 1)).toBe('');
  });

  it('new block gets paragraph type', () => {
    const doc = makeDoc([makeBlock('heading text', 'heading1')]);
    const result = applyOperation(doc, {
      type: 'split_block',
      position: { blockIndex: 0, offset: 7 },
    });
    expect(result.blocks[0].type).toBe('heading1');
    expect(result.blocks[1].type).toBe('paragraph');
  });

  it('preserves formatting across split', () => {
    const doc = makeDoc([
      makeStyledBlock([{ text: 'bold text', style: { bold: true } }]),
    ]);
    const result = applyOperation(doc, {
      type: 'split_block',
      position: { blockIndex: 0, offset: 4 },
    });
    expect(result.blocks[0].runs[0].style.bold).toBe(true);
    expect(result.blocks[1].runs[0].style.bold).toBe(true);
  });

  it('does not mutate original document', () => {
    const doc = makeDoc([makeBlock('hello world')]);
    const result = applyOperation(doc, {
      type: 'split_block',
      position: { blockIndex: 0, offset: 5 },
    });
    expect(doc.blocks).toHaveLength(1);
    expect(result.blocks).toHaveLength(2);
  });

  it('splits correctly with multiple runs', () => {
    const doc = makeDoc([
      makeStyledBlock([
        { text: 'hello', style: { bold: true } },
        { text: ' world', style: {} },
      ]),
    ]);
    const result = applyOperation(doc, {
      type: 'split_block',
      position: { blockIndex: 0, offset: 5 },
    });
    expect(getBlockText(result, 0)).toBe('hello');
    expect(result.blocks[0].runs[0].style.bold).toBe(true);
    expect(getBlockText(result, 1)).toBe(' world');
    expect(result.blocks[1].runs[0].style.bold).toBeFalsy();
  });
});

describe('merge_block operation', () => {
  it('merges a block with the previous one', () => {
    const doc = makeDoc([makeBlock('hello'), makeBlock(' world')]);
    const result = applyOperation(doc, {
      type: 'merge_block',
      blockIndex: 1,
    });
    expect(result.blocks).toHaveLength(1);
    expect(getBlockText(result, 0)).toBe('hello world');
  });

  it('merges empty block with previous', () => {
    const doc = makeDoc([makeBlock('hello'), makeBlock('')]);
    const result = applyOperation(doc, {
      type: 'merge_block',
      blockIndex: 1,
    });
    expect(result.blocks).toHaveLength(1);
    expect(getBlockText(result, 0)).toBe('hello');
  });

  it('merges into empty block', () => {
    const doc = makeDoc([makeBlock(''), makeBlock('hello')]);
    const result = applyOperation(doc, {
      type: 'merge_block',
      blockIndex: 1,
    });
    expect(result.blocks).toHaveLength(1);
    expect(getBlockText(result, 0)).toBe('hello');
  });

  it('does nothing if blockIndex is 0', () => {
    const doc = makeDoc([makeBlock('hello')]);
    const result = applyOperation(doc, {
      type: 'merge_block',
      blockIndex: 0,
    });
    expect(result.blocks).toHaveLength(1);
    expect(getBlockText(result, 0)).toBe('hello');
  });

  it('preserves the previous block type', () => {
    const doc = makeDoc([
      makeBlock('heading', 'heading1'),
      makeBlock(' text', 'paragraph'),
    ]);
    const result = applyOperation(doc, {
      type: 'merge_block',
      blockIndex: 1,
    });
    expect(result.blocks[0].type).toBe('heading1');
  });

  it('preserves formatting from both blocks', () => {
    const doc = makeDoc([
      makeStyledBlock([{ text: 'bold', style: { bold: true } }]),
      makeStyledBlock([{ text: 'italic', style: { italic: true } }]),
    ]);
    const result = applyOperation(doc, {
      type: 'merge_block',
      blockIndex: 1,
    });
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].runs).toHaveLength(2);
    expect(result.blocks[0].runs[0].text).toBe('bold');
    expect(result.blocks[0].runs[0].style.bold).toBe(true);
    expect(result.blocks[0].runs[1].text).toBe('italic');
    expect(result.blocks[0].runs[1].style.italic).toBe(true);
  });

  it('does not mutate original document', () => {
    const doc = makeDoc([makeBlock('hello'), makeBlock(' world')]);
    applyOperation(doc, {
      type: 'merge_block',
      blockIndex: 1,
    });
    expect(doc.blocks).toHaveLength(2);
  });
});

describe('change_block_type operation', () => {
  it('changes a paragraph to heading1', () => {
    const doc = makeDoc([makeBlock('hello', 'paragraph')]);
    const result = applyOperation(doc, {
      type: 'change_block_type',
      blockIndex: 0,
      newType: 'heading1',
    });
    expect(result.blocks[0].type).toBe('heading1');
    expect(getBlockText(result, 0)).toBe('hello');
  });

  it('changes heading to bullet list item', () => {
    const doc = makeDoc([makeBlock('item', 'heading2')]);
    const result = applyOperation(doc, {
      type: 'change_block_type',
      blockIndex: 0,
      newType: 'bullet-list-item',
    });
    expect(result.blocks[0].type).toBe('bullet-list-item');
  });

  it('does not affect other blocks', () => {
    const doc = makeDoc([
      makeBlock('first', 'paragraph'),
      makeBlock('second', 'paragraph'),
    ]);
    const result = applyOperation(doc, {
      type: 'change_block_type',
      blockIndex: 0,
      newType: 'heading1',
    });
    expect(result.blocks[0].type).toBe('heading1');
    expect(result.blocks[1].type).toBe('paragraph');
  });

  it('preserves text content and formatting', () => {
    const doc = makeDoc([
      makeStyledBlock([{ text: 'formatted', style: { bold: true, italic: true } }]),
    ]);
    const result = applyOperation(doc, {
      type: 'change_block_type',
      blockIndex: 0,
      newType: 'heading3',
    });
    expect(result.blocks[0].runs[0].text).toBe('formatted');
    expect(result.blocks[0].runs[0].style.bold).toBe(true);
    expect(result.blocks[0].runs[0].style.italic).toBe(true);
  });

  it('does not mutate original document', () => {
    const doc = makeDoc([makeBlock('hello', 'paragraph')]);
    applyOperation(doc, {
      type: 'change_block_type',
      blockIndex: 0,
      newType: 'heading1',
    });
    expect(doc.blocks[0].type).toBe('paragraph');
  });
});

describe('change_block_alignment operation', () => {
  it('changes alignment to center', () => {
    const doc = makeDoc([makeBlock('hello')]);
    const result = applyOperation(doc, {
      type: 'change_block_alignment',
      blockIndex: 0,
      newAlignment: 'center',
    });
    expect(result.blocks[0].alignment).toBe('center');
  });

  it('changes alignment to right', () => {
    const doc = makeDoc([makeBlock('hello')]);
    const result = applyOperation(doc, {
      type: 'change_block_alignment',
      blockIndex: 0,
      newAlignment: 'right',
    });
    expect(result.blocks[0].alignment).toBe('right');
  });

  it('does not mutate original document', () => {
    const doc = makeDoc([makeBlock('hello')]);
    applyOperation(doc, {
      type: 'change_block_alignment',
      blockIndex: 0,
      newAlignment: 'center',
    });
    expect(doc.blocks[0].alignment).toBe('left');
  });
});

describe('factory functions', () => {
  it('createEmptyDocument creates a doc with one empty paragraph', () => {
    const doc = createEmptyDocument('doc1', 'My Doc');
    expect(doc.id).toBe('doc1');
    expect(doc.title).toBe('My Doc');
    expect(doc.blocks).toHaveLength(1);
    expect(doc.blocks[0].type).toBe('paragraph');
    expect(blockToPlainText(doc.blocks[0])).toBe('');
  });

  it('createBlock creates a block with given text and style', () => {
    const block = createBlock('heading1', 'Hello', { bold: true }, 'center');
    expect(block.type).toBe('heading1');
    expect(block.alignment).toBe('center');
    expect(block.runs[0].text).toBe('Hello');
    expect(block.runs[0].style.bold).toBe(true);
  });
});

describe('complex operation sequences', () => {
  it('insert then delete round-trips', () => {
    const doc = makeDoc([makeBlock('hello world')]);
    const afterInsert = applyOperation(doc, {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 5 },
      text: ' beautiful',
    });
    expect(getBlockText(afterInsert, 0)).toBe('hello beautiful world');

    const afterDelete = applyOperation(afterInsert, {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 5 },
        end: { blockIndex: 0, offset: 15 },
      },
    });
    expect(getBlockText(afterDelete, 0)).toBe('hello world');
  });

  it('split then merge round-trips', () => {
    const doc = makeDoc([makeBlock('hello world')]);
    const afterSplit = applyOperation(doc, {
      type: 'split_block',
      position: { blockIndex: 0, offset: 5 },
    });
    expect(afterSplit.blocks).toHaveLength(2);

    const afterMerge = applyOperation(afterSplit, {
      type: 'merge_block',
      blockIndex: 1,
    });
    expect(afterMerge.blocks).toHaveLength(1);
    expect(getBlockText(afterMerge, 0)).toBe('hello world');
  });

  it('format, split, merge preserves formatting', () => {
    const doc = makeDoc([makeBlock('hello world')]);

    // Make "hello" bold
    const formatted = applyOperation(doc, {
      type: 'apply_formatting',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 5 },
      },
      style: { bold: true },
    });

    // Split after "hello"
    const split = applyOperation(formatted, {
      type: 'split_block',
      position: { blockIndex: 0, offset: 5 },
    });
    expect(split.blocks[0].runs[0].style.bold).toBe(true);

    // Merge back
    const merged = applyOperation(split, {
      type: 'merge_block',
      blockIndex: 1,
    });
    expect(merged.blocks[0].runs[0].text).toBe('hello');
    expect(merged.blocks[0].runs[0].style.bold).toBe(true);
    expect(merged.blocks[0].runs[1].text).toBe(' world');
    expect(merged.blocks[0].runs[1].style.bold).toBeFalsy();
  });

  it('multiple operations on multi-block document', () => {
    const doc = makeDoc([
      makeBlock('First paragraph'),
      makeBlock('Second paragraph'),
    ]);

    // Insert text in second block
    let result = applyOperation(doc, {
      type: 'insert_text',
      position: { blockIndex: 1, offset: 7 },
      text: 'great ',
    });
    expect(getBlockText(result, 1)).toBe('Second great paragraph');

    // Bold "great" in second block
    result = applyOperation(result, {
      type: 'apply_formatting',
      range: {
        start: { blockIndex: 1, offset: 7 },
        end: { blockIndex: 1, offset: 13 },
      },
      style: { bold: true },
    });

    // Change first block to heading
    result = applyOperation(result, {
      type: 'change_block_type',
      blockIndex: 0,
      newType: 'heading1',
    });

    expect(result.blocks[0].type).toBe('heading1');
    expect(getBlockText(result, 0)).toBe('First paragraph');
    expect(getBlockText(result, 1)).toBe('Second great paragraph');

    // Verify bold is on "great "
    const secondBlock = result.blocks[1];
    const boldRun = secondBlock.runs.find(
      (r) => r.style.bold && r.text.includes('great')
    );
    expect(boldRun).toBeDefined();
  });
});

describe('edge cases', () => {
  it('handles operation on non-existent block gracefully', () => {
    const doc = makeDoc([makeBlock('hello')]);
    const result = applyOperation(doc, {
      type: 'insert_text',
      position: { blockIndex: 5, offset: 0 },
      text: 'test',
    });
    // Should return unchanged doc (cloned)
    expect(result.blocks).toHaveLength(1);
    expect(getBlockText(result, 0)).toBe('hello');
  });

  it('handles merge_block with out-of-range index', () => {
    const doc = makeDoc([makeBlock('hello')]);
    const result = applyOperation(doc, {
      type: 'merge_block',
      blockIndex: 5,
    });
    expect(result.blocks).toHaveLength(1);
  });

  it('handles empty text insertion', () => {
    const doc = makeDoc([makeBlock('hello')]);
    const result = applyOperation(doc, {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 0 },
      text: '',
    });
    expect(getBlockText(result, 0)).toBe('hello');
  });

  it('handles formatting on styled text with partial overlap', () => {
    const doc = makeDoc([
      makeStyledBlock([
        { text: 'aaa', style: { bold: true } },
        { text: 'bbb', style: {} },
        { text: 'ccc', style: { italic: true } },
      ]),
    ]);
    const result = applyOperation(doc, {
      type: 'apply_formatting',
      range: {
        start: { blockIndex: 0, offset: 2 },
        end: { blockIndex: 0, offset: 7 },
      },
      style: { underline: true },
    });
    // Verify the entire text is preserved
    expect(getBlockText(result, 0)).toBe('aaabbbccc');
    // The underline should be applied to offset 2-7
    const plainSoFar: string[] = [];
    for (const run of result.blocks[0].runs) {
      const startPos = plainSoFar.join('').length;
      const endPos = startPos + run.text.length;
      if (startPos >= 2 && endPos <= 7) {
        expect(run.style.underline).toBe(true);
      }
      plainSoFar.push(run.text);
    }
  });
});

// ============================================================
// getTextInRange
// ============================================================

describe('getTextInRange', () => {
  it('extracts text from a single block', () => {
    const doc = makeDoc([makeBlock('hello world')]);
    const text = getTextInRange(doc, {
      start: { blockIndex: 0, offset: 0 },
      end: { blockIndex: 0, offset: 5 },
    });
    expect(text).toBe('hello');
  });

  it('extracts text from middle of a single block', () => {
    const doc = makeDoc([makeBlock('hello world')]);
    const text = getTextInRange(doc, {
      start: { blockIndex: 0, offset: 6 },
      end: { blockIndex: 0, offset: 11 },
    });
    expect(text).toBe('world');
  });

  it('extracts text across two blocks', () => {
    const doc = makeDoc([makeBlock('hello'), makeBlock('world')]);
    const text = getTextInRange(doc, {
      start: { blockIndex: 0, offset: 3 },
      end: { blockIndex: 1, offset: 3 },
    });
    expect(text).toBe('lo\nwor');
  });

  it('extracts text across three blocks', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb'), makeBlock('ccc')]);
    const text = getTextInRange(doc, {
      start: { blockIndex: 0, offset: 1 },
      end: { blockIndex: 2, offset: 2 },
    });
    expect(text).toBe('aa\nbbb\ncc');
  });

  it('extracts full blocks', () => {
    const doc = makeDoc([makeBlock('hello'), makeBlock('world')]);
    const text = getTextInRange(doc, {
      start: { blockIndex: 0, offset: 0 },
      end: { blockIndex: 1, offset: 5 },
    });
    expect(text).toBe('hello\nworld');
  });

  it('returns empty string for zero-width range', () => {
    const doc = makeDoc([makeBlock('hello')]);
    const text = getTextInRange(doc, {
      start: { blockIndex: 0, offset: 3 },
      end: { blockIndex: 0, offset: 3 },
    });
    expect(text).toBe('');
  });

  it('works with multiple runs in a block', () => {
    const doc = makeDoc([{
      id: 'b1',
      type: 'paragraph' as const,
      alignment: 'left' as const,
      runs: [
        { text: 'hello ', style: {} },
        { text: 'bold', style: { bold: true } },
        { text: ' world', style: {} },
      ],
    }]);
    const text = getTextInRange(doc, {
      start: { blockIndex: 0, offset: 4 },
      end: { blockIndex: 0, offset: 14 },
    });
    expect(text).toBe('o bold wor');
  });
});

// ============================================================
// Extended Block Types and Inline Code
// ============================================================

describe('insert_block operation', () => {
  it('inserts a new block after the specified block', () => {
    const doc = makeDoc([makeBlock('first'), makeBlock('second')]);
    const result = applyOperation(doc, {
      type: 'insert_block',
      afterBlockIndex: 0,
      blockType: 'paragraph',
    });
    expect(result.blocks).toHaveLength(3);
    expect(getBlockText(result, 0)).toBe('first');
    expect(getBlockText(result, 1)).toBe('');
    expect(result.blocks[1].type).toBe('paragraph');
    expect(getBlockText(result, 2)).toBe('second');
  });

  it('inserts a horizontal-rule block', () => {
    const doc = makeDoc([makeBlock('text')]);
    const result = applyOperation(doc, {
      type: 'insert_block',
      afterBlockIndex: 0,
      blockType: 'horizontal-rule',
    });
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[1].type).toBe('horizontal-rule');
  });

  it('inserts at end of document', () => {
    const doc = makeDoc([makeBlock('only')]);
    const result = applyOperation(doc, {
      type: 'insert_block',
      afterBlockIndex: 0,
      blockType: 'blockquote',
    });
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[1].type).toBe('blockquote');
  });

  it('inserts a code-block', () => {
    const doc = makeDoc([makeBlock('text')]);
    const result = applyOperation(doc, {
      type: 'insert_block',
      afterBlockIndex: 0,
      blockType: 'code-block',
    });
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[1].type).toBe('code-block');
  });

  it('does not mutate original document', () => {
    const doc = makeDoc([makeBlock('text')]);
    applyOperation(doc, {
      type: 'insert_block',
      afterBlockIndex: 0,
      blockType: 'horizontal-rule',
    });
    expect(doc.blocks).toHaveLength(1);
  });

  it('clamps afterBlockIndex that exceeds document length', () => {
    const doc = makeDoc([makeBlock('only')]);
    const result = applyOperation(doc, {
      type: 'insert_block',
      afterBlockIndex: 100,
      blockType: 'paragraph',
    });
    expect(result.blocks).toHaveLength(2);
    expect(getBlockText(result, 0)).toBe('only');
    expect(result.blocks[1].type).toBe('paragraph');
  });

  it('clamps negative afterBlockIndex to insert at beginning', () => {
    const doc = makeDoc([makeBlock('existing')]);
    const result = applyOperation(doc, {
      type: 'insert_block',
      afterBlockIndex: -5,
      blockType: 'paragraph',
    });
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[0].type).toBe('paragraph');
    expect(getBlockText(result, 1)).toBe('existing');
  });
});

describe('change_block_type with new types', () => {
  it('changes paragraph to blockquote', () => {
    const doc = makeDoc([makeBlock('quote text')]);
    const result = applyOperation(doc, {
      type: 'change_block_type',
      blockIndex: 0,
      newType: 'blockquote',
    });
    expect(result.blocks[0].type).toBe('blockquote');
    expect(getBlockText(result, 0)).toBe('quote text');
  });

  it('changes paragraph to code-block', () => {
    const doc = makeDoc([makeBlock('var x = 1;')]);
    const result = applyOperation(doc, {
      type: 'change_block_type',
      blockIndex: 0,
      newType: 'code-block',
    });
    expect(result.blocks[0].type).toBe('code-block');
    expect(getBlockText(result, 0)).toBe('var x = 1;');
  });

  it('changes paragraph to horizontal-rule', () => {
    const doc = makeDoc([makeBlock('text')]);
    const result = applyOperation(doc, {
      type: 'change_block_type',
      blockIndex: 0,
      newType: 'horizontal-rule',
    });
    expect(result.blocks[0].type).toBe('horizontal-rule');
  });

  it('changes blockquote back to paragraph', () => {
    const doc = makeDoc([makeBlock('quote', 'blockquote')]);
    const result = applyOperation(doc, {
      type: 'change_block_type',
      blockIndex: 0,
      newType: 'paragraph',
    });
    expect(result.blocks[0].type).toBe('paragraph');
    expect(getBlockText(result, 0)).toBe('quote');
  });
});

describe('inline code formatting', () => {
  it('applies code style to a range', () => {
    const doc = makeDoc([makeBlock('hello world')]);
    const result = applyOperation(doc, {
      type: 'apply_formatting',
      range: {
        start: { blockIndex: 0, offset: 6 },
        end: { blockIndex: 0, offset: 11 },
      },
      style: { code: true },
    });
    expect(result.blocks[0].runs).toHaveLength(2);
    expect(result.blocks[0].runs[0].text).toBe('hello ');
    expect(result.blocks[0].runs[0].style.code).toBeFalsy();
    expect(result.blocks[0].runs[1].text).toBe('world');
    expect(result.blocks[0].runs[1].style.code).toBe(true);
  });

  it('removes code style from a range', () => {
    const doc = makeDoc([
      makeStyledBlock([{ text: 'all code', style: { code: true } }]),
    ]);
    const result = applyOperation(doc, {
      type: 'remove_formatting',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 8 },
      },
      style: { code: true },
    });
    expect(result.blocks[0].runs[0].style.code).toBe(false);
  });

  it('code style is independent of other formatting', () => {
    const doc = makeDoc([makeBlock('text')]);
    let result = applyOperation(doc, {
      type: 'apply_formatting',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 4 },
      },
      style: { bold: true },
    });
    result = applyOperation(result, {
      type: 'apply_formatting',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 4 },
      },
      style: { code: true },
    });
    expect(result.blocks[0].runs[0].style.bold).toBe(true);
    expect(result.blocks[0].runs[0].style.code).toBe(true);
  });

  it('stylesEqual correctly handles code property', () => {
    expect(stylesEqual({ code: true }, { code: true })).toBe(true);
    expect(stylesEqual({ code: true }, {})).toBe(false);
    expect(stylesEqual({}, {})).toBe(true);
    expect(stylesEqual({ bold: true, code: true }, { bold: true, code: true })).toBe(true);
    expect(stylesEqual({ bold: true, code: true }, { bold: true })).toBe(false);
  });
});

// ============================================================
// delete_block operation
// ============================================================

describe('delete_block', () => {
  it('removes a block from the document', () => {
    const doc = makeDoc([
      makeBlock('Hello'),
      makeBlock('World'),
      makeBlock('!'),
    ]);
    const result = applyOperation(doc, {
      type: 'delete_block',
      blockIndex: 1,
    });
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[0].runs[0].text).toBe('Hello');
    expect(result.blocks[1].runs[0].text).toBe('!');
  });

  it('removes the first block', () => {
    const doc = makeDoc([
      makeBlock('First'),
      makeBlock('Second'),
    ]);
    const result = applyOperation(doc, {
      type: 'delete_block',
      blockIndex: 0,
    });
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].runs[0].text).toBe('Second');
  });

  it('removes the last block in a multi-block document', () => {
    const doc = makeDoc([
      makeBlock('First'),
      makeBlock('Last'),
    ]);
    const result = applyOperation(doc, {
      type: 'delete_block',
      blockIndex: 1,
    });
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].runs[0].text).toBe('First');
  });

  it('converts sole block to empty paragraph instead of deleting', () => {
    const doc = makeDoc([
      makeBlock('Only', 'horizontal-rule'),
    ]);
    const result = applyOperation(doc, {
      type: 'delete_block',
      blockIndex: 0,
    });
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].type).toBe('paragraph');
    expect(result.blocks[0].runs[0].text).toBe('');
  });

  it('is a no-op for out-of-bounds index', () => {
    const doc = makeDoc([makeBlock('Hello')]);
    const result = applyOperation(doc, {
      type: 'delete_block',
      blockIndex: 5,
    });
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].runs[0].text).toBe('Hello');
  });

  it('is a no-op for negative index', () => {
    const doc = makeDoc([makeBlock('Hello'), makeBlock('World')]);
    const result = applyOperation(doc, {
      type: 'delete_block',
      blockIndex: -1,
    });
    expect(result.blocks).toHaveLength(2);
  });
});
