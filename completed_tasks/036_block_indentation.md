# Task 036: Block Indentation (Nested Lists & General Indent)

## Priority
P3 — Feature extension (Margins and Indentation)

## Description
Add indentation support to blocks, enabling nested lists and general block indentation. This was explicitly planned for in Decision 001: "Nesting can be handled later by adding indentation levels to blocks."

## Requirements
1. Add `indentLevel` field to Block (0-8 range, default 0)
2. Add `set_indent` operation to change a block's indent level
3. Implement OT transforms for `set_indent` against all existing operations
4. Update renderer to nest list items (ul/ol) based on indent levels
5. Non-list blocks get margin-left based on indent level
6. Tab key indents current block (when cursor at start or block is list item)
7. Shift+Tab outdents current block
8. Toolbar indent/outdent buttons
9. CSS for nested list rendering and general indentation
10. Unit tests, integration tests, and e2e tests

## Scope
- Model: types.ts (Block interface, new op type), model.ts (applyOperation, cloneBlock)
- OT: ot.ts (transformSingle for set_indent)
- Renderer: renderer.ts (nested list grouping)
- Editor: editor.ts (Tab/Shift+Tab handling)
- Toolbar: toolbar.ts (indent/outdent buttons)
- Styles: style.css (nested list CSS)
- Validation: validation.ts (indentLevel validation)
- Tests: model, ot, renderer, editor, e2e
