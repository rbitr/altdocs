# Decision 022: Version History Implementation

## Context
Need to implement version history so users can view and restore previous document saves.

## Decisions

### Version creation trigger
**Decision**: Create a version automatically on every `updateDocument` call, but only when title or content actually changed.

**Alternatives considered**:
1. Create a version on every save regardless — would create noise from no-op saves (e.g., editor initial save)
2. Require explicit "save version" action — worse UX, users would forget
3. Time-based batching (e.g., one version per minute) — more complex, less predictable

**Rationale**: Change-detection is simple (string comparison of title and content), prevents noise from auto-save cycles that don't change anything, and still captures every meaningful edit.

### Version retention limit
**Decision**: Keep last 50 versions per document. Oldest versions are pruned on each new version creation.

**Rationale**: 50 versions provides ample history for most use cases. Pruning on insert keeps it simple (no background jobs). The UNIQUE(document_id, version_number) constraint ensures version numbers are always sequential per document.

### Restore behavior
**Decision**: Restoring a version updates the main document to the version's content AND creates a new version entry (via the existing updateDocument flow). This means the restore itself appears in version history.

**Alternatives considered**:
1. Restore without creating a version — would make the restore "invisible" in history, harder to undo
2. Reset version numbering — confusing, version numbers should always increase

**Rationale**: Treating a restore like any other edit is the simplest approach and allows users to undo a restore by restoring the version that existed before.

### UI placement
**Decision**: Version history button in toolbar's help group (next to keyboard shortcuts). Opens as a modal overlay panel similar to the shortcuts panel.

**Rationale**: Consistent with existing patterns. The overlay prevents interaction with the editor while viewing versions, which avoids confusion about which version is "active."
