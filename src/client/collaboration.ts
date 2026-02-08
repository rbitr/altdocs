import type { Operation, Position } from '../shared/model.js';
import { transformOperation } from '../shared/ot.js';
import type { Editor } from './editor.js';
import { getStoredToken, getShareToken } from './api-client.js';
import type { ServerMessage, ClientMessage } from '../shared/protocol.js';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

export interface RemoteUser {
  userId: string;
  displayName: string;
  color: string;
  cursor: Position | null;
}

export interface CollaborationEvents {
  onConnectionChange?: (state: ConnectionState) => void;
  onRemoteUsersChange?: (users: RemoteUser[]) => void;
}

/**
 * Manages the WebSocket connection and OT protocol for a single
 * document editing session.
 *
 * OT client protocol:
 * - Only one operation is "in flight" (sent to server) at a time.
 * - Additional local ops are buffered until the in-flight op is acked.
 * - When an ack arrives, the next buffered op is sent.
 * - Remote ops are transformed against all pending (in-flight + buffered) ops.
 */
export class CollaborationClient {
  private ws: WebSocket | null = null;
  private editor: Editor;
  private documentId: string;
  private clientId: string = '';
  private serverVersion: number = 0;
  private state: ConnectionState = 'disconnected';

  // In-flight operation: sent to server, awaiting ack
  private inflight: Operation | null = null;
  // Buffered operations: local ops made while awaiting ack
  private buffered: Operation[] = [];

  // Remote users in the room
  private remoteUsers: Map<string, RemoteUser> = new Map();

  private events: CollaborationEvents;
  private cursorDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(editor: Editor, documentId: string, events: CollaborationEvents = {}) {
    this.editor = editor;
    this.documentId = documentId;
    this.events = events;
  }

  /** Connect to the collaboration server */
  connect(): void {
    if (this.ws) return;

    const token = getStoredToken();
    if (!token) return;

    this.state = 'connecting';
    this.events.onConnectionChange?.(this.state);

    // Build WebSocket URL — use current page's host with /ws path
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
    const shareToken = getShareToken();
    if (shareToken) {
      wsUrl += `&share=${encodeURIComponent(shareToken)}`;
    }

    this.ws = new WebSocket(wsUrl);

    this.ws.addEventListener('open', () => {
      // Join the document room
      this.send({ type: 'join', documentId: this.documentId });
    });

    this.ws.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;
        this.handleMessage(msg);
      } catch {
        // ignore malformed messages
      }
    });

    this.ws.addEventListener('close', () => {
      this.ws = null;
      this.state = 'disconnected';
      this.events.onConnectionChange?.(this.state);
      this.remoteUsers.clear();
      this.events.onRemoteUsersChange?.([...this.remoteUsers.values()]);
    });

    this.ws.addEventListener('error', () => {
      // error is followed by close event
    });

    // Wire up the editor's operation callback
    this.editor.onOperation((op: Operation) => this.handleLocalOperation(op));
  }

  /** Disconnect from the collaboration server */
  disconnect(): void {
    if (this.cursorDebounceTimer) {
      clearTimeout(this.cursorDebounceTimer);
      this.cursorDebounceTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.inflight = null;
    this.buffered = [];
    this.remoteUsers.clear();
    this.state = 'disconnected';
  }

  getState(): ConnectionState {
    return this.state;
  }

  getRemoteUsers(): RemoteUser[] {
    return [...this.remoteUsers.values()];
  }

  getServerVersion(): number {
    return this.serverVersion;
  }

  // ── Message handling ──────────────────────────────────

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'joined':
        this.handleJoined(msg);
        break;
      case 'ack':
        this.handleAck(msg);
        break;
      case 'operation':
        this.handleRemoteOperation(msg);
        break;
      case 'user_joined':
        this.handleUserJoined(msg);
        break;
      case 'user_left':
        this.handleUserLeft(msg);
        break;
      case 'cursor':
        this.handleRemoteCursor(msg);
        break;
      case 'error':
        break;
    }
  }

  private handleJoined(msg: Extract<ServerMessage, { type: 'joined' }>): void {
    this.serverVersion = msg.version;
    this.state = 'connected';
    this.events.onConnectionChange?.(this.state);

    // Add initial users
    this.remoteUsers.clear();
    for (const user of msg.users) {
      this.remoteUsers.set(user.userId, {
        userId: user.userId,
        displayName: user.displayName,
        color: user.color,
        cursor: null,
      });
    }
    this.events.onRemoteUsersChange?.([...this.remoteUsers.values()]);

    // Generate client ID
    this.clientId = `local_${Date.now()}`;

    // Send initial cursor position
    this.sendCursorPosition();
  }

  private handleAck(msg: Extract<ServerMessage, { type: 'ack' }>): void {
    this.serverVersion = msg.version;

    if (this.buffered.length > 0) {
      // Send next buffered operation
      this.inflight = this.buffered.shift()!;
      this.sendOperation(this.inflight);
    } else {
      // No more pending ops — fully synchronized
      this.inflight = null;
    }
  }

  private handleRemoteOperation(msg: Extract<ServerMessage, { type: 'operation' }>): void {
    this.serverVersion = msg.version;
    let incomingOp = msg.operation;

    // Transform incoming op against in-flight local op
    if (this.inflight !== null) {
      const [inflightPrime, incomingPrime] = transformOperation(this.inflight, incomingOp);
      this.inflight = inflightPrime;
      incomingOp = incomingPrime;
    }

    // Transform incoming op against all buffered local ops
    const newBuffered: Operation[] = [];
    for (const buffOp of this.buffered) {
      const [buffPrime, incomingPrime] = transformOperation(buffOp, incomingOp);
      newBuffered.push(buffPrime);
      incomingOp = incomingPrime;
    }
    this.buffered = newBuffered;

    // Apply the transformed remote operation to the editor
    this.editor.applyRemoteOperation(incomingOp);
  }

  private handleUserJoined(msg: Extract<ServerMessage, { type: 'user_joined' }>): void {
    this.remoteUsers.set(msg.userId, {
      userId: msg.userId,
      displayName: msg.displayName,
      color: msg.color,
      cursor: null,
    });
    this.events.onRemoteUsersChange?.([...this.remoteUsers.values()]);
  }

  private handleUserLeft(msg: Extract<ServerMessage, { type: 'user_left' }>): void {
    this.remoteUsers.delete(msg.userId);
    this.events.onRemoteUsersChange?.([...this.remoteUsers.values()]);
  }

  private handleRemoteCursor(msg: Extract<ServerMessage, { type: 'cursor' }>): void {
    const user = this.remoteUsers.get(msg.userId);
    if (user) {
      user.cursor = msg.cursor;
      this.events.onRemoteUsersChange?.([...this.remoteUsers.values()]);
    }
  }

  // ── Local operations ──────────────────────────────────

  private handleLocalOperation(op: Operation): void {
    if (this.state !== 'connected') return;

    if (this.inflight === null) {
      // Synchronized → send immediately
      this.inflight = op;
      this.sendOperation(op);
    } else {
      // Awaiting ack → buffer this op
      this.buffered.push(op);
    }

    // Send cursor update after local op
    this.scheduleCursorUpdate();
  }

  private sendOperation(op: Operation): void {
    this.send({
      type: 'operation',
      documentId: this.documentId,
      clientId: this.clientId,
      version: this.serverVersion,
      operation: op,
    });
  }

  // ── Cursor synchronization ────────────────────────────

  private scheduleCursorUpdate(): void {
    if (this.cursorDebounceTimer) clearTimeout(this.cursorDebounceTimer);
    this.cursorDebounceTimer = setTimeout(() => {
      this.sendCursorPosition();
    }, 50);
  }

  private sendCursorPosition(): void {
    if (this.state !== 'connected') return;
    const cursor = this.editor.getCursor();
    this.send({
      type: 'cursor',
      documentId: this.documentId,
      cursor: cursor.focus,
    });
  }

  // ── WebSocket send helper ─────────────────────────────

  private send(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}
