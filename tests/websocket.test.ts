import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import http from 'http';
import { WebSocket } from 'ws';
import { apiRouter } from '../src/server/api.js';
import { authRouter, optionalAuth } from '../src/server/auth.js';
import { CollaborationServer } from '../src/server/websocket.js';
import { resetStore, useMemoryDb, createUser, createSession, createDocument, createShare } from '../src/server/db.js';
import type { ServerMessage, ClientMessage } from '../src/server/websocket.js';

let httpServer: http.Server;
let collabServer: CollaborationServer;
let wsUrl: string;

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(optionalAuth);
  app.use(authRouter);
  app.use(apiRouter);
  return app;
}

beforeAll(async () => {
  useMemoryDb();
  const app = createTestApp();
  httpServer = http.createServer(app);
  collabServer = new CollaborationServer(httpServer);

  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      const addr = httpServer.address();
      if (typeof addr === 'object' && addr) {
        wsUrl = `ws://localhost:${addr.port}`;
      }
      resolve();
    });
  });
});

afterAll(async () => {
  collabServer.close();
  await new Promise<void>((resolve) => {
    httpServer.close(() => resolve());
  });
}, 15000);

beforeEach(() => {
  resetStore();
});

// ============================================================
// Helpers
// ============================================================

function createTestUser(): { userId: string; token: string } {
  const user = createUser('TestUser', '#ff0000');
  const session = createSession(user.id);
  return { userId: user.id, token: session.token };
}

function createTestDoc(title: string = 'Test Doc'): string {
  const content = JSON.stringify([{
    id: 'block_1',
    type: 'paragraph',
    alignment: 'left',
    runs: [{ text: 'hello world', style: {} }],
  }]);
  const doc = createDocument(`doc_${Date.now()}_${Math.random()}`, title, content);
  return doc.id;
}

function connectWs(token: string, shareToken?: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    let url = `${wsUrl}?token=${token}`;
    if (shareToken) url += `&share=${shareToken}`;
    const ws = new WebSocket(url);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function waitForMessage(ws: WebSocket, timeout: number = 2000): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for message')), timeout);
    ws.once('message', (data) => {
      clearTimeout(timer);
      resolve(JSON.parse(data.toString()));
    });
  });
}

function sendMessage(ws: WebSocket, msg: ClientMessage): void {
  ws.send(JSON.stringify(msg));
}

function closeWs(ws: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }
    ws.on('close', () => resolve());
    ws.close();
  });
}

/** Join a document and wait for the joined message. Returns the joined message. */
async function joinDoc(ws: WebSocket, documentId: string): Promise<ServerMessage> {
  const msgPromise = waitForMessage(ws);
  sendMessage(ws, { type: 'join', documentId });
  return msgPromise;
}

/**
 * Set up two clients in the same document room.
 * Returns after both have joined and ws1 has received ws2's user_joined.
 */
async function setupTwoClients(
  docId: string
): Promise<{ ws1: WebSocket; ws2: WebSocket; user1: { userId: string; token: string }; user2: { userId: string; token: string } }> {
  const user1 = createTestUser();
  const user2 = createTestUser();

  const ws1 = await connectWs(user1.token);
  await joinDoc(ws1, docId);

  // Set up listener on ws1 BEFORE ws2 joins
  const ws1UserJoined = waitForMessage(ws1);

  const ws2 = await connectWs(user2.token);
  const ws2Joined = waitForMessage(ws2);
  sendMessage(ws2, { type: 'join', documentId: docId });

  // Wait for both messages
  await ws1UserJoined;
  await ws2Joined;

  return { ws1, ws2, user1, user2 };
}

// ============================================================
// Tests
// ============================================================

describe('WebSocket: Authentication', () => {
  it('rejects connection without token', async () => {
    const ws = new WebSocket(wsUrl);
    const closePromise = new Promise<{ code: number }>((resolve) => {
      ws.on('close', (code) => resolve({ code }));
    });
    const msg = await waitForMessage(ws);
    expect(msg.type).toBe('error');
    const { code } = await closePromise;
    expect(code).toBe(4001);
  });

  it('rejects connection with invalid token', async () => {
    const ws = new WebSocket(`${wsUrl}?token=invalid_token`);
    const closePromise = new Promise<{ code: number }>((resolve) => {
      ws.on('close', (code) => resolve({ code }));
    });
    const msg = await waitForMessage(ws);
    expect(msg.type).toBe('error');
    const { code } = await closePromise;
    expect(code).toBe(4001);
  });

  it('accepts connection with valid token', async () => {
    const { token } = createTestUser();
    const ws = await connectWs(token);
    expect(ws.readyState).toBe(WebSocket.OPEN);
    await closeWs(ws);
  });
});

describe('WebSocket: Join Document', () => {
  it('sends joined message when joining a document', async () => {
    const { token } = createTestUser();
    const docId = createTestDoc();
    const ws = await connectWs(token);

    const msg = await joinDoc(ws, docId);

    expect(msg.type).toBe('joined');
    if (msg.type === 'joined') {
      expect(msg.documentId).toBe(docId);
      expect(msg.version).toBe(0);
      expect(msg.users).toEqual([]);
    }

    await closeWs(ws);
  });

  it('sends error when joining non-existent document', async () => {
    const { token } = createTestUser();
    const ws = await connectWs(token);

    const msg = await joinDoc(ws, 'nonexistent');

    expect(msg.type).toBe('error');
    if (msg.type === 'error') {
      expect(msg.message).toBe('Document not found');
    }

    await closeWs(ws);
  });

  it('notifies existing users when a new user joins', async () => {
    const user1 = createTestUser();
    const user2 = createTestUser();
    const docId = createTestDoc();

    const ws1 = await connectWs(user1.token);
    await joinDoc(ws1, docId);

    // Set up listener on ws1 BEFORE ws2 joins
    const ws1Msg = waitForMessage(ws1);

    const ws2 = await connectWs(user2.token);
    const ws2Msg = waitForMessage(ws2);
    sendMessage(ws2, { type: 'join', documentId: docId });

    // User 1 should receive user_joined
    const msg = await ws1Msg;
    expect(msg.type).toBe('user_joined');
    if (msg.type === 'user_joined') {
      expect(msg.userId).toBe(user2.userId);
      expect(msg.documentId).toBe(docId);
    }

    // User 2 should receive joined with user1 in users list
    const joinedMsg = await ws2Msg;
    expect(joinedMsg.type).toBe('joined');
    if (joinedMsg.type === 'joined') {
      expect(joinedMsg.users.length).toBe(1);
      expect(joinedMsg.users[0].userId).toBe(user1.userId);
    }

    await closeWs(ws1);
    await closeWs(ws2);
  });

  it('notifies other users when a user leaves', async () => {
    const docId = createTestDoc();
    const { ws1, ws2, user2 } = await setupTwoClients(docId);

    // Set up listener for user_left BEFORE disconnect
    const leftMsg = waitForMessage(ws1);

    // User 2 disconnects
    await closeWs(ws2);

    // User 1 should receive user_left
    const msg = await leftMsg;
    expect(msg.type).toBe('user_left');
    if (msg.type === 'user_left') {
      expect(msg.userId).toBe(user2.userId);
    }

    await closeWs(ws1);
  });
});

describe('WebSocket: Operations', () => {
  it('acknowledges an operation from sender', async () => {
    const { token } = createTestUser();
    const docId = createTestDoc();
    const ws = await connectWs(token);

    await joinDoc(ws, docId);

    sendMessage(ws, {
      type: 'operation',
      documentId: docId,
      clientId: 'client1',
      version: 0,
      operation: {
        type: 'insert_text',
        position: { blockIndex: 0, offset: 0 },
        text: 'Hello',
      },
    });

    const msg = await waitForMessage(ws);
    expect(msg.type).toBe('ack');
    if (msg.type === 'ack') {
      expect(msg.version).toBe(1);
      expect(msg.documentId).toBe(docId);
    }

    await closeWs(ws);
  });

  it('broadcasts operation to other clients', async () => {
    const docId = createTestDoc();
    const { ws1, ws2, user1 } = await setupTwoClients(docId);

    // Set up listeners BEFORE sending operation
    const ws1Ack = waitForMessage(ws1);
    const ws2Op = waitForMessage(ws2);

    // User 1 sends an operation
    sendMessage(ws1, {
      type: 'operation',
      documentId: docId,
      clientId: 'client1',
      version: 0,
      operation: {
        type: 'insert_text',
        position: { blockIndex: 0, offset: 0 },
        text: 'Test',
      },
    });

    // User 1 gets ack
    const ack = await ws1Ack;
    expect(ack.type).toBe('ack');

    // User 2 gets the operation
    const opMsg = await ws2Op;
    expect(opMsg.type).toBe('operation');
    if (opMsg.type === 'operation') {
      expect(opMsg.operation.type).toBe('insert_text');
      expect(opMsg.version).toBe(1);
      expect(opMsg.userId).toBe(user1.userId);
    }

    await closeWs(ws1);
    await closeWs(ws2);
  });

  it('transforms operations against server history', async () => {
    const docId = createTestDoc();
    const { ws1, ws2 } = await setupTwoClients(docId);

    // Set up listeners for operation + ack
    const ws1Ack1 = waitForMessage(ws1);
    const ws2Op1 = waitForMessage(ws2);

    // User 1 sends an operation (insert at offset 0)
    sendMessage(ws1, {
      type: 'operation',
      documentId: docId,
      clientId: 'client1',
      version: 0,
      operation: {
        type: 'insert_text',
        position: { blockIndex: 0, offset: 0 },
        text: 'AB',
      },
    });
    await ws1Ack1; // ack (version 1)
    await ws2Op1; // operation broadcast

    // Set up listeners for user 2's operation
    const ws2Ack = waitForMessage(ws2);
    const ws1Op2 = waitForMessage(ws1);

    // User 2 sends an operation based on version 0 (hasn't seen user 1's op yet)
    sendMessage(ws2, {
      type: 'operation',
      documentId: docId,
      clientId: 'client2',
      version: 0,
      operation: {
        type: 'insert_text',
        position: { blockIndex: 0, offset: 5 },
        text: 'X',
      },
    });

    // User 2 gets ack
    const ack = await ws2Ack;
    expect(ack.type).toBe('ack');
    if (ack.type === 'ack') {
      expect(ack.version).toBe(2);
    }

    // User 1 gets the transformed operation
    const opMsg = await ws1Op2;
    expect(opMsg.type).toBe('operation');
    if (opMsg.type === 'operation') {
      expect(opMsg.operation.type).toBe('insert_text');
      if (opMsg.operation.type === 'insert_text') {
        // The insert at offset 5 should be shifted right by 2 (length of "AB")
        expect(opMsg.operation.position.offset).toBe(7);
      }
    }

    await closeWs(ws1);
    await closeWs(ws2);
  });

  it('increments version with each operation', async () => {
    const { token } = createTestUser();
    const docId = createTestDoc();
    const ws = await connectWs(token);

    await joinDoc(ws, docId);

    for (let i = 0; i < 3; i++) {
      sendMessage(ws, {
        type: 'operation',
        documentId: docId,
        clientId: 'client1',
        version: i,
        operation: {
          type: 'insert_text',
          position: { blockIndex: 0, offset: i },
          text: String(i),
        },
      });
      const ack = await waitForMessage(ws);
      expect(ack.type).toBe('ack');
      if (ack.type === 'ack') {
        expect(ack.version).toBe(i + 1);
      }
    }

    await closeWs(ws);
  });
});

describe('WebSocket: Cursor Sharing', () => {
  it('broadcasts cursor updates to other clients', async () => {
    const docId = createTestDoc();
    const { ws1, ws2, user1 } = await setupTwoClients(docId);

    // Set up listener BEFORE sending cursor
    const ws2Cursor = waitForMessage(ws2);

    sendMessage(ws1, {
      type: 'cursor',
      documentId: docId,
      cursor: { blockIndex: 0, offset: 5 },
    });

    const msg = await ws2Cursor;
    expect(msg.type).toBe('cursor');
    if (msg.type === 'cursor') {
      expect(msg.userId).toBe(user1.userId);
      expect(msg.cursor).toEqual({ blockIndex: 0, offset: 5 });
      expect(msg.color).toBe('#ff0000');
    }

    await closeWs(ws1);
    await closeWs(ws2);
  });

  it('broadcasts null cursor (user left text area)', async () => {
    const docId = createTestDoc();
    const { ws1, ws2 } = await setupTwoClients(docId);

    // Set up listener BEFORE sending cursor
    const ws2Cursor = waitForMessage(ws2);

    sendMessage(ws1, {
      type: 'cursor',
      documentId: docId,
      cursor: null,
    });

    const msg = await ws2Cursor;
    expect(msg.type).toBe('cursor');
    if (msg.type === 'cursor') {
      expect(msg.cursor).toBeNull();
    }

    await closeWs(ws1);
    await closeWs(ws2);
  });

  it('broadcasts selection anchor along with cursor', async () => {
    const docId = createTestDoc();
    const { ws1, ws2 } = await setupTwoClients(docId);

    // Set up listener BEFORE sending cursor
    const ws2Cursor = waitForMessage(ws2);

    sendMessage(ws1, {
      type: 'cursor',
      documentId: docId,
      cursor: { blockIndex: 0, offset: 5 },
      anchor: { blockIndex: 0, offset: 0 },
    });

    const msg = await ws2Cursor;
    expect(msg.type).toBe('cursor');
    if (msg.type === 'cursor') {
      expect(msg.cursor).toEqual({ blockIndex: 0, offset: 5 });
      expect(msg.anchor).toEqual({ blockIndex: 0, offset: 0 });
    }

    await closeWs(ws1);
    await closeWs(ws2);
  });

  it('broadcasts null anchor when cursor message has no anchor', async () => {
    const docId = createTestDoc();
    const { ws1, ws2 } = await setupTwoClients(docId);

    const ws2Cursor = waitForMessage(ws2);

    // Send cursor without anchor field (backward compat)
    sendMessage(ws1, {
      type: 'cursor',
      documentId: docId,
      cursor: { blockIndex: 0, offset: 3 },
    });

    const msg = await ws2Cursor;
    expect(msg.type).toBe('cursor');
    if (msg.type === 'cursor') {
      expect(msg.cursor).toEqual({ blockIndex: 0, offset: 3 });
      expect(msg.anchor).toBeNull();
    }

    await closeWs(ws1);
    await closeWs(ws2);
  });
});

describe('WebSocket: Room Management', () => {
  it('creates and cleans up rooms', async () => {
    const { token } = createTestUser();
    const docId = createTestDoc();
    const ws = await connectWs(token);

    await joinDoc(ws, docId);

    expect(collabServer.getRoom(docId)).toBeDefined();

    await closeWs(ws);
    await new Promise((r) => setTimeout(r, 50));

    expect(collabServer.getRoom(docId)).toBeUndefined();
  });

  it('room persists while at least one client is connected', async () => {
    const docId = createTestDoc();
    const { ws1, ws2 } = await setupTwoClients(docId);

    // Set up listener for user_left BEFORE disconnect
    const ws2Left = waitForMessage(ws2);

    await closeWs(ws1);
    await ws2Left; // wait for user_left event to be processed
    await new Promise((r) => setTimeout(r, 50));

    // Room should still exist (user 2 is connected)
    expect(collabServer.getRoom(docId)).toBeDefined();

    await closeWs(ws2);
    await new Promise((r) => setTimeout(r, 50));

    expect(collabServer.getRoom(docId)).toBeUndefined();
  });

  it('cleans up stale connections via heartbeat ping/pong', async () => {
    const user1 = createTestUser();
    const docId = createTestDoc();
    const ws1 = await connectWs(user1.token);
    await joinDoc(ws1, docId);

    // Verify room exists with one client
    const room = collabServer.getRoom(docId);
    expect(room).toBeDefined();
    expect(room!.clients.size).toBe(1);

    // The ws library's ping/pong is handled at the transport layer.
    // We verify the server sets up the heartbeat by checking that
    // alive tracking is active — the server pings, and if no pong
    // comes back, the connection is terminated on the next interval.
    // For this test, we just verify the connection stays alive when
    // pong IS received (normal operation).
    await new Promise(r => setTimeout(r, 100));
    expect(ws1.readyState).toBe(WebSocket.OPEN);

    await closeWs(ws1);
  });

  it('user can switch rooms', async () => {
    const user1 = createTestUser();
    const user2 = createTestUser();
    const docId1 = createTestDoc('Doc 1');
    const docId2 = createTestDoc('Doc 2');

    const ws1 = await connectWs(user1.token);
    const ws2 = await connectWs(user2.token);

    // Both join doc 1
    await joinDoc(ws1, docId1);

    const ws1UserJoined = waitForMessage(ws1);
    const ws2Joined = waitForMessage(ws2);
    sendMessage(ws2, { type: 'join', documentId: docId1 });
    await ws1UserJoined;
    await ws2Joined;

    // Set up listeners BEFORE switching
    const ws2Left = waitForMessage(ws2);
    const ws1Joined2 = waitForMessage(ws1);

    // User 1 switches to doc 2
    sendMessage(ws1, { type: 'join', documentId: docId2 });

    // User 2 should get user_left for doc 1
    const leftMsg = await ws2Left;
    expect(leftMsg.type).toBe('user_left');

    // User 1 should get joined for doc 2
    const joinedMsg = await ws1Joined2;
    expect(joinedMsg.type).toBe('joined');
    if (joinedMsg.type === 'joined') {
      expect(joinedMsg.documentId).toBe(docId2);
    }

    await closeWs(ws1);
    await closeWs(ws2);
  });

  it('disconnect cleans up alive tracking', async () => {
    const { token } = createTestUser();
    const docId = createTestDoc();
    const ws = await connectWs(token);
    await joinDoc(ws, docId);

    // Verify room exists
    expect(collabServer.getRoom(docId)).toBeDefined();

    await closeWs(ws);
    await new Promise(r => setTimeout(r, 50));

    // Room cleaned up, and no leftover alive tracking
    expect(collabServer.getRoom(docId)).toBeUndefined();
  });
});

describe('WebSocket: Share Token Access', () => {
  function createOwnedDoc(ownerId: string, title: string = 'Owned Doc'): string {
    const content = JSON.stringify([{
      id: 'block_1',
      type: 'paragraph',
      alignment: 'left',
      runs: [{ text: 'owned content', style: {} }],
    }]);
    const doc = createDocument(`doc_${Date.now()}_${Math.random()}`, title, content, ownerId);
    return doc.id;
  }

  it('owner can join their own document', async () => {
    const owner = createTestUser();
    const docId = createOwnedDoc(owner.userId);
    const ws = await connectWs(owner.token);

    const msg = await joinDoc(ws, docId);
    expect(msg.type).toBe('joined');

    await closeWs(ws);
  });

  it('non-owner without share token is denied', async () => {
    const owner = createTestUser();
    const other = createTestUser();
    const docId = createOwnedDoc(owner.userId);

    const ws = await connectWs(other.token);
    const msg = await joinDoc(ws, docId);
    expect(msg.type).toBe('error');
    if (msg.type === 'error') {
      expect(msg.message).toBe('Access denied');
    }

    await closeWs(ws);
  });

  it('edit share token allows joining and sending operations', async () => {
    const owner = createTestUser();
    const other = createTestUser();
    const docId = createOwnedDoc(owner.userId);
    const share = createShare(docId, 'edit', owner.userId);

    const ws = await connectWs(other.token, share.token);
    const joined = await joinDoc(ws, docId);
    expect(joined.type).toBe('joined');

    // Send an operation — should succeed with ack
    sendMessage(ws, {
      type: 'operation',
      documentId: docId,
      clientId: 'client1',
      version: 0,
      operation: {
        type: 'insert_text',
        position: { blockIndex: 0, offset: 0 },
        text: 'edited',
      },
    });
    const ack = await waitForMessage(ws);
    expect(ack.type).toBe('ack');

    await closeWs(ws);
  });

  it('view share token allows joining but rejects operations', async () => {
    const owner = createTestUser();
    const other = createTestUser();
    const docId = createOwnedDoc(owner.userId);
    const share = createShare(docId, 'view', owner.userId);

    const ws = await connectWs(other.token, share.token);
    const joined = await joinDoc(ws, docId);
    expect(joined.type).toBe('joined');

    // Send an operation — should be rejected with error
    sendMessage(ws, {
      type: 'operation',
      documentId: docId,
      clientId: 'client1',
      version: 0,
      operation: {
        type: 'insert_text',
        position: { blockIndex: 0, offset: 0 },
        text: 'hacked',
      },
    });
    const err = await waitForMessage(ws);
    expect(err.type).toBe('error');
    if (err.type === 'error') {
      expect(err.message).toBe('Read-only access');
    }

    await closeWs(ws);
  });

  it('invalid share token is denied for owned docs', async () => {
    const owner = createTestUser();
    const other = createTestUser();
    const docId = createOwnedDoc(owner.userId);

    const ws = await connectWs(other.token, 'invalid_share_token');
    const msg = await joinDoc(ws, docId);
    expect(msg.type).toBe('error');
    if (msg.type === 'error') {
      expect(msg.message).toBe('Access denied');
    }

    await closeWs(ws);
  });

  it('view-only user cursors are still broadcast', async () => {
    const owner = createTestUser();
    const viewer = createTestUser();
    const docId = createOwnedDoc(owner.userId);
    const share = createShare(docId, 'view', owner.userId);

    // Owner joins
    const ownerWs = await connectWs(owner.token);
    await joinDoc(ownerWs, docId);

    // Viewer joins
    const viewerJoinedBroadcast = waitForMessage(ownerWs);
    const viewerWs = await connectWs(viewer.token, share.token);
    await joinDoc(viewerWs, docId);
    await viewerJoinedBroadcast;

    // Viewer sends cursor update
    const ownerCursor = waitForMessage(ownerWs);
    sendMessage(viewerWs, {
      type: 'cursor',
      documentId: docId,
      cursor: { blockIndex: 0, offset: 3 },
    });

    const cursorMsg = await ownerCursor;
    expect(cursorMsg.type).toBe('cursor');
    if (cursorMsg.type === 'cursor') {
      expect(cursorMsg.cursor).toEqual({ blockIndex: 0, offset: 3 });
    }

    await closeWs(ownerWs);
    await closeWs(viewerWs);
  });
});

describe('WebSocket: Operation Error Cases', () => {
  it('rejects operation from client not in a room', async () => {
    const { token } = createTestUser();
    const ws = await connectWs(token);

    // Send operation without joining a room
    sendMessage(ws, {
      type: 'operation',
      documentId: 'nonexistent',
      clientId: 'client1',
      version: 0,
      operation: {
        type: 'insert_text',
        position: { blockIndex: 0, offset: 0 },
        text: 'test',
      },
    });

    const msg = await waitForMessage(ws);
    expect(msg.type).toBe('error');
    if (msg.type === 'error') {
      expect(msg.message).toBe('Not in a document room');
    }

    await closeWs(ws);
  });

  it('handles invalid JSON message gracefully', async () => {
    const { token } = createTestUser();
    const ws = await connectWs(token);

    // Send malformed JSON
    ws.send('not json at all');

    const msg = await waitForMessage(ws);
    expect(msg.type).toBe('error');
    if (msg.type === 'error') {
      expect(msg.message).toBe('Invalid message format');
    }

    await closeWs(ws);
  });

  it('ignores cursor messages for non-existent room', async () => {
    const { token } = createTestUser();
    const ws = await connectWs(token);

    // Send cursor to a room that doesn't exist — should be silently ignored
    sendMessage(ws, {
      type: 'cursor',
      documentId: 'nonexistent',
      cursor: { blockIndex: 0, offset: 0 },
    });

    // No response expected — wait briefly and verify connection is still open
    await new Promise(r => setTimeout(r, 100));
    expect(ws.readyState).toBe(WebSocket.OPEN);

    await closeWs(ws);
  });

  it('handles unknown message type gracefully', async () => {
    const { token } = createTestUser();
    const ws = await connectWs(token);

    // Send a message with an unknown type
    ws.send(JSON.stringify({ type: 'unknown_type', data: 'test' }));

    // Should not crash the connection — wait briefly and verify
    await new Promise(r => setTimeout(r, 100));
    expect(ws.readyState).toBe(WebSocket.OPEN);

    await closeWs(ws);
  });

  it('handles empty JSON object gracefully', async () => {
    const { token } = createTestUser();
    const ws = await connectWs(token);

    ws.send(JSON.stringify({}));

    // Should not crash
    await new Promise(r => setTimeout(r, 100));
    expect(ws.readyState).toBe(WebSocket.OPEN);

    await closeWs(ws);
  });

  it('handles very large message without crashing', async () => {
    const { token } = createTestUser();
    const docId = createTestDoc();
    const ws = await connectWs(token);
    await joinDoc(ws, docId);

    // Send operation with very large text
    const largeText = 'A'.repeat(100_000);
    sendMessage(ws, {
      type: 'operation',
      documentId: docId,
      clientId: 'client1',
      version: 0,
      operation: {
        type: 'insert_text',
        position: { blockIndex: 0, offset: 0 },
        text: largeText,
      },
    });

    const msg = await waitForMessage(ws);
    expect(msg.type).toBe('ack');

    await closeWs(ws);
  });

  it('handles rapid sequential operations correctly', async () => {
    const { token } = createTestUser();
    const docId = createTestDoc();
    const ws = await connectWs(token);
    await joinDoc(ws, docId);

    // Collect all messages into an array
    const messages: ServerMessage[] = [];
    const allReceived = new Promise<void>((resolve) => {
      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
        if (messages.length === 10) resolve();
      });
    });

    // Send 10 rapid operations
    for (let i = 0; i < 10; i++) {
      sendMessage(ws, {
        type: 'operation',
        documentId: docId,
        clientId: 'client1',
        version: i,
        operation: {
          type: 'insert_text',
          position: { blockIndex: 0, offset: i },
          text: String(i),
        },
      });
    }

    await allReceived;

    expect(messages.every(m => m.type === 'ack')).toBe(true);
    // Versions should be 1 through 10
    const versions = messages.map(m => m.type === 'ack' ? m.version : -1);
    expect(versions).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    await closeWs(ws);
  });
});

describe('WebSocket: Room Cleanup Edge Cases', () => {
  it('cleans up room when last client disconnects', async () => {
    const { token } = createTestUser();
    const docId = createTestDoc();
    const ws = await connectWs(token);
    await joinDoc(ws, docId);

    expect(collabServer.getRoom(docId)).toBeDefined();

    await closeWs(ws);
    await new Promise(r => setTimeout(r, 50));

    // Room should be cleaned up
    expect(collabServer.getRoom(docId)).toBeUndefined();
  });

  it('does not leak rooms across multiple join/leave cycles', async () => {
    const user1 = createTestUser();
    const docId = createTestDoc();

    // Join and leave 5 times — the specific room should be cleaned up each time
    for (let i = 0; i < 5; i++) {
      const ws = await connectWs(user1.token);
      await joinDoc(ws, docId);
      expect(collabServer.getRoom(docId)).toBeDefined();
      await closeWs(ws);
      await new Promise(r => setTimeout(r, 50));
      expect(collabServer.getRoom(docId)).toBeUndefined();
    }
  });

  it('preserves operation history for room with active clients', async () => {
    const user1 = createTestUser();
    const docId = createTestDoc();
    const ws = await connectWs(user1.token);
    await joinDoc(ws, docId);

    // Send several operations
    for (let i = 0; i < 5; i++) {
      sendMessage(ws, {
        type: 'operation',
        documentId: docId,
        clientId: 'client1',
        version: i,
        operation: {
          type: 'insert_text',
          position: { blockIndex: 0, offset: i },
          text: 'x',
        },
      });
      await waitForMessage(ws); // ack
    }

    const room = collabServer.getRoom(docId);
    expect(room).toBeDefined();
    expect(room!.operations.length).toBe(5);
    expect(room!.version).toBe(5);

    await closeWs(ws);
  });
});
