# Task 037: Image Insertion

## Priority: P3

## Description
Add image insertion support to the editor. Users can insert images into documents via:
1. Toolbar button that opens a file picker
2. Images uploaded to server, stored in data/uploads/ directory
3. Images rendered as block-level elements (like horizontal rules)

## Requirements
- New `image` block type added to BlockType union
- Block gets optional `imageUrl` field for storing image path
- New `set_image` operation type for setting/changing image URL on a block
- Server-side image upload endpoint: `POST /api/uploads`
  - Accepts multipart/form-data with image file
  - Validates file type (JPEG, PNG, GIF, WebP)
  - Limits file size (5MB max)
  - Stores in data/uploads/ directory
  - Returns JSON with URL path
- Image block rendering: `<figure>` containing `<img>` element
  - Max width: 100% of editor
  - Click to select
- Editor handling: image blocks are void (no text editing)
  - Enter on image block: insert paragraph after
  - Backspace on image block: delete it
  - No text input allowed on image blocks
- OT support for set_image operation (block-index based, like set_indent)
- Content validation updated for image blocks
- Toolbar "Image" button with file picker

## Tests
- Model: applyOperation for set_image
- Renderer: image block rendering
- Editor: image block keyboard handling (Enter, Backspace, arrow keys)
- API: upload endpoint (file validation, size limits)
- OT: set_image transformation
- Validation: image blocks

## Files to modify
- src/shared/model.ts — BlockType, Block interface, set_image op, applyOperation
- src/shared/validation.ts — image block type, imageUrl field
- src/shared/ot.ts — set_image transforms
- src/client/renderer.ts — image block rendering
- src/client/editor.ts — image block input handling, insertImage method
- src/client/toolbar.ts — image button
- src/server/api.ts — upload endpoint
- src/server/index.ts — serve uploads directory as static
- tests/ — unit tests for all above
