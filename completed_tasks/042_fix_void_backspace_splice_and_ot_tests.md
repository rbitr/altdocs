# Task 042: Fix Remaining Void Block Splice Bug + OT Cross-Combination Tests

## Priority: High (Bug Fix + Test Coverage)

## Problem 1: Void Block Backspace Still Uses Direct Splice

Task 041 introduced the `delete_block` operation and fixed several void block deletion paths
to use it. However, one path was missed:

**editor.ts ~line 490**: When the cursor is at the start of a text block and the *previous*
block is a void block (HR or image), pressing Backspace deletes the previous void block
using `this.doc.blocks.splice()` directly instead of the `delete_block` operation.

This means:
- The deletion is NOT broadcast to collaborators via WebSocket
- OT transforms don't apply to this mutation
- Document state can diverge between collaborating users

## Solution 1

Replace the direct `splice()` call with a `delete_block` operation via `applyLocal()`:
```typescript
const deleteOp: Operation = {
  type: 'delete_block',
  blockIndex: pos.blockIndex - 1,
};
this.applyLocal(deleteOp);
```

After the deletion, the current block shifts down by one index, so the cursor should
reference `pos.blockIndex - 1`.

## Problem 2: Missing OT Cross-Combination Tests

The newer operations (set_indent, set_image, set_line_spacing, delete_block) lack tests
for many cross-combinations. These operations all use `transformBlockIndex`, so they should
work correctly, but the combinations are untested.

## Solution 2

Add convergence tests for all missing cross-combinations of new operations.

## Tests
- Unit test for Backspace deleting previous void block via operation system
- OT convergence tests for new operation cross-combinations
