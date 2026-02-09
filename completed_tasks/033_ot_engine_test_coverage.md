# Task 033: OT Engine Test Coverage Improvement

## Priority
High — the OT engine is the most critical code for collaboration correctness

## Description
The OT engine (`src/shared/ot.ts`) has 66% statement coverage and 59.74% branch coverage. Many `transformSingle` operation-type combination branches are untested, including:
- `set_block_type` vs other operations
- `set_alignment` vs other operations
- `merge_block` vs `split_block` and vice versa
- `insert_block` vs `delete_block` and vice versa
- Various edge cases in priority/conflict resolution

## Acceptance Criteria
- [ ] All `transformSingle` operation-type pairs have at least one test
- [ ] Branch coverage for ot.ts improves from ~60% to 85%+
- [ ] All existing tests continue to pass
- [ ] Tests cover edge cases like same-position operations, overlapping ranges
