import { Router, Request, Response } from 'express';
import {
  getDocument, listDocuments, createDocument, updateDocument, deleteDocument,
  listVersions, getVersion,
  createShare, getShareByToken, listShares, deleteShare, getShare,
} from './db.js';
import type { ShareRecord } from './db.js';
import { validateContent } from '../shared/validation.js';

const router = Router();

// ── Permission helpers ─────────────────────────────────────

type Permission = 'owner' | 'edit' | 'view' | 'none';

function resolvePermission(req: Request, docOwnerId: string | null): Permission {
  // Legacy documents (no owner) — full access for everyone
  if (!docOwnerId) return 'owner';

  // Check if user is owner
  if (req.user && req.user.user_id === docOwnerId) return 'owner';

  // Check share token from X-Share-Token header
  const shareToken = req.headers['x-share-token'] as string | undefined;
  if (shareToken) {
    const share = getShareByToken(shareToken);
    if (share) {
      return share.permission === 'edit' ? 'edit' : 'view';
    }
  }

  return 'none';
}

function canRead(permission: Permission): boolean {
  return permission !== 'none';
}

function canWrite(permission: Permission): boolean {
  return permission === 'owner' || permission === 'edit';
}

function canManage(permission: Permission): boolean {
  return permission === 'owner';
}

// ── Document routes ─────────────────────────────────────

// List all documents
router.get('/api/documents', (req, res) => {
  const docs = listDocuments();
  // Filter: show legacy (no owner) + owned by user + shared docs
  const userId = req.user?.user_id;
  if (!userId) {
    // No auth — only show legacy documents
    res.json(docs.filter(d => !d.owner_id));
    return;
  }
  // Show owned + legacy docs (shared docs accessed via direct link)
  const visible = docs.filter(d => !d.owner_id || d.owner_id === userId);
  res.json(visible);
});

// Get a single document
router.get('/api/documents/:id', (req, res) => {
  const doc = getDocument(req.params.id);
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  const permission = resolvePermission(req, doc.owner_id);
  if (!canRead(permission)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }
  res.json({ ...doc, permission });
});

// Create a new document
router.post('/api/documents', (req, res) => {
  const { id, title, content } = req.body;
  if (!id || typeof id !== 'string') {
    res.status(400).json({ error: 'id is required' });
    return;
  }
  if (getDocument(id)) {
    res.status(409).json({ error: 'Document already exists' });
    return;
  }
  const contentStr = content || '[]';
  const contentError = validateContent(contentStr);
  if (contentError) {
    res.status(400).json({ error: contentError });
    return;
  }
  const ownerId = req.user?.user_id;
  const record = createDocument(id, title || 'Untitled', contentStr, ownerId);
  res.status(201).json(record);
});

// Update a document
router.put('/api/documents/:id', (req, res) => {
  const { title, content } = req.body;
  // Validate content if provided
  if (content !== undefined) {
    const contentError = validateContent(content);
    if (contentError) {
      res.status(400).json({ error: contentError });
      return;
    }
  }
  const existing = getDocument(req.params.id);
  if (!existing) {
    // Auto-create on PUT if it doesn't exist (upsert)
    const ownerId = req.user?.user_id;
    const record = createDocument(
      req.params.id,
      title || 'Untitled',
      content || '[]',
      ownerId
    );
    res.status(201).json(record);
    return;
  }
  const permission = resolvePermission(req, existing.owner_id);
  if (!canWrite(permission)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }
  const updated = updateDocument(
    req.params.id,
    title !== undefined ? title : existing.title,
    content !== undefined ? content : existing.content
  );
  res.json(updated);
});

// Delete a document
router.delete('/api/documents/:id', (req, res) => {
  const doc = getDocument(req.params.id);
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  const permission = resolvePermission(req, doc.owner_id);
  if (!canManage(permission)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }
  deleteDocument(req.params.id);
  res.status(204).end();
});

// ── Version routes ──────────────────────────────────────

// List versions of a document
router.get('/api/documents/:id/versions', (req, res) => {
  const doc = getDocument(req.params.id);
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  const permission = resolvePermission(req, doc.owner_id);
  if (!canRead(permission)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }
  const versions = listVersions(req.params.id);
  res.json(versions);
});

// Get a specific version
router.get('/api/documents/:id/versions/:version', (req, res) => {
  const doc = getDocument(req.params.id);
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  const permission = resolvePermission(req, doc.owner_id);
  if (!canRead(permission)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }
  const versionNumber = parseInt(req.params.version, 10);
  if (isNaN(versionNumber)) {
    res.status(400).json({ error: 'Invalid version number' });
    return;
  }
  const version = getVersion(req.params.id, versionNumber);
  if (!version) {
    res.status(404).json({ error: 'Version not found' });
    return;
  }
  res.json(version);
});

// Restore a version
router.post('/api/documents/:id/versions/:version/restore', (req, res) => {
  const doc = getDocument(req.params.id);
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  const permission = resolvePermission(req, doc.owner_id);
  if (!canWrite(permission)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }
  const versionNumber = parseInt(req.params.version, 10);
  if (isNaN(versionNumber)) {
    res.status(400).json({ error: 'Invalid version number' });
    return;
  }
  const version = getVersion(req.params.id, versionNumber);
  if (!version) {
    res.status(404).json({ error: 'Version not found' });
    return;
  }
  const updated = updateDocument(req.params.id, version.title, version.content);
  if (!updated) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  res.json(updated);
});

// ── Sharing routes ──────────────────────────────────────

// Create a share link
router.post('/api/documents/:id/shares', (req: Request, res: Response) => {
  const doc = getDocument(req.params.id);
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  const permission = resolvePermission(req, doc.owner_id);
  if (!canManage(permission)) {
    res.status(403).json({ error: 'Only the document owner can manage shares' });
    return;
  }
  const sharePermission = req.body.permission;
  if (sharePermission !== 'view' && sharePermission !== 'edit') {
    res.status(400).json({ error: 'permission must be "view" or "edit"' });
    return;
  }
  const share = createShare(req.params.id, sharePermission, req.user?.user_id);
  res.status(201).json(share);
});

// List shares for a document
router.get('/api/documents/:id/shares', (req: Request, res: Response) => {
  const doc = getDocument(req.params.id);
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  const permission = resolvePermission(req, doc.owner_id);
  if (!canManage(permission)) {
    res.status(403).json({ error: 'Only the document owner can manage shares' });
    return;
  }
  const shares = listShares(req.params.id);
  res.json(shares);
});

// Delete a share link
router.delete('/api/documents/:id/shares/:shareId', (req: Request, res: Response) => {
  const doc = getDocument(req.params.id);
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  const permission = resolvePermission(req, doc.owner_id);
  if (!canManage(permission)) {
    res.status(403).json({ error: 'Only the document owner can manage shares' });
    return;
  }
  const share = getShare(req.params.shareId);
  if (!share || share.document_id !== req.params.id) {
    res.status(404).json({ error: 'Share not found' });
    return;
  }
  deleteShare(req.params.shareId);
  res.status(204).end();
});

// Access a document via share token
router.get('/api/shared/:token', (req: Request, res: Response) => {
  const share = getShareByToken(req.params.token);
  if (!share) {
    res.status(404).json({ error: 'Share link not found or expired' });
    return;
  }
  const doc = getDocument(share.document_id);
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  res.json({
    document: doc,
    permission: share.permission,
    share_token: share.token,
  });
});

export { router as apiRouter };
