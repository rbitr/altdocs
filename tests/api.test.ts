import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import { apiRouter } from '../src/server/api.js';
import { resetStore, useMemoryDb } from '../src/server/db.js';
import type { Server } from 'http';

let server: Server;
let baseUrl: string;

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(apiRouter);
  return app;
}

beforeAll(async () => {
  useMemoryDb();
  const app = createTestApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      if (typeof addr === 'object' && addr) {
        baseUrl = `http://localhost:${addr.port}`;
      }
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  resetStore();
});

describe('API Endpoints', () => {
  describe('POST /api/documents', () => {
    it('creates a new document', async () => {
      const res = await fetch(`${baseUrl}/api/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'doc1', title: 'Test', content: '[]' }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBe('doc1');
      expect(body.title).toBe('Test');
      expect(body.content).toBe('[]');
      expect(body.created_at).toBeTruthy();
      expect(body.updated_at).toBeTruthy();
    });

    it('rejects missing id', async () => {
      const res = await fetch(`${baseUrl}/api/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'No ID' }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects duplicate id', async () => {
      await fetch(`${baseUrl}/api/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'dup', title: 'First' }),
      });
      const res = await fetch(`${baseUrl}/api/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'dup', title: 'Second' }),
      });
      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/documents/:id', () => {
    it('returns a document by id', async () => {
      await fetch(`${baseUrl}/api/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'doc1', title: 'Test', content: '[{"block":1}]' }),
      });

      const res = await fetch(`${baseUrl}/api/documents/doc1`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe('doc1');
      expect(body.title).toBe('Test');
      expect(body.content).toBe('[{"block":1}]');
    });

    it('returns 404 for non-existent document', async () => {
      const res = await fetch(`${baseUrl}/api/documents/nope`);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/documents/:id', () => {
    it('updates an existing document', async () => {
      await fetch(`${baseUrl}/api/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'doc1', title: 'Original', content: '[]' }),
      });

      const res = await fetch(`${baseUrl}/api/documents/doc1`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated', content: '[{"new":true}]' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.title).toBe('Updated');
      expect(body.content).toBe('[{"new":true}]');
    });

    it('creates document if it does not exist (upsert)', async () => {
      const res = await fetch(`${baseUrl}/api/documents/newdoc`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New via PUT', content: '[]' }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBe('newdoc');
      expect(body.title).toBe('New via PUT');
    });

    it('preserves title if not provided in update', async () => {
      await fetch(`${baseUrl}/api/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'doc1', title: 'Keep This', content: '[]' }),
      });

      const res = await fetch(`${baseUrl}/api/documents/doc1`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '[{"updated":true}]' }),
      });
      const body = await res.json();
      expect(body.title).toBe('Keep This');
      expect(body.content).toBe('[{"updated":true}]');
    });
  });

  describe('DELETE /api/documents/:id', () => {
    it('deletes an existing document', async () => {
      await fetch(`${baseUrl}/api/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'doc1', title: 'To Delete', content: '[]' }),
      });

      const res = await fetch(`${baseUrl}/api/documents/doc1`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(204);

      // Verify it's gone
      const getRes = await fetch(`${baseUrl}/api/documents/doc1`);
      expect(getRes.status).toBe(404);
    });

    it('returns 404 for non-existent document', async () => {
      const res = await fetch(`${baseUrl}/api/documents/nope`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(404);
    });

    it('does not affect other documents', async () => {
      await fetch(`${baseUrl}/api/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'keep', title: 'Keep', content: '[]' }),
      });
      await fetch(`${baseUrl}/api/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'remove', title: 'Remove', content: '[]' }),
      });

      await fetch(`${baseUrl}/api/documents/remove`, { method: 'DELETE' });

      const listRes = await fetch(`${baseUrl}/api/documents`);
      const docs = await listRes.json();
      expect(docs.length).toBe(1);
      expect(docs[0].id).toBe('keep');
    });
  });

  describe('GET /api/documents/:id/versions', () => {
    it('returns version list after updates', async () => {
      await fetch(`${baseUrl}/api/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'doc1', title: 'Test', content: '[]' }),
      });
      // Update twice to create versions
      await fetch(`${baseUrl}/api/documents/doc1`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Update 1', content: '[1]' }),
      });
      await fetch(`${baseUrl}/api/documents/doc1`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Update 2', content: '[2]' }),
      });

      const res = await fetch(`${baseUrl}/api/documents/doc1/versions`);
      expect(res.status).toBe(200);
      const versions = await res.json();
      expect(versions.length).toBe(2);
      expect(versions[0].version_number).toBe(2);
      expect(versions[1].version_number).toBe(1);
      // List items don't include content
      expect(versions[0].content).toBeUndefined();
    });

    it('returns 404 for non-existent document', async () => {
      const res = await fetch(`${baseUrl}/api/documents/nope/versions`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/documents/:id/versions/:version', () => {
    it('returns a specific version with content', async () => {
      await fetch(`${baseUrl}/api/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'doc1', title: 'Test', content: '[]' }),
      });
      await fetch(`${baseUrl}/api/documents/doc1`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'V1 Title', content: '[1]' }),
      });

      const res = await fetch(`${baseUrl}/api/documents/doc1/versions/1`);
      expect(res.status).toBe(200);
      const version = await res.json();
      expect(version.version_number).toBe(1);
      expect(version.title).toBe('V1 Title');
      expect(version.content).toBe('[1]');
    });

    it('returns 404 for non-existent version', async () => {
      await fetch(`${baseUrl}/api/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'doc1', title: 'Test', content: '[]' }),
      });
      const res = await fetch(`${baseUrl}/api/documents/doc1/versions/99`);
      expect(res.status).toBe(404);
    });

    it('returns 400 for invalid version number', async () => {
      await fetch(`${baseUrl}/api/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'doc1', title: 'Test', content: '[]' }),
      });
      const res = await fetch(`${baseUrl}/api/documents/doc1/versions/abc`);
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/documents/:id/versions/:version/restore', () => {
    it('restores a version and updates the document', async () => {
      await fetch(`${baseUrl}/api/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'doc1', title: 'Original', content: '[0]' }),
      });
      await fetch(`${baseUrl}/api/documents/doc1`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'V1 Title', content: '[1]' }),
      });
      await fetch(`${baseUrl}/api/documents/doc1`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'V2 Title', content: '[2]' }),
      });

      // Restore version 1
      const res = await fetch(`${baseUrl}/api/documents/doc1/versions/1/restore`, {
        method: 'POST',
      });
      expect(res.status).toBe(200);
      const restored = await res.json();
      expect(restored.title).toBe('V1 Title');
      expect(restored.content).toBe('[1]');

      // Verify the document now has the restored content
      const getRes = await fetch(`${baseUrl}/api/documents/doc1`);
      const doc = await getRes.json();
      expect(doc.title).toBe('V1 Title');
      expect(doc.content).toBe('[1]');
    });

    it('returns 404 for non-existent version', async () => {
      await fetch(`${baseUrl}/api/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'doc1', title: 'Test', content: '[]' }),
      });
      const res = await fetch(`${baseUrl}/api/documents/doc1/versions/99/restore`, {
        method: 'POST',
      });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/documents', () => {
    it('returns empty list when no documents', async () => {
      const res = await fetch(`${baseUrl}/api/documents`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual([]);
    });

    it('returns all documents', async () => {
      await fetch(`${baseUrl}/api/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'a', title: 'Doc A', content: '[]' }),
      });
      await fetch(`${baseUrl}/api/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'b', title: 'Doc B', content: '[]' }),
      });

      const res = await fetch(`${baseUrl}/api/documents`);
      const body = await res.json();
      expect(body.length).toBe(2);
      // Each item should have id, title, updated_at (but not content)
      for (const item of body) {
        expect(item.id).toBeTruthy();
        expect(item.title).toBeTruthy();
        expect(item.updated_at).toBeTruthy();
        expect(item.content).toBeUndefined();
      }
    });
  });
});
