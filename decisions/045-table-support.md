# Decision 045: Table Support Architecture

## Context
Tables are the last major P3 feature. Need to add support for inserting, editing, and rendering tables within the document model.

## Decision

### Data Model
Tables are a new block type `'table'` stored as a single Block with a `tableData` field:
```ts
interface TableCell {
  runs: TextRun[];
}

interface Block {
  // ... existing fields
  tableData?: TableCell[][];  // rows × columns
}
```

Each cell is an array of TextRun[], using the same rich text model as regular blocks. This keeps tables consistent with the rest of the system.

### Why Single Block (Not Multiple Blocks)
- Alternatives considered: (1) one block per cell, (2) nested document per cell, (3) single block with grid data
- Chose (3) because:
  - Tables are a self-contained unit — they should move/delete as one atomic unit
  - Block-level cursor navigation can skip over the entire table
  - OT is simpler: one block-indexed operation (`set_table_data`) covers all cell edits
  - Rendering is naturally a single `<table>` element
  - Splitting/merging tables with other blocks doesn't make sense

### Operations
- `insert_block` with `blockType: 'table'` creates a table (default 2×2)
- New `set_table_data` operation: sets the entire tableData for a block (used for all cell edits: typing, adding/removing rows/columns)
- The `set_table_data` operation sends the full tableData (not cell-level diffs). This is simpler and avoids complex cell-level OT. Trade-off: larger payloads for large tables, but acceptable for typical doc editing.

### Editing
- Tables are "container" blocks: they're not void (they contain editable content) but they don't use the standard text editing path
- Cursor in a table cell is tracked as `{ blockIndex, offset }` where offset maps to a cell's text content
- Simple approach: clicking a cell focuses it; Tab moves between cells; Enter creates a new line within a cell (or we just move to next cell for simplicity)
- Arrow keys within a cell navigate text; at cell boundary, move to adjacent cell
- For this initial implementation: focus cell, type to edit, Tab/Shift+Tab to navigate cells

### OT
- `set_table_data` follows the same pattern as `set_image`: block-indexed, priority-based resolution for concurrent edits
- Block structure ops (split, merge, insert, delete) adjust the blockIndex via `transformBlockIndex`

### Rendering
- Table blocks render as `<table>` with `<tbody>`, `<tr>`, `<td>` elements
- Each cell renders its TextRun[] the same way regular blocks do
- Table has a CSS class for default styling (borders, padding)

## Alternatives Considered
1. **Cell-level OT**: Too complex for the value — would need row/column index tracking and all the position transform machinery duplicated for cell coordinates
2. **Blocks-as-cells**: Would require container/grouping blocks, fundamentally changing the flat Block[] model
3. **Rich cell content (block per cell)**: Over-engineering for typical table use cases
