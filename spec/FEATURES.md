# AltDocs Feature Specification

## Priority Levels
- **P0**: Must have for MVP. Build these first.
- **P1**: Important, build after P0 is solid.
- **P2**: Nice to have, build when core is stable.

---

## P0 — Core Document Editing

### Text Editing
- Render a document as editable text in the browser
- Insert and delete characters at a cursor position
- Move cursor with arrow keys, Home/End, click-to-position
- Text selection (click-drag, shift+arrow, Ctrl/Cmd+A)
- Cut, copy, paste (plain text first)
- Undo/redo with reasonable history depth
- Line wrapping and basic paragraph handling

### Rich Text Formatting
- Bold, italic, underline, strikethrough
- Headings (H1-H3)
- Bullet lists and numbered lists
- Text alignment (left, center, right)
- Formatting applied via toolbar buttons and keyboard shortcuts

### Document Persistence
- Save documents to server
- Auto-save on a timer and on meaningful changes
- Load documents by ID
- Document list / home page

---

## P1 — Multi-User and Collaboration

### Real-Time Collaboration
- Multiple users editing the same document simultaneously
- Conflict resolution (implement OT or CRDT from scratch)
- Show other users' cursors and selections
- Presence indicators (who is viewing/editing)

### Sharing
- Share a document via link
- Permission levels: view-only, can edit
- Document owner can manage sharing

### User Identity
- Simple user accounts (email + password or anonymous with persistent ID)
- Display names and cursor colors per user

---

## P2 — Polish and Extended Features

### Extended Formatting
- Font size and font family
- Text color and highlight color
- Block quotes
- Horizontal rules
- Inline code and code blocks

### Document Management
- Rename documents
- Delete documents
- Duplicate documents
- Version history (view previous saves)

### UX Polish
- Keyboard shortcuts reference panel
- Print-friendly rendering
- Responsive layout for different screen sizes
- Loading states and error handling UI
