# Technical Constraints

## From-Scratch Requirement

The purpose of this project is to build a document editor from the ground up. The core document model, rendering engine, input handling, and collaboration algorithm must all be implemented in this repo. See AGENT_PROMPT.md for the explicit list of forbidden and allowed dependencies.

## Technology Choices

- **Language**: TypeScript for both client and server
- **Runtime**: Node.js for the server
- **Database**: SQLite (via better-sqlite3) for simplicity; can migrate later
- **Transport**: HTTP for REST, WebSocket for real-time
- **Build**: Vite for client bundling
- **Tests**: Vitest for unit/integration, Playwright for browser tests

## Architecture Principles

- The document model is the source of truth. Rendering is a pure function of the model.
- All document mutations go through a well-defined operation/command layer — no direct DOM manipulation for content changes.
- The client should work offline for basic editing, syncing when reconnected (P1+).
- Keep the server thin. Business logic lives in shared code where possible.

## What "From Scratch" Means Concretely

- **Document model**: Build your own data structure to represent rich text (e.g., a tree of blocks containing runs of styled text). Do not use contenteditable for the data model — you may use it as an input mechanism, but the model must be yours.
- **Rendering**: Render from your document model to DOM. You control the DOM structure.
- **Input handling**: Capture keyboard and mouse events, translate them to operations on your model.
- **Collaboration**: If/when implementing real-time sync, build the OT or CRDT algorithm yourself.

## Non-Constraints (Things That Are Fine)

- Using the browser's built-in text measurement and layout
- Using CSS for styling
- Using standard Web APIs (Selection API, Range API, Clipboard API, etc.)
- Using a framework like Vite for build tooling
- Using existing test runners
