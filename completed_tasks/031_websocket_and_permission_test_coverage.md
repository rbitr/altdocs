# Task 031: WebSocket Heartbeat & Permission Edge Case Tests

## Priority: P1

## Why
The WebSocket heartbeat mechanism (ping/pong, connection termination) and API permission resolution logic are critical for reliability and security but lack unit tests. These are the highest-impact gaps in our test suite.

## Requirements

### WebSocket Heartbeat Tests (in websocket.test.ts)
- Test that server sends ping at the configured interval
- Test that connection is terminated when pong is not received
- Test that alive flag is reset on pong
- Test room cleanup when last user leaves/disconnects

### API Permission Edge Case Tests (in api.test.ts or new permission.test.ts)
- Test resolvePermission() with all combinations:
  - Legacy document (no owner): full access for anyone
  - Owner access with valid session
  - Edit share token grants write but not delete/manage
  - View share token grants read-only
  - Invalid/expired share token denied
  - No auth + no share token denied for owned doc
- Test canRead(), canWrite(), canManage() helpers
- Test version retention limit (50 versions)

## Done When
- All new tests pass
- No existing tests regress
- Critical server-side logic paths have test coverage
