# Task 026: Remote Cursor Rendering

**Priority**: P1 (Real-Time Collaboration — Presence)
**Depends on**: Task 025 (Client-Side WebSocket Integration)

## Goal

Render remote users' cursor positions in the editor so collaborators can see where each other is typing. This is the visual counterpart to the cursor synchronization already implemented in Task 025.

## Scope

### RemoteCursorRenderer (src/client/remote-cursors.ts)
- New module that manages rendering of remote cursor overlays in the editor
- Takes the editor container element and subscribes to remote user updates
- For each remote user with a cursor position:
  - Renders a thin vertical caret line in the user's color at their cursor position
  - Renders a small name label (flag/tooltip) above the caret line showing the user's display name
- Uses absolutely-positioned DOM elements overlaid on the editor
- Updates positions when:
  - Remote cursor data changes (user moved their cursor)
  - The editor re-renders (local edits may shift positions)
  - The window is scrolled/resized

### Integration
- Wire RemoteCursorRenderer into the editor view in main.ts
- Feed it remote user data from CollaborationClient's onRemoteUsersChange callback
- Clean up cursor overlays on disconnect/navigation

### Position Resolution
- Reuse resolvePosition() from cursor-renderer.ts to convert a document Position to a DOM (node, offset) pair
- From (node, offset), compute pixel coordinates using Range.getBoundingClientRect()

## Out of Scope
- Remote selection highlighting (just cursors for now)
- Cursor animations/transitions

## Testing
- Unit tests for the cursor overlay element creation and update logic
- E2E test: two browser contexts, verify remote cursor elements appear
