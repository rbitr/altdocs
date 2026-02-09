# Decision 025: Client-Side WebSocket Integration Design

## Context
Task 024 built the WebSocket server and OT engine. Now we need to connect the editor to it.

## Key Decision: How to Intercept Editor Operations

### Option A: Diff-based (compare doc before/after)
- Editor doesn't expose individual ops, so diff the document state
- Con: Complex, lossy, slow, can't reconstruct exact operation types

### Option B: Add onOperation callback to Editor (chosen)
- Editor emits each Operation as it's created, before render
- CollaborationClient receives ops and sends to server
- Pro: Simple, exact operations, no diffing needed
- Con: Requires modifying Editor class

### Option C: Wrap all Editor methods
- Create a proxy that intercepts insertText, deleteSelection, etc.
- Con: Fragile, must wrap every method, misses internal ops

**Decision: Option B.** Adding an `onOperation` callback is minimally invasive and gives us exact operations.

## OT Client Protocol Design

The client maintains three states for each operation:
1. **Synchronized** — no pending ops, server version matches
2. **AwaitingAck** — one op sent to server, awaiting acknowledgment
3. **AwaitingAckWithBuffer** — one op sent, more local ops queued

State transitions:
- Local edit while Synchronized → send op, move to AwaitingAck
- Local edit while AwaitingAck → buffer op, move to AwaitingAckWithBuffer
- Ack received in AwaitingAck → move to Synchronized
- Ack received in AwaitingAckWithBuffer → send buffered op, move to AwaitingAck
- Remote op in any state → transform against pending/buffered ops, apply to editor

This is the standard OT client protocol (similar to Google Wave's approach).

## Auto-Save Interaction

When collaboration is active, the server holds the authoritative document state in memory. We still auto-save periodically via HTTP to persist to the database, but we don't need to detect changes — the server's document state is always current.

## Alternatives Considered
- Using a separate "collaboration mode" toggle — rejected as unnecessary complexity
- Queuing all ops and sending in batches — rejected, real-time requires immediate sending
