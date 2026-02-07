/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Editor } from '../src/client/editor.js';
import type { Document, Block } from '../src/shared/model.js';
import { blockToPlainText } from '../src/shared/model.js';
import { collapsedCursor, isCollapsed, getSelectionRange } from '../src/shared/cursor.js';

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

describe('Editor - font size and family', () => {
  it('applies font size to selection', () => {
    const editor = createEditor(makeDoc([makeBlock('hello world')]));
    editor.cursor = {
      anchor: { blockIndex: 0, offset: 0 },
      focus: { blockIndex: 0, offset: 5 },
    };
    editor.applyFontSize(24);
    expect(editor.doc.blocks[0].runs[0].text).toBe('hello');
    expect(editor.doc.blocks[0].runs[0].style.fontSize).toBe(24);
    expect(editor.doc.blocks[0].runs[1].text).toBe(' world');
    expect(editor.doc.blocks[0].runs[1].style.fontSize).toBeUndefined();
  });

  it('applies font family to selection', () => {
    const editor = createEditor(makeDoc([makeBlock('hello world')]));
    editor.cursor = {
      anchor: { blockIndex: 0, offset: 0 },
      focus: { blockIndex: 0, offset: 5 },
    };
    editor.applyFontFamily('Georgia');
    expect(editor.doc.blocks[0].runs[0].text).toBe('hello');
    expect(editor.doc.blocks[0].runs[0].style.fontFamily).toBe('Georgia');
    expect(editor.doc.blocks[0].runs[1].text).toBe(' world');
    expect(editor.doc.blocks[0].runs[1].style.fontFamily).toBeUndefined();
  });

  it('does nothing when cursor is collapsed', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 2 });
    editor.applyFontSize(24);
    expect(editor.doc.blocks[0].runs[0].style.fontSize).toBeUndefined();
  });

  it('removes font size when undefined is passed', () => {
    const editor = createEditor(
      makeDoc([
        {
          id: 'b1',
          type: 'paragraph',
          alignment: 'left',
          runs: [{ text: 'hello', style: { fontSize: 24 } }],
        },
      ])
    );
    editor.cursor = {
      anchor: { blockIndex: 0, offset: 0 },
      focus: { blockIndex: 0, offset: 5 },
    };
    editor.applyFontSize(undefined);
    expect(editor.doc.blocks[0].runs[0].style.fontSize).toBeUndefined();
  });

  it('removes font family when undefined is passed', () => {
    const editor = createEditor(
      makeDoc([
        {
          id: 'b1',
          type: 'paragraph',
          alignment: 'left',
          runs: [{ text: 'hello', style: { fontFamily: 'Arial' } }],
        },
      ])
    );
    editor.cursor = {
      anchor: { blockIndex: 0, offset: 0 },
      focus: { blockIndex: 0, offset: 5 },
    };
    editor.applyFontFamily(undefined);
    expect(editor.doc.blocks[0].runs[0].style.fontFamily).toBeUndefined();
  });

  it('getActiveFontSize returns font size at cursor', () => {
    const editor = createEditor(
      makeDoc([
        {
          id: 'b1',
          type: 'paragraph',
          alignment: 'left',
          runs: [{ text: 'hello', style: { fontSize: 18 } }],
        },
      ])
    );
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 2 });
    expect(editor.getActiveFontSize()).toBe(18);
  });

  it('getActiveFontFamily returns font family at cursor', () => {
    const editor = createEditor(
      makeDoc([
        {
          id: 'b1',
          type: 'paragraph',
          alignment: 'left',
          runs: [{ text: 'hello', style: { fontFamily: 'Verdana' } }],
        },
      ])
    );
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 2 });
    expect(editor.getActiveFontFamily()).toBe('Verdana');
  });

  it('getActiveFontSize returns undefined for default text', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 2 });
    expect(editor.getActiveFontSize()).toBeUndefined();
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

describe('Editor - changeBlockType', () => {
  it('changes block type to heading1', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    editor.changeBlockType('heading1');
    expect(editor.doc.blocks[0].type).toBe('heading1');
  });

  it('changes block type to bullet-list-item', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    editor.changeBlockType('bullet-list-item');
    expect(editor.doc.blocks[0].type).toBe('bullet-list-item');
  });

  it('changes block at cursor focus position', () => {
    const editor = createEditor(makeDoc([makeBlock('first'), makeBlock('second')]));
    editor.cursor = collapsedCursor({ blockIndex: 1, offset: 0 });
    editor.changeBlockType('heading2');
    expect(editor.doc.blocks[0].type).toBe('paragraph');
    expect(editor.doc.blocks[1].type).toBe('heading2');
  });

  it('can be undone', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    editor.changeBlockType('heading1');
    expect(editor.doc.blocks[0].type).toBe('heading1');
    editor.undo();
    expect(editor.doc.blocks[0].type).toBe('paragraph');
  });
});

describe('Editor - changeAlignment', () => {
  it('changes alignment to center', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    editor.changeAlignment('center');
    expect(editor.doc.blocks[0].alignment).toBe('center');
  });

  it('changes alignment to right', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    editor.changeAlignment('right');
    expect(editor.doc.blocks[0].alignment).toBe('right');
  });

  it('can be undone', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    editor.changeAlignment('center');
    editor.undo();
    expect(editor.doc.blocks[0].alignment).toBe('left');
  });
});

describe('Editor - getActiveFormatting', () => {
  it('returns empty style for plain text', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 2 });
    const fmt = editor.getActiveFormatting();
    expect(fmt.bold).toBeFalsy();
    expect(fmt.italic).toBeFalsy();
  });

  it('returns bold when cursor is in bold text', () => {
    const editor = createEditor(makeDoc([{
      id: 'b1',
      type: 'paragraph',
      alignment: 'left',
      runs: [
        { text: 'plain ', style: {} },
        { text: 'bold', style: { bold: true } },
        { text: ' plain', style: {} },
      ],
    }]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 7 }); // inside "bold"
    const fmt = editor.getActiveFormatting();
    expect(fmt.bold).toBe(true);
  });

  it('returns combined styles', () => {
    const editor = createEditor(makeDoc([{
      id: 'b1',
      type: 'paragraph',
      alignment: 'left',
      runs: [{ text: 'hello', style: { bold: true, italic: true, underline: true } }],
    }]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 2 });
    const fmt = editor.getActiveFormatting();
    expect(fmt.bold).toBe(true);
    expect(fmt.italic).toBe(true);
    expect(fmt.underline).toBe(true);
  });
});

describe('Editor - getActiveBlockType', () => {
  it('returns paragraph for default block', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    expect(editor.getActiveBlockType()).toBe('paragraph');
  });

  it('returns heading1 for heading block', () => {
    const editor = createEditor(makeDoc([{
      id: 'b1', type: 'heading1', alignment: 'left',
      runs: [{ text: 'hello', style: {} }],
    }]));
    expect(editor.getActiveBlockType()).toBe('heading1');
  });

  it('returns type of block at cursor', () => {
    const editor = createEditor(makeDoc([
      makeBlock('first'),
      { id: 'b2', type: 'heading2', alignment: 'left', runs: [{ text: 'second', style: {} }] },
    ]));
    editor.cursor = collapsedCursor({ blockIndex: 1, offset: 0 });
    expect(editor.getActiveBlockType()).toBe('heading2');
  });
});

describe('Editor - getActiveAlignment', () => {
  it('returns left for default block', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    expect(editor.getActiveAlignment()).toBe('left');
  });

  it('returns center for center-aligned block', () => {
    const editor = createEditor(makeDoc([{
      id: 'b1', type: 'paragraph', alignment: 'center',
      runs: [{ text: 'hello', style: {} }],
    }]));
    expect(editor.getActiveAlignment()).toBe('center');
  });
});

describe('Editor - strikethrough shortcut', () => {
  it('toggles strikethrough on selection with Ctrl+D', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = {
      anchor: { blockIndex: 0, offset: 0 },
      focus: { blockIndex: 0, offset: 5 },
    };
    editor.handleKeyDown(makeKeyEvent('d', { ctrlKey: true }));
    expect(editor.doc.blocks[0].runs[0].style.strikethrough).toBe(true);
  });
});

describe('Editor - onUpdate callback', () => {
  it('calls onUpdate after insertText', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    let called = false;
    editor.onUpdate(() => { called = true; });
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 5 });
    editor.insertText('!');
    expect(called).toBe(true);
  });

  it('calls onUpdate after changeBlockType', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    let callCount = 0;
    editor.onUpdate(() => { callCount++; });
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    editor.changeBlockType('heading1');
    expect(callCount).toBeGreaterThan(0);
  });
});

// ============================================================
// Clipboard operations
// ============================================================

describe('Editor - getSelectedText', () => {
  it('returns empty string with collapsed cursor', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 2 });
    expect(editor.getSelectedText()).toBe('');
  });

  it('returns selected text within a single block', () => {
    const editor = createEditor(makeDoc([makeBlock('hello world')]));
    editor.cursor = {
      anchor: { blockIndex: 0, offset: 0 },
      focus: { blockIndex: 0, offset: 5 },
    };
    expect(editor.getSelectedText()).toBe('hello');
  });

  it('returns selected text across multiple blocks', () => {
    const editor = createEditor(makeDoc([makeBlock('hello'), makeBlock('world')]));
    editor.cursor = {
      anchor: { blockIndex: 0, offset: 3 },
      focus: { blockIndex: 1, offset: 3 },
    };
    expect(editor.getSelectedText()).toBe('lo\nwor');
  });

  it('works with backward selection', () => {
    const editor = createEditor(makeDoc([makeBlock('hello world')]));
    editor.cursor = {
      anchor: { blockIndex: 0, offset: 11 },
      focus: { blockIndex: 0, offset: 6 },
    };
    expect(editor.getSelectedText()).toBe('world');
  });
});

describe('Editor - pasteText (single line)', () => {
  it('pastes text at cursor position', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 5 });
    editor.pasteText(' world');
    expect(getBlockText(editor, 0)).toBe('hello world');
    expect(editor.cursor.focus).toEqual({ blockIndex: 0, offset: 11 });
  });

  it('pastes text at the beginning', () => {
    const editor = createEditor(makeDoc([makeBlock('world')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    editor.pasteText('hello ');
    expect(getBlockText(editor, 0)).toBe('hello world');
    expect(editor.cursor.focus).toEqual({ blockIndex: 0, offset: 6 });
  });

  it('replaces selection when pasting', () => {
    const editor = createEditor(makeDoc([makeBlock('hello world')]));
    editor.cursor = {
      anchor: { blockIndex: 0, offset: 0 },
      focus: { blockIndex: 0, offset: 5 },
    };
    editor.pasteText('goodbye');
    expect(getBlockText(editor, 0)).toBe('goodbye world');
    expect(editor.cursor.focus).toEqual({ blockIndex: 0, offset: 7 });
  });
});

describe('Editor - pasteText (multi-line)', () => {
  it('splits into multiple blocks on newlines', () => {
    const editor = createEditor(makeDoc([makeBlock('')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    editor.pasteText('line1\nline2\nline3');
    expect(editor.doc.blocks).toHaveLength(3);
    expect(getBlockText(editor, 0)).toBe('line1');
    expect(getBlockText(editor, 1)).toBe('line2');
    expect(getBlockText(editor, 2)).toBe('line3');
    expect(editor.cursor.focus).toEqual({ blockIndex: 2, offset: 5 });
  });

  it('inserts multi-line text in the middle of existing text', () => {
    const editor = createEditor(makeDoc([makeBlock('helloworld')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 5 });
    editor.pasteText('\n');
    expect(editor.doc.blocks).toHaveLength(2);
    expect(getBlockText(editor, 0)).toBe('hello');
    expect(getBlockText(editor, 1)).toBe('world');
    expect(editor.cursor.focus).toEqual({ blockIndex: 1, offset: 0 });
  });

  it('handles paste with trailing newline', () => {
    const editor = createEditor(makeDoc([makeBlock('')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    editor.pasteText('hello\n');
    expect(editor.doc.blocks).toHaveLength(2);
    expect(getBlockText(editor, 0)).toBe('hello');
    expect(getBlockText(editor, 1)).toBe('');
    expect(editor.cursor.focus).toEqual({ blockIndex: 1, offset: 0 });
  });

  it('handles multi-line paste replacing a selection', () => {
    const editor = createEditor(makeDoc([makeBlock('hello world')]));
    editor.cursor = {
      anchor: { blockIndex: 0, offset: 5 },
      focus: { blockIndex: 0, offset: 11 },
    };
    editor.pasteText('\nfoo\nbar');
    expect(editor.doc.blocks).toHaveLength(3);
    expect(getBlockText(editor, 0)).toBe('hello');
    expect(getBlockText(editor, 1)).toBe('foo');
    expect(getBlockText(editor, 2)).toBe('bar');
  });

  it('handles multi-line paste into middle of existing blocks', () => {
    const editor = createEditor(makeDoc([makeBlock('abcdef')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 3 });
    editor.pasteText('X\nY');
    expect(editor.doc.blocks).toHaveLength(2);
    expect(getBlockText(editor, 0)).toBe('abcX');
    expect(getBlockText(editor, 1)).toBe('Ydef');
    expect(editor.cursor.focus).toEqual({ blockIndex: 1, offset: 1 });
  });
});

describe('Editor - clipboard undo/redo', () => {
  it('undoes a single-line paste', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 5 });
    editor.pasteText(' world');
    expect(getBlockText(editor, 0)).toBe('hello world');

    editor.undo();
    expect(getBlockText(editor, 0)).toBe('hello');
  });

  it('undoes a multi-line paste', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 5 });
    editor.pasteText('\nworld\nfoo');
    expect(editor.doc.blocks).toHaveLength(3);

    editor.undo();
    expect(editor.doc.blocks).toHaveLength(1);
    expect(getBlockText(editor, 0)).toBe('hello');
  });

  it('redoes a paste after undo', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 5 });
    editor.pasteText(' world');
    editor.undo();
    editor.redo();
    expect(getBlockText(editor, 0)).toBe('hello world');
  });
});

// ============================================================
// Extended Formatting
// ============================================================

describe('Editor - inline code shortcut', () => {
  it('toggles code formatting on selection with Ctrl+`', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = {
      anchor: { blockIndex: 0, offset: 0 },
      focus: { blockIndex: 0, offset: 5 },
    };
    editor.handleKeyDown(makeKeyEvent('`', { ctrlKey: true }));
    expect(editor.doc.blocks[0].runs[0].style.code).toBe(true);
  });

  it('does nothing with collapsed cursor', () => {
    const editor = createEditor(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 2 });
    editor.handleKeyDown(makeKeyEvent('`', { ctrlKey: true }));
    expect(editor.doc.blocks[0].runs[0].style.code).toBeFalsy();
  });
});

describe('Editor - blockquote and code-block types', () => {
  it('changes block to blockquote', () => {
    const editor = createEditor(makeDoc([makeBlock('quote text')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    editor.changeBlockType('blockquote');
    expect(editor.doc.blocks[0].type).toBe('blockquote');
    expect(getBlockText(editor, 0)).toBe('quote text');
  });

  it('changes block to code-block', () => {
    const editor = createEditor(makeDoc([makeBlock('code text')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    editor.changeBlockType('code-block');
    expect(editor.doc.blocks[0].type).toBe('code-block');
    expect(getBlockText(editor, 0)).toBe('code text');
  });

  it('blockquote change can be undone', () => {
    const editor = createEditor(makeDoc([makeBlock('text')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    editor.changeBlockType('blockquote');
    editor.undo();
    expect(editor.doc.blocks[0].type).toBe('paragraph');
  });
});

describe('Editor - horizontal rule', () => {
  it('inserts a horizontal rule after current block', () => {
    const editor = createEditor(makeDoc([makeBlock('text')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 4 });
    editor.insertHorizontalRule();
    expect(editor.doc.blocks).toHaveLength(3);
    expect(editor.doc.blocks[0].type).toBe('paragraph');
    expect(editor.doc.blocks[1].type).toBe('horizontal-rule');
    expect(editor.doc.blocks[2].type).toBe('paragraph');
    // Cursor should be in the new paragraph after the HR
    expect(editor.cursor.focus.blockIndex).toBe(2);
    expect(editor.cursor.focus.offset).toBe(0);
  });

  it('insertHorizontalRule can be undone', () => {
    const editor = createEditor(makeDoc([makeBlock('text')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 4 });
    editor.insertHorizontalRule();
    expect(editor.doc.blocks).toHaveLength(3);
    editor.undo();
    expect(editor.doc.blocks).toHaveLength(1);
    expect(getBlockText(editor, 0)).toBe('text');
  });

  it('Enter on horizontal rule creates paragraph after', () => {
    const editor = createEditor(makeDoc([
      makeBlock('before'),
      {
        id: 'hr1', type: 'horizontal-rule', alignment: 'left',
        runs: [{ text: '', style: {} }],
      },
    ]));
    editor.cursor = collapsedCursor({ blockIndex: 1, offset: 0 });
    editor.handleKeyDown(makeKeyEvent('Enter'));
    expect(editor.doc.blocks).toHaveLength(3);
    expect(editor.doc.blocks[2].type).toBe('paragraph');
    expect(editor.cursor.focus.blockIndex).toBe(2);
  });

  it('Backspace on horizontal rule deletes it', () => {
    const editor = createEditor(makeDoc([
      makeBlock('before'),
      {
        id: 'hr1', type: 'horizontal-rule', alignment: 'left',
        runs: [{ text: '', style: {} }],
      },
      makeBlock('after'),
    ]));
    editor.cursor = collapsedCursor({ blockIndex: 1, offset: 0 });
    editor.handleKeyDown(makeKeyEvent('Backspace'));
    expect(editor.doc.blocks).toHaveLength(2);
    expect(editor.doc.blocks[0].type).toBe('paragraph');
    expect(editor.doc.blocks[1].type).toBe('paragraph');
    expect(editor.cursor.focus.blockIndex).toBe(0);
  });

  it('Backspace at start of block after HR deletes the HR', () => {
    const editor = createEditor(makeDoc([
      makeBlock('before'),
      {
        id: 'hr1', type: 'horizontal-rule', alignment: 'left',
        runs: [{ text: '', style: {} }],
      },
      makeBlock('after'),
    ]));
    editor.cursor = collapsedCursor({ blockIndex: 2, offset: 0 });
    editor.handleKeyDown(makeKeyEvent('Backspace'));
    expect(editor.doc.blocks).toHaveLength(2);
    expect(editor.doc.blocks[0].type).toBe('paragraph');
    expect(editor.doc.blocks[1].type).toBe('paragraph');
    expect(getBlockText(editor, 1)).toBe('after');
    expect(editor.cursor.focus.blockIndex).toBe(1);
  });

  it('blocks text input on horizontal rule', () => {
    const editor = createEditor(makeDoc([
      {
        id: 'hr1', type: 'horizontal-rule', alignment: 'left',
        runs: [{ text: '', style: {} }],
      },
    ]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    editor.handleKeyDown(makeKeyEvent('a'));
    // Text should not have been inserted
    expect(getBlockText(editor, 0)).toBe('');
  });
});
