# Task 034: Fix OT Boundary Convergence Bug

## Priority: P1 (Correctness)

## Description
Fix the known OT convergence failure when an insert_text operation occurs at the exact end offset of a concurrent delete_text range.

## Problem
When user A inserts text at offset 3 and user B concurrently deletes [0,3] on the same block:
- `transformDeleteAgainstInsert` used `shiftOnTie=true` for the delete's end position, expanding the delete to [0,4] to cover the inserted character
- But `transformInsertText` did NOT make the insert a no-op because `isPositionWithinRange` uses strict boundaries (the insert at the end is not "within" the range)
- Result: Path A→B' produces "de" but Path B→A' produces "Xde" — non-convergent

## Fix
Changed `shiftOnTie` from `true` to `false` for the delete's end position in `transformDeleteAgainstInsert`. This means:
- The delete does NOT expand to cover text inserted at its end boundary
- The insert survives (correct — it's outside the delete range)
- Both paths now converge to "Xde"

## Files Modified
- `src/shared/ot.ts` — Changed `shiftOnTie` for delete end in `transformDeleteAgainstInsert`
- `tests/ot.test.ts` — Updated boundary test to verify full convergence

## Tests
- Updated existing "insert at delete range boundary" test to verify convergence (both paths produce identical "Xde")
- All 918 unit tests pass
