# Task 009: Document Persistence (Save/Load)

**Priority**: P0
**Depends on**: 005

## Description

Save documents to the server and load them back. This requires setting up the database and API endpoints.

## Requirements

1. Set up SQLite database (via better-sqlite3) in `src/server/db.ts`.
2. Create a documents table: id, title, content (JSON), created_at, updated_at.
3. API endpoints:
   - POST /api/documents — create new document
   - GET /api/documents/:id — load document
   - PUT /api/documents/:id — save/update document
   - GET /api/documents — list all documents (id + title + updated_at)
4. Auto-save: client sends save requests on a timer and on meaningful changes.
5. Load document by ID from URL (e.g., /#/doc/:id).
6. Write integration tests for API endpoints.

## Done When

- Documents can be saved and loaded via the API.
- Auto-save works on a timer.
- Document list endpoint returns available documents.
- Integration tests verify CRUD operations.

## Notes

- better-sqlite3 requires native compilation. If this fails on the current system (no make/gcc), use a fallback like an in-memory JSON store and create a blocker for installing build tools.
