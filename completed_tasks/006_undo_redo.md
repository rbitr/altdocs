# Task 006: Undo/Redo

**Priority**: P0
**Depends on**: 005

## Description

Implement undo/redo with a history stack of document states.

## Requirements

1. Create `src/shared/history.ts` with an undo/redo manager.
2. Store document snapshots (or operations) on each change.
3. Support Ctrl/Cmd+Z for undo and Ctrl/Cmd+Shift+Z (or Ctrl+Y) for redo.
4. Reasonable history depth (at least 100 operations).
5. Redo stack is cleared when a new operation is applied after undo.
6. Write unit tests for the history manager.

## Done When

- Ctrl+Z undoes the last operation.
- Ctrl+Shift+Z redoes.
- Multiple sequential undos/redos work correctly.
- History is bounded to a reasonable depth.
- Tests cover push, undo, redo, and redo-clearing behavior.
