# Task 049: Robustness & Error Handling Fixes

## Priority: P2 (Code quality & hardening)

## Description
Address several robustness issues found during code review:

1. **API client res.json() error handling**: All `res.json()` calls in api-client.ts can throw if the server returns malformed JSON with a 2xx status. Wrap in try-catch with graceful fallback.

2. **SharePanel race condition**: Clicking the Share button creates a new SharePanel instance every time without destroying the old one. Rapid clicks can create multiple overlays.

3. **Font size validation upper bound**: Server validation accepts any positive fontSize but should cap at a reasonable maximum (e.g., 400) to prevent UI-breaking values.

4. **WebSocket fallback block**: When JSON.parse fails for room document content, the fallback block includes `indentLevel: 0` explicitly — this is fine but should use the same structure as createEmptyDocument() for consistency.

## Acceptance Criteria
- [ ] API client gracefully handles malformed JSON responses
- [ ] SharePanel properly destroys previous instance before creating new one
- [ ] Font size has reasonable upper bound in validation
- [ ] WebSocket fallback block matches canonical empty block structure
- [ ] All existing tests pass
- [ ] New tests cover the fixes
