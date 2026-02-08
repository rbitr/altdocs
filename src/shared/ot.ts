// ============================================================
// Operational Transformation Engine
// ============================================================
//
// Given two concurrent operations a and b (both generated against
// the same document state S), produce transformed operations a' and b'
// such that:
//   apply(apply(S, a), b') === apply(apply(S, b), a')
//
// This module implements transformation functions for all operation
// type pairs used in the AltDocs document model.
//
// Convention: operation `a` has higher priority than `b`. When two
// inserts happen at the same position, `a`'s text comes first.
// ============================================================

import type {
  Operation,
  Position,
  Range,
  InsertTextOp,
  DeleteTextOp,
  ApplyFormattingOp,
  RemoveFormattingOp,
  SplitBlockOp,
  MergeBlockOp,
  ChangeBlockTypeOp,
  ChangeBlockAlignmentOp,
  InsertBlockOp,
  SetIndentOp,
  SetImageOp,
} from './model.js';

// ============================================================
// Position & Range Transformation Helpers
// ============================================================

/** Compare two positions. Returns -1, 0, or 1. */
function comparePositions(a: Position, b: Position): number {
  if (a.blockIndex !== b.blockIndex) return a.blockIndex < b.blockIndex ? -1 : 1;
  if (a.offset !== b.offset) return a.offset < b.offset ? -1 : 1;
  return 0;
}

/**
 * Transform a position against an insert_text operation.
 * `shiftOnTie`: if true and positions are equal, the position shifts right.
 */
function transformPositionAgainstInsert(
  pos: Position,
  insertPos: Position,
  insertLength: number,
  shiftOnTie: boolean
): Position {
  if (pos.blockIndex !== insertPos.blockIndex) return { ...pos };
  if (pos.offset < insertPos.offset) return { ...pos };
  if (pos.offset === insertPos.offset && !shiftOnTie) return { ...pos };
  return { blockIndex: pos.blockIndex, offset: pos.offset + insertLength };
}

/** Transform a position against a delete_text operation. */
function transformPositionAgainstDelete(pos: Position, range: Range): Position {
  const { start, end } = range;

  // Single-block delete
  if (start.blockIndex === end.blockIndex) {
    if (pos.blockIndex !== start.blockIndex) return { ...pos };
    if (pos.offset <= start.offset) return { ...pos };
    if (pos.offset >= end.offset) {
      return { blockIndex: pos.blockIndex, offset: pos.offset - (end.offset - start.offset) };
    }
    // Position within deleted range — collapse to start
    return { ...start };
  }

  // Multi-block delete
  if (pos.blockIndex < start.blockIndex) return { ...pos };
  if (pos.blockIndex > end.blockIndex) {
    return {
      blockIndex: pos.blockIndex - (end.blockIndex - start.blockIndex),
      offset: pos.offset,
    };
  }

  // Position is in the start block
  if (pos.blockIndex === start.blockIndex) {
    if (pos.offset <= start.offset) return { ...pos };
    return { ...start };
  }

  // Position is in a middle block (deleted)
  if (pos.blockIndex > start.blockIndex && pos.blockIndex < end.blockIndex) {
    return { ...start };
  }

  // Position is in the end block
  if (pos.blockIndex === end.blockIndex) {
    if (pos.offset >= end.offset) {
      return {
        blockIndex: start.blockIndex,
        offset: start.offset + (pos.offset - end.offset),
      };
    }
    return { ...start };
  }

  return { ...pos };
}

/** Transform a position against a split_block operation. */
function transformPositionAgainstSplit(
  pos: Position,
  splitPos: Position,
  shiftOnTie: boolean
): Position {
  if (pos.blockIndex < splitPos.blockIndex) return { ...pos };
  if (pos.blockIndex > splitPos.blockIndex) {
    return { blockIndex: pos.blockIndex + 1, offset: pos.offset };
  }
  // Same block as split
  if (pos.offset < splitPos.offset) return { ...pos };
  if (pos.offset === splitPos.offset && !shiftOnTie) return { ...pos };
  // Position moves to the new block
  return {
    blockIndex: splitPos.blockIndex + 1,
    offset: pos.offset - splitPos.offset,
  };
}

/** Transform a position against a merge_block operation (without prev block length). */
function transformPositionAgainstMerge(
  pos: Position,
  mergeBlockIndex: number
): Position {
  if (pos.blockIndex < mergeBlockIndex - 1) return { ...pos };
  if (pos.blockIndex === mergeBlockIndex - 1) return { ...pos };
  if (pos.blockIndex === mergeBlockIndex) {
    return {
      blockIndex: mergeBlockIndex - 1,
      offset: pos.offset, // approximate — server should have context for full accuracy
    };
  }
  return { blockIndex: pos.blockIndex - 1, offset: pos.offset };
}

/** Transform a position against an insert_block operation. */
function transformPositionAgainstInsertBlock(
  pos: Position,
  afterBlockIndex: number
): Position {
  if (pos.blockIndex <= afterBlockIndex) return { ...pos };
  return { blockIndex: pos.blockIndex + 1, offset: pos.offset };
}

/** Check if a position is strictly inside a range (not at the boundaries). */
function isPositionWithinRange(pos: Position, range: Range): boolean {
  const afterStart = comparePositions(pos, range.start) > 0;
  const beforeEnd = comparePositions(pos, range.end) < 0;
  return afterStart && beforeEnd;
}

/** Transform a range using a position transform function. */
function transformRange(
  range: Range,
  transformFn: (pos: Position, isEnd: boolean) => Position
): Range {
  return {
    start: transformFn(range.start, false),
    end: transformFn(range.end, true),
  };
}

// ============================================================
// Main Transform Function
// ============================================================

/**
 * Transform two concurrent operations.
 * Returns [a', b'] where:
 *   apply(apply(S, a), b') === apply(apply(S, b), a')
 *
 * `a` has priority over `b` for tie-breaking (e.g., concurrent inserts
 * at the same position: a's text goes first).
 */
export function transformOperation(
  a: Operation,
  b: Operation
): [Operation, Operation] {
  // a' = transform a against b, where a has priority (doesn't shift on tie)
  const aPrime = transformWithPriority(a, b, true);
  // b' = transform b against a, where b does NOT have priority (shifts on tie)
  const bPrime = transformWithPriority(b, a, false);
  return [aPrime, bPrime];
}

/**
 * Transform operation `op` against `other` that was applied first.
 * This version always gives priority to `other` (the already-applied operation).
 * Used by the server to transform incoming client ops against the server log.
 */
export function transformSingle(op: Operation, other: Operation): Operation {
  return transformWithPriority(op, other, false);
}

/**
 * Core transform: transform `op` assuming `other` was already applied.
 * `hasPriority`: if true, `op` has priority for tie-breaking.
 */
function transformWithPriority(
  op: Operation,
  other: Operation,
  hasPriority: boolean
): Operation {
  switch (op.type) {
    case 'insert_text':
      return transformInsertText(op, other, hasPriority);
    case 'delete_text':
      return transformDeleteText(op, other);
    case 'apply_formatting':
      return transformApplyFormatting(op, other);
    case 'remove_formatting':
      return transformRemoveFormatting(op, other);
    case 'split_block':
      return transformSplitBlock(op, other, hasPriority);
    case 'merge_block':
      return transformMergeBlock(op, other);
    case 'change_block_type':
      return transformChangeBlockType(op, other);
    case 'change_block_alignment':
      return transformChangeBlockAlignment(op, other);
    case 'insert_block':
      return transformInsertBlockOp(op, other, hasPriority);
    case 'set_indent':
      return transformSetIndent(op, other);
    case 'set_image':
      return transformSetImage(op, other);
  }
}

// ============================================================
// Transform insert_text against other operations
// ============================================================

function transformInsertText(
  op: InsertTextOp,
  other: Operation,
  hasPriority: boolean
): InsertTextOp {
  switch (other.type) {
    case 'insert_text': {
      // Two concurrent inserts at same position:
      // If we DON'T have priority, we shift right (other's text goes first).
      // If we DO have priority, we stay put (our text goes first).
      const shiftOnTie = !hasPriority;
      const newPos = transformPositionAgainstInsert(
        op.position,
        other.position,
        other.text.length,
        shiftOnTie
      );
      return { ...op, position: newPos };
    }
    case 'delete_text': {
      // Check if the insert position is strictly within the delete range.
      // If so, the insert is "swallowed" by the delete — return a no-op insert.
      if (isPositionWithinRange(op.position, other.range)) {
        return { ...op, text: '', position: { ...other.range.start } };
      }
      const newPos = transformPositionAgainstDelete(op.position, other.range);
      return { ...op, position: newPos };
    }
    case 'split_block': {
      const newPos = transformPositionAgainstSplit(op.position, other.position, true);
      return { ...op, position: newPos };
    }
    case 'merge_block': {
      const newPos = transformPositionAgainstMerge(op.position, other.blockIndex);
      return { ...op, position: newPos };
    }
    case 'insert_block': {
      const newPos = transformPositionAgainstInsertBlock(
        op.position,
        other.afterBlockIndex
      );
      return { ...op, position: newPos };
    }
    default:
      // Formatting, change_block_type, change_block_alignment don't affect positions
      return { ...op };
  }
}

// ============================================================
// Transform delete_text against other operations
// ============================================================

function transformDeleteText(op: DeleteTextOp, other: Operation): Operation {
  switch (other.type) {
    case 'insert_text': {
      return transformDeleteAgainstInsert(op, other);
    }
    case 'delete_text': {
      return transformDeleteAgainstDelete(op, other);
    }
    case 'split_block': {
      const newRange = transformRange(op.range, (pos, isEnd) =>
        transformPositionAgainstSplit(pos, other.position, isEnd)
      );
      return { ...op, range: newRange };
    }
    case 'merge_block': {
      const newRange = transformRangeAgainstMerge(op.range, other.blockIndex);
      return { ...op, range: newRange };
    }
    case 'insert_block': {
      const newRange = transformRange(op.range, (pos) =>
        transformPositionAgainstInsertBlock(pos, other.afterBlockIndex)
      );
      return { ...op, range: newRange };
    }
    default:
      return { ...op };
  }
}

/**
 * Transform a delete against a concurrent insert.
 * If the insert is within the delete range, the delete expands to include
 * the inserted text (the insert becomes a no-op via transformInsertText).
 * This ensures convergence: both paths produce the same result (delete wins).
 */
function transformDeleteAgainstInsert(
  op: DeleteTextOp,
  other: InsertTextOp
): DeleteTextOp {
  const { start, end } = op.range;
  const ins = other.position;
  const insLen = other.text.length;

  // Start shifts right when the insert is at or before it (shiftOnTie=true).
  // End shifts right only when the insert is strictly before it (shiftOnTie=false).
  // Using shiftOnTie=false for the end prevents the delete from expanding
  // to cover text inserted at the exact end boundary, which would break
  // convergence (the insert survives via transformInsertText since it's
  // not strictly within the range).
  const newStart = transformPositionAgainstInsert(start, ins, insLen, true);
  const newEnd = transformPositionAgainstInsert(end, ins, insLen, false);
  return { ...op, range: { start: newStart, end: newEnd } };
}

/** Handle two concurrent deletes. Compute what remains of our delete after the other was applied. */
function transformDeleteAgainstDelete(
  op: DeleteTextOp,
  other: DeleteTextOp
): DeleteTextOp {
  // Both deletes on same single block — the common case
  if (
    op.range.start.blockIndex === op.range.end.blockIndex &&
    other.range.start.blockIndex === other.range.end.blockIndex &&
    op.range.start.blockIndex === other.range.start.blockIndex
  ) {
    const myStart = op.range.start.offset;
    const myEnd = op.range.end.offset;
    const otherStart = other.range.start.offset;
    const otherEnd = other.range.end.offset;
    const bi = op.range.start.blockIndex;

    // No overlap — other delete is entirely before ours
    if (otherEnd <= myStart) {
      const shift = otherEnd - otherStart;
      return {
        ...op,
        range: {
          start: { blockIndex: bi, offset: myStart - shift },
          end: { blockIndex: bi, offset: myEnd - shift },
        },
      };
    }

    // No overlap — other delete is entirely after ours
    if (otherStart >= myEnd) {
      return { ...op };
    }

    // Overlap — compute the non-overlapping part of our delete
    // After the other delete is applied, any characters in the overlap
    // are already gone. We only need to delete what's left of our range.

    // Characters of our range that are before the other's start
    const beforeOverlap = Math.max(0, otherStart - myStart);
    // Characters of our range that are after the other's end
    const afterOverlap = Math.max(0, myEnd - otherEnd);

    // New start: our start shifted left by however much of the other delete
    // was before our start
    const shiftBefore = Math.max(0, Math.min(otherEnd, myStart) - otherStart);
    const newStart = myStart - shiftBefore;
    const newEnd = newStart + beforeOverlap + afterOverlap;

    if (newStart >= newEnd) {
      // Our entire delete was consumed
      return {
        ...op,
        range: {
          start: { blockIndex: bi, offset: newStart },
          end: { blockIndex: bi, offset: newStart },
        },
      };
    }

    return {
      ...op,
      range: {
        start: { blockIndex: bi, offset: newStart },
        end: { blockIndex: bi, offset: newEnd },
      },
    };
  }

  // For multi-block or cross-block deletes, use position-based transform
  const newRange = transformRange(op.range, (pos) =>
    transformPositionAgainstDelete(pos, other.range)
  );
  return { ...op, range: newRange };
}

/** Transform a range against a merge_block. */
function transformRangeAgainstMerge(range: Range, mergeBlockIndex: number): Range {
  return {
    start: transformPositionAgainstMerge(range.start, mergeBlockIndex),
    end: transformPositionAgainstMerge(range.end, mergeBlockIndex),
  };
}

// ============================================================
// Transform formatting operations against other operations
// ============================================================

function transformApplyFormatting(
  op: ApplyFormattingOp,
  other: Operation
): ApplyFormattingOp {
  const newRange = transformRangeAgainstOp(op.range, other);
  return { ...op, range: newRange };
}

function transformRemoveFormatting(
  op: RemoveFormattingOp,
  other: Operation
): RemoveFormattingOp {
  const newRange = transformRangeAgainstOp(op.range, other);
  return { ...op, range: newRange };
}

/** Generic range transformation against any operation. */
function transformRangeAgainstOp(range: Range, other: Operation): Range {
  switch (other.type) {
    case 'insert_text':
      return transformRange(range, (pos, isEnd) =>
        transformPositionAgainstInsert(pos, other.position, other.text.length, isEnd)
      );
    case 'delete_text':
      return transformRange(range, (pos) =>
        transformPositionAgainstDelete(pos, other.range)
      );
    case 'split_block':
      return transformRange(range, (pos, isEnd) =>
        transformPositionAgainstSplit(pos, other.position, isEnd)
      );
    case 'merge_block':
      return transformRangeAgainstMerge(range, other.blockIndex);
    case 'insert_block':
      return transformRange(range, (pos) =>
        transformPositionAgainstInsertBlock(pos, other.afterBlockIndex)
      );
    default:
      return { ...range };
  }
}

// ============================================================
// Transform split_block against other operations
// ============================================================

function transformSplitBlock(
  op: SplitBlockOp,
  other: Operation,
  hasPriority: boolean
): SplitBlockOp {
  switch (other.type) {
    case 'insert_text': {
      const newPos = transformPositionAgainstInsert(
        op.position,
        other.position,
        other.text.length,
        false // split stays at original position when insert is at same spot
      );
      return { ...op, position: newPos };
    }
    case 'delete_text': {
      const newPos = transformPositionAgainstDelete(op.position, other.range);
      return { ...op, position: newPos };
    }
    case 'split_block': {
      const cmp = comparePositions(op.position, other.position);
      if (cmp < 0) return { ...op };
      if (cmp === 0) {
        // Same position — both produce same split. Return as-is
        // (applying twice will create an extra empty block).
        return { ...op };
      }
      // Our split is after the other split
      const newPos = transformPositionAgainstSplit(op.position, other.position, true);
      return { ...op, position: newPos };
    }
    case 'merge_block': {
      const newPos = transformPositionAgainstMerge(op.position, other.blockIndex);
      return { ...op, position: newPos };
    }
    case 'insert_block': {
      const newPos = transformPositionAgainstInsertBlock(
        op.position,
        other.afterBlockIndex
      );
      return { ...op, position: newPos };
    }
    default:
      return { ...op };
  }
}

// ============================================================
// Transform merge_block against other operations
// ============================================================

function transformMergeBlock(op: MergeBlockOp, other: Operation): Operation {
  switch (other.type) {
    case 'split_block': {
      if (other.position.blockIndex < op.blockIndex) {
        return { ...op, blockIndex: op.blockIndex + 1 };
      }
      if (other.position.blockIndex === op.blockIndex) {
        // Split in the block we're merging — our merge index shifts
        return { ...op, blockIndex: op.blockIndex + 1 };
      }
      return { ...op };
    }
    case 'merge_block': {
      if (other.blockIndex < op.blockIndex) {
        return { ...op, blockIndex: op.blockIndex - 1 };
      }
      if (other.blockIndex === op.blockIndex) {
        // Same block merged — becomes no-op. Return merge at index that
        // will be a no-op (blockIndex 0 with merge is invalid).
        return { ...op, blockIndex: op.blockIndex - 1 };
      }
      return { ...op };
    }
    case 'insert_block': {
      if (other.afterBlockIndex < op.blockIndex) {
        return { ...op, blockIndex: op.blockIndex + 1 };
      }
      if (other.afterBlockIndex === op.blockIndex - 1) {
        // New block inserted right before our merge target
        return { ...op, blockIndex: op.blockIndex + 1 };
      }
      return { ...op };
    }
    case 'insert_text':
    case 'delete_text':
      return { ...op };
    default:
      return { ...op };
  }
}

// ============================================================
// Transform change_block_type against other operations
// ============================================================

function transformChangeBlockType(
  op: ChangeBlockTypeOp,
  other: Operation
): ChangeBlockTypeOp {
  const newIndex = transformBlockIndex(op.blockIndex, other);
  return { ...op, blockIndex: newIndex };
}

// ============================================================
// Transform change_block_alignment against other operations
// ============================================================

function transformChangeBlockAlignment(
  op: ChangeBlockAlignmentOp,
  other: Operation
): ChangeBlockAlignmentOp {
  const newIndex = transformBlockIndex(op.blockIndex, other);
  return { ...op, blockIndex: newIndex };
}

// ============================================================
// Transform insert_block against other operations
// ============================================================

function transformInsertBlockOp(
  op: InsertBlockOp,
  other: Operation,
  hasPriority: boolean
): InsertBlockOp {
  switch (other.type) {
    case 'split_block': {
      if (other.position.blockIndex <= op.afterBlockIndex) {
        return { ...op, afterBlockIndex: op.afterBlockIndex + 1 };
      }
      return { ...op };
    }
    case 'merge_block': {
      if (other.blockIndex <= op.afterBlockIndex) {
        return { ...op, afterBlockIndex: op.afterBlockIndex - 1 };
      }
      return { ...op };
    }
    case 'insert_block': {
      if (other.afterBlockIndex < op.afterBlockIndex) {
        return { ...op, afterBlockIndex: op.afterBlockIndex + 1 };
      }
      if (other.afterBlockIndex === op.afterBlockIndex) {
        // Same position — priority determines order
        if (!hasPriority) {
          return { ...op, afterBlockIndex: op.afterBlockIndex + 1 };
        }
        return { ...op };
      }
      return { ...op };
    }
    default:
      return { ...op };
  }
}

// ============================================================
// Block index transformation helper
// ============================================================

/** Transform a block index against an operation that may change block count/order. */
function transformBlockIndex(blockIndex: number, other: Operation): number {
  switch (other.type) {
    case 'split_block': {
      if (other.position.blockIndex < blockIndex) return blockIndex + 1;
      return blockIndex;
    }
    case 'merge_block': {
      if (other.blockIndex < blockIndex) return blockIndex - 1;
      if (other.blockIndex === blockIndex) return blockIndex - 1;
      return blockIndex;
    }
    case 'insert_block': {
      if (other.afterBlockIndex < blockIndex) return blockIndex + 1;
      return blockIndex;
    }
    default:
      return blockIndex;
  }
}

// ============================================================
// Transform set_indent against other operations
// ============================================================

function transformSetIndent(op: SetIndentOp, other: Operation): SetIndentOp {
  const newIndex = transformBlockIndex(op.blockIndex, other);
  return { ...op, blockIndex: newIndex };
}

// ============================================================
// Transform set_image against other operations
// ============================================================

function transformSetImage(op: SetImageOp, other: Operation): SetImageOp {
  const newIndex = transformBlockIndex(op.blockIndex, other);
  return { ...op, blockIndex: newIndex };
}

// ============================================================
// Server-side OT with document context
// ============================================================

/**
 * Transform an incoming operation against a list of operations that have
 * already been applied (the server's operation log since the client's base version).
 * Returns the transformed operation ready to apply to the current server state.
 */
export function transformOperationAgainstHistory(
  op: Operation,
  history: Operation[]
): Operation {
  let transformed = op;
  for (const past of history) {
    transformed = transformSingle(transformed, past);
  }
  return transformed;
}
