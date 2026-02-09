# Task 005: Keyboard Input Handling

**Priority**: P0
**Depends on**: 004

## Description

Capture keyboard events and translate them into document operations. This connects user typing to the document model.

## Requirements

1. Create `src/client/input.ts` that handles keyboard events on the editor.
2. Map keyboard events to operations:
   - Character input → insert_text operation
   - Backspace → delete_text (single char or selection) or merge_block
   - Delete → delete_text forward
   - Enter → split_block operation
   - Arrow keys → cursor movement (no operation, just cursor state update)
3. Handle modifier keys:
   - Shift+arrows → extend selection
   - Ctrl/Cmd+A → select all
   - Ctrl/Cmd+B → toggle bold formatting
   - Ctrl/Cmd+I → toggle italic formatting
   - Ctrl/Cmd+U → toggle underline formatting
4. Apply operations through applyOperation and re-render.
5. Maintain cursor position after operations (e.g., after insert, cursor moves forward).
6. Write tests for keyboard-to-operation mapping.

## Done When

- Typing characters inserts text at the cursor position.
- Backspace and Delete work correctly (including at block boundaries).
- Enter splits the current block.
- Selection + typing replaces the selection.
- Formatting shortcuts (Ctrl+B/I/U) toggle formatting on selection.
- Tests verify correct operations are produced for various key combinations.
