import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import { apiRouter } from '../src/server/api.js';
import { authRouter, optionalAuth } from '../src/server/auth.js';
import { createDocument, createUser, createSession, createShare, resetStore, useMemoryDb } from '../src/server/db.js';
import type { Server } from 'http';

let server: Server;
let baseUrl: string;

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(optionalAuth);
  app.use(authRouter);
  app.use(apiRouter);
  return app;
}

/** Helper: create a user+session, returns { userId, token } */
function createTestUser(): { userId: string; token: string } {
  const user = createUser();
  const session = createSession(user.id);
  return { userId: user.id, token: session.token };
}

function authFetch(url: string, token: string, options?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      ...(options?.headers as Record<string, string> || {}),
      Authorization: `Bearer ${token}`,
    },
  });
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

describe('Sharing API', () => {
  describe('Document ownership', () => {
    it('new documents are owned by the creating user', async () => {
      const { token } = createTestUser();
      const res = await authFetch(`${baseUrl}/api/documents`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'doc1', title: 'Test', content: '[]' }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.owner_id).toBeTruthy();
    });

    it('documents without auth have null owner (legacy)', async () => {
      const res = await fetch(`${baseUrl}/api/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'doc1', title: 'Test', content: '[]' }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.owner_id).toBeNull();
    });
  });

  describe('Permission enforcement - owned documents', () => {
    it('owner can read their own document', async () => {
      const { userId, token } = createTestUser();
      createDocument('doc1', 'Test', '[]', userId);
      const res = await authFetch(`${baseUrl}/api/documents/doc1`, token);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.permission).toBe('owner');
    });

    it('other user cannot read an owned document without share token', async () => {
      const owner = createTestUser();
      const other = createTestUser();
      createDocument('doc1', 'Test', '[]', owner.userId);
      const res = await authFetch(`${baseUrl}/api/documents/doc1`, other.token);
      expect(res.status).toBe(403);
    });

    it('other user cannot update an owned document without share token', async () => {
      const owner = createTestUser();
      const other = createTestUser();
      createDocument('doc1', 'Test', '[]', owner.userId);
      const res = await authFetch(`${baseUrl}/api/documents/doc1`, other.token, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Hacked' }),
      });
      expect(res.status).toBe(403);
    });

    it('other user cannot delete an owned document', async () => {
      const owner = createTestUser();
      const other = createTestUser();
      createDocument('doc1', 'Test', '[]', owner.userId);
      const res = await authFetch(`${baseUrl}/api/documents/doc1`, other.token, {
        method: 'DELETE',
      });
      expect(res.status).toBe(403);
    });
  });

  describe('Permission enforcement - legacy documents', () => {
    it('legacy documents (no owner) are accessible to everyone', async () => {
      createDocument('doc1', 'Test', '[]');
      const res = await fetch(`${baseUrl}/api/documents/doc1`);
      expect(res.status).toBe(200);
    });

    it('legacy documents can be updated by anyone', async () => {
      createDocument('doc1', 'Test', '[]');
      const res = await fetch(`${baseUrl}/api/documents/doc1`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated' }),
      });
      expect(res.status).toBe(200);
    });
  });

  describe('Share link access', () => {
    it('view share token grants read access', async () => {
      const owner = createTestUser();
      const other = createTestUser();
      createDocument('doc1', 'Test', '[]', owner.userId);
      const share = createShare('doc1', 'view', owner.userId);

      const res = await fetch(`${baseUrl}/api/documents/doc1`, {
        headers: {
          Authorization: `Bearer ${other.token}`,
          'X-Share-Token': share.token,
        },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.permission).toBe('view');
    });

    it('view share token does not grant write access', async () => {
      const owner = createTestUser();
      const other = createTestUser();
      createDocument('doc1', 'Test', '[]', owner.userId);
      const share = createShare('doc1', 'view', owner.userId);

      const res = await fetch(`${baseUrl}/api/documents/doc1`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${other.token}`,
          'X-Share-Token': share.token,
        },
        body: JSON.stringify({ title: 'Hacked' }),
      });
      expect(res.status).toBe(403);
    });

    it('edit share token grants read and write access', async () => {
      const owner = createTestUser();
      const other = createTestUser();
      createDocument('doc1', 'Test Content', '[]', owner.userId);
      const share = createShare('doc1', 'edit', owner.userId);

      // Read
      const readRes = await fetch(`${baseUrl}/api/documents/doc1`, {
        headers: {
          Authorization: `Bearer ${other.token}`,
          'X-Share-Token': share.token,
        },
      });
      expect(readRes.status).toBe(200);
      const readBody = await readRes.json();
      expect(readBody.permission).toBe('edit');

      // Write
      const writeRes = await fetch(`${baseUrl}/api/documents/doc1`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${other.token}`,
          'X-Share-Token': share.token,
        },
        body: JSON.stringify({ title: 'Collaborative Edit' }),
      });
      expect(writeRes.status).toBe(200);
    });

    it('edit share does not grant delete access', async () => {
      const owner = createTestUser();
      const other = createTestUser();
      createDocument('doc1', 'Test', '[]', owner.userId);
      const share = createShare('doc1', 'edit', owner.userId);

      const res = await fetch(`${baseUrl}/api/documents/doc1`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${other.token}`,
          'X-Share-Token': share.token,
        },
      });
      expect(res.status).toBe(403);
    });

    it('invalid share token is rejected', async () => {
      const owner = createTestUser();
      const other = createTestUser();
      createDocument('doc1', 'Test', '[]', owner.userId);

      const res = await fetch(`${baseUrl}/api/documents/doc1`, {
        headers: {
          Authorization: `Bearer ${other.token}`,
          'X-Share-Token': 'invalid_token_here',
        },
      });
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/documents/:id/shares', () => {
    it('owner can create a share link', async () => {
      const { userId, token } = createTestUser();
      createDocument('doc1', 'Test', '[]', userId);

      const res = await authFetch(`${baseUrl}/api/documents/doc1/shares`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permission: 'view' }),
      });
      expect(res.status).toBe(201);
      const share = await res.json();
      expect(share.document_id).toBe('doc1');
      expect(share.permission).toBe('view');
      expect(share.token).toBeTruthy();
    });

    it('non-owner cannot create a share link', async () => {
      const owner = createTestUser();
      const other = createTestUser();
      createDocument('doc1', 'Test', '[]', owner.userId);

      const res = await authFetch(`${baseUrl}/api/documents/doc1/shares`, other.token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permission: 'view' }),
      });
      expect(res.status).toBe(403);
    });

    it('rejects invalid permission value', async () => {
      const { userId, token } = createTestUser();
      createDocument('doc1', 'Test', '[]', userId);

      const res = await authFetch(`${baseUrl}/api/documents/doc1/shares`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permission: 'admin' }),
      });
      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent document', async () => {
      const { token } = createTestUser();
      const res = await authFetch(`${baseUrl}/api/documents/nope/shares`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permission: 'view' }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/documents/:id/shares', () => {
    it('owner can list shares', async () => {
      const { userId, token } = createTestUser();
      createDocument('doc1', 'Test', '[]', userId);
      createShare('doc1', 'view', userId);
      createShare('doc1', 'edit', userId);

      const res = await authFetch(`${baseUrl}/api/documents/doc1/shares`, token);
      expect(res.status).toBe(200);
      const shares = await res.json();
      expect(shares).toHaveLength(2);
    });

    it('non-owner cannot list shares', async () => {
      const owner = createTestUser();
      const other = createTestUser();
      createDocument('doc1', 'Test', '[]', owner.userId);

      const res = await authFetch(`${baseUrl}/api/documents/doc1/shares`, other.token);
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/documents/:id/shares/:shareId', () => {
    it('owner can revoke a share', async () => {
      const { userId, token } = createTestUser();
      createDocument('doc1', 'Test', '[]', userId);
      const share = createShare('doc1', 'view', userId);

      const res = await authFetch(`${baseUrl}/api/documents/doc1/shares/${share.id}`, token, {
        method: 'DELETE',
      });
      expect(res.status).toBe(204);

      // Share should no longer work
      const other = createTestUser();
      const accessRes = await fetch(`${baseUrl}/api/documents/doc1`, {
        headers: {
          Authorization: `Bearer ${other.token}`,
          'X-Share-Token': share.token,
        },
      });
      expect(accessRes.status).toBe(403);
    });

    it('non-owner cannot revoke a share', async () => {
      const owner = createTestUser();
      const other = createTestUser();
      createDocument('doc1', 'Test', '[]', owner.userId);
      const share = createShare('doc1', 'view', owner.userId);

      const res = await authFetch(`${baseUrl}/api/documents/doc1/shares/${share.id}`, other.token, {
        method: 'DELETE',
      });
      expect(res.status).toBe(403);
    });

    it('returns 404 for non-existent share', async () => {
      const { userId, token } = createTestUser();
      createDocument('doc1', 'Test', '[]', userId);

      const res = await authFetch(`${baseUrl}/api/documents/doc1/shares/nonexistent`, token, {
        method: 'DELETE',
      });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/shared/:token', () => {
    it('returns document with view permission', async () => {
      const { userId } = createTestUser();
      createDocument('doc1', 'Shared Doc', '[{"text":"hello"}]', userId);
      const share = createShare('doc1', 'view', userId);

      const res = await fetch(`${baseUrl}/api/shared/${share.token}`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.document.id).toBe('doc1');
      expect(body.document.title).toBe('Shared Doc');
      expect(body.permission).toBe('view');
      expect(body.share_token).toBe(share.token);
    });

    it('returns document with edit permission', async () => {
      const { userId } = createTestUser();
      createDocument('doc1', 'Shared Doc', '[]', userId);
      const share = createShare('doc1', 'edit', userId);

      const res = await fetch(`${baseUrl}/api/shared/${share.token}`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.permission).toBe('edit');
    });

    it('returns 404 for invalid token', async () => {
      const res = await fetch(`${baseUrl}/api/shared/invalidtoken`);
      expect(res.status).toBe(404);
    });
  });

  describe('Document list filtering', () => {
    it('authenticated user sees own documents and legacy documents', async () => {
      const user1 = createTestUser();
      const user2 = createTestUser();
      createDocument('doc1', 'User1 Doc', '[]', user1.userId);
      createDocument('doc2', 'User2 Doc', '[]', user2.userId);
      createDocument('doc3', 'Legacy Doc', '[]'); // no owner

      const res = await authFetch(`${baseUrl}/api/documents`, user1.token);
      const docs = await res.json();
      const ids = docs.map((d: any) => d.id);
      expect(ids).toContain('doc1');
      expect(ids).toContain('doc3');
      expect(ids).not.toContain('doc2');
    });

    it('unauthenticated user only sees legacy documents', async () => {
      const user1 = createTestUser();
      createDocument('doc1', 'Owned Doc', '[]', user1.userId);
      createDocument('doc2', 'Legacy Doc', '[]');

      const res = await fetch(`${baseUrl}/api/documents`);
      const docs = await res.json();
      const ids = docs.map((d: any) => d.id);
      expect(ids).not.toContain('doc1');
      expect(ids).toContain('doc2');
    });
  });

  describe('Version access with permissions', () => {
    it('view share token grants access to versions', async () => {
      const owner = createTestUser();
      const other = createTestUser();
      createDocument('doc1', 'Test', '[0]', owner.userId);

      // Create a version via update
      await authFetch(`${baseUrl}/api/documents/doc1`, owner.token, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'V1', content: '[1]' }),
      });

      const share = createShare('doc1', 'view', owner.userId);

      const res = await fetch(`${baseUrl}/api/documents/doc1/versions`, {
        headers: {
          Authorization: `Bearer ${other.token}`,
          'X-Share-Token': share.token,
        },
      });
      expect(res.status).toBe(200);
      const versions = await res.json();
      expect(versions.length).toBeGreaterThanOrEqual(1);
    });

    it('view share token does not allow version restore', async () => {
      const owner = createTestUser();
      const other = createTestUser();
      createDocument('doc1', 'Test', '[0]', owner.userId);

      await authFetch(`${baseUrl}/api/documents/doc1`, owner.token, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'V1', content: '[1]' }),
      });

      const share = createShare('doc1', 'view', owner.userId);

      const res = await fetch(`${baseUrl}/api/documents/doc1/versions/1/restore`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${other.token}`,
          'X-Share-Token': share.token,
        },
      });
      expect(res.status).toBe(403);
    });
  });
});
