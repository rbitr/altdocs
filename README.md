# AltDocs

A from-scratch rich text document editor, built without any editor frameworks. The core document model, rendering engine, input handling, and persistence are all implemented in this repository.

## Prerequisites

- **Node.js** >= 20 (tested with v24)
- **npm** >= 9
- A C/C++ toolchain (`build-essential` on Debian/Ubuntu) — required by `better-sqlite3`

## Quick Start

```bash
# Install dependencies
npm install

# Start the dev server (API on :3000, Vite on :5173)
npm run dev          # starts the Express API server
npx vite             # in a second terminal — starts the Vite dev server
```

Open http://localhost:5173 in your browser. The Vite dev server proxies `/api/` requests to the Express server on port 3000.

## Production Build & Hosting

```bash
# Build the client bundle
npm run build        # outputs to dist/client/

# Start the production server
PORT=3000 npm run dev
```

In production the Express server serves both the API and the static client files from `dist/client/`. Set the `PORT` environment variable to control which port the server listens on (default: `3000`).

### What You Need to Host

1. **Node.js runtime** with native module support (for `better-sqlite3`)
2. **A writable `data/` directory** next to the project root — the SQLite database (`altdocs.db`) is created here automatically
3. **Build the client first** (`npm run build`) — the server serves `dist/client/` as static files
4. **Run the server** — `npm run dev` starts Express via tsx

### Reverse Proxy (Optional)

If placing behind nginx or similar:

```
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
}
```

## Project Structure

```
altdocs/
├── src/
│   ├── server/          # Express API server
│   │   ├── index.ts     # Server entry point
│   │   ├── api.ts       # REST routes (/api/documents)
│   │   └── db.ts        # SQLite storage layer
│   ├── client/          # Browser client
│   │   ├── index.html   # HTML entry point
│   │   ├── main.ts      # Client entry, routing, auto-save
│   │   ├── editor.ts    # Editor controller (model ↔ DOM)
│   │   ├── renderer.ts  # Model → DOM rendering
│   │   ├── cursor-renderer.ts  # Cursor/selection display
│   │   ├── toolbar.ts   # Formatting toolbar
│   │   ├── api-client.ts # HTTP client for server API
│   │   └── styles.css   # Stylesheet
│   └── shared/          # Code shared between client & server
│       ├── model.ts     # Document model & operations
│       ├── types.ts     # Type definitions
│       ├── cursor.ts    # Cursor/selection logic
│       └── history.ts   # Undo/redo history manager
├── tests/               # Test files
├── data/                # SQLite database (auto-created, gitignored)
├── dist/                # Build output (gitignored)
├── spec/                # Feature specs and constraints
├── decisions/           # Architecture decision records
└── package.json
```

## API

All endpoints are under `/api/`:

| Method | Path                    | Description            |
|--------|-------------------------|------------------------|
| GET    | `/api/documents`        | List all documents     |
| GET    | `/api/documents/:id`    | Get a document by ID   |
| POST   | `/api/documents`        | Create a new document  |
| PUT    | `/api/documents/:id`    | Update (or upsert) a document |

Documents are stored as JSON-serialized block arrays in SQLite.

## Testing

```bash
# Unit tests (vitest)
npm test

# End-to-end browser tests (Playwright)
npm run test:e2e
```

E2E tests automatically start both the Express server (port 3000) and Vite dev server (port 5173) via Playwright's `webServer` config.

To install Playwright browser binaries on a fresh machine:

```bash
npx playwright install --with-deps chromium
```

## Architecture

- **Document model**: Flat array of `Block` objects, each containing an array of `TextRun` objects with formatting flags. All mutations go through an operation layer (`applyOperation`).
- **Rendering**: The model is rendered to DOM via a pure render function. The browser's `contenteditable` is used as an input mechanism, but the model is the source of truth.
- **Persistence**: SQLite (via `better-sqlite3`) in WAL mode. The database file lives in `data/altdocs.db`.
- **Auto-save**: Client saves 2 seconds after the last edit, with JSON change detection to skip no-op saves.

## Environment Variables

| Variable | Default | Description                |
|----------|---------|----------------------------|
| `PORT`   | `3000`  | Port for the Express server |

## License

Private — see project documentation.
