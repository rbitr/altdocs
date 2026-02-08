import type { Operation } from './model.js';

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
      version: number;
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
