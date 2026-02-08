# Task 043: Fix change_block_type and change_block_alignment OT Convergence

## Priority: Medium (OT Correctness)

## Problem

The `change_block_type` and `change_block_alignment` operations have the same convergence
bug that was fixed for `set_indent`, `set_image`, and `set_line_spacing` in task 042.

When two users concurrently change the block type (or alignment) of the same block,
the transform functions don't handle the conflict — both operations pass through unchanged.
This means the two OT paths produce different results (non-convergence).

## Solution

Apply the same priority-based resolution used in task 042:
- Pass `hasPriority` to `transformChangeBlockType()` and `transformChangeBlockAlignment()`
- When transforming against the same operation type on the same block, if not having
  priority, adopt the other operation's value

## Tests
- Update existing tests that assert "last wins" behavior
- Add convergence tests for concurrent same-type operations on the same block
