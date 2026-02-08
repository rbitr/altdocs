# Task 048: Find & Replace + Word Deletion Shortcuts

## Priority: HIGH

## Description
Add essential text navigation and editing features that users expect in any document editor:
1. **Word deletion**: Ctrl+Backspace (delete previous word) and Ctrl+Delete (delete next word)
2. **Find & Replace**: Ctrl+F opens find bar, Ctrl+H opens find & replace bar, with next/previous navigation and replace/replace all

## Requirements

### Word Deletion
- Ctrl+Backspace deletes the previous word from cursor position
- Ctrl+Delete deletes the next word from cursor position
- Word boundaries follow standard rules (whitespace, punctuation)
- Works within a single block (doesn't cross block boundaries)

### Find & Replace
- Ctrl+F opens a find bar overlay at the top of the editor
- Type to search; matches are highlighted in the document
- Next/Previous buttons (or Enter/Shift+Enter) to navigate between matches
- Current match highlighted differently from other matches
- Ctrl+H opens find & replace mode with replace input
- Replace button replaces current match
- Replace All button replaces all matches
- Escape closes the find bar
- Match count displayed (e.g., "3 of 12")

## Acceptance Criteria
- Word deletion works correctly with unit tests
- Find & replace UI works with unit and e2e tests
- All existing tests still pass
- TypeScript compiles cleanly
