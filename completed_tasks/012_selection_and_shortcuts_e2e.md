# Task 012: Text Selection and Keyboard Shortcuts E2E Tests

## Priority
P0 hardening — all P0 features are implemented but some lack e2e test coverage.

## Description
Add end-to-end Playwright tests to verify:

1. **Click-drag text selection**: Mouse drag to select text, verify selection is reflected in the editor model. Test that selected text can be replaced by typing.
2. **Keyboard formatting shortcuts**: Verify Ctrl+B, Ctrl+I, Ctrl+U, Ctrl+D work in the browser (currently only have unit tests).
3. **Home/End key navigation**: Verify Home, End, Ctrl+Home, Ctrl+End work in the browser.

## Acceptance Criteria
- [ ] E2e test for click-drag selection that verifies text gets selected
- [ ] E2e test for typing over a selection (replace selected text)
- [ ] E2e tests for Ctrl+B, Ctrl+I, Ctrl+U, Ctrl+D keyboard shortcuts
- [ ] E2e tests for Home/End cursor navigation
- [ ] All existing tests still pass
