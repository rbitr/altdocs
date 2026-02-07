# Task 002: Core Document Model

**Priority**: P0
**Depends on**: 001

## Description

Design and implement the core document data model. This is the foundation everything else builds on — get it right.

## Requirements

1. Define a document model in `src/shared/model.ts` that represents:
   - A document as an ordered list of blocks (paragraphs, headings, list items)
   - Each block contains an ordered list of text runs
   - Each text run has: text content, and a set of style flags (bold, italic, underline, strikethrough)
   - Block-level properties: type (paragraph, heading1-3, bullet-list-item, numbered-list-item), alignment (left, center, right)
2. Define an operation/command type that describes mutations:
   - Insert text at position
   - Delete text/range
   - Apply/remove formatting to a range
   - Split block (Enter key)
   - Merge blocks (Backspace at start of block)
   - Change block type
3. Implement an `applyOperation(doc, operation) => doc` pure function.
4. Write thorough unit tests for the model and operations — this is the most critical code to test well.

## Done When

- Model types are defined and exported.
- `applyOperation` handles all operation types.
- Tests cover: insertion, deletion, range deletion, formatting toggle, block split/merge, block type changes.
- All tests pass.
