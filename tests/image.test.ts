/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import {
  Document,
  Block,
  Operation,
  applyOperation,
  blockTextLength,
  blockToPlainText,
  createEmptyDocument,
  createBlock,
  resetBlockIdCounter,
} from '../src/shared/model.js';
import { transformOperation, transformSingle } from '../src/shared/ot.js';
import { validateContent } from '../src/shared/validation.js';
import { renderDocument, renderDocumentToElement } from '../src/client/renderer.js';
import { Editor } from '../src/client/editor.js';
import { collapsedCursor } from '../src/shared/cursor.js';

// ============================================================
// Test Helpers
// ============================================================

function makeDoc(blocks: Block[]): Document {
  return { id: 'test-doc', title: 'Test', blocks };
}

function makeBlock(text: string, type: Block['type'] = 'paragraph'): Block {
  return {
    id: `b-${Math.random()}`,
    type,
    alignment: 'left',
    runs: [{ text, style: {} }],
  };
}

function makeImageBlock(imageUrl?: string): Block {
  const block: Block = {
    id: `b-img-${Math.random()}`,
    type: 'image',
    alignment: 'left',
    runs: [{ text: '', style: {} }],
  };
  if (imageUrl) {
    block.imageUrl = imageUrl;
  }
  return block;
}

function createEditor(doc?: Document): Editor {
  const container = document.createElement('div');
  return new Editor(container, doc);
}

function getBlockText(editor: Editor, blockIndex: number): string {
  return blockToPlainText(editor.doc.blocks[blockIndex]);
}

function makeKeyEvent(key: string, opts: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...opts,
  });
}

// ============================================================
// Model: set_image operation
// ============================================================

describe('set_image operation', () => {
  beforeEach(() => {
    resetBlockIdCounter();
  });

  it('sets imageUrl on a block', () => {
    const doc = makeDoc([makeImageBlock()]);
    const op: Operation = { type: 'set_image', blockIndex: 0, imageUrl: '/uploads/test.png' };
    const result = applyOperation(doc, op);
    expect(result.blocks[0].imageUrl).toBe('/uploads/test.png');
  });

  it('overwrites existing imageUrl', () => {
    const doc = makeDoc([makeImageBlock('/uploads/old.png')]);
    const op: Operation = { type: 'set_image', blockIndex: 0, imageUrl: '/uploads/new.png' };
    const result = applyOperation(doc, op);
    expect(result.blocks[0].imageUrl).toBe('/uploads/new.png');
  });

  it('does nothing for out-of-bounds blockIndex', () => {
    const doc = makeDoc([makeBlock('hello')]);
    const op: Operation = { type: 'set_image', blockIndex: 5, imageUrl: '/uploads/test.png' };
    const result = applyOperation(doc, op);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].imageUrl).toBeUndefined();
  });

  it('does not mutate the original document', () => {
    const doc = makeDoc([makeImageBlock()]);
    const op: Operation = { type: 'set_image', blockIndex: 0, imageUrl: '/uploads/test.png' };
    applyOperation(doc, op);
    expect(doc.blocks[0].imageUrl).toBeUndefined();
  });

  it('preserves imageUrl when cloning image blocks', () => {
    const doc = makeDoc([makeImageBlock('/uploads/test.png'), makeBlock('hello')]);
    const op: Operation = { type: 'insert_text', position: { blockIndex: 1, offset: 5 }, text: '!' };
    const result = applyOperation(doc, op);
    expect(result.blocks[0].imageUrl).toBe('/uploads/test.png');
    expect(result.blocks[0].type).toBe('image');
  });
});

// ============================================================
// Model: image as block type with insert_block
// ============================================================

describe('insert_block with image type', () => {
  beforeEach(() => {
    resetBlockIdCounter();
  });

  it('inserts an image block', () => {
    const doc = makeDoc([makeBlock('hello')]);
    const op: Operation = { type: 'insert_block', afterBlockIndex: 0, blockType: 'image' };
    const result = applyOperation(doc, op);
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[1].type).toBe('image');
    expect(result.blocks[1].runs).toHaveLength(1);
  });

  it('insert_block + set_image creates a full image block', () => {
    const doc = makeDoc([makeBlock('hello')]);
    let result = applyOperation(doc, { type: 'insert_block', afterBlockIndex: 0, blockType: 'image' });
    result = applyOperation(result, { type: 'set_image', blockIndex: 1, imageUrl: '/uploads/pic.jpg' });
    expect(result.blocks[1].type).toBe('image');
    expect(result.blocks[1].imageUrl).toBe('/uploads/pic.jpg');
  });
});

// ============================================================
// OT: set_image transforms
// ============================================================

describe('OT: set_image', () => {
  it('set_image vs split_block before — shifts blockIndex', () => {
    const a: Operation = { type: 'split_block', position: { blockIndex: 0, offset: 3 } };
    const b: Operation = { type: 'set_image', blockIndex: 1, imageUrl: '/uploads/test.png' };
    const [, bPrime] = transformOperation(a, b);
    expect(bPrime).toEqual({ type: 'set_image', blockIndex: 2, imageUrl: '/uploads/test.png' });
  });

  it('set_image vs split_block after — no change', () => {
    const a: Operation = { type: 'split_block', position: { blockIndex: 2, offset: 3 } };
    const b: Operation = { type: 'set_image', blockIndex: 0, imageUrl: '/uploads/test.png' };
    const [, bPrime] = transformOperation(a, b);
    expect(bPrime).toEqual({ type: 'set_image', blockIndex: 0, imageUrl: '/uploads/test.png' });
  });

  it('set_image vs merge_block before — shifts blockIndex down', () => {
    const a: Operation = { type: 'merge_block', blockIndex: 1 };
    const b: Operation = { type: 'set_image', blockIndex: 2, imageUrl: '/uploads/test.png' };
    const [, bPrime] = transformOperation(a, b);
    expect(bPrime).toEqual({ type: 'set_image', blockIndex: 1, imageUrl: '/uploads/test.png' });
  });

  it('set_image vs insert_block before — shifts blockIndex up', () => {
    const a: Operation = { type: 'insert_block', afterBlockIndex: 0, blockType: 'paragraph' };
    const b: Operation = { type: 'set_image', blockIndex: 1, imageUrl: '/uploads/test.png' };
    const [, bPrime] = transformOperation(a, b);
    expect(bPrime).toEqual({ type: 'set_image', blockIndex: 2, imageUrl: '/uploads/test.png' });
  });

  it('set_image vs insert_text — no change', () => {
    const a: Operation = { type: 'insert_text', position: { blockIndex: 0, offset: 0 }, text: 'x' };
    const b: Operation = { type: 'set_image', blockIndex: 0, imageUrl: '/uploads/test.png' };
    const [, bPrime] = transformOperation(a, b);
    expect(bPrime).toEqual({ type: 'set_image', blockIndex: 0, imageUrl: '/uploads/test.png' });
  });

  it('two concurrent set_image on same block — priority op (a) wins', () => {
    const a: Operation = { type: 'set_image', blockIndex: 0, imageUrl: '/uploads/a.png' };
    const b: Operation = { type: 'set_image', blockIndex: 0, imageUrl: '/uploads/b.png' };
    const [aPrime, bPrime] = transformOperation(a, b);
    // a has priority: a' keeps its value, b' adopts a's value for convergence
    expect(aPrime).toEqual({ type: 'set_image', blockIndex: 0, imageUrl: '/uploads/a.png' });
    expect(bPrime).toEqual({ type: 'set_image', blockIndex: 0, imageUrl: '/uploads/a.png' });
  });

  it('transformSingle: set_image against split_block', () => {
    const op: Operation = { type: 'set_image', blockIndex: 1, imageUrl: '/uploads/test.png' };
    const other: Operation = { type: 'split_block', position: { blockIndex: 0, offset: 3 } };
    const result = transformSingle(op, other);
    expect(result).toEqual({ type: 'set_image', blockIndex: 2, imageUrl: '/uploads/test.png' });
  });
});

// ============================================================
// Validation: image blocks
// ============================================================

describe('Validation: image blocks', () => {
  it('accepts valid image block', () => {
    const content = JSON.stringify([{
      id: 'b1',
      type: 'image',
      alignment: 'left',
      runs: [{ text: '', style: {} }],
      imageUrl: '/uploads/test.png',
    }]);
    expect(validateContent(content)).toBeNull();
  });

  it('accepts image block without imageUrl', () => {
    const content = JSON.stringify([{
      id: 'b1',
      type: 'image',
      alignment: 'left',
      runs: [{ text: '', style: {} }],
    }]);
    expect(validateContent(content)).toBeNull();
  });

  it('rejects image block with non-string imageUrl', () => {
    const content = JSON.stringify([{
      id: 'b1',
      type: 'image',
      alignment: 'left',
      runs: [{ text: '', style: {} }],
      imageUrl: 123,
    }]);
    expect(validateContent(content)).toContain('imageUrl');
  });
});

// ============================================================
// Renderer: image blocks
// ============================================================

describe('Renderer: image blocks', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.className = 'altdocs-editor';
  });

  it('renders image block with URL as figure > img', () => {
    const doc = makeDoc([makeImageBlock('/uploads/test.png')]);
    renderDocument(doc, container);
    const figure = container.querySelector('figure');
    expect(figure).not.toBeNull();
    expect(figure!.classList.contains('image-block')).toBe(true);
    const img = figure!.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.src).toContain('/uploads/test.png');
    expect(img!.alt).toBe('Document image');
  });

  it('renders image block without URL as placeholder', () => {
    const doc = makeDoc([makeImageBlock()]);
    renderDocument(doc, container);
    const figure = container.querySelector('figure');
    expect(figure).not.toBeNull();
    const placeholder = figure!.querySelector('.image-placeholder');
    expect(placeholder).not.toBeNull();
    expect(placeholder!.textContent).toBe('Image loading...');
  });

  it('sets data-block-id on image block', () => {
    const block = makeImageBlock('/uploads/test.png');
    const doc = makeDoc([block]);
    renderDocument(doc, container);
    const figure = container.querySelector('figure');
    expect(figure!.dataset.blockId).toBe(block.id);
  });

  it('renders image block with indent', () => {
    const block = makeImageBlock('/uploads/test.png');
    block.indentLevel = 2;
    const doc = makeDoc([block]);
    renderDocument(doc, container);
    const figure = container.querySelector('figure');
    expect(figure!.dataset.indent).toBe('2');
  });

  it('image block among other blocks', () => {
    const doc = makeDoc([
      makeBlock('Before'),
      makeImageBlock('/uploads/test.png'),
      makeBlock('After'),
    ]);
    renderDocument(doc, container);
    const children = container.children;
    expect(children).toHaveLength(3);
    expect(children[0].tagName).toBe('P');
    expect(children[1].tagName).toBe('FIGURE');
    expect(children[2].tagName).toBe('P');
  });
});

// ============================================================
// Editor: image block handling
// ============================================================

describe('Editor: image blocks', () => {
  it('blocks text input on image blocks', () => {
    const doc = makeDoc([makeImageBlock('/uploads/test.png')]);
    const editor = createEditor(doc);
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });

    const e = makeKeyEvent('a');
    editor.handleKeyDown(e);

    // Text should not be inserted
    expect(editor.doc.blocks[0].type).toBe('image');
    expect(blockTextLength(editor.doc.blocks[0])).toBe(0);
  });

  it('Enter on image block inserts paragraph after', () => {
    const doc = makeDoc([makeImageBlock('/uploads/test.png')]);
    const editor = createEditor(doc);
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });

    editor.handleKeyDown(makeKeyEvent('Enter'));

    expect(editor.doc.blocks).toHaveLength(2);
    expect(editor.doc.blocks[0].type).toBe('image');
    expect(editor.doc.blocks[1].type).toBe('paragraph');
    expect(editor.cursor.focus.blockIndex).toBe(1);
  });

  it('Backspace on image block deletes it (with previous block)', () => {
    const doc = makeDoc([makeBlock('hello'), makeImageBlock('/uploads/test.png')]);
    const editor = createEditor(doc);
    editor.cursor = collapsedCursor({ blockIndex: 1, offset: 0 });

    editor.handleKeyDown(makeKeyEvent('Backspace'));

    expect(editor.doc.blocks).toHaveLength(1);
    expect(editor.doc.blocks[0].type).toBe('paragraph');
    expect(editor.cursor.focus.blockIndex).toBe(0);
    expect(editor.cursor.focus.offset).toBe(5);
  });

  it('Backspace on image block as only block converts to paragraph', () => {
    const doc = makeDoc([makeImageBlock('/uploads/test.png')]);
    const editor = createEditor(doc);
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });

    editor.handleKeyDown(makeKeyEvent('Backspace'));

    expect(editor.doc.blocks).toHaveLength(1);
    expect(editor.doc.blocks[0].type).toBe('paragraph');
    expect(editor.doc.blocks[0].imageUrl).toBeUndefined();
  });

  it('Backspace on image block as first block removes it', () => {
    const doc = makeDoc([makeImageBlock('/uploads/test.png'), makeBlock('hello')]);
    const editor = createEditor(doc);
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });

    editor.handleKeyDown(makeKeyEvent('Backspace'));

    expect(editor.doc.blocks).toHaveLength(1);
    expect(editor.doc.blocks[0].type).toBe('paragraph');
    expect(getBlockText(editor, 0)).toBe('hello');
  });

  it('Backspace at start of block after image deletes the image', () => {
    const doc = makeDoc([makeImageBlock('/uploads/test.png'), makeBlock('hello')]);
    const editor = createEditor(doc);
    editor.cursor = collapsedCursor({ blockIndex: 1, offset: 0 });

    editor.handleKeyDown(makeKeyEvent('Backspace'));

    expect(editor.doc.blocks).toHaveLength(1);
    expect(editor.doc.blocks[0].type).toBe('paragraph');
    expect(getBlockText(editor, 0)).toBe('hello');
  });

  it('image block detected as void by getActiveBlockType', () => {
    const doc = makeDoc([makeImageBlock('/uploads/test.png')]);
    const editor = createEditor(doc);
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    expect(editor.getActiveBlockType()).toBe('image');
  });
});

// ============================================================
// Upload API: parseMultipart
// ============================================================

describe('parseMultipart', () => {
  // We test the multipart parser directly since we can't easily test the HTTP endpoint
  // from jsdom (no real server). API integration tests should be in a separate file.

  it('parses a simple multipart body', async () => {
    // Dynamic import to avoid jsdom issues with server code
    const { parseMultipart } = await import('../src/server/uploads.js');

    const boundary = '----boundary123';
    const contentType = `multipart/form-data; boundary=${boundary}`;
    const fileContent = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]); // JPEG header

    const body = Buffer.concat([
      Buffer.from(`------boundary123\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="file"; filename="test.jpg"\r\n`),
      Buffer.from(`Content-Type: image/jpeg\r\n`),
      Buffer.from(`\r\n`),
      fileContent,
      Buffer.from(`\r\n------boundary123--\r\n`),
    ]);

    const result = parseMultipart(body, contentType);
    expect(result).not.toBeNull();
    expect(result!.filename).toBe('test.jpg');
    expect(result!.contentType).toBe('image/jpeg');
    expect(result!.data).toEqual(fileContent);
  });

  it('returns null for missing boundary', async () => {
    const { parseMultipart } = await import('../src/server/uploads.js');
    const result = parseMultipart(Buffer.from('data'), 'multipart/form-data');
    expect(result).toBeNull();
  });

  it('returns null for empty body', async () => {
    const { parseMultipart } = await import('../src/server/uploads.js');
    const result = parseMultipart(Buffer.from(''), 'multipart/form-data; boundary=xxx');
    expect(result).toBeNull();
  });

  it('extracts content type from part headers', async () => {
    const { parseMultipart } = await import('../src/server/uploads.js');

    const boundary = 'testboundary';
    const body = Buffer.concat([
      Buffer.from(`--testboundary\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="file"; filename="image.png"\r\n`),
      Buffer.from(`Content-Type: image/png\r\n`),
      Buffer.from(`\r\n`),
      Buffer.from('pngdata'),
      Buffer.from(`\r\n--testboundary--\r\n`),
    ]);

    const result = parseMultipart(body, `multipart/form-data; boundary=${boundary}`);
    expect(result).not.toBeNull();
    expect(result!.contentType).toBe('image/png');
    expect(result!.filename).toBe('image.png');
  });
});

// ============================================================
// Upload API: HTTP endpoint tests
// ============================================================

describe('Upload API endpoint', () => {
  let server: import('http').Server;
  let baseUrl: string;

  beforeAll(async () => {
    const express = (await import('express')).default;
    const { uploadRouter } = await import('../src/server/uploads.js');

    const app = express();
    app.use(uploadRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr) {
          baseUrl = `http://localhost:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('rejects non-multipart requests', async () => {
    const res = await fetch(`${baseUrl}/api/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: 'data' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('multipart/form-data');
  });

  it('uploads a valid JPEG image', async () => {
    const boundary = '----testboundary';
    const fileContent = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]); // minimal JPEG

    const body = Buffer.concat([
      Buffer.from(`------testboundary\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="file"; filename="test.jpg"\r\n`),
      Buffer.from(`Content-Type: image/jpeg\r\n`),
      Buffer.from(`\r\n`),
      fileContent,
      Buffer.from(`\r\n------testboundary--\r\n`),
    ]);

    const res = await fetch(`${baseUrl}/api/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.url).toMatch(/^\/uploads\/[a-f0-9]+\.jpg$/);
  });

  it('uploads a valid PNG image', async () => {
    const boundary = '----testboundary';
    const fileContent = Buffer.from([0x89, 0x50, 0x4E, 0x47]); // PNG header

    const body = Buffer.concat([
      Buffer.from(`------testboundary\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="file"; filename="test.png"\r\n`),
      Buffer.from(`Content-Type: image/png\r\n`),
      Buffer.from(`\r\n`),
      fileContent,
      Buffer.from(`\r\n------testboundary--\r\n`),
    ]);

    const res = await fetch(`${baseUrl}/api/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.url).toMatch(/^\/uploads\/[a-f0-9]+\.png$/);
  });

  it('rejects unsupported file types', async () => {
    const boundary = '----testboundary';
    const body = Buffer.concat([
      Buffer.from(`------testboundary\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="file"; filename="test.pdf"\r\n`),
      Buffer.from(`Content-Type: application/pdf\r\n`),
      Buffer.from(`\r\n`),
      Buffer.from('pdf content'),
      Buffer.from(`\r\n------testboundary--\r\n`),
    ]);

    const res = await fetch(`${baseUrl}/api/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Unsupported file type');
  });

  it('uploads WebP images', async () => {
    const boundary = '----testboundary';
    const body = Buffer.concat([
      Buffer.from(`------testboundary\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="file"; filename="test.webp"\r\n`),
      Buffer.from(`Content-Type: image/webp\r\n`),
      Buffer.from(`\r\n`),
      Buffer.from('webp content'),
      Buffer.from(`\r\n------testboundary--\r\n`),
    ]);

    const res = await fetch(`${baseUrl}/api/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.url).toMatch(/^\/uploads\/[a-f0-9]+\.webp$/);
  });

  it('uploads GIF images', async () => {
    const boundary = '----testboundary';
    const body = Buffer.concat([
      Buffer.from(`------testboundary\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="file"; filename="test.gif"\r\n`),
      Buffer.from(`Content-Type: image/gif\r\n`),
      Buffer.from(`\r\n`),
      Buffer.from('gif content'),
      Buffer.from(`\r\n------testboundary--\r\n`),
    ]);

    const res = await fetch(`${baseUrl}/api/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.url).toMatch(/^\/uploads\/[a-f0-9]+\.gif$/);
  });
});
