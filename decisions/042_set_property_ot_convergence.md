# Decision 042: Set-Property Operation OT Convergence

## Context

The set-property operations (`set_indent`, `set_image`, `set_line_spacing`) had a convergence
bug when two users concurrently applied the same operation type to the same block. Both operations
would pass through the transform unchanged, and "last writer wins" behavior meant the two
paths (A→B' vs B→A') would produce different results.

## Decision

Use priority-based conflict resolution for concurrent set-property operations on the same block.
When transforming a set-property op against another of the same type on the same block:
- The **priority** operation (a) keeps its value
- The **non-priority** operation (b') adopts a's value

This ensures convergence: both paths end at a's value.

## Alternatives Considered

1. **No-op the non-priority operation**: Simpler but requires a no-op operation type or
   special handling. Adopting the value is semantically equivalent and doesn't require
   new types.

2. **Last-write-wins (no transform)**: The existing behavior. Doesn't converge — both paths
   produce different final values. This violates the OT convergence property.

3. **Merge/combine values**: Not applicable for set-property operations where the values
   are complete replacements (not incremental).

## Impact

- `set_indent`, `set_image`, `set_line_spacing` now converge correctly when two users
  concurrently set the same property on the same block
- The priority convention (a has priority in `transformOperation`) determines which user's
  value wins

## Note

The older `change_block_type` and `change_block_alignment` operations have the same
convergence issue but were not fixed in this change to limit scope. They should be
addressed in a follow-up.
