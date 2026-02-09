# Task 032: UI Component Unit Tests

## Priority: P2 (Test coverage improvement)

## Description
Add unit tests for the three client UI components that currently have zero unit test coverage:
1. `src/client/share-panel.ts` — SharePanel class
2. `src/client/version-panel.ts` — VersionPanel class
3. `src/client/main.ts` — parseHash, updateSaveStatus, createLoadingIndicator, and other helpers

These components are covered by e2e tests but lack unit tests for edge cases, error paths, and DOM construction.

## Acceptance Criteria
- [ ] share-panel.test.ts with tests for open/close, share creation, copy link, revoke, error states
- [ ] version-panel.test.ts with tests for open/close, version list, restore flow, error/empty states
- [ ] main-helpers.test.ts with tests for parseHash, updateSaveStatus, createLoadingIndicator
- [ ] All existing tests still pass
- [ ] New tests all pass
