// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  Document,
  Block,
  Operation,
  applyOperation,
  createBlock,
  LineSpacing,
  VALID_LINE_SPACINGS,
} from '../src/shared/model.js';
import { transformOperation, transformSingle } from '../src/shared/ot.js';
import { validateContent } from '../src/shared/validation.js';
import { renderDocumentToElement } from '../src/client/renderer.js';
import { Editor } from '../src/client/editor.js';

// ============================================================
// Test Helpers
// ============================================================

function makeDoc(blocks: Block[]): Document {
  return { id: 'test-doc', title: 'Test', blocks };
}

function makeBlock(text: string, type: Block['type'] = 'paragraph', opts?: { lineSpacing?: LineSpacing; indent?: number }): Block {
  return {
    id: `b${Math.random()}`,
    type,
    alignment: 'left',
    indentLevel: opts?.indent ?? 0,
    lineSpacing: opts?.lineSpacing,
    runs: [{ text, style: {} }],
  };
}

// ============================================================
// Model: set_line_spacing operation
// ============================================================

describe('set_line_spacing operation', () => {
  it('sets line spacing on a block', () => {
    const doc = makeDoc([makeBlock('hello')]);
    const result = applyOperation(doc, { type: 'set_line_spacing', blockIndex: 0, lineSpacing: 1.5 });
    expect(result.blocks[0].lineSpacing).toBe(1.5);
  });

  it('sets line spacing to double', () => {
    const doc = makeDoc([makeBlock('hello')]);
    const result = applyOperation(doc, { type: 'set_line_spacing', blockIndex: 0, lineSpacing: 2.0 });
    expect(result.blocks[0].lineSpacing).toBe(2.0);
  });

  it('sets line spacing to single', () => {
    const doc = makeDoc([makeBlock('hello', 'paragraph', { lineSpacing: 2.0 })]);
    const result = applyOperation(doc, { type: 'set_line_spacing', blockIndex: 0, lineSpacing: 1.0 });
    expect(result.blocks[0].lineSpacing).toBe(1.0);
  });

  it('sets line spacing to 1.15', () => {
    const doc = makeDoc([makeBlock('hello')]);
    const result = applyOperation(doc, { type: 'set_line_spacing', blockIndex: 0, lineSpacing: 1.15 });
    expect(result.blocks[0].lineSpacing).toBe(1.15);
  });

  it('does not affect other blocks', () => {
    const doc = makeDoc([makeBlock('a'), makeBlock('b')]);
    const result = applyOperation(doc, { type: 'set_line_spacing', blockIndex: 0, lineSpacing: 2.0 });
    expect(result.blocks[0].lineSpacing).toBe(2.0);
    expect(result.blocks[1].lineSpacing).toBeUndefined();
  });

  it('handles invalid block index gracefully', () => {
    const doc = makeDoc([makeBlock('hello')]);
    const result = applyOperation(doc, { type: 'set_line_spacing', blockIndex: 5, lineSpacing: 1.5 });
    expect(result.blocks.length).toBe(1);
    expect(result.blocks[0].lineSpacing).toBeUndefined();
  });

  it('split_block preserves line spacing', () => {
    const doc = makeDoc([makeBlock('hello', 'paragraph', { lineSpacing: 1.5 })]);
    const result = applyOperation(doc, { type: 'split_block', position: { blockIndex: 0, offset: 3 } });
    expect(result.blocks.length).toBe(2);
    expect(result.blocks[0].lineSpacing).toBe(1.5);
    expect(result.blocks[1].lineSpacing).toBe(1.5);
  });

  it('cloneBlock preserves line spacing', () => {
    const doc = makeDoc([makeBlock('hello', 'paragraph', { lineSpacing: 2.0 })]);
    // applyOperation clones the doc, so check that lineSpacing survives
    const result = applyOperation(doc, { type: 'insert_text', position: { blockIndex: 0, offset: 0 }, text: 'X' });
    expect(result.blocks[0].lineSpacing).toBe(2.0);
  });

  it('VALID_LINE_SPACINGS contains all valid values', () => {
    expect(VALID_LINE_SPACINGS).toEqual([1.0, 1.15, 1.5, 2.0]);
  });
});

// ============================================================
// OT: set_line_spacing transforms
// ============================================================

describe('OT: set_line_spacing', () => {
  it('set_line_spacing vs split_block before — shifts blockIndex', () => {
    const a: Operation = { type: 'split_block', position: { blockIndex: 0, offset: 3 } };
    const b: Operation = { type: 'set_line_spacing', blockIndex: 1, lineSpacing: 1.5 };
    const [, bPrime] = transformOperation(a, b);
    expect(bPrime).toEqual({ type: 'set_line_spacing', blockIndex: 2, lineSpacing: 1.5 });
  });

  it('set_line_spacing vs split_block after — no change', () => {
    const a: Operation = { type: 'split_block', position: { blockIndex: 2, offset: 3 } };
    const b: Operation = { type: 'set_line_spacing', blockIndex: 0, lineSpacing: 2.0 };
    const [, bPrime] = transformOperation(a, b);
    expect(bPrime).toEqual({ type: 'set_line_spacing', blockIndex: 0, lineSpacing: 2.0 });
  });

  it('set_line_spacing vs merge_block before — shifts blockIndex down', () => {
    const a: Operation = { type: 'merge_block', blockIndex: 1 };
    const b: Operation = { type: 'set_line_spacing', blockIndex: 2, lineSpacing: 1.15 };
    const [, bPrime] = transformOperation(a, b);
    expect(bPrime).toEqual({ type: 'set_line_spacing', blockIndex: 1, lineSpacing: 1.15 });
  });

  it('set_line_spacing vs merge_block same — shifts to merged block', () => {
    const a: Operation = { type: 'merge_block', blockIndex: 2 };
    const b: Operation = { type: 'set_line_spacing', blockIndex: 2, lineSpacing: 1.5 };
    const [, bPrime] = transformOperation(a, b);
    expect(bPrime).toEqual({ type: 'set_line_spacing', blockIndex: 1, lineSpacing: 1.5 });
  });

  it('set_line_spacing vs insert_block before — shifts blockIndex up', () => {
    const a: Operation = { type: 'insert_block', afterBlockIndex: 0, blockType: 'paragraph' };
    const b: Operation = { type: 'set_line_spacing', blockIndex: 1, lineSpacing: 2.0 };
    const [, bPrime] = transformOperation(a, b);
    expect(bPrime).toEqual({ type: 'set_line_spacing', blockIndex: 2, lineSpacing: 2.0 });
  });

  it('set_line_spacing vs insert_text — no change', () => {
    const a: Operation = { type: 'insert_text', position: { blockIndex: 0, offset: 0 }, text: 'hi' };
    const b: Operation = { type: 'set_line_spacing', blockIndex: 0, lineSpacing: 1.5 };
    const [, bPrime] = transformOperation(a, b);
    expect(bPrime).toEqual({ type: 'set_line_spacing', blockIndex: 0, lineSpacing: 1.5 });
  });

  it('set_line_spacing vs delete_text — no change', () => {
    const a: Operation = { type: 'delete_text', range: { start: { blockIndex: 0, offset: 0 }, end: { blockIndex: 0, offset: 3 } } };
    const b: Operation = { type: 'set_line_spacing', blockIndex: 0, lineSpacing: 2.0 };
    const [, bPrime] = transformOperation(a, b);
    expect(bPrime).toEqual({ type: 'set_line_spacing', blockIndex: 0, lineSpacing: 2.0 });
  });

  it('set_line_spacing vs set_line_spacing same block — priority op (a) wins', () => {
    const a: Operation = { type: 'set_line_spacing', blockIndex: 0, lineSpacing: 1.5 };
    const b: Operation = { type: 'set_line_spacing', blockIndex: 0, lineSpacing: 2.0 };
    const [aPrime, bPrime] = transformOperation(a, b);
    // a has priority: a' keeps its value, b' adopts a's value for convergence
    expect(aPrime).toEqual({ type: 'set_line_spacing', blockIndex: 0, lineSpacing: 1.5 });
    expect(bPrime).toEqual({ type: 'set_line_spacing', blockIndex: 0, lineSpacing: 1.5 });
  });

  it('transformSingle: set_line_spacing against split_block', () => {
    const op: Operation = { type: 'set_line_spacing', blockIndex: 1, lineSpacing: 1.5 };
    const other: Operation = { type: 'split_block', position: { blockIndex: 0, offset: 3 } };
    const result = transformSingle(op, other);
    expect(result).toEqual({ type: 'set_line_spacing', blockIndex: 2, lineSpacing: 1.5 });
  });

  it('insert_text vs set_line_spacing — no change to insert', () => {
    const a: Operation = { type: 'set_line_spacing', blockIndex: 0, lineSpacing: 1.5 };
    const b: Operation = { type: 'insert_text', position: { blockIndex: 0, offset: 0 }, text: 'hi' };
    const [, bPrime] = transformOperation(a, b);
    expect(bPrime).toEqual({ type: 'insert_text', position: { blockIndex: 0, offset: 0 }, text: 'hi' });
  });

  it('change_block_type vs set_line_spacing — no change', () => {
    const a: Operation = { type: 'set_line_spacing', blockIndex: 0, lineSpacing: 2.0 };
    const b: Operation = { type: 'change_block_type', blockIndex: 0, newType: 'heading1' };
    const [, bPrime] = transformOperation(a, b);
    expect(bPrime).toEqual({ type: 'change_block_type', blockIndex: 0, newType: 'heading1' });
  });

  it('set_line_spacing vs set_indent same block — both independent', () => {
    const a: Operation = { type: 'set_line_spacing', blockIndex: 0, lineSpacing: 1.5 };
    const b: Operation = { type: 'set_indent', blockIndex: 0, indentLevel: 2 };
    const [aPrime, bPrime] = transformOperation(a, b);
    expect(aPrime).toEqual({ type: 'set_line_spacing', blockIndex: 0, lineSpacing: 1.5 });
    expect(bPrime).toEqual({ type: 'set_indent', blockIndex: 0, indentLevel: 2 });
  });
});

// ============================================================
// OT: Convergence tests for set_line_spacing
// ============================================================

describe('OT: set_line_spacing convergence', () => {
  function applyOps(doc: Document, ops: Operation[]): Document {
    let d = doc;
    for (const op of ops) {
      d = applyOperation(d, op);
    }
    return d;
  }

  it('converges: set_line_spacing + insert_text', () => {
    const doc = makeDoc([makeBlock('hello')]);
    const a: Operation = { type: 'set_line_spacing', blockIndex: 0, lineSpacing: 1.5 };
    const b: Operation = { type: 'insert_text', position: { blockIndex: 0, offset: 0 }, text: 'X' };
    const [aPrime, bPrime] = transformOperation(a, b);

    const path1 = applyOps(doc, [a, bPrime]);
    const path2 = applyOps(doc, [b, aPrime]);

    expect(path1.blocks[0].runs.map(r => r.text).join('')).toBe(path2.blocks[0].runs.map(r => r.text).join(''));
    expect(path1.blocks[0].lineSpacing).toBe(path2.blocks[0].lineSpacing);
  });

  it('converges: set_line_spacing + split_block', () => {
    const doc = makeDoc([makeBlock('hello'), makeBlock('world')]);
    const a: Operation = { type: 'set_line_spacing', blockIndex: 1, lineSpacing: 2.0 };
    const b: Operation = { type: 'split_block', position: { blockIndex: 0, offset: 3 } };
    const [aPrime, bPrime] = transformOperation(a, b);

    const path1 = applyOps(doc, [a, bPrime]);
    const path2 = applyOps(doc, [b, aPrime]);

    expect(path1.blocks.length).toBe(path2.blocks.length);
    for (let i = 0; i < path1.blocks.length; i++) {
      expect(path1.blocks[i].lineSpacing).toBe(path2.blocks[i].lineSpacing);
    }
  });

  it('converges: set_line_spacing + merge_block', () => {
    const doc = makeDoc([makeBlock('hello'), makeBlock('world'), makeBlock('!')]);
    const a: Operation = { type: 'set_line_spacing', blockIndex: 2, lineSpacing: 1.15 };
    const b: Operation = { type: 'merge_block', blockIndex: 1 };
    const [aPrime, bPrime] = transformOperation(a, b);

    const path1 = applyOps(doc, [a, bPrime]);
    const path2 = applyOps(doc, [b, aPrime]);

    expect(path1.blocks.length).toBe(path2.blocks.length);
    for (let i = 0; i < path1.blocks.length; i++) {
      expect(path1.blocks[i].lineSpacing).toBe(path2.blocks[i].lineSpacing);
    }
  });

  it('converges: concurrent set_line_spacing on different blocks', () => {
    const doc = makeDoc([makeBlock('hello'), makeBlock('world')]);
    const a: Operation = { type: 'set_line_spacing', blockIndex: 0, lineSpacing: 1.5 };
    const b: Operation = { type: 'set_line_spacing', blockIndex: 1, lineSpacing: 2.0 };
    const [aPrime, bPrime] = transformOperation(a, b);

    const path1 = applyOps(doc, [a, bPrime]);
    const path2 = applyOps(doc, [b, aPrime]);

    expect(path1.blocks[0].lineSpacing).toBe(path2.blocks[0].lineSpacing);
    expect(path1.blocks[1].lineSpacing).toBe(path2.blocks[1].lineSpacing);
  });
});

// ============================================================
// Renderer: line spacing
// ============================================================

describe('Renderer: line spacing', () => {
  it('applies line-height style when lineSpacing is set', () => {
    const doc = makeDoc([makeBlock('hello', 'paragraph', { lineSpacing: 1.5 })]);
    const el = renderDocumentToElement(doc);
    const p = el.querySelector('p')!;
    expect(p.style.lineHeight).toBe('1.5');
  });

  it('applies line-height 2 for double spacing', () => {
    const doc = makeDoc([makeBlock('hello', 'paragraph', { lineSpacing: 2.0 })]);
    const el = renderDocumentToElement(doc);
    const p = el.querySelector('p')!;
    expect(p.style.lineHeight).toBe('2');
  });

  it('applies line-height 1 for single spacing', () => {
    const doc = makeDoc([makeBlock('hello', 'paragraph', { lineSpacing: 1.0 })]);
    const el = renderDocumentToElement(doc);
    const p = el.querySelector('p')!;
    expect(p.style.lineHeight).toBe('1');
  });

  it('applies line-height 1.15', () => {
    const doc = makeDoc([makeBlock('hello', 'paragraph', { lineSpacing: 1.15 })]);
    const el = renderDocumentToElement(doc);
    const p = el.querySelector('p')!;
    expect(p.style.lineHeight).toBe('1.15');
  });

  it('does not set line-height when lineSpacing is undefined', () => {
    const doc = makeDoc([makeBlock('hello')]);
    const el = renderDocumentToElement(doc);
    const p = el.querySelector('p')!;
    expect(p.style.lineHeight).toBe('');
  });

  it('applies line-height to headings', () => {
    const doc = makeDoc([makeBlock('Title', 'heading1', { lineSpacing: 2.0 })]);
    const el = renderDocumentToElement(doc);
    const h1 = el.querySelector('h1')!;
    expect(h1.style.lineHeight).toBe('2');
  });

  it('applies line-height to blockquotes', () => {
    const doc = makeDoc([makeBlock('Quote', 'blockquote', { lineSpacing: 1.5 })]);
    const el = renderDocumentToElement(doc);
    const bq = el.querySelector('blockquote')!;
    expect(bq.style.lineHeight).toBe('1.5');
  });

  it('applies line-height to list items', () => {
    const doc = makeDoc([makeBlock('Item', 'bullet-list-item', { lineSpacing: 1.15 })]);
    const el = renderDocumentToElement(doc);
    const li = el.querySelector('li')!;
    expect(li.style.lineHeight).toBe('1.15');
  });

  it('can combine line spacing with alignment and indent', () => {
    const block: Block = {
      id: 'b1',
      type: 'paragraph',
      alignment: 'center',
      indentLevel: 2,
      lineSpacing: 2.0,
      runs: [{ text: 'hello', style: {} }],
    };
    const doc = makeDoc([block]);
    const el = renderDocumentToElement(doc);
    const p = el.querySelector('p')!;
    expect(p.style.lineHeight).toBe('2');
    expect(p.style.textAlign).toBe('center');
    expect(p.dataset.indent).toBe('2');
  });
});

// ============================================================
// Editor: setLineSpacing
// ============================================================

describe('Editor: setLineSpacing', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('setLineSpacing sets block line spacing', () => {
    const editor = new Editor(container);
    editor.setLineSpacing(1.5);
    expect(editor.doc.blocks[0].lineSpacing).toBe(1.5);
  });

  it('setLineSpacing to double', () => {
    const editor = new Editor(container);
    editor.setLineSpacing(2.0);
    expect(editor.doc.blocks[0].lineSpacing).toBe(2.0);
  });

  it('getActiveLineSpacing returns current block line spacing', () => {
    const doc = makeDoc([makeBlock('hello', 'paragraph', { lineSpacing: 1.15 })]);
    const editor = new Editor(container, doc);
    expect(editor.getActiveLineSpacing()).toBe(1.15);
  });

  it('getActiveLineSpacing returns undefined when not set', () => {
    const editor = new Editor(container);
    expect(editor.getActiveLineSpacing()).toBeUndefined();
  });

  it('setLineSpacing fires onOperation callback', () => {
    const editor = new Editor(container);
    const ops: Operation[] = [];
    editor.onOperation((op) => ops.push(op));
    editor.setLineSpacing(1.5);
    expect(ops.length).toBe(1);
    expect(ops[0].type).toBe('set_line_spacing');
  });

  it('setLineSpacing is undoable', () => {
    const editor = new Editor(container);
    editor.setLineSpacing(2.0);
    expect(editor.doc.blocks[0].lineSpacing).toBe(2.0);
    editor.undo();
    expect(editor.doc.blocks[0].lineSpacing).toBeUndefined();
  });

  it('setLineSpacing works on heading blocks', () => {
    const doc = makeDoc([makeBlock('Title', 'heading1')]);
    const editor = new Editor(container, doc);
    editor.setLineSpacing(1.5);
    expect(editor.doc.blocks[0].lineSpacing).toBe(1.5);
  });

  it('setLineSpacing does nothing for invalid block index', () => {
    const editor = new Editor(container);
    // Move cursor to a non-existent block
    editor.cursor = { anchor: { blockIndex: 99, offset: 0 }, focus: { blockIndex: 99, offset: 0 } };
    editor.setLineSpacing(1.5);
    // Should not crash, and original block should be unchanged
    expect(editor.doc.blocks[0].lineSpacing).toBeUndefined();
  });
});

// ============================================================
// Validation: lineSpacing
// ============================================================

describe('Validation: lineSpacing', () => {
  it('accepts blocks without lineSpacing (backward compat)', () => {
    const content = JSON.stringify([
      { id: 'b1', type: 'paragraph', alignment: 'left', runs: [{ text: 'hi', style: {} }] },
    ]);
    expect(validateContent(content)).toBeNull();
  });

  it('accepts lineSpacing of 1', () => {
    const content = JSON.stringify([
      { id: 'b1', type: 'paragraph', alignment: 'left', lineSpacing: 1, runs: [{ text: 'hi', style: {} }] },
    ]);
    expect(validateContent(content)).toBeNull();
  });

  it('accepts lineSpacing of 1.15', () => {
    const content = JSON.stringify([
      { id: 'b1', type: 'paragraph', alignment: 'left', lineSpacing: 1.15, runs: [{ text: 'hi', style: {} }] },
    ]);
    expect(validateContent(content)).toBeNull();
  });

  it('accepts lineSpacing of 1.5', () => {
    const content = JSON.stringify([
      { id: 'b1', type: 'paragraph', alignment: 'left', lineSpacing: 1.5, runs: [{ text: 'hi', style: {} }] },
    ]);
    expect(validateContent(content)).toBeNull();
  });

  it('accepts lineSpacing of 2', () => {
    const content = JSON.stringify([
      { id: 'b1', type: 'paragraph', alignment: 'left', lineSpacing: 2, runs: [{ text: 'hi', style: {} }] },
    ]);
    expect(validateContent(content)).toBeNull();
  });

  it('rejects invalid lineSpacing value', () => {
    const content = JSON.stringify([
      { id: 'b1', type: 'paragraph', alignment: 'left', lineSpacing: 3, runs: [{ text: 'hi', style: {} }] },
    ]);
    expect(validateContent(content)).toContain('lineSpacing');
  });

  it('rejects string lineSpacing', () => {
    const content = JSON.stringify([
      { id: 'b1', type: 'paragraph', alignment: 'left', lineSpacing: '1.5', runs: [{ text: 'hi', style: {} }] },
    ]);
    expect(validateContent(content)).toContain('lineSpacing');
  });

  it('rejects negative lineSpacing', () => {
    const content = JSON.stringify([
      { id: 'b1', type: 'paragraph', alignment: 'left', lineSpacing: -1, runs: [{ text: 'hi', style: {} }] },
    ]);
    expect(validateContent(content)).toContain('lineSpacing');
  });

  it('rejects zero lineSpacing', () => {
    const content = JSON.stringify([
      { id: 'b1', type: 'paragraph', alignment: 'left', lineSpacing: 0, runs: [{ text: 'hi', style: {} }] },
    ]);
    expect(validateContent(content)).toContain('lineSpacing');
  });
});
