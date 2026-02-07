import { describe, it, expect } from 'vitest';
import {
  CursorState,
  collapsedCursor,
  isCollapsed,
  comparePositions,
  getSelectionRange,
  clampPosition,
  clampCursor,
  moveLeft,
  moveRight,
  moveToLineStart,
  moveToLineEnd,
  moveUp,
  moveDown,
  selectAll,
  collapseToStart,
  collapseToEnd,
  moveToDocStart,
  moveToDocEnd,
} from '../src/shared/cursor.js';
import type { Document, Block } from '../src/shared/model.js';

// ============================================================
// Helpers
// ============================================================

function makeDoc(blocks: Block[]): Document {
  return { id: 'test', title: 'Test', blocks };
}

function makeBlock(text: string): Block {
  return {
    id: `b${Math.random()}`,
    type: 'paragraph',
    alignment: 'left',
    runs: [{ text, style: {} }],
  };
}

function threeBlockDoc(): Document {
  return makeDoc([
    makeBlock('hello'),      // block 0: 5 chars
    makeBlock('world wide'), // block 1: 10 chars
    makeBlock('test'),       // block 2: 4 chars
  ]);
}

// ============================================================
// Tests
// ============================================================

describe('collapsedCursor', () => {
  it('creates a cursor with matching anchor and focus', () => {
    const cursor = collapsedCursor({ blockIndex: 0, offset: 3 });
    expect(cursor.anchor).toEqual({ blockIndex: 0, offset: 3 });
    expect(cursor.focus).toEqual({ blockIndex: 0, offset: 3 });
  });
});

describe('isCollapsed', () => {
  it('returns true for collapsed cursor', () => {
    const cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    expect(isCollapsed(cursor)).toBe(true);
  });

  it('returns false for selection', () => {
    const cursor: CursorState = {
      anchor: { blockIndex: 0, offset: 0 },
      focus: { blockIndex: 0, offset: 5 },
    };
    expect(isCollapsed(cursor)).toBe(false);
  });
});

describe('comparePositions', () => {
  it('returns 0 for equal positions', () => {
    expect(comparePositions({ blockIndex: 0, offset: 3 }, { blockIndex: 0, offset: 3 })).toBe(0);
  });

  it('returns negative when first is before second (same block)', () => {
    expect(comparePositions({ blockIndex: 0, offset: 1 }, { blockIndex: 0, offset: 5 })).toBeLessThan(0);
  });

  it('returns positive when first is after second (same block)', () => {
    expect(comparePositions({ blockIndex: 0, offset: 5 }, { blockIndex: 0, offset: 1 })).toBeGreaterThan(0);
  });

  it('compares by block index first', () => {
    expect(comparePositions({ blockIndex: 0, offset: 99 }, { blockIndex: 1, offset: 0 })).toBeLessThan(0);
  });
});

describe('getSelectionRange', () => {
  it('returns range in order for forward selection', () => {
    const cursor: CursorState = {
      anchor: { blockIndex: 0, offset: 0 },
      focus: { blockIndex: 0, offset: 5 },
    };
    const range = getSelectionRange(cursor);
    expect(range.start).toEqual({ blockIndex: 0, offset: 0 });
    expect(range.end).toEqual({ blockIndex: 0, offset: 5 });
  });

  it('returns range in order for backward selection', () => {
    const cursor: CursorState = {
      anchor: { blockIndex: 1, offset: 3 },
      focus: { blockIndex: 0, offset: 2 },
    };
    const range = getSelectionRange(cursor);
    expect(range.start).toEqual({ blockIndex: 0, offset: 2 });
    expect(range.end).toEqual({ blockIndex: 1, offset: 3 });
  });
});

describe('clampPosition', () => {
  it('clamps block index to valid range', () => {
    const doc = threeBlockDoc();
    expect(clampPosition({ blockIndex: -1, offset: 0 }, doc)).toEqual({ blockIndex: 0, offset: 0 });
    expect(clampPosition({ blockIndex: 10, offset: 0 }, doc)).toEqual({ blockIndex: 2, offset: 0 });
  });

  it('clamps offset to block text length', () => {
    const doc = threeBlockDoc();
    expect(clampPosition({ blockIndex: 0, offset: 100 }, doc)).toEqual({ blockIndex: 0, offset: 5 });
    expect(clampPosition({ blockIndex: 0, offset: -1 }, doc)).toEqual({ blockIndex: 0, offset: 0 });
  });
});

describe('moveLeft', () => {
  it('moves cursor one character left', () => {
    const doc = threeBlockDoc();
    const cursor = collapsedCursor({ blockIndex: 0, offset: 3 });
    const result = moveLeft(cursor, doc, false);
    expect(result.focus).toEqual({ blockIndex: 0, offset: 2 });
    expect(isCollapsed(result)).toBe(true);
  });

  it('moves to end of previous block at offset 0', () => {
    const doc = threeBlockDoc();
    const cursor = collapsedCursor({ blockIndex: 1, offset: 0 });
    const result = moveLeft(cursor, doc, false);
    expect(result.focus).toEqual({ blockIndex: 0, offset: 5 });
  });

  it('stays at start of document', () => {
    const doc = threeBlockDoc();
    const cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    const result = moveLeft(cursor, doc, false);
    expect(result.focus).toEqual({ blockIndex: 0, offset: 0 });
  });

  it('collapses selection to start when not extending', () => {
    const doc = threeBlockDoc();
    const cursor: CursorState = {
      anchor: { blockIndex: 0, offset: 1 },
      focus: { blockIndex: 0, offset: 4 },
    };
    const result = moveLeft(cursor, doc, false);
    expect(result.focus).toEqual({ blockIndex: 0, offset: 1 });
    expect(isCollapsed(result)).toBe(true);
  });

  it('extends selection when shift is held', () => {
    const doc = threeBlockDoc();
    const cursor = collapsedCursor({ blockIndex: 0, offset: 3 });
    const result = moveLeft(cursor, doc, true);
    expect(result.anchor).toEqual({ blockIndex: 0, offset: 3 });
    expect(result.focus).toEqual({ blockIndex: 0, offset: 2 });
    expect(isCollapsed(result)).toBe(false);
  });
});

describe('moveRight', () => {
  it('moves cursor one character right', () => {
    const doc = threeBlockDoc();
    const cursor = collapsedCursor({ blockIndex: 0, offset: 3 });
    const result = moveRight(cursor, doc, false);
    expect(result.focus).toEqual({ blockIndex: 0, offset: 4 });
  });

  it('moves to start of next block at end', () => {
    const doc = threeBlockDoc();
    const cursor = collapsedCursor({ blockIndex: 0, offset: 5 });
    const result = moveRight(cursor, doc, false);
    expect(result.focus).toEqual({ blockIndex: 1, offset: 0 });
  });

  it('stays at end of document', () => {
    const doc = threeBlockDoc();
    const cursor = collapsedCursor({ blockIndex: 2, offset: 4 });
    const result = moveRight(cursor, doc, false);
    expect(result.focus).toEqual({ blockIndex: 2, offset: 4 });
  });

  it('collapses selection to end when not extending', () => {
    const doc = threeBlockDoc();
    const cursor: CursorState = {
      anchor: { blockIndex: 0, offset: 1 },
      focus: { blockIndex: 0, offset: 4 },
    };
    const result = moveRight(cursor, doc, false);
    expect(result.focus).toEqual({ blockIndex: 0, offset: 4 });
    expect(isCollapsed(result)).toBe(true);
  });

  it('extends selection when shift is held', () => {
    const doc = threeBlockDoc();
    const cursor = collapsedCursor({ blockIndex: 0, offset: 3 });
    const result = moveRight(cursor, doc, true);
    expect(result.anchor).toEqual({ blockIndex: 0, offset: 3 });
    expect(result.focus).toEqual({ blockIndex: 0, offset: 4 });
  });
});

describe('moveToLineStart', () => {
  it('moves to start of current block', () => {
    const cursor = collapsedCursor({ blockIndex: 1, offset: 5 });
    const result = moveToLineStart(cursor, false);
    expect(result.focus).toEqual({ blockIndex: 1, offset: 0 });
    expect(isCollapsed(result)).toBe(true);
  });

  it('extends selection to line start', () => {
    const cursor = collapsedCursor({ blockIndex: 1, offset: 5 });
    const result = moveToLineStart(cursor, true);
    expect(result.anchor).toEqual({ blockIndex: 1, offset: 5 });
    expect(result.focus).toEqual({ blockIndex: 1, offset: 0 });
  });
});

describe('moveToLineEnd', () => {
  it('moves to end of current block', () => {
    const doc = threeBlockDoc();
    const cursor = collapsedCursor({ blockIndex: 1, offset: 3 });
    const result = moveToLineEnd(cursor, doc, false);
    expect(result.focus).toEqual({ blockIndex: 1, offset: 10 });
    expect(isCollapsed(result)).toBe(true);
  });

  it('extends selection to line end', () => {
    const doc = threeBlockDoc();
    const cursor = collapsedCursor({ blockIndex: 1, offset: 3 });
    const result = moveToLineEnd(cursor, doc, true);
    expect(result.anchor).toEqual({ blockIndex: 1, offset: 3 });
    expect(result.focus).toEqual({ blockIndex: 1, offset: 10 });
  });
});

describe('moveUp', () => {
  it('moves to previous block, preserving offset', () => {
    const doc = threeBlockDoc();
    const cursor = collapsedCursor({ blockIndex: 1, offset: 3 });
    const result = moveUp(cursor, doc, false);
    expect(result.focus).toEqual({ blockIndex: 0, offset: 3 });
  });

  it('clamps offset to previous block length', () => {
    const doc = threeBlockDoc();
    const cursor = collapsedCursor({ blockIndex: 1, offset: 8 });
    const result = moveUp(cursor, doc, false);
    expect(result.focus).toEqual({ blockIndex: 0, offset: 5 }); // block 0 has 5 chars
  });

  it('moves to start of document when at first block', () => {
    const doc = threeBlockDoc();
    const cursor = collapsedCursor({ blockIndex: 0, offset: 3 });
    const result = moveUp(cursor, doc, false);
    expect(result.focus).toEqual({ blockIndex: 0, offset: 0 });
  });

  it('extends selection up', () => {
    const doc = threeBlockDoc();
    const cursor = collapsedCursor({ blockIndex: 1, offset: 3 });
    const result = moveUp(cursor, doc, true);
    expect(result.anchor).toEqual({ blockIndex: 1, offset: 3 });
    expect(result.focus).toEqual({ blockIndex: 0, offset: 3 });
  });
});

describe('moveDown', () => {
  it('moves to next block, preserving offset', () => {
    const doc = threeBlockDoc();
    const cursor = collapsedCursor({ blockIndex: 0, offset: 3 });
    const result = moveDown(cursor, doc, false);
    expect(result.focus).toEqual({ blockIndex: 1, offset: 3 });
  });

  it('clamps offset to next block length', () => {
    const doc = threeBlockDoc();
    const cursor = collapsedCursor({ blockIndex: 1, offset: 8 });
    const result = moveDown(cursor, doc, false);
    expect(result.focus).toEqual({ blockIndex: 2, offset: 4 }); // block 2 has 4 chars
  });

  it('moves to end of document when at last block', () => {
    const doc = threeBlockDoc();
    const cursor = collapsedCursor({ blockIndex: 2, offset: 2 });
    const result = moveDown(cursor, doc, false);
    expect(result.focus).toEqual({ blockIndex: 2, offset: 4 });
  });

  it('extends selection down', () => {
    const doc = threeBlockDoc();
    const cursor = collapsedCursor({ blockIndex: 0, offset: 3 });
    const result = moveDown(cursor, doc, true);
    expect(result.anchor).toEqual({ blockIndex: 0, offset: 3 });
    expect(result.focus).toEqual({ blockIndex: 1, offset: 3 });
  });
});

describe('selectAll', () => {
  it('selects from start to end of document', () => {
    const doc = threeBlockDoc();
    const result = selectAll(doc);
    expect(result.anchor).toEqual({ blockIndex: 0, offset: 0 });
    expect(result.focus).toEqual({ blockIndex: 2, offset: 4 });
  });

  it('works with single block', () => {
    const doc = makeDoc([makeBlock('hello')]);
    const result = selectAll(doc);
    expect(result.anchor).toEqual({ blockIndex: 0, offset: 0 });
    expect(result.focus).toEqual({ blockIndex: 0, offset: 5 });
  });
});

describe('collapseToStart', () => {
  it('collapses forward selection to start', () => {
    const cursor: CursorState = {
      anchor: { blockIndex: 0, offset: 2 },
      focus: { blockIndex: 1, offset: 5 },
    };
    const result = collapseToStart(cursor);
    expect(result.focus).toEqual({ blockIndex: 0, offset: 2 });
    expect(isCollapsed(result)).toBe(true);
  });

  it('collapses backward selection to start', () => {
    const cursor: CursorState = {
      anchor: { blockIndex: 1, offset: 5 },
      focus: { blockIndex: 0, offset: 2 },
    };
    const result = collapseToStart(cursor);
    expect(result.focus).toEqual({ blockIndex: 0, offset: 2 });
  });
});

describe('collapseToEnd', () => {
  it('collapses forward selection to end', () => {
    const cursor: CursorState = {
      anchor: { blockIndex: 0, offset: 2 },
      focus: { blockIndex: 1, offset: 5 },
    };
    const result = collapseToEnd(cursor);
    expect(result.focus).toEqual({ blockIndex: 1, offset: 5 });
    expect(isCollapsed(result)).toBe(true);
  });
});

describe('moveToDocStart', () => {
  it('moves to start of document', () => {
    const cursor = collapsedCursor({ blockIndex: 2, offset: 3 });
    const result = moveToDocStart(false, cursor);
    expect(result.focus).toEqual({ blockIndex: 0, offset: 0 });
    expect(isCollapsed(result)).toBe(true);
  });

  it('extends selection to start', () => {
    const cursor = collapsedCursor({ blockIndex: 2, offset: 3 });
    const result = moveToDocStart(true, cursor);
    expect(result.anchor).toEqual({ blockIndex: 2, offset: 3 });
    expect(result.focus).toEqual({ blockIndex: 0, offset: 0 });
  });
});

describe('moveToDocEnd', () => {
  it('moves to end of document', () => {
    const doc = threeBlockDoc();
    const cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    const result = moveToDocEnd(doc, false, cursor);
    expect(result.focus).toEqual({ blockIndex: 2, offset: 4 });
    expect(isCollapsed(result)).toBe(true);
  });

  it('extends selection to end', () => {
    const doc = threeBlockDoc();
    const cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    const result = moveToDocEnd(doc, true, cursor);
    expect(result.anchor).toEqual({ blockIndex: 0, offset: 0 });
    expect(result.focus).toEqual({ blockIndex: 2, offset: 4 });
  });
});

describe('cursor movement sequences', () => {
  it('right then left returns to original position', () => {
    const doc = threeBlockDoc();
    const start = collapsedCursor({ blockIndex: 0, offset: 3 });
    const right = moveRight(start, doc, false);
    const back = moveLeft(right, doc, false);
    expect(back.focus).toEqual(start.focus);
  });

  it('extend selection right then collapse to start', () => {
    const doc = threeBlockDoc();
    let cursor = collapsedCursor({ blockIndex: 0, offset: 2 });
    cursor = moveRight(cursor, doc, true);
    cursor = moveRight(cursor, doc, true);
    cursor = moveRight(cursor, doc, true);
    expect(cursor.anchor).toEqual({ blockIndex: 0, offset: 2 });
    expect(cursor.focus).toEqual({ blockIndex: 0, offset: 5 });

    const collapsed = collapseToStart(cursor);
    expect(collapsed.focus).toEqual({ blockIndex: 0, offset: 2 });
  });

  it('select all then move left goes to start', () => {
    const doc = threeBlockDoc();
    const selected = selectAll(doc);
    const result = moveLeft(selected, doc, false);
    expect(result.focus).toEqual({ blockIndex: 0, offset: 0 });
    expect(isCollapsed(result)).toBe(true);
  });

  it('select all then move right goes to end', () => {
    const doc = threeBlockDoc();
    const selected = selectAll(doc);
    const result = moveRight(selected, doc, false);
    expect(result.focus).toEqual({ blockIndex: 2, offset: 4 });
    expect(isCollapsed(result)).toBe(true);
  });
});
