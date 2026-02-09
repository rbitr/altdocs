# Task 040: Image Insertion E2E Tests

## Priority
P3 (test coverage gap)

## Description
Add comprehensive e2e (Playwright) tests for the image insertion feature (Task 037). Unit tests exist but no e2e tests cover the actual browser-based workflow.

## Requirements
- Test image block rendering in the editor
- Test image block keyboard navigation (arrow keys, Enter, Backspace/Delete on void blocks)
- Test image block persistence (save and reload)
- Test toolbar image insert button is present
- Test undo/redo of image insertion

## Notes
- Image upload involves file picker which is hard to test in e2e — focus on testing image blocks created via API and their behavior in the editor
- Use API to pre-create documents with image blocks for testing rendering/navigation
- Image blocks are void blocks (like horizontal rules) — similar navigation patterns
