# Decision 009: JSON File-Based Storage for Document Persistence

## Context

Task 009 requires document persistence — saving and loading documents via a server API. The spec calls for SQLite via `better-sqlite3`, but that library requires native compilation (`make`/`gcc`) which is unavailable on this system.

## Decision

Use an in-memory `Map<string, DocumentRecord>` backed by a JSON file on disk (`data/documents.json`).

## Alternatives Considered

1. **better-sqlite3** — Preferred by spec but fails to install without build tools. Would need to install `make` and `gcc` on the system first.
2. **@node-rs/sqlite** — Rust-based SQLite binding with pre-compiled binaries. Might work without build tools, but adds a dependency that may be fragile.
3. **In-memory only** — Simplest, but data lost on server restart.
4. **JSON file store (chosen)** — Simple, requires no dependencies, data persists across restarts. Trade-off: not suitable for concurrent writes or large datasets, but fine for MVP/development.

## Design Details

- `src/server/db.ts`: In-memory Map synced to `data/documents.json` on every write
- CRUD operations are synchronous in-memory, with sync file writes for persistence
- `data/` directory is gitignored
- `resetStore()` exposed for test isolation
- PUT endpoint supports upsert (auto-creates document if it doesn't exist)

## Client Architecture

- Hash-based routing: `/#/doc/:id` opens editor, root shows document list
- Auto-save: 2-second debounce after each editor change via `onUpdate()` callback
- Change detection: Compares JSON-serialized blocks to avoid no-op saves
- Graceful degradation: If API is unreachable, creates empty document locally

## Migration Path

When build tools become available, replace `db.ts` internals with `better-sqlite3` — the CRUD function signatures remain the same, so the API layer won't change.
