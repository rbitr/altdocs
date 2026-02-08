// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  Document,
  Block,
  Operation,
  applyOperation,
  createBlock,
  createEmptyDocument,
  getIndentLevel,
  MAX_INDENT_LEVEL,
  resetBlockIdCounter,
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

function makeBlock(text: string, type: Block['type'] = 'paragraph', indent = 0): Block {
  return {
    id: `b${Math.random()}`,
    type,
    alignment: 'left',
    indentLevel: indent,
    runs: [{ text, style: {} }],
  };
}

// ============================================================
// Model: set_indent operation
// ============================================================

describe('set_indent operation', () => {
  it('sets indent level on a block', () => {
    const doc = makeDoc([makeBlock('hello')]);
    const result = applyOperation(doc, { type: 'set_indent', blockIndex: 0, indentLevel: 2 });
    expect(getIndentLevel(result.blocks[0])).toBe(2);
  });

  it('clamps indent to MAX_INDENT_LEVEL', () => {
    const doc = makeDoc([makeBlock('hello')]);
    const result = applyOperation(doc, { type: 'set_indent', blockIndex: 0, indentLevel: 99 });
    expect(getIndentLevel(result.blocks[0])).toBe(MAX_INDENT_LEVEL);
  });

  it('clamps indent to 0 minimum', () => {
    const doc = makeDoc([makeBlock('hello', 'paragraph', 3)]);
    const result = applyOperation(doc, { type: 'set_indent', blockIndex: 0, indentLevel: -5 });
    expect(getIndentLevel(result.blocks[0])).toBe(0);
  });

  it('does not affect other blocks', () => {
    const doc = makeDoc([makeBlock('a', 'paragraph', 1), makeBlock('b', 'paragraph', 0)]);
    const result = applyOperation(doc, { type: 'set_indent', blockIndex: 0, indentLevel: 3 });
    expect(getIndentLevel(result.blocks[0])).toBe(3);
    expect(getIndentLevel(result.blocks[1])).toBe(0);
  });

  it('handles invalid block index gracefully', () => {
    const doc = makeDoc([makeBlock('hello')]);
    const result = applyOperation(doc, { type: 'set_indent', blockIndex: 5, indentLevel: 2 });
    // Should return document unchanged
    expect(result.blocks.length).toBe(1);
    expect(getIndentLevel(result.blocks[0])).toBe(0);
  });

  it('split_block preserves indent level', () => {
    const doc = makeDoc([makeBlock('hello', 'bullet-list-item', 2)]);
    const result = applyOperation(doc, { type: 'split_block', position: { blockIndex: 0, offset: 3 } });
    expect(result.blocks.length).toBe(2);
    expect(getIndentLevel(result.blocks[0])).toBe(2);
    expect(getIndentLevel(result.blocks[1])).toBe(2);
  });

  it('getIndentLevel returns 0 for blocks without indentLevel', () => {
    const block: Block = { id: 'b1', type: 'paragraph', alignment: 'left', runs: [{ text: '', style: {} }] };
    expect(getIndentLevel(block)).toBe(0);
  });

  it('createBlock creates blocks with indentLevel 0', () => {
    const block = createBlock('paragraph', 'test');
    expect(getIndentLevel(block)).toBe(0);
  });

  it('createEmptyDocument creates blocks with indentLevel 0', () => {
    resetBlockIdCounter();
    const doc = createEmptyDocument('test', 'Test');
    expect(getIndentLevel(doc.blocks[0])).toBe(0);
  });
});

// ============================================================
// OT: set_indent transforms
// ============================================================

describe('OT: set_indent', () => {
  it('set_indent vs split_block before — shifts blockIndex', () => {
    const a: Operation = { type: 'split_block', position: { blockIndex: 0, offset: 3 } };
    const b: Operation = { type: 'set_indent', blockIndex: 1, indentLevel: 2 };
    const [, bPrime] = transformOperation(a, b);
    expect(bPrime).toEqual({ type: 'set_indent', blockIndex: 2, indentLevel: 2 });
  });

  it('set_indent vs split_block after — no change', () => {
    const a: Operation = { type: 'split_block', position: { blockIndex: 2, offset: 3 } };
    const b: Operation = { type: 'set_indent', blockIndex: 0, indentLevel: 1 };
    const [, bPrime] = transformOperation(a, b);
    expect(bPrime).toEqual({ type: 'set_indent', blockIndex: 0, indentLevel: 1 });
  });

  it('set_indent vs merge_block before — shifts blockIndex down', () => {
    const a: Operation = { type: 'merge_block', blockIndex: 1 };
    const b: Operation = { type: 'set_indent', blockIndex: 2, indentLevel: 3 };
    const [, bPrime] = transformOperation(a, b);
    expect(bPrime).toEqual({ type: 'set_indent', blockIndex: 1, indentLevel: 3 });
  });

  it('set_indent vs merge_block same — shifts to merged block', () => {
    const a: Operation = { type: 'merge_block', blockIndex: 2 };
    const b: Operation = { type: 'set_indent', blockIndex: 2, indentLevel: 1 };
    const [, bPrime] = transformOperation(a, b);
    expect(bPrime).toEqual({ type: 'set_indent', blockIndex: 1, indentLevel: 1 });
  });

  it('set_indent vs insert_block before — shifts blockIndex up', () => {
    const a: Operation = { type: 'insert_block', afterBlockIndex: 0, blockType: 'paragraph' };
    const b: Operation = { type: 'set_indent', blockIndex: 1, indentLevel: 2 };
    const [, bPrime] = transformOperation(a, b);
    expect(bPrime).toEqual({ type: 'set_indent', blockIndex: 2, indentLevel: 2 });
  });

  it('set_indent vs insert_text — no change', () => {
    const a: Operation = { type: 'insert_text', position: { blockIndex: 0, offset: 0 }, text: 'hi' };
    const b: Operation = { type: 'set_indent', blockIndex: 0, indentLevel: 2 };
    const [, bPrime] = transformOperation(a, b);
    expect(bPrime).toEqual({ type: 'set_indent', blockIndex: 0, indentLevel: 2 });
  });

  it('set_indent vs delete_text — no change', () => {
    const a: Operation = { type: 'delete_text', range: { start: { blockIndex: 0, offset: 0 }, end: { blockIndex: 0, offset: 3 } } };
    const b: Operation = { type: 'set_indent', blockIndex: 0, indentLevel: 1 };
    const [, bPrime] = transformOperation(a, b);
    expect(bPrime).toEqual({ type: 'set_indent', blockIndex: 0, indentLevel: 1 });
  });

  it('set_indent vs set_indent same block — priority op (a) wins', () => {
    const a: Operation = { type: 'set_indent', blockIndex: 0, indentLevel: 2 };
    const b: Operation = { type: 'set_indent', blockIndex: 0, indentLevel: 3 };
    const [aPrime, bPrime] = transformOperation(a, b);
    // a has priority: a' keeps its value, b' adopts a's value for convergence
    expect(aPrime).toEqual({ type: 'set_indent', blockIndex: 0, indentLevel: 2 });
    expect(bPrime).toEqual({ type: 'set_indent', blockIndex: 0, indentLevel: 2 });
  });

  it('transformSingle: set_indent against split_block', () => {
    const op: Operation = { type: 'set_indent', blockIndex: 1, indentLevel: 2 };
    const other: Operation = { type: 'split_block', position: { blockIndex: 0, offset: 3 } };
    const result = transformSingle(op, other);
    expect(result).toEqual({ type: 'set_indent', blockIndex: 2, indentLevel: 2 });
  });

  // Test insert_text against set_indent (no effect)
  it('insert_text vs set_indent — no change to insert', () => {
    const a: Operation = { type: 'set_indent', blockIndex: 0, indentLevel: 2 };
    const b: Operation = { type: 'insert_text', position: { blockIndex: 0, offset: 0 }, text: 'hi' };
    const [, bPrime] = transformOperation(a, b);
    expect(bPrime).toEqual({ type: 'insert_text', position: { blockIndex: 0, offset: 0 }, text: 'hi' });
  });

  // Test change_block_type against set_indent (no effect)
  it('change_block_type vs set_indent — no change', () => {
    const a: Operation = { type: 'set_indent', blockIndex: 0, indentLevel: 2 };
    const b: Operation = { type: 'change_block_type', blockIndex: 0, newType: 'heading1' };
    const [, bPrime] = transformOperation(a, b);
    expect(bPrime).toEqual({ type: 'change_block_type', blockIndex: 0, newType: 'heading1' });
  });
});

// ============================================================
// OT: Convergence tests for set_indent
// ============================================================

describe('OT: set_indent convergence', () => {
  function applyOps(doc: Document, ops: Operation[]): Document {
    let d = doc;
    for (const op of ops) {
      d = applyOperation(d, op);
    }
    return d;
  }

  it('converges: set_indent + insert_text', () => {
    const doc = makeDoc([makeBlock('hello')]);
    const a: Operation = { type: 'set_indent', blockIndex: 0, indentLevel: 2 };
    const b: Operation = { type: 'insert_text', position: { blockIndex: 0, offset: 0 }, text: 'X' };
    const [aPrime, bPrime] = transformOperation(a, b);

    const path1 = applyOps(doc, [a, bPrime]);
    const path2 = applyOps(doc, [b, aPrime]);

    expect(path1.blocks[0].runs.map(r => r.text).join('')).toBe(path2.blocks[0].runs.map(r => r.text).join(''));
    expect(getIndentLevel(path1.blocks[0])).toBe(getIndentLevel(path2.blocks[0]));
  });

  it('converges: set_indent + split_block', () => {
    const doc = makeDoc([makeBlock('hello'), makeBlock('world')]);
    const a: Operation = { type: 'set_indent', blockIndex: 1, indentLevel: 3 };
    const b: Operation = { type: 'split_block', position: { blockIndex: 0, offset: 3 } };
    const [aPrime, bPrime] = transformOperation(a, b);

    const path1 = applyOps(doc, [a, bPrime]);
    const path2 = applyOps(doc, [b, aPrime]);

    expect(path1.blocks.length).toBe(path2.blocks.length);
    for (let i = 0; i < path1.blocks.length; i++) {
      expect(getIndentLevel(path1.blocks[i])).toBe(getIndentLevel(path2.blocks[i]));
    }
  });

  it('converges: set_indent + merge_block', () => {
    const doc = makeDoc([makeBlock('hello'), makeBlock('world'), makeBlock('!')]);
    const a: Operation = { type: 'set_indent', blockIndex: 2, indentLevel: 1 };
    const b: Operation = { type: 'merge_block', blockIndex: 1 };
    const [aPrime, bPrime] = transformOperation(a, b);

    const path1 = applyOps(doc, [a, bPrime]);
    const path2 = applyOps(doc, [b, aPrime]);

    expect(path1.blocks.length).toBe(path2.blocks.length);
    for (let i = 0; i < path1.blocks.length; i++) {
      expect(getIndentLevel(path1.blocks[i])).toBe(getIndentLevel(path2.blocks[i]));
    }
  });
});

// ============================================================
// Renderer: indentation
// ============================================================

describe('Renderer: indentation', () => {
  it('renders flat list items in a single ul', () => {
    const doc = makeDoc([
      makeBlock('Item 1', 'bullet-list-item'),
      makeBlock('Item 2', 'bullet-list-item'),
    ]);
    const el = renderDocumentToElement(doc);
    const uls = el.querySelectorAll('ul');
    expect(uls.length).toBe(1);
    expect(uls[0].children.length).toBe(2);
  });

  it('renders nested bullet list items', () => {
    const doc = makeDoc([
      makeBlock('Item 1', 'bullet-list-item', 0),
      makeBlock('Sub-item 1', 'bullet-list-item', 1),
      makeBlock('Sub-item 2', 'bullet-list-item', 1),
    ]);
    const el = renderDocumentToElement(doc);
    // Top-level ul with 1 li
    const topUl = el.querySelector('ul')!;
    expect(topUl).toBeTruthy();
    // The first li should contain a nested ul
    const firstLi = topUl.querySelector(':scope > li');
    expect(firstLi).toBeTruthy();
    const nestedUl = firstLi!.querySelector('ul');
    expect(nestedUl).toBeTruthy();
    expect(nestedUl!.children.length).toBe(2);
  });

  it('renders deeply nested list items', () => {
    const doc = makeDoc([
      makeBlock('Level 0', 'bullet-list-item', 0),
      makeBlock('Level 1', 'bullet-list-item', 1),
      makeBlock('Level 2', 'bullet-list-item', 2),
    ]);
    const el = renderDocumentToElement(doc);
    // Should have 3 nested ul levels
    const topUl = el.querySelector('ul')!;
    expect(topUl).toBeTruthy();
    expect(topUl.querySelector('ul ul')).toBeTruthy(); // 3 levels deep
  });

  it('renders outdented items correctly', () => {
    const doc = makeDoc([
      makeBlock('Level 0', 'bullet-list-item', 0),
      makeBlock('Level 1', 'bullet-list-item', 1),
      makeBlock('Back to 0', 'bullet-list-item', 0),
    ]);
    const el = renderDocumentToElement(doc);
    const topUl = el.querySelector('ul')!;
    // Top level should have 2 direct li children (Level 0 and Back to 0)
    const topLis = topUl.querySelectorAll(':scope > li');
    expect(topLis.length).toBe(2);
  });

  it('renders numbered list items with nesting', () => {
    const doc = makeDoc([
      makeBlock('Item 1', 'numbered-list-item', 0),
      makeBlock('Sub-item', 'numbered-list-item', 1),
    ]);
    const el = renderDocumentToElement(doc);
    const topOl = el.querySelector('ol')!;
    expect(topOl).toBeTruthy();
    const nestedOl = topOl.querySelector('ol');
    expect(nestedOl).toBeTruthy();
  });

  it('applies data-indent attribute to non-list blocks', () => {
    const doc = makeDoc([makeBlock('Indented paragraph', 'paragraph', 2)]);
    const el = renderDocumentToElement(doc);
    const p = el.querySelector('p')!;
    expect(p.dataset.indent).toBe('2');
  });

  it('does not add data-indent for indent level 0', () => {
    const doc = makeDoc([makeBlock('Normal paragraph', 'paragraph', 0)]);
    const el = renderDocumentToElement(doc);
    const p = el.querySelector('p')!;
    expect(p.dataset.indent).toBeUndefined();
  });

  it('applies data-indent to blockquotes', () => {
    const doc = makeDoc([makeBlock('Indented quote', 'blockquote', 1)]);
    const el = renderDocumentToElement(doc);
    const bq = el.querySelector('blockquote')!;
    expect(bq.dataset.indent).toBe('1');
  });

  it('applies data-indent to horizontal rules', () => {
    const doc = makeDoc([
      { id: 'hr1', type: 'horizontal-rule' as const, alignment: 'left' as const, indentLevel: 1, runs: [{ text: '', style: {} }] },
    ]);
    const el = renderDocumentToElement(doc);
    const hr = el.querySelector('hr')!;
    expect(hr.dataset.indent).toBe('1');
  });

  it('breaks list on non-list block and resumes', () => {
    const doc = makeDoc([
      makeBlock('Item 1', 'bullet-list-item', 0),
      makeBlock('Paragraph', 'paragraph', 0),
      makeBlock('Item 2', 'bullet-list-item', 0),
    ]);
    const el = renderDocumentToElement(doc);
    // Should have 2 separate uls
    const uls = el.querySelectorAll(':scope > ul');
    expect(uls.length).toBe(2);
  });
});

// ============================================================
// Editor: indent/outdent
// ============================================================

describe('Editor: indent/outdent', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('indent() increases indent level by 1', () => {
    const editor = new Editor(container);
    editor.indent();
    expect(getIndentLevel(editor.doc.blocks[0])).toBe(1);
  });

  it('outdent() decreases indent level by 1', () => {
    const doc = makeDoc([makeBlock('hello', 'paragraph', 2)]);
    const editor = new Editor(container, doc);
    editor.outdent();
    expect(getIndentLevel(editor.doc.blocks[0])).toBe(1);
  });

  it('indent does not exceed MAX_INDENT_LEVEL', () => {
    const doc = makeDoc([makeBlock('hello', 'paragraph', MAX_INDENT_LEVEL)]);
    const editor = new Editor(container, doc);
    editor.indent();
    expect(getIndentLevel(editor.doc.blocks[0])).toBe(MAX_INDENT_LEVEL);
  });

  it('outdent does not go below 0', () => {
    const editor = new Editor(container);
    editor.outdent();
    expect(getIndentLevel(editor.doc.blocks[0])).toBe(0);
  });

  it('Tab key triggers indent', () => {
    const editor = new Editor(container);
    editor.handleKeyDown(new KeyboardEvent('keydown', { key: 'Tab' }));
    expect(getIndentLevel(editor.doc.blocks[0])).toBe(1);
  });

  it('Shift+Tab triggers outdent', () => {
    const doc = makeDoc([makeBlock('hello', 'paragraph', 2)]);
    const editor = new Editor(container, doc);
    editor.handleKeyDown(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }));
    expect(getIndentLevel(editor.doc.blocks[0])).toBe(1);
  });

  it('getActiveIndentLevel returns current block indent', () => {
    const doc = makeDoc([makeBlock('hello', 'paragraph', 3)]);
    const editor = new Editor(container, doc);
    expect(editor.getActiveIndentLevel()).toBe(3);
  });

  it('indent fires onOperation callback', () => {
    const editor = new Editor(container);
    const ops: Operation[] = [];
    editor.onOperation((op) => ops.push(op));
    editor.indent();
    expect(ops.length).toBe(1);
    expect(ops[0].type).toBe('set_indent');
  });

  it('indent is undoable', () => {
    const editor = new Editor(container);
    editor.indent();
    expect(getIndentLevel(editor.doc.blocks[0])).toBe(1);
    editor.undo();
    expect(getIndentLevel(editor.doc.blocks[0])).toBe(0);
  });

  it('indent works on list items', () => {
    const doc = makeDoc([makeBlock('item', 'bullet-list-item')]);
    const editor = new Editor(container, doc);
    editor.indent();
    expect(getIndentLevel(editor.doc.blocks[0])).toBe(1);
    expect(editor.doc.blocks[0].type).toBe('bullet-list-item');
  });
});

// ============================================================
// Validation: indentLevel
// ============================================================

describe('Validation: indentLevel', () => {

  it('accepts blocks without indentLevel (backward compat)', () => {
    const content = JSON.stringify([
      { id: 'b1', type: 'paragraph', alignment: 'left', runs: [{ text: 'hi', style: {} }] },
    ]);
    expect(validateContent(content)).toBeNull();
  });

  it('accepts blocks with valid indentLevel', () => {
    const content = JSON.stringify([
      { id: 'b1', type: 'paragraph', alignment: 'left', indentLevel: 3, runs: [{ text: 'hi', style: {} }] },
    ]);
    expect(validateContent(content)).toBeNull();
  });

  it('accepts indentLevel of 0', () => {
    const content = JSON.stringify([
      { id: 'b1', type: 'paragraph', alignment: 'left', indentLevel: 0, runs: [{ text: 'hi', style: {} }] },
    ]);
    expect(validateContent(content)).toBeNull();
  });

  it('accepts indentLevel of 8 (max)', () => {
    const content = JSON.stringify([
      { id: 'b1', type: 'paragraph', alignment: 'left', indentLevel: 8, runs: [{ text: 'hi', style: {} }] },
    ]);
    expect(validateContent(content)).toBeNull();
  });

  it('rejects negative indentLevel', () => {
    const content = JSON.stringify([
      { id: 'b1', type: 'paragraph', alignment: 'left', indentLevel: -1, runs: [{ text: 'hi', style: {} }] },
    ]);
    expect(validateContent(content)).toContain('indentLevel');
  });

  it('rejects indentLevel > 8', () => {
    const content = JSON.stringify([
      { id: 'b1', type: 'paragraph', alignment: 'left', indentLevel: 9, runs: [{ text: 'hi', style: {} }] },
    ]);
    expect(validateContent(content)).toContain('indentLevel');
  });

  it('rejects non-integer indentLevel', () => {
    const content = JSON.stringify([
      { id: 'b1', type: 'paragraph', alignment: 'left', indentLevel: 1.5, runs: [{ text: 'hi', style: {} }] },
    ]);
    expect(validateContent(content)).toContain('indentLevel');
  });

  it('rejects string indentLevel', () => {
    const content = JSON.stringify([
      { id: 'b1', type: 'paragraph', alignment: 'left', indentLevel: '2', runs: [{ text: 'hi', style: {} }] },
    ]);
    expect(validateContent(content)).toContain('indentLevel');
  });
});
