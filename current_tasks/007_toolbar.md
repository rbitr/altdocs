# Task 007: Formatting Toolbar

**Priority**: P0
**Depends on**: 005

## Description

Add a toolbar with buttons for formatting and block type changes.

## Requirements

1. Create a toolbar component in `src/client/toolbar.ts`.
2. Buttons for: Bold, Italic, Underline, Strikethrough.
3. Block type selector: Paragraph, Heading 1-3, Bullet List, Numbered List.
4. Alignment buttons: Left, Center, Right.
5. Toolbar buttons reflect current state (active when formatting is applied at cursor).
6. Toolbar actions apply formatting to the current selection or toggle at cursor.
7. Basic styling for the toolbar (fixed at top of editor area).
8. Write e2e tests for toolbar interactions.

## Done When

- Toolbar renders with all specified buttons.
- Clicking a formatting button applies formatting to the selection.
- Clicking a block type button changes the current block's type.
- Active state is shown on buttons when the cursor is in formatted text.
- Tests verify toolbar button functionality.
