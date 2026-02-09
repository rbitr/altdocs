# Decision 024: Operational Transformation Design

## Context

Real-time collaboration requires a conflict resolution mechanism when multiple users edit the same document concurrently. The two main approaches are OT (Operational Transformation) and CRDT (Conflict-free Replicated Data Types). Both must be built from scratch per project constraints.

## Decision

We chose **Operational Transformation (OT)** with a **server-authoritative architecture**.

### Why OT over CRDT

1. **Fits the existing model**: Our document model uses positions (blockIndex + offset) and operations are already well-defined. OT transforms these positions naturally.
2. **Simpler server architecture**: OT with a central server avoids the complexity of CRDT's distributed merging. The server is the single source of truth and assigns operation ordering.
3. **Smaller memory footprint**: CRDTs require tracking tombstones for deleted content, which grows unboundedly. OT only needs a bounded operation history.
4. **Existing precedent**: Google Docs uses OT (Jupiter protocol). It's well-suited for a centralized collaborative editor.

### OT Architecture

- **Server-authoritative**: The server receives operations from clients, transforms them against its operation log, applies them to the canonical document state, and broadcasts the transformed operations to other clients.
- **Priority-based tie-breaking**: When `transformOperation(a, b)` is called, operation `a` has priority. For same-position inserts, `a`'s text comes first. The server gives priority to already-applied operations (via `transformSingle`).
- **Delete wins over insert within range**: When an insert occurs strictly within a concurrently deleted range, the insert becomes a no-op and the delete expands. This is the simplest convergent behavior.
- **Operation history**: The server keeps up to 1000 operations per room for transformation lookback. Clients send their last-known version number so the server knows which operations to transform against.

### WebSocket Protocol

- Clients authenticate via token query parameter on connection
- Clients join document "rooms" via `join` message
- Operations include the client's last-known server version
- Server sends `ack` to operation sender, broadcasts transformed op to others
- Presence: `user_joined`, `user_left`, and `cursor` messages

## Alternatives Considered

1. **CRDT (Yjs-style)**: More complex, requires custom data structure (e.g., YATA algorithm). Better for offline-first but over-engineered for our server-centric architecture.
2. **Last-writer-wins (no OT)**: Simpler but loses concurrent edits. Not suitable for real-time collaboration.
3. **Client-side OT (peer-to-peer)**: More complex, requires each client to maintain its own transform state. Server-authoritative is simpler.

## Future Considerations

- Operation compaction: merge sequential single-character inserts into multi-character operations to reduce history size
- Database persistence of operation log for crash recovery
- Offline operation queuing with reconnection replay
