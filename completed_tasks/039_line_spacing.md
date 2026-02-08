# Task 039: Line Spacing Controls

## Priority
P3

## Description
Add user-controllable line spacing to the editor. Currently, line-height values are hard-coded in CSS. Users should be able to adjust line spacing per block (paragraph, heading, list item, etc.).

## Requirements
1. Add `lineSpacing` optional field to Block model (number, e.g. 1.0, 1.15, 1.5, 2.0)
2. Create `set_line_spacing` operation type that sets lineSpacing on a block
3. Add OT transforms for `set_line_spacing` (uses blockIndex like change_block_type)
4. Renderer applies `line-height` style based on block's lineSpacing value
5. Toolbar dropdown/button group for selecting line spacing (1.0, 1.15, 1.5, 2.0)
6. Keyboard shortcut: Ctrl+Shift+1/5/2 for single/1.5/double spacing (optional)
7. Default line spacing is undefined (uses CSS default ~1.6)

## Technical Approach
- Follow same pattern as block alignment and block type changes
- `set_line_spacing` op: `{ type: 'set_line_spacing', blockIndex: number, lineSpacing: number }`
- OT transform uses `transformBlockIndex` (same as change_block_type, change_block_alignment, set_indent)
- Renderer: apply `style="line-height: X"` to block elements when lineSpacing is set
- Toolbar: line-spacing button group in formatting section with dropdown

## Testing
- Unit tests for set_line_spacing operation application
- Unit tests for OT transforms with set_line_spacing
- Unit tests for renderer applying line-height styles
- Editor unit tests for line spacing changes
- E2E tests for toolbar line spacing controls

## Acceptance Criteria
- [ ] Block model supports optional lineSpacing field
- [ ] set_line_spacing operation works correctly
- [ ] OT transforms are correct for set_line_spacing
- [ ] Renderer applies line-height inline style
- [ ] Toolbar has line spacing controls
- [ ] Validation accepts lineSpacing field
- [ ] Tests pass
