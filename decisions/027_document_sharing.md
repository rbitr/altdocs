# Decision 027: Document Sharing Design

## Context
We need to implement document sharing so users can share documents via link with configurable permission levels (view-only or can-edit). This is the last remaining P1 feature.

## Decision

### Share Model: Token-based Share Links

Each document can have multiple share links, each with its own permission level. A share link is identified by a random token (URL-safe, 16 bytes hex = 32 chars). Anyone with the token can access the document at the specified permission level.

**Why token-based links (not user-based sharing):**
- Users are anonymous — there's no user directory to search/invite from
- Link-based sharing is simpler and matches Google Docs "anyone with link" model
- Works without requiring the recipient to have an account first

### Database Schema

**New `document_shares` table:**
```sql
CREATE TABLE document_shares (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  permission TEXT NOT NULL DEFAULT 'view',  -- 'view' | 'edit'
  created_by TEXT,  -- user_id of creator
  created_at TEXT NOT NULL,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);
```

**Add `owner_id` column to `documents` table:**
```sql
ALTER TABLE documents ADD COLUMN owner_id TEXT;
```
- Nullable for backward compatibility with existing documents
- Set on new document creation from req.user
- Legacy documents (owner_id = NULL) remain accessible to all

### Permission Model

1. **Owner** (documents.owner_id = user_id): Full access — read, write, delete, manage shares
2. **Editor** (share with permission='edit'): Read and write access
3. **Viewer** (share with permission='view'): Read-only access
4. **Legacy** (documents.owner_id IS NULL): Full access for everyone (backward compat)

### Access Resolution

When a user accesses a document:
1. If document has no owner (legacy) → full access
2. If user is the owner → full access
3. If request includes a share token (via `?share=TOKEN` query param) → use token's permission
4. Otherwise → no access (403)

### Share Link URL Format

`#/doc/{docId}?share={token}`

The share token is passed as a query parameter in the hash. The client stores the share token and sends it with API requests via a `X-Share-Token` header.

### API Endpoints

- `POST /api/documents/:id/shares` — Create share link (owner only). Body: `{ permission: 'view' | 'edit' }`
- `GET /api/documents/:id/shares` — List shares (owner only)
- `DELETE /api/documents/:id/shares/:shareId` — Revoke share (owner only)
- `GET /api/shared/:token` — Get document via share token (public — returns document + permission)

### WebSocket Access Control

- On join: verify user is owner OR has a valid share token with appropriate permission
- Share token passed as additional query param: `?token={session}&share={shareToken}`
- View-only users can join rooms (see cursors, see real-time edits) but operations are rejected

## Alternatives Considered

1. **User-based sharing (share with specific user IDs)**: Rejected — users are anonymous, no user directory
2. **Single share link per document**: Simpler but less flexible — can't have separate view/edit links
3. **Store permissions in document record as JSON**: Simpler but makes queries harder and doesn't scale
4. **Require auth on all document routes immediately**: Would break existing behavior for legacy docs

## Migration Strategy

- Add `owner_id` column as nullable
- Existing documents remain accessible to all (owner_id = NULL)
- New documents get owner_id from the creating user
- No data migration needed — graceful degradation for legacy docs
