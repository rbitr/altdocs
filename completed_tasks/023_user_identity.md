# Task 023: User Identity (Anonymous Persistent Sessions)

## Priority
P1 — Prerequisite for collaboration and sharing features

## Description
Add a basic user identity system with anonymous persistent sessions. Users get a unique persistent ID and can set a display name. This is the foundation for collaboration (showing other users' cursors) and sharing (permission levels).

Per the spec: "Simple user accounts (email + password or anonymous with persistent ID)" — start with anonymous persistent ID approach, which can be extended to email/password later.

## Requirements

### Server
1. Create `users` table: `id TEXT PRIMARY KEY, display_name TEXT NOT NULL, color TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL`
2. Create `sessions` table: `token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, expires_at TEXT NOT NULL`
3. POST `/api/auth/session` — Create a new anonymous session (creates user + session, returns token + user info)
4. GET `/api/auth/me` — Get current user from session token (via Authorization header)
5. PUT `/api/auth/me` — Update display name
6. Session middleware that extracts user from `Authorization: Bearer <token>` header
7. Add `owner_id` to documents table (nullable for backward compat, set on create)

### Client
1. On app load, check localStorage for session token
2. If no token, call POST `/api/auth/session` to create anonymous session
3. Store token in localStorage, send with all API requests
4. Show current user's display name and color in a small header/profile area
5. Allow editing display name via click-to-edit

### Design Decisions
- Anonymous-first: No registration required, just auto-create
- Persistent via localStorage token + server session
- Each user gets a random cursor color (for future collaboration)
- Display names default to "Anonymous User" but are editable
- Sessions expire after 30 days, auto-refresh

## Testing
- Unit tests for user/session DB operations
- API integration tests for auth endpoints
- E2E test for anonymous session creation and display name editing
