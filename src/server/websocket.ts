// ============================================================
// WebSocket Server for Real-Time Collaboration
// ============================================================
//
// Manages document "rooms" where multiple clients connect to
// collaboratively edit the same document. Uses OT to resolve
// conflicts between concurrent operations.
// ============================================================

import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Server } from 'http';
import { URL } from 'url';
import { getSessionWithUser, getDocument } from './db.js';
import { transformSingle } from '../shared/ot.js';
import type { Operation } from '../shared/model.js';
import { applyOperation } from '../shared/model.js';
import type { Document, Block } from '../shared/model.js';

// ============================================================
// Types
// ============================================================

export interface ClientInfo {
  ws: WebSocket;
  userId: string;
  displayName: string;
  color: string;
  clientId: string;
}

export interface DocumentRoom {
  documentId: string;
  /** Server version counter — increments with each accepted operation */
  version: number;
  /** Current document state (kept in memory for active rooms) */
  document: Document | null;
  /** Operation history since room was opened (for OT transformation) */
  operations: Array<{ op: Operation; clientId: string; version: number }>;
  /** Connected clients */
  clients: Map<string, ClientInfo>;
}

/** Messages from client to server */
export type ClientMessage =
  | {
      type: 'join';
      documentId: string;
    }
  | {
      type: 'operation';
      documentId: string;
      clientId: string;
      version: number; // client's last known server version
      operation: Operation;
    }
  | {
      type: 'cursor';
      documentId: string;
      cursor: { blockIndex: number; offset: number } | null;
    };

/** Messages from server to client */
export type ServerMessage =
  | {
      type: 'joined';
      documentId: string;
      version: number;
      users: Array<{ userId: string; displayName: string; color: string }>;
    }
  | {
      type: 'operation';
      documentId: string;
      clientId: string;
      userId: string;
      version: number;
      operation: Operation;
    }
  | {
      type: 'ack';
      documentId: string;
      version: number;
    }
  | {
      type: 'user_joined';
      documentId: string;
      userId: string;
      displayName: string;
      color: string;
    }
  | {
      type: 'user_left';
      documentId: string;
      userId: string;
    }
  | {
      type: 'cursor';
      documentId: string;
      userId: string;
      displayName: string;
      color: string;
      cursor: { blockIndex: number; offset: number } | null;
    }
  | {
      type: 'error';
      message: string;
    };

// ============================================================
// CollaborationServer
// ============================================================

/** Maximum operation history to keep per room (for OT transformation lookback). */
const MAX_HISTORY_LENGTH = 1000;

export class CollaborationServer {
  private wss: WebSocketServer;
  private rooms: Map<string, DocumentRoom> = new Map();
  /** Map from WebSocket to client metadata */
  private wsClients: Map<WebSocket, { userId: string; displayName: string; color: string; documentId: string | null }> = new Map();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server });
    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
  }

  /** Get a room (for testing). */
  getRoom(documentId: string): DocumentRoom | undefined {
    return this.rooms.get(documentId);
  }

  /** Get all rooms (for testing). */
  getRooms(): Map<string, DocumentRoom> {
    return this.rooms;
  }

  /** Close the WebSocket server. */
  close(): void {
    this.wss.close();
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    // Authenticate via query parameter
    const urlStr = req.url || '/';
    const baseUrl = `http://${req.headers.host || 'localhost'}`;
    let token: string | null = null;
    try {
      const url = new URL(urlStr, baseUrl);
      token = url.searchParams.get('token');
    } catch {
      this.sendMessage(ws, { type: 'error', message: 'Invalid URL' });
      ws.close(4000, 'Invalid URL');
      return;
    }

    if (!token) {
      this.sendMessage(ws, { type: 'error', message: 'Authentication required' });
      ws.close(4001, 'Authentication required');
      return;
    }

    const session = getSessionWithUser(token);
    if (!session) {
      this.sendMessage(ws, { type: 'error', message: 'Invalid or expired session' });
      ws.close(4001, 'Invalid session');
      return;
    }

    // Store client info
    this.wsClients.set(ws, {
      userId: session.user_id,
      displayName: session.display_name,
      color: session.color,
      documentId: null,
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as ClientMessage;
        this.handleMessage(ws, msg);
      } catch {
        this.sendMessage(ws, { type: 'error', message: 'Invalid message format' });
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(ws);
    });
  }

  private handleMessage(ws: WebSocket, msg: ClientMessage): void {
    const clientMeta = this.wsClients.get(ws);
    if (!clientMeta) return;

    switch (msg.type) {
      case 'join':
        this.handleJoin(ws, clientMeta, msg.documentId);
        break;
      case 'operation':
        this.handleOperation(ws, clientMeta, msg);
        break;
      case 'cursor':
        this.handleCursor(ws, clientMeta, msg);
        break;
    }
  }

  private handleJoin(
    ws: WebSocket,
    clientMeta: { userId: string; displayName: string; color: string; documentId: string | null },
    documentId: string
  ): void {
    // Leave previous room if any
    if (clientMeta.documentId) {
      this.leaveRoom(ws, clientMeta, clientMeta.documentId);
    }

    // Verify document exists
    const docRecord = getDocument(documentId);
    if (!docRecord) {
      this.sendMessage(ws, { type: 'error', message: 'Document not found' });
      return;
    }

    // Get or create room
    let room = this.rooms.get(documentId);
    if (!room) {
      let blocks: Block[];
      try {
        blocks = JSON.parse(docRecord.content);
      } catch {
        blocks = [{ id: 'block_1', type: 'paragraph', alignment: 'left', runs: [{ text: '', style: {} }] }];
      }
      room = {
        documentId,
        version: 0,
        document: {
          id: docRecord.id,
          title: docRecord.title,
          blocks,
        },
        operations: [],
        clients: new Map(),
      };
      this.rooms.set(documentId, room);
    }

    // Create a unique client ID for this connection
    const clientId = `${clientMeta.userId}_${Date.now()}`;

    // Add client to room
    room.clients.set(clientId, {
      ws,
      userId: clientMeta.userId,
      displayName: clientMeta.displayName,
      color: clientMeta.color,
      clientId,
    });
    clientMeta.documentId = documentId;

    // Collect current users in room
    const users: Array<{ userId: string; displayName: string; color: string }> = [];
    for (const client of room.clients.values()) {
      if (client.clientId !== clientId) {
        users.push({
          userId: client.userId,
          displayName: client.displayName,
          color: client.color,
        });
      }
    }

    // Send joined message to new client
    this.sendMessage(ws, {
      type: 'joined',
      documentId,
      version: room.version,
      users,
    });

    // Broadcast user_joined to other clients
    this.broadcastToRoom(room, clientId, {
      type: 'user_joined',
      documentId,
      userId: clientMeta.userId,
      displayName: clientMeta.displayName,
      color: clientMeta.color,
    });
  }

  private handleOperation(
    ws: WebSocket,
    clientMeta: { userId: string; displayName: string; color: string; documentId: string | null },
    msg: { type: 'operation'; documentId: string; clientId: string; version: number; operation: Operation }
  ): void {
    const room = this.rooms.get(msg.documentId);
    if (!room) {
      this.sendMessage(ws, { type: 'error', message: 'Not in a document room' });
      return;
    }

    // Find the client info in the room
    let senderClientId: string | null = null;
    for (const [cid, client] of room.clients) {
      if (client.ws === ws) {
        senderClientId = cid;
        break;
      }
    }

    if (!senderClientId) {
      this.sendMessage(ws, { type: 'error', message: 'Not in room' });
      return;
    }

    // Transform the operation against all operations that happened since client's version
    let transformedOp = msg.operation;
    const opsToTransformAgainst = room.operations.filter(
      (entry) => entry.version > msg.version
    );

    for (const entry of opsToTransformAgainst) {
      transformedOp = transformSingle(transformedOp, entry.op);
    }

    // Apply the transformed operation to the server's document state
    if (room.document) {
      room.document = applyOperation(room.document, transformedOp);
    }

    // Increment version
    room.version++;

    // Store in operation history
    room.operations.push({
      op: transformedOp,
      clientId: senderClientId,
      version: room.version,
    });

    // Prune old history
    if (room.operations.length > MAX_HISTORY_LENGTH) {
      room.operations = room.operations.slice(-MAX_HISTORY_LENGTH);
    }

    // Acknowledge to sender
    this.sendMessage(ws, {
      type: 'ack',
      documentId: msg.documentId,
      version: room.version,
    });

    // Broadcast transformed operation to all other clients
    this.broadcastToRoom(room, senderClientId, {
      type: 'operation',
      documentId: msg.documentId,
      clientId: senderClientId,
      userId: clientMeta.userId,
      version: room.version,
      operation: transformedOp,
    });
  }

  private handleCursor(
    ws: WebSocket,
    clientMeta: { userId: string; displayName: string; color: string; documentId: string | null },
    msg: { type: 'cursor'; documentId: string; cursor: { blockIndex: number; offset: number } | null }
  ): void {
    const room = this.rooms.get(msg.documentId);
    if (!room) return;

    // Find sender's clientId
    let senderClientId: string | null = null;
    for (const [cid, client] of room.clients) {
      if (client.ws === ws) {
        senderClientId = cid;
        break;
      }
    }
    if (!senderClientId) return;

    // Broadcast cursor position to other clients
    this.broadcastToRoom(room, senderClientId, {
      type: 'cursor',
      documentId: msg.documentId,
      userId: clientMeta.userId,
      displayName: clientMeta.displayName,
      color: clientMeta.color,
      cursor: msg.cursor,
    });
  }

  private handleDisconnect(ws: WebSocket): void {
    const clientMeta = this.wsClients.get(ws);
    if (!clientMeta) return;

    if (clientMeta.documentId) {
      this.leaveRoom(ws, clientMeta, clientMeta.documentId);
    }

    this.wsClients.delete(ws);
  }

  private leaveRoom(
    ws: WebSocket,
    clientMeta: { userId: string; displayName: string; color: string; documentId: string | null },
    documentId: string
  ): void {
    const room = this.rooms.get(documentId);
    if (!room) return;

    // Find and remove the client from the room
    let removedClientId: string | null = null;
    for (const [cid, client] of room.clients) {
      if (client.ws === ws) {
        removedClientId = cid;
        room.clients.delete(cid);
        break;
      }
    }

    if (removedClientId) {
      // Broadcast user_left to remaining clients
      this.broadcastToRoom(room, removedClientId, {
        type: 'user_left',
        documentId,
        userId: clientMeta.userId,
      });
    }

    // Clean up empty rooms
    if (room.clients.size === 0) {
      this.rooms.delete(documentId);
    }

    clientMeta.documentId = null;
  }

  private sendMessage(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  private broadcastToRoom(
    room: DocumentRoom,
    excludeClientId: string,
    msg: ServerMessage
  ): void {
    const data = JSON.stringify(msg);
    for (const [cid, client] of room.clients) {
      if (cid !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(data);
      }
    }
  }
}

/**
 * Attach the collaboration WebSocket server to an existing HTTP server.
 */
export function createCollaborationServer(server: Server): CollaborationServer {
  return new CollaborationServer(server);
}
