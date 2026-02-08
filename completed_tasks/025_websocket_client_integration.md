# Task 025: Client-Side WebSocket Integration

**Priority**: P1 (Real-Time Collaboration — Client)
**Depends on**: Task 024 (WebSocket Server + OT Engine)

## Goal

Connect the client-side editor to the WebSocket collaboration server so that multiple users editing the same document see each other's changes in real-time.

## Scope

### Editor Operation Hooks (src/client/editor.ts)
- Add `onOperation(callback)` that fires whenever the editor creates and applies an operation
- The callback receives the Operation that was just applied locally
- This lets the collaboration client intercept all local edits

### CollaborationClient (src/client/collaboration.ts)
- Manages WebSocket connection to the server for a single document session
- On connect: joins the document room, receives server version
- Local edits flow: Editor → onOperation callback → send to server → await ack
- Remote edits flow: receive from server → transform against pending local ops → apply to editor
- Tracks: server version, pending (unacknowledged) operations, connection state
- Sends cursor position updates to server
- Receives and exposes remote user cursor positions

### OT Client Protocol
- Maintain a buffer of operations sent but not yet acknowledged
- When receiving a remote op, transform it against all pending local ops
- When receiving an ack, remove the oldest pending op and advance server version
- Use `transformOperation()` from shared/ot.ts for client-side transformation

### Integration (src/client/main.ts)
- When opening a document, create a CollaborationClient
- Wire it to the editor's onOperation callback
- On navigation away, disconnect from WebSocket
- Disable auto-save when collaboration is active (server manages document state)

## Out of Scope (Future Tasks)
- Remote cursor rendering in the editor (Task 026)
- Offline operation queuing / reconnection
- Document sharing with permission levels

## Testing
- Unit tests for CollaborationClient OT buffer logic
- E2E test: two browser tabs editing same document, changes appear in both
