# Task 041: Add delete_block Operation and Fix Void Block Deletion

## Priority: High (Bug Fix)

## Problem
Void block deletion (Backspace on HR/image blocks) directly mutates `this.doc.blocks`
via `splice()` instead of using the operation system. This means:
1. Void block deletions are NOT broadcast to collaborators via WebSocket
2. OT transforms don't apply to these mutations
3. Document state can diverge between collaborating users

Similarly, image upload failure cleanup also uses direct `splice()`.

## Solution

### 1. Add `delete_block` operation type
- New operation: `{ type: 'delete_block', blockIndex: number }`
- `applyOperation()` removes the block at the given index
- Guard: if only one block remains, convert to empty paragraph instead of deleting

### 2. OT transforms for delete_block
- Transform delete_block against all existing operation types
- Transform all existing operations against delete_block
- Key semantics: similar to merge_block for block index shifts

### 3. Fix editor.ts handleBackspace void block path
- Replace direct `splice()` with `delete_block` operation via `applyLocal()`

### 4. Fix editor.ts image upload failure cleanup
- Replace direct `splice()` with `delete_block` operation via `applyLocal()`

### 5. Add transformBlockIndex safety clamp
- Ensure `transformBlockIndex` never returns negative values

### 6. Tests
- Unit tests for delete_block in model.test.ts
- OT transform tests for delete_block in ot.test.ts
- Verify existing editor tests still pass
