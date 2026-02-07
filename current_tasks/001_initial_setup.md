# Task 001: Initial Project Setup

**Priority**: P0 (must be first)

## Description

Set up the project skeleton so that subsequent tasks can build on a working foundation.

## Requirements

1. Initialize `package.json` with TypeScript, Vite, Vitest, and Playwright as dev dependencies.
2. Set up TypeScript config (`tsconfig.json`) for both client and server.
3. Create a minimal HTTP server in `src/server/` that serves static files from a built client directory.
4. Create a minimal client entry point in `src/client/` that renders "AltDocs" to the page.
5. Set up Vite config for building the client.
6. Add a `vitest` config and a single passing placeholder test.
7. Add Playwright config and a single passing browser test that loads the page and checks the title.
8. Add npm scripts: `dev`, `build`, `test`, `test:e2e`.
9. Create a `.gitignore` covering node_modules, dist, and other common artifacts.
10. Ensure `npm run build && npm test` passes.

## Done When

- Running `npm run dev` starts a server that serves a page saying "AltDocs".
- `npm test` runs vitest and passes.
- `npm run test:e2e` runs Playwright and passes.
- All code is TypeScript.
