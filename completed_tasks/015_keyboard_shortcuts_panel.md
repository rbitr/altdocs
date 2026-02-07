# Task 015: Keyboard Shortcuts Reference Panel

## Priority
P2 — UX Polish

## Description
Add a keyboard shortcuts reference panel that users can open to see all available shortcuts. This is listed under "UX Polish" in the feature spec.

## Requirements
1. A panel/overlay that displays all keyboard shortcuts organized by category
2. A way to toggle the panel open/closed:
   - Toolbar button (e.g., "?" or keyboard icon)
   - Keyboard shortcut (Ctrl+/ or Ctrl+?)
3. Panel should be dismissible (click outside, press Escape, click close button)
4. Categories: Text Formatting, Block Types, Navigation, Editing, Other
5. Clean, readable styling that matches the app's visual style

## Shortcuts to Document
### Text Formatting
- Ctrl+B — Bold
- Ctrl+I — Italic
- Ctrl+U — Underline
- Ctrl+D — Strikethrough

### Editing
- Ctrl+Z — Undo
- Ctrl+Y / Ctrl+Shift+Z — Redo
- Ctrl+A — Select All
- Ctrl+C — Copy
- Ctrl+X — Cut
- Ctrl+V — Paste

### Navigation
- Arrow keys — Move cursor
- Home / End — Line start/end
- Ctrl+Home / Ctrl+End — Document start/end

## Testing
- Unit test: shortcut panel component renders correctly, shows/hides
- E2E test: open panel via button click, verify content, close via Escape
