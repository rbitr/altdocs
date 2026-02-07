import { Router } from 'express';
import { getDocument, listDocuments, createDocument, updateDocument, deleteDocument } from './db.js';

const router = Router();

// List all documents
router.get('/api/documents', (_req, res) => {
  const docs = listDocuments();
  res.json(docs);
});

// Get a single document
router.get('/api/documents/:id', (req, res) => {
  const doc = getDocument(req.params.id);
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  res.json(doc);
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
  const record = createDocument(id, title || 'Untitled', content || '[]');
  res.status(201).json(record);
});

// Update a document
router.put('/api/documents/:id', (req, res) => {
  const { title, content } = req.body;
  const existing = getDocument(req.params.id);
  if (!existing) {
    // Auto-create on PUT if it doesn't exist (upsert)
    const record = createDocument(
      req.params.id,
      title || 'Untitled',
      content || '[]'
    );
    res.status(201).json(record);
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
  const deleted = deleteDocument(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  res.status(204).end();
});

export { router as apiRouter };
