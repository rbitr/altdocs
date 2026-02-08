import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import { authRouter, optionalAuth } from '../src/server/auth.js';
import { resetStore, useMemoryDb } from '../src/server/db.js';
import type { Server } from 'http';

let server: Server;
let baseUrl: string;

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(optionalAuth);
  app.use(authRouter);
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

describe('Auth API', () => {
  describe('POST /api/auth/session', () => {
    it('creates an anonymous session', async () => {
      const res = await fetch(`${baseUrl}/api/auth/session`, { method: 'POST' });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.token).toBeTruthy();
      expect(body.token.length).toBe(64);
      expect(body.user).toBeTruthy();
      expect(body.user.id).toMatch(/^user_/);
      expect(body.user.display_name).toMatch(/^Anonymous /);
      expect(body.user.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it('creates a unique user each time', async () => {
      const res1 = await fetch(`${baseUrl}/api/auth/session`, { method: 'POST' });
      const body1 = await res1.json();
      const res2 = await fetch(`${baseUrl}/api/auth/session`, { method: 'POST' });
      const body2 = await res2.json();
      expect(body1.token).not.toBe(body2.token);
      expect(body1.user.id).not.toBe(body2.user.id);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns 401 without auth token', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`);
      expect(res.status).toBe(401);
    });

    it('returns 401 with invalid token', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: 'Bearer invalidtoken123' },
      });
      expect(res.status).toBe(401);
    });

    it('returns user info with valid token', async () => {
      const sessionRes = await fetch(`${baseUrl}/api/auth/session`, { method: 'POST' });
      const session = await sessionRes.json();

      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe(session.user.id);
      expect(body.display_name).toBe(session.user.display_name);
      expect(body.color).toBe(session.user.color);
    });
  });

  describe('PUT /api/auth/me', () => {
    it('returns 401 without auth token', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: 'New Name' }),
      });
      expect(res.status).toBe(401);
    });

    it('updates display name', async () => {
      const sessionRes = await fetch(`${baseUrl}/api/auth/session`, { method: 'POST' });
      const session = await sessionRes.json();

      const res = await fetch(`${baseUrl}/api/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ display_name: 'Alice' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.display_name).toBe('Alice');
      expect(body.id).toBe(session.user.id);
      expect(body.color).toBe(session.user.color);
    });

    it('persists updated name', async () => {
      const sessionRes = await fetch(`${baseUrl}/api/auth/session`, { method: 'POST' });
      const session = await sessionRes.json();

      await fetch(`${baseUrl}/api/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ display_name: 'Bob' }),
      });

      const meRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      const me = await meRes.json();
      expect(me.display_name).toBe('Bob');
    });

    it('rejects empty display name', async () => {
      const sessionRes = await fetch(`${baseUrl}/api/auth/session`, { method: 'POST' });
      const session = await sessionRes.json();

      const res = await fetch(`${baseUrl}/api/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ display_name: '' }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects missing display name', async () => {
      const sessionRes = await fetch(`${baseUrl}/api/auth/session`, { method: 'POST' });
      const session = await sessionRes.json();

      const res = await fetch(`${baseUrl}/api/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it('truncates display name to 50 characters', async () => {
      const sessionRes = await fetch(`${baseUrl}/api/auth/session`, { method: 'POST' });
      const session = await sessionRes.json();

      const longName = 'A'.repeat(100);
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ display_name: longName }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.display_name.length).toBe(50);
    });

    it('rejects whitespace-only display name', async () => {
      const sessionRes = await fetch(`${baseUrl}/api/auth/session`, { method: 'POST' });
      const session = await sessionRes.json();

      const res = await fetch(`${baseUrl}/api/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ display_name: '   \t  ' }),
      });
      expect(res.status).toBe(400);
    });

    it('accepts display name with special characters', async () => {
      const sessionRes = await fetch(`${baseUrl}/api/auth/session`, { method: 'POST' });
      const session = await sessionRes.json();

      const res = await fetch(`${baseUrl}/api/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ display_name: 'User <script>alert(1)</script>' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      // Should store as-is (sanitization happens at render time)
      expect(body.display_name).toBe('User <script>alert(1)</script>');
    });

    it('accepts display name with unicode characters', async () => {
      const sessionRes = await fetch(`${baseUrl}/api/auth/session`, { method: 'POST' });
      const session = await sessionRes.json();

      const res = await fetch(`${baseUrl}/api/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ display_name: 'ユーザー名 🎉' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.display_name).toBe('ユーザー名 🎉');
    });

    it('rejects non-string display_name (number)', async () => {
      const sessionRes = await fetch(`${baseUrl}/api/auth/session`, { method: 'POST' });
      const session = await sessionRes.json();

      const res = await fetch(`${baseUrl}/api/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ display_name: 12345 }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects non-string display_name (boolean)', async () => {
      const sessionRes = await fetch(`${baseUrl}/api/auth/session`, { method: 'POST' });
      const session = await sessionRes.json();

      const res = await fetch(`${baseUrl}/api/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ display_name: true }),
      });
      expect(res.status).toBe(400);
    });

    it('trims leading/trailing whitespace from display name', async () => {
      const sessionRes = await fetch(`${baseUrl}/api/auth/session`, { method: 'POST' });
      const session = await sessionRes.json();

      const res = await fetch(`${baseUrl}/api/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ display_name: '  Alice  ' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.display_name).toBe('Alice');
    });
  });

  describe('optionalAuth middleware edge cases', () => {
    it('ignores Authorization header without Bearer prefix', async () => {
      const sessionRes = await fetch(`${baseUrl}/api/auth/session`, { method: 'POST' });
      const session = await sessionRes.json();

      // Use "Token" prefix instead of "Bearer"
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Token ${session.token}` },
      });
      expect(res.status).toBe(401);
    });

    it('ignores Authorization header with lowercase bearer', async () => {
      const sessionRes = await fetch(`${baseUrl}/api/auth/session`, { method: 'POST' });
      const session = await sessionRes.json();

      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `bearer ${session.token}` },
      });
      expect(res.status).toBe(401);
    });

    it('ignores Authorization header with just "Bearer" and no token', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: 'Bearer ' },
      });
      expect(res.status).toBe(401);
    });

    it('ignores empty Authorization header', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: '' },
      });
      expect(res.status).toBe(401);
    });
  });
});
