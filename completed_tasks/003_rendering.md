# Task 003: Document Renderer

**Priority**: P0
**Depends on**: 002

## Description

Render the document model to the DOM. This is a one-way flow: model -> DOM.

## Requirements

1. Create `src/client/renderer.ts` that takes a document model and renders it to a container element.
2. Each block becomes a DOM element (div/p/h1-h3/li as appropriate).
3. Each text run becomes a span with appropriate inline styles or semantic elements (strong, em, etc.).
4. Implement efficient re-rendering: when the model changes, update only the changed parts of the DOM (or do a full re-render if simpler to start — optimize later).
5. The rendered output should look like a reasonable document (basic CSS).
6. Write tests: given a model, assert the DOM structure is correct.

## Done When

- A document model renders to readable, styled HTML in the browser.
- Block types render with distinct visual styles.
- Inline formatting (bold, italic, etc.) renders correctly.
- Tests verify DOM output matches expected structure.
