# Task 044: Remote User Selection Highlighting

## Priority
P2 — Collaboration polish (last remaining P2 feature)

## Description
Allow users to see what text other collaborators are currently selecting/highlighting. Currently, only the remote cursor position (a single point) is shown. This task extends the protocol and rendering to broadcast and display full text selections.

## Requirements
1. Extend the WebSocket protocol to include selection range (anchor + focus) instead of just cursor position
2. Update the CollaborationClient to send full selection state (anchor + focus)
3. Update RemoteCursorRenderer to render colored highlight overlays for non-collapsed selections
4. Add CSS styles for remote selection highlighting (translucent background in user's color)
5. Maintain backward compatibility (collapsed selections still show as a caret)
6. Update existing unit and e2e tests, add new ones for selection highlighting

## Implementation Notes
- The cursor message already sends a Position for cursor focus. Extend to include anchor as well.
- When anchor !== focus, render colored rectangles over the selected text ranges
- Use `resolvePosition()` to get DOM coordinates for both anchor and focus
- Use Range.getClientRects() to get the actual rendered rectangles for multi-line selections
- Remote selection highlights should be semi-transparent (opacity 0.25) in the user's color
- Caret still shown at the focus position even when there's a selection

## Tests
- Unit tests for RemoteCursorRenderer with selections
- Unit tests for protocol changes
- Update collaboration client tests
- E2e test showing remote selection visible to other users
