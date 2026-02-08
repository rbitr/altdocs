# Task 024: WebSocket Server + Operational Transformation Engine

**Priority**: P1 (Real-Time Collaboration — Foundation)
**Depends on**: Task 023 (User Identity)

## Goal

Implement the foundational infrastructure for real-time collaboration:

1. **Operational Transformation (OT) engine**: Pure transformation functions that can resolve conflicts between concurrent operations from different users.
2. **WebSocket server**: Document "rooms" where multiple clients connect, send operations, and receive transformed operations from other users.

## Scope

### OT Engine (src/shared/ot.ts)
- `transformOperation(op1, op2): [op1', op2']` — given two concurrent operations, produce transformed versions that can be applied in either order to produce the same result.
- Focus on core text operations first: `insert_text`, `delete_text`, `split_block`, `merge_block`.
- Block-level operations (`change_block_type`, `change_block_alignment`, `insert_block`) use simpler last-writer-wins or index-shifting logic.
- Formatting operations (`apply_formatting`, `remove_formatting`) transform ranges similar to text operations.

### WebSocket Server (src/server/websocket.ts)
- Attach WebSocket server to existing HTTP server (same port 3000).
- Authenticate connections via token query parameter.
- Document rooms: clients join a room by document ID.
- Server maintains a version counter per document room.
- When a client sends an operation:
  1. Server transforms it against any operations that have been applied since the client's last known version.
  2. Server applies the operation to the document state.
  3. Server broadcasts the transformed operation to all other clients in the room.
  4. Server acknowledges the operation to the sending client.
- Presence: track which users are in each room, broadcast join/leave events.

## Out of Scope (Future Tasks)
- Client-side WebSocket integration (will be task 025)
- Remote cursor rendering (will be task 026)
- Offline operation queuing
- Operation persistence to database

## Testing
- Unit tests for every OT transformation pair
- Unit tests for WebSocket room management
- Integration tests for WebSocket message flow
