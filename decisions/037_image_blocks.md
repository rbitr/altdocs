# Decision 037: Image Block Design

## Context
Adding image insertion as a P3 feature. Need to decide how images are modeled, stored, and rendered.

## Decision

### Block Model
- Add `'image'` to BlockType union
- Add optional `imageUrl?: string` field to Block interface
- Image blocks are void blocks (like horizontal-rule): they have runs but no meaningful text
- This follows the same pattern as horizontal-rule for editor handling

### Storage
- Images uploaded to `data/uploads/` directory on server
- Served as static files via Express
- File names use crypto random hex to prevent collisions
- No database table for images — the URL in the block content is the source of truth

### Operations
- New `set_image` operation: `{ type: 'set_image', blockIndex: number, imageUrl: string }`
- Used to set or change the image URL on a block
- OT transforms: uses transformBlockIndex (same as set_indent, change_block_type)
- Image insertion flow: insert_block (type: image) + set_image (sets URL)

### Rendering
- Image blocks render as `<figure data-block-id="..."><img src="..." /><figcaption>optional</figcaption></figure>`
- Max width 100%, auto height
- Clicking an image selects the block

### Upload API
- POST /api/uploads — multipart/form-data
- Validates: JPEG, PNG, GIF, WebP only
- Max file size: 5MB
- Returns: { url: '/uploads/filename.ext' }
- Uses multer-less approach: raw body parsing with content-type validation

### Alternatives Considered
1. **Base64 inline images**: Would bloat document content JSON massively. Rejected.
2. **External URL only (no upload)**: Simpler but poor UX — users expect file upload. Could add URL input later.
3. **Separate images table**: Overkill for MVP. URL-in-block is simpler and sufficient.
4. **Extend insert_block with metadata**: Would complicate the existing operation type. A separate set_image op is cleaner.
