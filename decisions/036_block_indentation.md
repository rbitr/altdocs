# Decision 036: Block Indentation Design

## Context

The P3 feature "Margins and Indentation" from FEATURES.md calls for block-level indentation. Decision 001 explicitly planned for this: "Nesting (e.g., lists within lists) can be handled later by adding indentation levels to blocks."

## Decision

### Approach: Optional `indentLevel` field on Block

Added an optional `indentLevel?: number` field to the `Block` interface (default 0, range 0-8). This is the simplest approach that supports both:

1. **Nested lists**: Bullet/numbered list items at different indent levels render as nested `<ul>`/`<ol>` elements.
2. **General block indentation**: Non-list blocks (paragraphs, headings, blockquotes, etc.) get `margin-left` via CSS `data-indent` attributes.

### New Operation: `set_indent`

A new `set_indent` operation changes a block's indent level. This is structurally identical to `change_block_type` and `change_block_alignment` — it only affects a single block at a given index.

### OT Transforms

The `set_indent` operation uses the same `transformBlockIndex` helper as `change_block_type` and `change_block_alignment`. It adjusts the block index when split_block/merge_block/insert_block operations change block positions. Text operations and formatting operations don't affect it.

### Renderer Strategy

For list items, the renderer maintains a `listStack` — an array of `{element, indent, type}` entries tracking the current nesting level. When a list item has a deeper indent than the current level, sub-lists are created as children of the last `<li>`. When indent decreases, the stack is popped. This produces valid HTML nesting.

For non-list blocks, a `data-indent` attribute is set and CSS applies `margin-left` at 1.5em per level.

### Why `indentLevel` is optional

Making the field optional (with `??` defaulting to 0) avoids breaking all existing Block literals in tests and stored documents. The `getIndentLevel(block)` helper function provides safe access.

### Keyboard Interaction

- **Tab** indents the current block (any block type).
- **Shift+Tab** outdents the current block.
- Toolbar indent/outdent buttons also available.

### Split Block Behavior

When splitting a block (Enter key), the new block inherits the parent's indent level. This matches Google Docs behavior where pressing Enter in a nested list item creates a new item at the same level.

## Alternatives Considered

1. **Required `indentLevel` field**: Cleaner type-wise but would require updating ~100+ block literals in test files and migrating stored documents. Not worth the churn.

2. **Separate indent/outdent operations instead of set_indent**: Would require two operation types and more OT transform pairs. `set_indent` is simpler and more general (can set to any level in one operation).

3. **Tree-based nesting**: Would allow richer nesting (e.g., lists inside blockquotes) but would require fundamental changes to the flat block model and all operations. Far too complex for the current need.

## Status

Implemented with 51 unit tests and 7 e2e tests. All 1028 unit tests and 150 e2e tests pass.
