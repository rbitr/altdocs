# Task 045: Table Support

## Priority: P3

## Description
Add table support to the document editor — insert, render, edit, and delete tables.

## Requirements
- New block type: `table`
- Table data model: 2D grid of cells, each with TextRun[]
- Insert table via toolbar button (default 2×2)
- Render tables as HTML `<table>` elements
- Edit cell content by clicking and typing
- Navigate between cells with Tab/Shift+Tab
- Add/remove rows and columns
- Delete entire table via Backspace/Delete
- Table-specific CSS styling
- OT support for set_table_data operation
- Content validation for tableData
- Unit tests for operations, rendering, OT
- Editor integration tests for table editing

## Design
See decisions/045-table-support.md
