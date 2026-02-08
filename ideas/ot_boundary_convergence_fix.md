# OT Boundary Convergence Fix

## Issue
When an insert_text position is exactly at the end of a concurrent delete_text range, the OT engine does not converge:

- Path A→B: insert "X" at offset 3, then transformed delete [0,4] → "de"
- Path B→A: delete [0,3] → "de", then transformed insert at 0 → "Xde"

The root cause: `transformDeleteAgainstInsert` uses `shiftOnTie=true` for the end position, causing the delete to expand and consume the inserted character. But `transformInsertText` does NOT turn the insert into a no-op because `isPositionWithinRange` returns false (position is at the boundary, not strictly inside).

## Potential Fix
Either:
1. Make `isPositionWithinRange` inclusive on the end boundary for this case
2. Don't expand the delete end with `shiftOnTie=true` when the insert is at the boundary
3. Use `shiftOnTie=false` for the delete end in `transformDeleteAgainstInsert`

Option 3 seems safest — the insert survives and appears right after the delete range, which matches user intent (typing at a cursor that's right after deleted text).

## Impact
Low — this only occurs when an insert happens at the exact end offset of a concurrent delete on the same block. In practice, cursor positions rarely land exactly on this boundary in real-time collaboration.
