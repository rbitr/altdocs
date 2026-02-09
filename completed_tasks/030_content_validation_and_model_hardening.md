# Task 030: Server-Side Content Validation & Model Hardening

## Priority: P1 (Data Integrity)

## Problem
1. The document API accepts arbitrary strings for `content` without validating they conform to the Block[] schema. Malformed JSON or invalid block structures can corrupt the database and crash clients.
2. `applyInsertBlock` has no bounds checking on `afterBlockIndex`.
3. `applySplitBlock` always creates paragraph blocks regardless of the source block type — the ternary is a no-op.

## Requirements
- Add a `validateContent` function that checks:
  - Content is valid JSON
  - Parsed value is an array
  - Each element has required Block properties (id, type, alignment, runs)
  - Block type is one of the valid BlockType values
  - Alignment is one of 'left', 'center', 'right'
  - Runs is an array with valid TextRun objects (text string, style object)
- Integrate validation into POST and PUT document routes
- Return 400 with descriptive error for invalid content
- Add bounds checking to `applyInsertBlock`
- Fix `applySplitBlock` type logic (new block should be paragraph for all types — simplify the dead ternary)
- Write tests for all changes

## Acceptance Criteria
- [ ] Invalid content JSON returns 400 error
- [ ] Valid content passes through unchanged
- [ ] applyInsertBlock handles out-of-bounds gracefully
- [ ] All existing tests still pass
- [ ] New unit tests for validation logic
