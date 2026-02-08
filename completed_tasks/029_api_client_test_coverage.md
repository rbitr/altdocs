# Task 029: Expand API Client Unit Test Coverage

## Priority
P2 (Quality / Maintenance)

## Description
The `src/client/api-client.ts` module exports 21 functions but only 7 have unit tests (33% coverage). This task adds unit tests for all untested functions:

### Token Management (6 functions)
- `getStoredToken()` / `setStoredToken()` / `clearStoredToken()`
- `setShareToken()` / `getShareToken()` / `clearShareToken()`

### Auth API (4 functions)
- `createSession()`
- `getMe()`
- `updateMe()`
- `ensureSession()`

### Version API (3 functions)
- `fetchVersions()`
- `fetchVersion()`
- `restoreVersion()`

### Sharing API (4 functions)
- `createShareLink()`
- `fetchShares()`
- `deleteShareLink()`
- `fetchSharedDocument()`

## Acceptance Criteria
- All 21 exported functions in api-client.ts have at least one unit test
- Error scenarios (network failures, 401s, 404s) are tested
- Token management edge cases (localStorage unavailable, etc.) are tested
- All tests pass with `npm test`
