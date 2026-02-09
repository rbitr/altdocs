# Task 035: Main.ts Unit Test Coverage

## Priority
P2 (test coverage improvement)

## Description
The `src/client/main.ts` file contains ~597 lines of complex application logic but only 4 helper functions have unit test coverage (via `main-helpers.test.ts`). The remaining functions — including routing, auto-save, editor initialization, user profile rendering, and collaborator list updates — are only exercised through e2e tests.

Add comprehensive unit tests for the untested functions in main.ts to catch edge cases and improve test reliability.

## Functions to Test
1. `scheduleAutoSave()` — debouncing logic
2. `doAutoSave()` — JSON change detection, save success/failure handling
3. `renderUserProfile()` — user profile bar creation
4. `startNameEdit()` — inline name editing with validation
5. `updateCollaboratorsList()` — collaborator dot rendering
6. `renderDocumentList()` — document list view with async operations
7. `openEditor()` — editor initialization with permissions, share tokens, collaboration
8. `route()` — hash-based routing with cleanup logic

## Acceptance Criteria
- Unit tests for the core logic of each function listed above
- Tests mock API calls, DOM interactions, and collaboration client
- All existing 918 tests continue to pass
- New tests pass
