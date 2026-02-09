# Decision 012: Use Anchor Position for Formatting State Display

## Context
When text is selected and formatting is applied (e.g., select "bold" in "make bold" and press Ctrl+B), the toolbar should show the bold button as active. The `getActiveFormatting()` method was reading from `cursor.focus`, but when selecting backwards with Shift+ArrowLeft, focus ends up at the left boundary of the selection — at offset 5 between runs "make " (plain) and "bold" (bold). The boundary logic would return the plain run's style, causing the toolbar to incorrectly show formatting as inactive.

## Decision
Use `cursor.anchor` instead of `cursor.focus` for determining active formatting when there's a selection. When the cursor is collapsed (no selection), continue using `cursor.focus`.

## Reasoning
- The anchor is where the user's cursor was before they started selecting — it represents the "starting point" of the selection
- When a user selects backwards from position 9 to position 5, the anchor at 9 is inside the formatted run, making it a better indicator of the selected content's style
- This matches the behavior of Google Docs and other editors, where the toolbar reflects the formatting of the selected content
- The collapsed cursor case is unaffected since anchor === focus

## Alternatives Considered
1. **Check all runs in the selection range**: More thorough but complex — what if the selection spans both bold and non-bold text? Would need "mixed state" UI.
2. **Always use the rightmost position**: Would work for left-to-right selections but would be wrong for selections starting at formatted text and extending into plain text.
3. **Change the boundary logic to be right-biased at run ends**: Would fix this specific case but could break the collapsed cursor left-bias behavior which is correct for typing position.
