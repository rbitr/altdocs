# Task 014: Extended Formatting — Block Quotes, Horizontal Rules, Inline Code, Code Blocks

## Priority
P2 (Extended Formatting)

## Description
Add the remaining P2 extended formatting features from the spec:

1. **Block quotes** — A new block type that renders as `<blockquote>`, available from the block type dropdown
2. **Horizontal rules** — A new block type that renders as `<hr>`, inserted via toolbar button or `---` shortcut
3. **Inline code** — A new text style (like bold/italic) that renders with `<code>` tags, toggled with Ctrl+` shortcut
4. **Code blocks** — A new block type with monospace font rendering, available from the block type dropdown

## Implementation Plan

### Model changes (src/shared/model.ts)
- Add `'blockquote'`, `'code-block'`, and `'horizontal-rule'` to `BlockType` union
- Add `code?: boolean` to `TextStyle` interface
- Update `stylesEqual()` to compare `code` property
- Update `applyStyleDelta()` and `removeStyleDelta()` for `code`

### Renderer changes (src/client/renderer.ts)
- Add blockquote → `<blockquote>`, code-block → `<pre>`, horizontal-rule → `<hr>` to BLOCK_TAG_MAP
- Render `code` style as `<code>` elements
- Horizontal rules render as empty `<hr>` (no text content)
- Code blocks render runs inside `<code>` within `<pre>`

### Editor changes (src/client/editor.ts)
- Add Ctrl+` keyboard shortcut for inline code toggle
- Handle horizontal rule insertion (new operation or block type change)
- Handle Enter on horizontal rule (create new paragraph after)
- Handle Backspace at start of block after horizontal rule (delete the rule)

### Toolbar changes (src/client/toolbar.ts)
- Add block quote, code block to the block type dropdown
- Add horizontal rule insert button
- Add inline code toggle button (Ctrl+`)

### CSS changes (src/client/styles.css)
- Style blockquote (left border, padding, gray text)
- Style hr (margin, color)
- Style code (inline: background, border-radius, monospace font)
- Style pre/code-block (background, padding, monospace font, overflow)

### Tests
- Unit tests for new block types and inline code in model operations
- Renderer tests for all new element types
- E2e tests for toolbar interactions and keyboard shortcuts

## Acceptance Criteria
- [ ] Block quotes render with left border and indentation
- [ ] Horizontal rules render as visual separators
- [ ] Inline code renders with monospace background style
- [ ] Code blocks render as preformatted monospace blocks
- [ ] All features accessible from toolbar
- [ ] Ctrl+` toggles inline code formatting
- [ ] All existing tests still pass
- [ ] New tests cover the new features
