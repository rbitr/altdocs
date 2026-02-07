# Task 004: Cursor and Selection Model

**Priority**: P0
**Depends on**: 002, 003

## Description

Implement a cursor and selection model that tracks the user's editing position within the document. This is the bridge between the document model and user interaction.

## Requirements

1. Define a `CursorState` type in `src/shared/cursor.ts` that represents:
   - A single cursor position (collapsed selection)
   - A selection range (anchor + focus, which may go backwards)
2. Implement cursor movement logic:
   - Move left/right by one character
   - Move to start/end of line (Home/End)
   - Move up/down (requires knowing line breaks from rendering — can stub for now)
3. Implement selection logic:
   - Extend selection with Shift+arrow keys
   - Select all (Ctrl/Cmd+A)
   - Collapse selection to start or end
4. Render cursor position and selection highlight in the DOM:
   - Show a blinking caret at the cursor position
   - Highlight selected text range
5. Map click position (DOM coordinates) to document position.
6. Write unit tests for cursor movement and selection logic.

## Done When

- Cursor state is maintained and updates with keyboard/mouse input.
- Caret is visible at the correct position in the rendered document.
- Selection highlighting works for within-block and cross-block selections.
- Click-to-position places the cursor correctly.
- Tests cover cursor movement, selection extension, and position mapping.
