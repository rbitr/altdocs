# Decision 028: WebSocket Resilience — Heartbeat and Reconnection

## Context

Code audit revealed that WebSocket connections had no liveness detection or reconnection mechanism:
- Stale connections (e.g., client loses network) remained in rooms indefinitely, showing ghost users and wasting server memory
- Network hiccups or server restarts permanently broke real-time collaboration for affected clients

## Decisions

### Server-Side Heartbeat

The server pings all connected clients every 30 seconds using the WebSocket protocol-level `ping/pong` frames. If no `pong` is received before the next ping interval, the connection is terminated via `ws.terminate()`.

**Why 30s ping / 10s timeout (implicit)?** The ping fires every 30s and checks the `alive` flag from the previous cycle. This means a connection is terminated after 30-60s of silence, which is a reasonable balance between detecting stale connections promptly and avoiding false positives on slow networks.

**Alternative considered:** Application-level heartbeat messages. Rejected because WebSocket protocol-level `ping/pong` is handled by the browser and `ws` library automatically, with zero application code needed on the client side. It also works even if the application message handler is stuck.

### Client-Side Reconnection

The client uses exponential backoff for auto-reconnection:
- Base delay: 1 second
- Multiplier: 2x per attempt
- Max delay: 30 seconds
- Backoff resets to base on successful connection (WebSocket `open` event)

On reconnect, the client:
1. Clears stale OT state (inflight and buffered operations are no longer valid after disconnect)
2. Creates a new WebSocket connection
3. Re-joins the document room
4. Receives the current server version and user list

**Why clear OT state?** After a disconnect, the server may have processed operations from other clients. The inflight operation was never acked, and buffered operations were based on the pre-disconnect state. Re-sending them would cause incorrect OT transformation. The client's local document state reflects its own operations (via auto-save), so no data is lost.

**Why not reconnect to the same room version?** The room may have been cleaned up (if the disconnecting client was the last one). The simplest correct approach is to re-join fresh and rely on auto-save to persist the client's local state.

**Alternative considered:** Preserving OT state across reconnects using a reconnection token/version. Rejected as significantly more complex for a scenario that's adequately handled by auto-save + fresh re-join.

## OT Edge Cases Investigated

During this audit, two OT transform edge cases were analyzed and found to be **non-bugs**:

1. **Concurrent split_block at same position**: Both splits apply, creating an extra empty block. Both paths converge to identical state (e.g., `["abc", "", "def"]`). This is a known OT characteristic — convergence is preserved even though the result is semantically suboptimal.

2. **Concurrent merge_block at same index**: The second merge transforms to `blockIndex - 1`, which for `blockIndex: 1` produces `blockIndex: 0`. `applyMergeBlock` treats `blockIndex <= 0` as a no-op (returns doc unchanged), so both paths converge correctly.
