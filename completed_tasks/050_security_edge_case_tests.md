# Task 050: Security & Edge Case Test Hardening

## Priority: Medium-High

## Description
Add tests for security-sensitive and edge-case scenarios across the upload, auth, and WebSocket modules. These address real gaps identified in the test coverage analysis.

## Acceptance Criteria
1. Upload module:
   - Test filename with path traversal characters (e.g., `../../etc/passwd`)
   - Test MIME type spoofing (wrong Content-Type header)
   - Test HTML/SVG upload rejection (XSS vector)
   - Test empty Content-Type header
   - Test boundary edge cases
2. Auth module:
   - Test various malformed Authorization header formats
   - Test whitespace-only display names
   - Test special characters in display names
   - Test non-string display_name values
3. WebSocket module:
   - Test malformed message types
   - Test operation on wrong document
   - Test room cleanup after all clients leave
   - Test multiple rapid joins/leaves
   - Test operation history pruning
