# Task 022: Version History

## Priority
P2 — Document Management

## Description

Implement version history so users can view and restore previous saves.

### Requirements
- Add a `document_versions` table to the database schema (document_id, version_number, content, title, created_at)
- On each save, insert a new version record (in addition to updating the main document)
- API endpoints: GET /api/documents/:id/versions (list versions), GET /api/documents/:id/versions/:version (get specific version)
- API endpoint: POST /api/documents/:id/versions/:version/restore (restore a version)
- UI panel to view version history (list of timestamps, preview content)
- Ability to restore a previous version
- Limit version retention (e.g., keep last 50 versions per document)
- Add API tests and e2e tests

## Dependencies
None — but this is the most complex remaining P2 task
