/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Editor } from '../src/client/editor.js';
import type { Document, Block } from '../src/shared/model.js';
import { blockToPlainText } from '../src/shared/model.js';
import { collapsedCursor, isCollapsed } from '../src/shared/cursor.js';

// ============================================================
// Helpers
// ============================================================

function makeDoc(blocks: Block[]): Document {
  return { id: 'test', title: 'Test', blocks };
}

function makeBlock(text: string, id?: string): Block {
  return {
    id: id || `b${Math.random()}`,
    type: 'paragraph',
    alignment: 'left',
    runs: [{ text, style: {} }],
  };
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
// Tests
// ============================================================

describe('Editor - text insertion', () => {
  it('inserts a character at the cursor position', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 5 });
    editor.insertText('!');
    expect(getBlockText(editor, 0)).toBe('hello!');
    expect(editor.cursor.focus.offset).toBe(6);
  });

  it('inserts text at the beginning', () => {
    const editor = createEditor(makeDoc([makeBlock('world')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    editor.insertText('hello ');
    expect(getBlockText(editor, 0)).toBe('hello world');
    expect(editor.cursor.focus.offset).toBe(6);
  });

  it('inserts text in the middle', () => {
    const editor = createEditor(makeDoc([makeBlock('hllo')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 1 });
    editor.insertText('e');
    expect(getBlockText(editor, 0)).toBe('hello');
    expect(editor.cursor.focus.offset).toBe(2);
  });

  it('replaces selection when inserting text', () => {
    const editor = createEditor(makeDoc([makeBlock('hello world')]));
    editor.cursor = {
      anchor: { blockIndex: 0, offset: 0 },
      focus: { blockIndex: 0, offset: 5 },
    };
    editor.insertText('goodbye');
    expect(getBlockText(editor, 0)).toBe('goodbye world');
    expect(editor.cursor.focus.offset).toBe(7);
  });

  it('inserts into second block', () => {
    const editor = createEditor(makeDoc([makeBlock('first'), makeBlock('second')]));
    editor.cursor = collapsedCursor({ blockIndex: 1, offset: 6 });
    editor.insertText(' block');
    expect(getBlockText(editor, 1)).toBe('second block');
  });
});

describe('Editor - backspace', () => {
  let editor: Editor;

  it('deletes character before cursor', () => {
    editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 5 });
    editor.handleKeyDown(makeKeyEvent('Backspace'));
    expect(getBlockText(editor, 0)).toBe('hell');
    expect(editor.cursor.focus.offset).toBe(4);
  });

  it('deletes character in the middle', () => {
    editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 2 });
    editor.handleKeyDown(makeKeyEvent('Backspace'));
    expect(getBlockText(editor, 0)).toBe('hllo');
    expect(editor.cursor.focus.offset).toBe(1);
  });

  it('merges with previous block at start of block', () => {
    editor = createEditor(makeDoc([makeBlock('hello'), makeBlock('world')]));
    editor.cursor = collapsedCursor({ blockIndex: 1, offset: 0 });
    editor.handleKeyDown(makeKeyEvent('Backspace'));
    expect(editor.doc.blocks).toHaveLength(1);
    expect(getBlockText(editor, 0)).toBe('helloworld');
    expect(editor.cursor.focus).toEqual({ blockIndex: 0, offset: 5 });
  });

  it('does nothing at start of first block', () => {
    editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    editor.handleKeyDown(makeKeyEvent('Backspace'));
    expect(getBlockText(editor, 0)).toBe('hello');
  });

  it('deletes selection on backspace', () => {
    editor = createEditor(makeDoc([makeBlock('hello world')]));
    editor.cursor = {
      anchor: { blockIndex: 0, offset: 2 },
      focus: { blockIndex: 0, offset: 7 },
    };
    editor.handleKeyDown(makeKeyEvent('Backspace'));
    expect(getBlockText(editor, 0)).toBe('heorld');
    expect(editor.cursor.focus).toEqual({ blockIndex: 0, offset: 2 });
  });
});

describe('Editor - delete key', () => {
  it('deletes character after cursor', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    editor.handleKeyDown(makeKeyEvent('Delete'));
    expect(getBlockText(editor, 0)).toBe('ello');
    expect(editor.cursor.focus.offset).toBe(0);
  });

  it('merges next block at end of block', () => {
    const editor = createEditor(makeDoc([makeBlock('hello'), makeBlock('world')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 5 });
    editor.handleKeyDown(makeKeyEvent('Delete'));
    expect(editor.doc.blocks).toHaveLength(1);
    expect(getBlockText(editor, 0)).toBe('helloworld');
    expect(editor.cursor.focus).toEqual({ blockIndex: 0, offset: 5 });
  });

  it('does nothing at end of last block', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 5 });
    editor.handleKeyDown(makeKeyEvent('Delete'));
    expect(getBlockText(editor, 0)).toBe('hello');
  });

  it('deletes selection on delete key', () => {
    const editor = createEditor(makeDoc([makeBlock('hello world')]));
    editor.cursor = {
      anchor: { blockIndex: 0, offset: 5 },
      focus: { blockIndex: 0, offset: 11 },
    };
    editor.handleKeyDown(makeKeyEvent('Delete'));
    expect(getBlockText(editor, 0)).toBe('hello');
  });
});

describe('Editor - enter key', () => {
  it('splits block at cursor position', () => {
    const editor = createEditor(makeDoc([makeBlock('hello world')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 5 });
    editor.handleKeyDown(makeKeyEvent('Enter'));
    expect(editor.doc.blocks).toHaveLength(2);
    expect(getBlockText(editor, 0)).toBe('hello');
    expect(getBlockText(editor, 1)).toBe(' world');
    expect(editor.cursor.focus).toEqual({ blockIndex: 1, offset: 0 });
  });

  it('creates empty block when pressing enter at end', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 5 });
    editor.handleKeyDown(makeKeyEvent('Enter'));
    expect(editor.doc.blocks).toHaveLength(2);
    expect(getBlockText(editor, 0)).toBe('hello');
    expect(getBlockText(editor, 1)).toBe('');
    expect(editor.cursor.focus).toEqual({ blockIndex: 1, offset: 0 });
  });

  it('deletes selection before splitting', () => {
    const editor = createEditor(makeDoc([makeBlock('hello world')]));
    editor.cursor = {
      anchor: { blockIndex: 0, offset: 5 },
      focus: { blockIndex: 0, offset: 11 },
    };
    editor.handleKeyDown(makeKeyEvent('Enter'));
    expect(editor.doc.blocks).toHaveLength(2);
    expect(getBlockText(editor, 0)).toBe('hello');
    expect(getBlockText(editor, 1)).toBe('');
  });
});

describe('Editor - arrow keys', () => {
  it('moves cursor left', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 3 });
    editor.handleKeyDown(makeKeyEvent('ArrowLeft'));
    expect(editor.cursor.focus).toEqual({ blockIndex: 0, offset: 2 });
  });

  it('moves cursor right', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 3 });
    editor.handleKeyDown(makeKeyEvent('ArrowRight'));
    expect(editor.cursor.focus).toEqual({ blockIndex: 0, offset: 4 });
  });

  it('extends selection with shift+arrow', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 2 });
    editor.handleKeyDown(makeKeyEvent('ArrowRight', { shiftKey: true }));
    expect(editor.cursor.anchor).toEqual({ blockIndex: 0, offset: 2 });
    expect(editor.cursor.focus).toEqual({ blockIndex: 0, offset: 3 });
    expect(isCollapsed(editor.cursor)).toBe(false);
  });

  it('moves up between blocks', () => {
    const editor = createEditor(makeDoc([makeBlock('hello'), makeBlock('world')]));
    editor.cursor = collapsedCursor({ blockIndex: 1, offset: 3 });
    editor.handleKeyDown(makeKeyEvent('ArrowUp'));
    expect(editor.cursor.focus).toEqual({ blockIndex: 0, offset: 3 });
  });

  it('moves down between blocks', () => {
    const editor = createEditor(makeDoc([makeBlock('hello'), makeBlock('world')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 3 });
    editor.handleKeyDown(makeKeyEvent('ArrowDown'));
    expect(editor.cursor.focus).toEqual({ blockIndex: 1, offset: 3 });
  });

  it('home moves to start of block', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 3 });
    editor.handleKeyDown(makeKeyEvent('Home'));
    expect(editor.cursor.focus).toEqual({ blockIndex: 0, offset: 0 });
  });

  it('end moves to end of block', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 2 });
    editor.handleKeyDown(makeKeyEvent('End'));
    expect(editor.cursor.focus).toEqual({ blockIndex: 0, offset: 5 });
  });
});

describe('Editor - select all', () => {
  it('selects entire document with Ctrl+A', () => {
    const editor = createEditor(
      makeDoc([makeBlock('hello'), makeBlock('world')])
    );
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 2 });
    editor.handleKeyDown(makeKeyEvent('a', { ctrlKey: true }));
    expect(editor.cursor.anchor).toEqual({ blockIndex: 0, offset: 0 });
    expect(editor.cursor.focus).toEqual({ blockIndex: 1, offset: 5 });
  });
});

describe('Editor - formatting shortcuts', () => {
  it('toggles bold on selection with Ctrl+B', () => {
    const editor = createEditor(makeDoc([makeBlock('hello world')]));
    editor.cursor = {
      anchor: { blockIndex: 0, offset: 0 },
      focus: { blockIndex: 0, offset: 5 },
    };
    editor.handleKeyDown(makeKeyEvent('b', { ctrlKey: true }));
    // "hello" should now be bold
    expect(editor.doc.blocks[0].runs[0].text).toBe('hello');
    expect(editor.doc.blocks[0].runs[0].style.bold).toBe(true);
    expect(editor.doc.blocks[0].runs[1].text).toBe(' world');
    expect(editor.doc.blocks[0].runs[1].style.bold).toBeFalsy();
  });

  it('toggles italic on selection with Ctrl+I', () => {
    const editor = createEditor(makeDoc([makeBlock('hello world')]));
    editor.cursor = {
      anchor: { blockIndex: 0, offset: 6 },
      focus: { blockIndex: 0, offset: 11 },
    };
    editor.handleKeyDown(makeKeyEvent('i', { ctrlKey: true }));
    expect(editor.doc.blocks[0].runs[1].text).toBe('world');
    expect(editor.doc.blocks[0].runs[1].style.italic).toBe(true);
  });

  it('toggles underline on selection with Ctrl+U', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = {
      anchor: { blockIndex: 0, offset: 0 },
      focus: { blockIndex: 0, offset: 5 },
    };
    editor.handleKeyDown(makeKeyEvent('u', { ctrlKey: true }));
    expect(editor.doc.blocks[0].runs[0].style.underline).toBe(true);
  });

  it('removes bold when already applied', () => {
    const editor = createEditor(
      makeDoc([
        {
          id: 'b1',
          type: 'paragraph',
          alignment: 'left',
          runs: [{ text: 'hello world', style: { bold: true } }],
        },
      ])
    );
    editor.cursor = {
      anchor: { blockIndex: 0, offset: 0 },
      focus: { blockIndex: 0, offset: 5 },
    };
    editor.handleKeyDown(makeKeyEvent('b', { ctrlKey: true }));
    // "hello" should no longer be bold
    expect(editor.doc.blocks[0].runs[0].text).toBe('hello');
    expect(editor.doc.blocks[0].runs[0].style.bold).toBe(false);
    // " world" should still be bold
    expect(editor.doc.blocks[0].runs[1].text).toBe(' world');
    expect(editor.doc.blocks[0].runs[1].style.bold).toBe(true);
  });

  it('does nothing when cursor is collapsed (no selection)', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 2 });
    editor.handleKeyDown(makeKeyEvent('b', { ctrlKey: true }));
    // Should be unchanged
    expect(editor.doc.blocks[0].runs[0].text).toBe('hello');
    expect(editor.doc.blocks[0].runs[0].style.bold).toBeFalsy();
  });
});

describe('Editor - complex sequences', () => {
  it('type, enter, type creates two blocks', () => {
    const editor = createEditor(makeDoc([makeBlock('')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });

    editor.insertText('Hello');
    editor.handleKeyDown(makeKeyEvent('Enter'));
    editor.insertText('World');

    expect(editor.doc.blocks).toHaveLength(2);
    expect(getBlockText(editor, 0)).toBe('Hello');
    expect(getBlockText(editor, 1)).toBe('World');
  });

  it('select all and delete clears document', () => {
    const editor = createEditor(
      makeDoc([makeBlock('hello'), makeBlock('world')])
    );
    editor.handleKeyDown(makeKeyEvent('a', { ctrlKey: true }));
    editor.handleKeyDown(makeKeyEvent('Backspace'));
    // After deleting everything, should have one empty block
    // (because delete_text merges the range, leaving an empty first block)
    expect(editor.doc.blocks).toHaveLength(1);
    expect(getBlockText(editor, 0)).toBe('');
  });

  it('select all and type replaces everything', () => {
    const editor = createEditor(
      makeDoc([makeBlock('hello'), makeBlock('world')])
    );
    editor.handleKeyDown(makeKeyEvent('a', { ctrlKey: true }));
    editor.insertText('replaced');
    expect(editor.doc.blocks).toHaveLength(1);
    expect(getBlockText(editor, 0)).toBe('replaced');
  });
});

describe('Editor - undo/redo', () => {
  it('undoes text insertion', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 5 });
    editor.insertText(' world');
    expect(getBlockText(editor, 0)).toBe('hello world');

    editor.undo();
    expect(getBlockText(editor, 0)).toBe('hello');
  });

  it('redoes after undo', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 5 });
    editor.insertText(' world');
    editor.undo();
    expect(getBlockText(editor, 0)).toBe('hello');

    editor.redo();
    expect(getBlockText(editor, 0)).toBe('hello world');
  });

  it('undoes backspace', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 5 });
    editor.handleKeyDown(makeKeyEvent('Backspace'));
    expect(getBlockText(editor, 0)).toBe('hell');

    editor.undo();
    expect(getBlockText(editor, 0)).toBe('hello');
  });

  it('undoes enter (split block)', () => {
    const editor = createEditor(makeDoc([makeBlock('hello world')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 5 });
    editor.handleKeyDown(makeKeyEvent('Enter'));
    expect(editor.doc.blocks).toHaveLength(2);

    editor.undo();
    expect(editor.doc.blocks).toHaveLength(1);
    expect(getBlockText(editor, 0)).toBe('hello world');
  });

  it('undoes formatting', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = {
      anchor: { blockIndex: 0, offset: 0 },
      focus: { blockIndex: 0, offset: 5 },
    };
    editor.handleKeyDown(makeKeyEvent('b', { ctrlKey: true }));
    expect(editor.doc.blocks[0].runs[0].style.bold).toBe(true);

    editor.undo();
    expect(editor.doc.blocks[0].runs[0].style.bold).toBeFalsy();
  });

  it('Ctrl+Z triggers undo', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 5 });
    editor.insertText('!');
    expect(getBlockText(editor, 0)).toBe('hello!');

    editor.handleKeyDown(makeKeyEvent('z', { ctrlKey: true }));
    expect(getBlockText(editor, 0)).toBe('hello');
  });

  it('Ctrl+Shift+Z triggers redo', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 5 });
    editor.insertText('!');
    editor.handleKeyDown(makeKeyEvent('z', { ctrlKey: true }));
    expect(getBlockText(editor, 0)).toBe('hello');

    editor.handleKeyDown(makeKeyEvent('z', { ctrlKey: true, shiftKey: true }));
    expect(getBlockText(editor, 0)).toBe('hello!');
  });

  it('Ctrl+Y triggers redo', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 5 });
    editor.insertText('!');
    editor.handleKeyDown(makeKeyEvent('z', { ctrlKey: true }));

    editor.handleKeyDown(makeKeyEvent('y', { ctrlKey: true }));
    expect(getBlockText(editor, 0)).toBe('hello!');
  });

  it('new operation clears redo stack', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 5 });

    editor.insertText('!');
    editor.undo();
    expect(editor.history.canRedo()).toBe(true);

    editor.insertText('?');
    expect(editor.history.canRedo()).toBe(false);
  });

  it('multiple undos restore to original state', () => {
    const editor = createEditor(makeDoc([makeBlock('')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });

    editor.insertText('a');
    editor.insertText('b');
    editor.insertText('c');
    expect(getBlockText(editor, 0)).toBe('abc');

    editor.undo();
    expect(getBlockText(editor, 0)).toBe('ab');
    editor.undo();
    expect(getBlockText(editor, 0)).toBe('a');
    editor.undo();
    expect(getBlockText(editor, 0)).toBe('');
  });

  it('restores cursor position on undo', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 5 });
    editor.insertText(' world');
    expect(editor.cursor.focus.offset).toBe(11);

    editor.undo();
    expect(editor.cursor.focus.offset).toBe(5);
  });
});
