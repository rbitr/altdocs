# Decision 039: Line Spacing Controls

## Context
P3 feature: allow users to control line spacing per block.

## Decision
- Added `lineSpacing` optional field to Block model as a union type of `1.0 | 1.15 | 1.5 | 2.0`
- Created `set_line_spacing` operation following same pattern as `set_indent`, `set_image`
- OT transforms use `transformBlockIndex` (same as all other block-level operations)
- Renderer applies `line-height` CSS inline style on block elements
- Toolbar has a `<select>` dropdown with options: Single (1), 1.15, 1.5, Double (2)
- Default label "Spacing" shown when no explicit spacing is set (uses CSS default)
- `split_block` preserves lineSpacing on the new block (same as indentLevel)
- Validation restricts lineSpacing to the four valid values

## Alternatives Considered
1. **Free-form numeric input**: More flexible but harder to validate, less discoverable. Google Docs also uses a fixed set of presets. Chose presets for simplicity.
2. **Line spacing as a TextStyle property**: Would allow per-run spacing, but line-height is inherently a block-level property. Chose block-level.
3. **CSS custom property approach**: Could use `data-line-spacing` attribute + CSS. Chose inline styles for consistency with alignment and simplicity — the renderer already uses `el.style.textAlign`.

## Impact
- Block model gets optional `lineSpacing` field (backward compatible — undefined means default)
- New operation type `set_line_spacing` in the Operation union
- Toolbar gets a new dropdown control between indent and insert groups
- 51 new unit tests, 7 new e2e tests
