# Decision 001: Document Model Design

## Context

The document model is the core data structure for AltDocs. Every feature depends on it.

## Decision

The model uses a flat list of blocks, where each block contains a list of text runs:

```
Document -> Block[] -> TextRun[]
```

### Key choices:

1. **Flat block list (not a tree)**: Blocks are stored in a flat array rather than a nested tree. This simplifies operations (insert, delete, split, merge) and makes positions easy to reason about (blockIndex + character offset). Nesting (e.g., lists within lists) can be handled later by adding indentation levels to blocks.

2. **Text runs for inline formatting**: Each block contains an ordered list of `TextRun` objects. A run has text content and a style (bold, italic, underline, strikethrough). Adjacent runs with the same style are automatically merged (normalization). This is simpler than a character-level style map and efficient enough for typical document sizes.

3. **Position = blockIndex + offset**: A document position is a block index and a character offset within that block's plain text. This makes it trivial to map positions to DOM and vice versa.

4. **Operations are data**: All mutations are described as plain operation objects that can be serialized. The `applyOperation(doc, op) => doc` function is pure (returns a new document). This is essential for undo/redo and future collaboration support.

5. **Split block creates paragraph**: When splitting a block (Enter key), the new block always gets type `paragraph`, even if the original was a heading. This matches Google Docs behavior.

## Alternatives Considered

- **Tree-based model** (like ProseMirror's): More flexible for nested structures, but significantly more complex. Premature for MVP.
- **Character-level style array**: Simpler conceptually but wasteful (every character carries style info) and harder to serialize efficiently.
- **Mutable model with event emitting**: Would be more "reactive" but breaks the pure-function approach we want for operations/undo/collaboration.

## Status

Implemented and tested with 66 unit tests covering all operation types.
