# Decision 023: User Identity — Anonymous Persistent Sessions

## Context
P1 collaboration features require user identity. The spec says "Simple user accounts (email + password or anonymous with persistent ID)". We need a foundation before adding real-time collaboration, sharing, and presence.

## Decision
Implement anonymous persistent sessions as the first step:

1. **Anonymous-first**: No registration required. On first visit, the client automatically creates a session.
2. **Persistent via token**: Server generates a random token, client stores it in localStorage, sends via `Authorization: Bearer <token>` header.
3. **Users table**: `id`, `display_name`, `color`, `created_at`, `updated_at`.
4. **Sessions table**: `token`, `user_id`, `created_at`, `expires_at` (30-day expiry).
5. **User color**: Random from a curated palette of 12 distinct colors. Used for cursor display in future collaboration.
6. **Display name**: Defaults to "Anonymous" + random animal. Editable by the user.
7. **No owner_id on documents yet**: Document ownership/permissions will be added in a sharing task. This task focuses purely on identity.
8. **No mandatory auth on existing endpoints**: Existing document APIs continue to work without auth. The auth middleware extracts user if present but doesn't reject requests without tokens.

## Alternatives Considered

### Email/password first
- Pro: More traditional, handles identity properly
- Con: Adds complexity (password hashing, forgot password, validation), friction for users
- **Rejected**: Spec suggests anonymous first. Can always add email/password upgrade later.

### JWT tokens (stateless)
- Pro: No session table needed, scales horizontally
- Con: Can't invalidate tokens server-side, larger tokens
- **Rejected**: We're single-server SQLite. Stateful sessions are simpler and we can revoke them.

### Cookie-based sessions
- Pro: Browser handles storage/sending automatically
- Con: CSRF concerns, more complex with SPA, can't easily use with WebSocket
- **Rejected**: Token in header is simpler for SPA and will work naturally with WebSocket connections.

## Consequences
- Every API request can optionally include auth via header
- Users get persistent identity across page reloads
- Foundation ready for collaboration (cursor colors, display names)
- Can be extended to email/password accounts later by adding credentials to users table
