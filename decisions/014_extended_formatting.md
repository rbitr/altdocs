# Decision 014: Extended Formatting Implementation

## Date
2026-02-07

## Context
P2 spec calls for block quotes, horizontal rules, inline code, and code blocks.

## Decisions

### Block Types
- Added `blockquote`, `code-block`, and `horizontal-rule` to the `BlockType` union.
- Block quotes render as `<blockquote>` — a standard semantic HTML element.
- Code blocks render as `<pre><code>` — inner `<code>` wraps all runs for proper monospace rendering; formatting (bold/italic) within code blocks is kept in the model but not visually distinct in the `<pre>` context.
- Horizontal rules render as `<hr>` — a void element with no text content.

### Horizontal Rule Behavior
- HR is a block-level separator with no editable text content.
- Character input is blocked on HR blocks.
- Enter on an HR creates a new paragraph after it (via `insert_block` operation).
- Backspace on an HR deletes it. Backspace at start of a block after an HR deletes the HR.
- Insert via toolbar button (not block type dropdown) — creating a new HR inserts both the HR and a following empty paragraph for continued editing.

### New Operation: `insert_block`
- Added `insert_block` operation type for inserting new empty blocks at a specific position.
- This was needed because `split_block` always creates a paragraph from existing content, while HR insertion needs to create a new block of a specific type.

### Inline Code
- Added `code?: boolean` to `TextStyle` — treated like bold/italic/underline/strikethrough.
- Renders as `<code>` tag (instead of `<span>`) when the `code` style flag is set.
- Can be combined with other formatting (bold+code, etc.).
- Keyboard shortcut: Ctrl+` (backtick).

## Alternatives Considered
- **HR as "special operation" vs block type**: Could have made HR a non-block entity inserted via a special operation. Chose to make it a block type for consistency — the block model is the source of truth and every visible element in the document corresponds to a block.
- **Code blocks with syntax highlighting**: Deferred — syntax highlighting would require a tokenizer/parser and is a separate feature.
