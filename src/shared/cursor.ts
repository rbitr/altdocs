import type { Document, Position, Range } from './model.js';
import { blockTextLength } from './model.js';

/**
 * CursorState represents the user's cursor/selection in the document.
 *
 * - anchor: where the selection started (or cursor position if collapsed)
 * - focus: where the selection ends (may be before or after anchor)
 *
 * When anchor equals focus, the cursor is collapsed (no selection).
 * The focus is where the caret is visually displayed.
 */
export interface CursorState {
  anchor: Position;
  focus: Position;
}

/** Create a collapsed cursor at a position */
export function collapsedCursor(pos: Position): CursorState {
  return { anchor: { ...pos }, focus: { ...pos } };
}

/** Check if cursor is collapsed (no selection) */
export function isCollapsed(cursor: CursorState): boolean {
  return (
    cursor.anchor.blockIndex === cursor.focus.blockIndex &&
    cursor.anchor.offset === cursor.focus.offset
  );
}

/** Compare two positions. Returns negative if a < b, 0 if equal, positive if a > b */
export function comparePositions(a: Position, b: Position): number {
  if (a.blockIndex !== b.blockIndex) return a.blockIndex - b.blockIndex;
  return a.offset - b.offset;
}

/** Get the selection range (start <= end) regardless of anchor/focus direction */
export function getSelectionRange(cursor: CursorState): Range {
  if (comparePositions(cursor.anchor, cursor.focus) <= 0) {
    return {
      start: { ...cursor.anchor },
      end: { ...cursor.focus },
    };
  }
  return {
    start: { ...cursor.focus },
    end: { ...cursor.anchor },
  };
}

/** Clamp a position to be within document bounds */
export function clampPosition(pos: Position, doc: Document): Position {
  const blockIndex = Math.max(0, Math.min(pos.blockIndex, doc.blocks.length - 1));
  const maxOffset = blockTextLength(doc.blocks[blockIndex]);
  const offset = Math.max(0, Math.min(pos.offset, maxOffset));
  return { blockIndex, offset };
}

/** Clamp a cursor state to be within document bounds */
export function clampCursor(cursor: CursorState, doc: Document): CursorState {
  return {
    anchor: clampPosition(cursor.anchor, doc),
    focus: clampPosition(cursor.focus, doc),
  };
}

// ============================================================
// Cursor Movement
// ============================================================

/** Move cursor one character to the left */
export function moveLeft(cursor: CursorState, doc: Document, extend: boolean): CursorState {
  // If there's a selection and not extending, collapse to start
  if (!extend && !isCollapsed(cursor)) {
    const range = getSelectionRange(cursor);
    return collapsedCursor(range.start);
  }

  const pos = cursor.focus;
  let newPos: Position;

  if (pos.offset > 0) {
    newPos = { blockIndex: pos.blockIndex, offset: pos.offset - 1 };
  } else if (pos.blockIndex > 0) {
    // Move to end of previous block
    const prevBlockLen = blockTextLength(doc.blocks[pos.blockIndex - 1]);
    newPos = { blockIndex: pos.blockIndex - 1, offset: prevBlockLen };
  } else {
    newPos = { ...pos };
  }

  if (extend) {
    return { anchor: { ...cursor.anchor }, focus: newPos };
  }
  return collapsedCursor(newPos);
}

/** Move cursor one character to the right */
export function moveRight(cursor: CursorState, doc: Document, extend: boolean): CursorState {
  // If there's a selection and not extending, collapse to end
  if (!extend && !isCollapsed(cursor)) {
    const range = getSelectionRange(cursor);
    return collapsedCursor(range.end);
  }

  const pos = cursor.focus;
  const blockLen = blockTextLength(doc.blocks[pos.blockIndex]);
  let newPos: Position;

  if (pos.offset < blockLen) {
    newPos = { blockIndex: pos.blockIndex, offset: pos.offset + 1 };
  } else if (pos.blockIndex < doc.blocks.length - 1) {
    // Move to start of next block
    newPos = { blockIndex: pos.blockIndex + 1, offset: 0 };
  } else {
    newPos = { ...pos };
  }

  if (extend) {
    return { anchor: { ...cursor.anchor }, focus: newPos };
  }
  return collapsedCursor(newPos);
}

/** Move cursor to start of line (Home key) */
export function moveToLineStart(cursor: CursorState, extend: boolean): CursorState {
  const newPos: Position = { blockIndex: cursor.focus.blockIndex, offset: 0 };

  if (extend) {
    return { anchor: { ...cursor.anchor }, focus: newPos };
  }
  return collapsedCursor(newPos);
}

/** Move cursor to end of line (End key) */
export function moveToLineEnd(cursor: CursorState, doc: Document, extend: boolean): CursorState {
  const blockLen = blockTextLength(doc.blocks[cursor.focus.blockIndex]);
  const newPos: Position = { blockIndex: cursor.focus.blockIndex, offset: blockLen };

  if (extend) {
    return { anchor: { ...cursor.anchor }, focus: newPos };
  }
  return collapsedCursor(newPos);
}

/** Move cursor up one block (simplified — treats each block as a line) */
export function moveUp(cursor: CursorState, doc: Document, extend: boolean): CursorState {
  const pos = cursor.focus;

  if (pos.blockIndex <= 0) {
    // At first block — move to start
    const newPos: Position = { blockIndex: 0, offset: 0 };
    if (extend) {
      return { anchor: { ...cursor.anchor }, focus: newPos };
    }
    return collapsedCursor(newPos);
  }

  const prevBlockLen = blockTextLength(doc.blocks[pos.blockIndex - 1]);
  const newPos: Position = {
    blockIndex: pos.blockIndex - 1,
    offset: Math.min(pos.offset, prevBlockLen),
  };

  if (extend) {
    return { anchor: { ...cursor.anchor }, focus: newPos };
  }
  return collapsedCursor(newPos);
}

/** Move cursor down one block (simplified — treats each block as a line) */
export function moveDown(cursor: CursorState, doc: Document, extend: boolean): CursorState {
  const pos = cursor.focus;

  if (pos.blockIndex >= doc.blocks.length - 1) {
    // At last block — move to end
    const lastBlockLen = blockTextLength(doc.blocks[doc.blocks.length - 1]);
    const newPos: Position = { blockIndex: doc.blocks.length - 1, offset: lastBlockLen };
    if (extend) {
      return { anchor: { ...cursor.anchor }, focus: newPos };
    }
    return collapsedCursor(newPos);
  }

  const nextBlockLen = blockTextLength(doc.blocks[pos.blockIndex + 1]);
  const newPos: Position = {
    blockIndex: pos.blockIndex + 1,
    offset: Math.min(pos.offset, nextBlockLen),
  };

  if (extend) {
    return { anchor: { ...cursor.anchor }, focus: newPos };
  }
  return collapsedCursor(newPos);
}

/** Select the entire document */
export function selectAll(doc: Document): CursorState {
  const lastBlockIndex = doc.blocks.length - 1;
  const lastBlockLen = blockTextLength(doc.blocks[lastBlockIndex]);
  return {
    anchor: { blockIndex: 0, offset: 0 },
    focus: { blockIndex: lastBlockIndex, offset: lastBlockLen },
  };
}

/** Collapse selection to its start */
export function collapseToStart(cursor: CursorState): CursorState {
  const range = getSelectionRange(cursor);
  return collapsedCursor(range.start);
}

/** Collapse selection to its end */
export function collapseToEnd(cursor: CursorState): CursorState {
  const range = getSelectionRange(cursor);
  return collapsedCursor(range.end);
}

/** Move cursor to the start of the document */
export function moveToDocStart(extend: boolean, cursor: CursorState): CursorState {
  const newPos: Position = { blockIndex: 0, offset: 0 };
  if (extend) {
    return { anchor: { ...cursor.anchor }, focus: newPos };
  }
  return collapsedCursor(newPos);
}

/** Move cursor to the end of the document */
export function moveToDocEnd(doc: Document, extend: boolean, cursor: CursorState): CursorState {
  const lastBlockIndex = doc.blocks.length - 1;
  const lastBlockLen = blockTextLength(doc.blocks[lastBlockIndex]);
  const newPos: Position = { blockIndex: lastBlockIndex, offset: lastBlockLen };
  if (extend) {
    return { anchor: { ...cursor.anchor }, focus: newPos };
  }
  return collapsedCursor(newPos);
}
