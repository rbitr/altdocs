/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { findAllMatches, FindReplaceBar } from '../src/client/find-replace.js';
import { Editor } from '../src/client/editor.js';
import type { Document, Block } from '../src/shared/model.js';
import { blockToPlainText } from '../src/shared/model.js';
import { collapsedCursor } from '../src/shared/cursor.js';

// ── Helpers ────────────────────────────────────────────────

function makeBlock(text: string, id?: string): Block {
  return {
    id: id || `b${Math.random()}`,
    type: 'paragraph',
    alignment: 'left',
    runs: [{ text, style: {} }],
  };
}

function makeDoc(blocks: Block[]): Document {
  return { id: 'test', title: 'Test', blocks };
}

function createEditor(doc?: Document): Editor {
  const container = document.createElement('div');
  return new Editor(container, doc);
}

// ── findAllMatches() ───────────────────────────────────────

describe('findAllMatches', () => {
  it('finds no matches for empty query', () => {
    const doc = makeDoc([makeBlock('hello world')]);
    expect(findAllMatches(doc, '')).toEqual([]);
  });

  it('finds single match in single block', () => {
    const doc = makeDoc([makeBlock('hello world')]);
    const matches = findAllMatches(doc, 'world');
    expect(matches).toHaveLength(1);
    expect(matches[0]).toEqual({ blockIndex: 0, startOffset: 6, endOffset: 11 });
  });

  it('finds multiple matches in single block', () => {
    const doc = makeDoc([makeBlock('abcabcabc')]);
    const matches = findAllMatches(doc, 'abc');
    expect(matches).toHaveLength(3);
    expect(matches[0].startOffset).toBe(0);
    expect(matches[1].startOffset).toBe(3);
    expect(matches[2].startOffset).toBe(6);
  });

  it('finds overlapping matches', () => {
    const doc = makeDoc([makeBlock('aaa')]);
    const matches = findAllMatches(doc, 'aa');
    expect(matches).toHaveLength(2);
    expect(matches[0]).toEqual({ blockIndex: 0, startOffset: 0, endOffset: 2 });
    expect(matches[1]).toEqual({ blockIndex: 0, startOffset: 1, endOffset: 3 });
  });

  it('finds matches across multiple blocks', () => {
    const doc = makeDoc([makeBlock('hello world'), makeBlock('world hello')]);
    const matches = findAllMatches(doc, 'hello');
    expect(matches).toHaveLength(2);
    expect(matches[0]).toEqual({ blockIndex: 0, startOffset: 0, endOffset: 5 });
    expect(matches[1]).toEqual({ blockIndex: 1, startOffset: 6, endOffset: 11 });
  });

  it('is case-insensitive by default', () => {
    const doc = makeDoc([makeBlock('Hello HELLO hello')]);
    const matches = findAllMatches(doc, 'hello');
    expect(matches).toHaveLength(3);
  });

  it('supports case-sensitive search', () => {
    const doc = makeDoc([makeBlock('Hello HELLO hello')]);
    const matches = findAllMatches(doc, 'hello', true);
    expect(matches).toHaveLength(1);
    expect(matches[0].startOffset).toBe(12);
  });

  it('finds no matches when query not present', () => {
    const doc = makeDoc([makeBlock('hello world')]);
    const matches = findAllMatches(doc, 'xyz');
    expect(matches).toHaveLength(0);
  });

  it('handles empty document', () => {
    const doc = makeDoc([makeBlock('')]);
    const matches = findAllMatches(doc, 'test');
    expect(matches).toHaveLength(0);
  });

  it('finds matches with special characters', () => {
    const doc = makeDoc([makeBlock('hello (world)')]);
    const matches = findAllMatches(doc, '(world)');
    expect(matches).toHaveLength(1);
    expect(matches[0]).toEqual({ blockIndex: 0, startOffset: 6, endOffset: 13 });
  });
});

// ── FindReplaceBar ─────────────────────────────────────────

describe('FindReplaceBar', () => {
  let container: HTMLElement;
  let wrapper: HTMLElement;
  let editor: Editor;
  let bar: FindReplaceBar;

  beforeEach(() => {
    container = document.createElement('div');
    container.className = 'altdocs-editor';
    wrapper = document.createElement('div');
    wrapper.className = 'editor-wrapper';
    wrapper.appendChild(container);
    document.body.appendChild(wrapper);

    editor = new Editor(container, makeDoc([
      makeBlock('hello world'),
      makeBlock('foo bar baz'),
      makeBlock('hello again'),
    ]));

    bar = new FindReplaceBar(container, editor);
  });

  afterEach(() => {
    bar.destroy();
    wrapper.remove();
  });

  it('starts hidden', () => {
    expect(bar.isVisible()).toBe(false);
  });

  it('shows the find bar', () => {
    bar.show();
    expect(bar.isVisible()).toBe(true);
    expect(wrapper.querySelector('.find-replace-bar')).not.toBeNull();
  });

  it('hides the find bar', () => {
    bar.show();
    bar.hide();
    expect(bar.isVisible()).toBe(false);
  });

  it('shows replace row when requested', () => {
    bar.show(true);
    const replaceRow = wrapper.querySelectorAll('.find-replace-row');
    expect(replaceRow.length).toBe(2);
    expect((replaceRow[1] as HTMLElement).style.display).not.toBe('none');
  });

  it('hides replace row for find-only mode', () => {
    bar.show(false);
    const replaceRow = wrapper.querySelectorAll('.find-replace-row');
    expect(replaceRow.length).toBe(2);
    expect((replaceRow[1] as HTMLElement).style.display).toBe('none');
  });

  it('cleans up on destroy', () => {
    bar.show();
    bar.destroy();
    expect(wrapper.querySelector('.find-replace-bar')).toBeNull();
    expect(bar.isVisible()).toBe(false);
  });

  it('pre-fills with selected text', () => {
    editor.cursor = {
      anchor: { blockIndex: 0, offset: 0 },
      focus: { blockIndex: 0, offset: 5 },
    };
    bar.show();
    const findInput = wrapper.querySelector('.find-input') as HTMLInputElement;
    expect(findInput.value).toBe('hello');
  });

  it('does not pre-fill with multi-line selection', () => {
    editor.cursor = {
      anchor: { blockIndex: 0, offset: 0 },
      focus: { blockIndex: 1, offset: 3 },
    };
    bar.show();
    const findInput = wrapper.querySelector('.find-input') as HTMLInputElement;
    expect(findInput.value).toBe('');
  });
});

// ── Editor word deletion ───────────────────────────────────

describe('Editor - Ctrl+Backspace (delete previous word)', () => {
  it('deletes the previous word', () => {
    const editor = createEditor(makeDoc([makeBlock('hello world')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 11 });
    const e = new KeyboardEvent('keydown', { key: 'Backspace', ctrlKey: true, bubbles: true, cancelable: true });
    editor.handleKeyDown(e);
    expect(blockToPlainText(editor.doc.blocks[0])).toBe('hello ');
  });

  it('deletes word and spaces before it', () => {
    const editor = createEditor(makeDoc([makeBlock('one two three')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 8 });
    const e = new KeyboardEvent('keydown', { key: 'Backspace', ctrlKey: true, bubbles: true, cancelable: true });
    editor.handleKeyDown(e);
    expect(blockToPlainText(editor.doc.blocks[0])).toBe('one three');
  });

  it('deletes from start of block to cursor when only one word', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 5 });
    const e = new KeyboardEvent('keydown', { key: 'Backspace', ctrlKey: true, bubbles: true, cancelable: true });
    editor.handleKeyDown(e);
    expect(blockToPlainText(editor.doc.blocks[0])).toBe('');
  });

  it('merges with previous block when at offset 0', () => {
    const editor = createEditor(makeDoc([makeBlock('hello'), makeBlock('world')]));
    editor.cursor = collapsedCursor({ blockIndex: 1, offset: 0 });
    const e = new KeyboardEvent('keydown', { key: 'Backspace', ctrlKey: true, bubbles: true, cancelable: true });
    editor.handleKeyDown(e);
    expect(editor.doc.blocks).toHaveLength(1);
    expect(blockToPlainText(editor.doc.blocks[0])).toBe('helloworld');
  });

  it('does nothing at start of first block', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    const e = new KeyboardEvent('keydown', { key: 'Backspace', ctrlKey: true, bubbles: true, cancelable: true });
    editor.handleKeyDown(e);
    expect(blockToPlainText(editor.doc.blocks[0])).toBe('hello');
  });

  it('deletes selection if present', () => {
    const editor = createEditor(makeDoc([makeBlock('hello world')]));
    editor.cursor = {
      anchor: { blockIndex: 0, offset: 0 },
      focus: { blockIndex: 0, offset: 5 },
    };
    const e = new KeyboardEvent('keydown', { key: 'Backspace', ctrlKey: true, bubbles: true, cancelable: true });
    editor.handleKeyDown(e);
    expect(blockToPlainText(editor.doc.blocks[0])).toBe(' world');
  });
});

describe('Editor - Ctrl+Delete (delete next word)', () => {
  it('deletes the next word', () => {
    const editor = createEditor(makeDoc([makeBlock('hello world')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    const e = new KeyboardEvent('keydown', { key: 'Delete', ctrlKey: true, bubbles: true, cancelable: true });
    editor.handleKeyDown(e);
    expect(blockToPlainText(editor.doc.blocks[0])).toBe('world');
  });

  it('deletes word and spaces after it', () => {
    const editor = createEditor(makeDoc([makeBlock('one two three')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 4 });
    const e = new KeyboardEvent('keydown', { key: 'Delete', ctrlKey: true, bubbles: true, cancelable: true });
    editor.handleKeyDown(e);
    expect(blockToPlainText(editor.doc.blocks[0])).toBe('one three');
  });

  it('merges with next block when at end of block', () => {
    const editor = createEditor(makeDoc([makeBlock('hello'), makeBlock('world')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 5 });
    const e = new KeyboardEvent('keydown', { key: 'Delete', ctrlKey: true, bubbles: true, cancelable: true });
    editor.handleKeyDown(e);
    expect(editor.doc.blocks).toHaveLength(1);
    expect(blockToPlainText(editor.doc.blocks[0])).toBe('helloworld');
  });

  it('does nothing at end of last block', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 5 });
    const e = new KeyboardEvent('keydown', { key: 'Delete', ctrlKey: true, bubbles: true, cancelable: true });
    editor.handleKeyDown(e);
    expect(blockToPlainText(editor.doc.blocks[0])).toBe('hello');
  });

  it('deletes from cursor to end when only one word', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    const e = new KeyboardEvent('keydown', { key: 'Delete', ctrlKey: true, bubbles: true, cancelable: true });
    editor.handleKeyDown(e);
    expect(blockToPlainText(editor.doc.blocks[0])).toBe('');
  });

  it('deletes selection if present', () => {
    const editor = createEditor(makeDoc([makeBlock('hello world')]));
    editor.cursor = {
      anchor: { blockIndex: 0, offset: 6 },
      focus: { blockIndex: 0, offset: 11 },
    };
    const e = new KeyboardEvent('keydown', { key: 'Delete', ctrlKey: true, bubbles: true, cancelable: true });
    editor.handleKeyDown(e);
    expect(blockToPlainText(editor.doc.blocks[0])).toBe('hello ');
  });
});

// ── Editor Ctrl+F / Ctrl+H callbacks ──────────────────────

describe('Editor - find/replace callbacks', () => {
  it('fires onFindReplace callback on Ctrl+F', () => {
    const editor = createEditor();
    let called = false;
    let withReplace = true;
    editor.onFindReplace((wr) => { called = true; withReplace = wr; });
    const e = new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true, cancelable: true });
    editor.handleKeyDown(e);
    expect(called).toBe(true);
    expect(withReplace).toBe(false);
  });

  it('fires onFindReplace callback on Ctrl+H with replace=true', () => {
    const editor = createEditor();
    let called = false;
    let withReplace = false;
    editor.onFindReplace((wr) => { called = true; withReplace = wr; });
    const e = new KeyboardEvent('keydown', { key: 'h', ctrlKey: true, bubbles: true, cancelable: true });
    editor.handleKeyDown(e);
    expect(called).toBe(true);
    expect(withReplace).toBe(true);
  });
});
