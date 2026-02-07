# Task 017: Fill Unit Test Coverage Gaps

## Priority
High — these are critical modules with zero unit tests.

## Description

Two important client modules have no unit tests:

1. **`src/client/cursor-renderer.ts`** — Maps between DOM positions and document model positions. Functions include `resolvePosition`, `resolveDocumentPosition`, `applyCursorToDOM`, `readCursorFromDOM`. Currently only tested implicitly through e2e tests.

2. **`src/client/api-client.ts`** — Client-side API functions with 3-second timeout logic. Functions include `fetchDocumentList`, `fetchDocument`, `saveDocument`, `deleteDocumentById`, `duplicateDocument`.

## Acceptance Criteria

- [ ] Unit tests for all exported functions in `cursor-renderer.ts`
- [ ] Unit tests for all exported functions in `api-client.ts` (including timeout and error handling)
- [ ] All existing tests still pass
- [ ] New tests pass
