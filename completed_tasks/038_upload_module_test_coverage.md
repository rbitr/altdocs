# Task 038: Upload Module Test Coverage

## Priority: High (test coverage gap — security-critical code)

## Description
The `src/server/uploads.ts` module has zero unit tests. It contains:
- `parseMultipart()` — manual multipart boundary parsing (complex, security-sensitive)
- `uploadRouter` — Express router for file uploads with size/MIME validation
- File I/O operations (writing to data/uploads/)

This is a critical gap since upload parsing is a common attack surface.

## Requirements
1. Unit tests for `parseMultipart()`:
   - Valid multipart body with file
   - Missing boundary
   - Malformed body (no header/body separator)
   - Filename extraction (quoted, unquoted)
   - Content-Type extraction
   - Empty body / empty file content

2. Integration tests for upload router:
   - Successful upload (JPEG, PNG, GIF, WebP)
   - Rejected MIME types (text/plain, application/pdf, etc.)
   - File too large (>5MB)
   - Missing file field
   - Auth required (must have session)

3. Unit test for `uploadImage()` in api-client (if feasible in jsdom)

## Acceptance Criteria
- All tests pass
- parseMultipart edge cases covered
- Upload router validation paths covered
