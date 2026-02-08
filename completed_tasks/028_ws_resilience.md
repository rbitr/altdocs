# Task 028: WebSocket Resilience — Heartbeat and Reconnection

## Priority: P1 (reliability)

## Description

Code audit identified reliability gaps in the WebSocket layer:

### WebSocket Resilience

1. **No ping/pong heartbeat**: Stale WebSocket connections (e.g., client loses network) remain in rooms indefinitely, wasting server resources and showing ghost users. Add server-side ping interval with automatic cleanup of unresponsive connections.

2. **No client reconnection**: When the WebSocket connection drops (network hiccup, server restart), the client makes no attempt to reconnect. Add auto-reconnection with exponential backoff.

### OT Edge Cases — Verified as Non-Bugs

Concurrent split_block at same position: Creates an extra empty block, but both paths converge to identical state. This is a known OT characteristic, not a convergence violation.

Concurrent merge_block at same index: Transforms to blockIndex 0, which `applyMergeBlock` treats as a no-op (returns doc unchanged). Both paths converge correctly.

## Acceptance Criteria

- [ ] Server pings clients every 30s; terminates unresponsive connections after 10s timeout
- [ ] Client reconnects automatically on disconnect with exponential backoff (1s, 2s, 4s... up to 30s)
- [ ] Client re-joins the document room on reconnection
- [ ] All existing tests continue to pass
- [ ] New tests cover heartbeat and reconnection logic
