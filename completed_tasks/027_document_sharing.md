# Task 027: Document Sharing

## Priority: P1

## Description
Implement document sharing so users can share documents via link with configurable permission levels.

## Requirements
1. **Share via link**: Generate a shareable link for a document
2. **Permission levels**: view-only and can-edit permissions
3. **Document ownership**: Track who created a document (owner)
4. **Owner management**: Document owner can manage sharing settings
5. **Access control**: Enforce permissions on document read/write/delete operations

## Implementation Plan

### Database
- Add `owner_id` column to `documents` table (nullable for backward compat, defaults to null for legacy docs)
- Add `document_shares` table:
  - `id` TEXT PRIMARY KEY
  - `document_id` TEXT FOREIGN KEY
  - `share_token` TEXT UNIQUE (for share links)
  - `permission` TEXT ('view' | 'edit')
  - `created_by` TEXT (user who created the share)
  - `created_at` TEXT

### API Endpoints
- `POST /api/documents/:id/shares` — Create a share link (owner only)
- `GET /api/documents/:id/shares` — List shares for a document (owner only)
- `PUT /api/documents/:id/shares/:shareId` — Update share permission (owner only)
- `DELETE /api/documents/:id/shares/:shareId` — Revoke a share (owner only)
- `GET /api/shared/:token` — Access a shared document via token

### Permission Logic
- Document owner has full access (read, write, delete, manage shares)
- Users with edit share link can read and write
- Users with view share link can read only
- Legacy documents (no owner) remain accessible to all
- Document list shows owned docs + docs shared with user via active sessions

### Client UI
- Share button in editor toolbar area
- Share dialog/panel showing:
  - Shareable link with copy button
  - Permission level selector (view/edit)
  - List of active shares with revoke option
- Visual indicator for shared documents in doc list

### WebSocket
- Check share permissions before allowing room join
- Respect view-only permission (reject operations from view-only users)

## Acceptance Criteria
- [ ] Documents have an owner (the user who created them)
- [ ] Owner can create share links with view or edit permission
- [ ] Share links grant access to the document
- [ ] View-only users cannot edit the document
- [ ] Owner can revoke share links
- [ ] Permission enforced on API and WebSocket levels
- [ ] Unit tests for sharing logic
- [ ] E2e tests for sharing flows
