# Decision 011: Migrate from JSON File Store to SQLite via better-sqlite3

## Context

Task 011 requires proper persistent storage. The previous implementation (Decision 009) used a JSON file backed by an in-memory Map because `better-sqlite3` could not be installed without `make`/`gcc`. Build tools are now available on the system.

## Decision

Replace the JSON file store with SQLite via `better-sqlite3`, as originally specified in CONSTRAINTS.md.

## Implementation

- `src/server/db.ts` now uses `better-sqlite3` to manage a SQLite database at `data/altdocs.db`
- WAL journal mode enabled for better concurrent read performance
- Single `documents` table with columns: `id`, `title`, `content`, `created_at`, `updated_at`
- Same exported function signatures as before — no changes needed in API layer
- `useMemoryDb()` function added for test isolation (switches to `:memory:` database)
- `resetStore()` now does `DELETE FROM documents` instead of clearing a Map

## Why SQLite over JSON File

1. **Concurrent safety**: SQLite handles concurrent reads/writes correctly; JSON file could corrupt on concurrent writes
2. **Performance**: SQLite is faster for lookups and doesn't require loading entire dataset into memory
3. **Query flexibility**: Can add indexes, do filtered queries, pagination etc. as the app grows
4. **Spec compliance**: CONSTRAINTS.md specifies SQLite as the database choice

## Test Strategy

- Unit and API tests call `useMemoryDb()` in `beforeAll` to avoid touching the real database file
- `resetStore()` clears all rows between tests for isolation
- All 284 unit tests and 24 e2e tests pass with the new implementation
