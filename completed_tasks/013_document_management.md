# Task 013: Document Management (Rename, Delete, Duplicate)

## Priority
P2 (but high value — makes document list usable before P1 collaboration work)

## Description
Add basic document management capabilities: rename documents, delete documents, and duplicate documents. Also add an editable document title in the editor view.

## Requirements

### API
- [x] DELETE endpoint for `/api/documents/:id` (db.ts already has `deleteDocument()`)
- [ ] Title update already works via PUT — just need UI

### Editor View
- [ ] Editable document title above the toolbar (replaces "All Documents" back link area)
- [ ] Title changes auto-save with the document
- [ ] Title updates reflected when navigating back to document list

### Document List
- [ ] Delete button on each document with confirmation
- [ ] Inline rename (click title to edit)
- [ ] Duplicate button on each document
- [ ] Better display: show "Untitled" in gray/italic when no real title

### Tests
- [ ] API tests for DELETE endpoint
- [ ] Unit/integration tests for rename and duplicate flows
- [ ] E2E tests for document management UI
