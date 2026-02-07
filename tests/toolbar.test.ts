/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Toolbar } from '../src/client/toolbar.js';
import { Editor } from '../src/client/editor.js';
import type { Document, Block } from '../src/shared/model.js';
import { blockToPlainText } from '../src/shared/model.js';
import { collapsedCursor } from '../src/shared/cursor.js';

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

function createEditorAndToolbar(doc?: Document): { editor: Editor; toolbar: Toolbar; editorEl: HTMLElement; toolbarEl: HTMLElement } {
  const editorEl = document.createElement('div');
  const toolbarEl = document.createElement('div');
  const editor = new Editor(editorEl, doc);
  const toolbar = new Toolbar(toolbarEl, editor);
  return { editor, toolbar, editorEl, toolbarEl };
}

function getButton(toolbarEl: HTMLElement, action: string): HTMLButtonElement {
  return toolbarEl.querySelector(`[data-toolbar-action="${action}"]`) as HTMLButtonElement;
}

function getSelect(toolbarEl: HTMLElement): HTMLSelectElement {
  return toolbarEl.querySelector('[data-toolbar-action="block-type"]') as HTMLSelectElement;
}

function getBlockText(editor: Editor, blockIndex: number): string {
  return blockToPlainText(editor.doc.blocks[blockIndex]);
}

// ============================================================
// Tests
// ============================================================

describe('Toolbar - rendering', () => {
  it('renders with the toolbar class', () => {
    const { toolbarEl } = createEditorAndToolbar(makeDoc([makeBlock('hello')]));
    expect(toolbarEl.className).toBe('altdocs-toolbar');
  });

  it('renders bold button', () => {
    const { toolbarEl } = createEditorAndToolbar(makeDoc([makeBlock('hello')]));
    const btn = getButton(toolbarEl, 'bold');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toBe('B');
    expect(btn.title).toContain('Bold');
  });

  it('renders italic button', () => {
    const { toolbarEl } = createEditorAndToolbar(makeDoc([makeBlock('hello')]));
    const btn = getButton(toolbarEl, 'italic');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toBe('I');
  });

  it('renders underline button', () => {
    const { toolbarEl } = createEditorAndToolbar(makeDoc([makeBlock('hello')]));
    const btn = getButton(toolbarEl, 'underline');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toBe('U');
  });

  it('renders strikethrough button', () => {
    const { toolbarEl } = createEditorAndToolbar(makeDoc([makeBlock('hello')]));
    const btn = getButton(toolbarEl, 'strikethrough');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toBe('S');
  });

  it('renders alignment buttons', () => {
    const { toolbarEl } = createEditorAndToolbar(makeDoc([makeBlock('hello')]));
    expect(getButton(toolbarEl, 'align-left')).toBeTruthy();
    expect(getButton(toolbarEl, 'align-center')).toBeTruthy();
    expect(getButton(toolbarEl, 'align-right')).toBeTruthy();
  });

  it('renders block type select with all options', () => {
    const { toolbarEl } = createEditorAndToolbar(makeDoc([makeBlock('hello')]));
    const select = getSelect(toolbarEl);
    expect(select).toBeTruthy();
    const options = Array.from(select.options);
    expect(options.map(o => o.value)).toEqual([
      'paragraph', 'heading1', 'heading2', 'heading3',
      'bullet-list-item', 'numbered-list-item',
      'blockquote', 'code-block',
    ]);
  });

  it('has role="toolbar"', () => {
    const { toolbarEl } = createEditorAndToolbar(makeDoc([makeBlock('hello')]));
    expect(toolbarEl.getAttribute('role')).toBe('toolbar');
  });
});

describe('Toolbar - formatting actions', () => {
  it('clicking bold button applies bold to selection', () => {
    const { editor, toolbarEl } = createEditorAndToolbar(makeDoc([makeBlock('hello')]));
    editor.cursor = {
      anchor: { blockIndex: 0, offset: 0 },
      focus: { blockIndex: 0, offset: 5 },
    };
    const btn = getButton(toolbarEl, 'bold');
    btn.click();
    expect(editor.doc.blocks[0].runs[0].style.bold).toBe(true);
  });

  it('clicking italic button applies italic to selection', () => {
    const { editor, toolbarEl } = createEditorAndToolbar(makeDoc([makeBlock('hello')]));
    editor.cursor = {
      anchor: { blockIndex: 0, offset: 0 },
      focus: { blockIndex: 0, offset: 5 },
    };
    getButton(toolbarEl, 'italic').click();
    expect(editor.doc.blocks[0].runs[0].style.italic).toBe(true);
  });

  it('clicking underline button applies underline to selection', () => {
    const { editor, toolbarEl } = createEditorAndToolbar(makeDoc([makeBlock('hello')]));
    editor.cursor = {
      anchor: { blockIndex: 0, offset: 0 },
      focus: { blockIndex: 0, offset: 5 },
    };
    getButton(toolbarEl, 'underline').click();
    expect(editor.doc.blocks[0].runs[0].style.underline).toBe(true);
  });

  it('clicking strikethrough button applies strikethrough to selection', () => {
    const { editor, toolbarEl } = createEditorAndToolbar(makeDoc([makeBlock('hello')]));
    editor.cursor = {
      anchor: { blockIndex: 0, offset: 0 },
      focus: { blockIndex: 0, offset: 5 },
    };
    getButton(toolbarEl, 'strikethrough').click();
    expect(editor.doc.blocks[0].runs[0].style.strikethrough).toBe(true);
  });

  it('toggling bold off works', () => {
    const { editor, toolbarEl } = createEditorAndToolbar(makeDoc([{
      id: 'b1',
      type: 'paragraph',
      alignment: 'left',
      runs: [{ text: 'hello', style: { bold: true } }],
    }]));
    editor.cursor = {
      anchor: { blockIndex: 0, offset: 0 },
      focus: { blockIndex: 0, offset: 5 },
    };
    getButton(toolbarEl, 'bold').click();
    expect(editor.doc.blocks[0].runs[0].style.bold).toBe(false);
  });
});

describe('Toolbar - block type actions', () => {
  it('changing block type select to heading1 changes the block', () => {
    const { editor, toolbarEl } = createEditorAndToolbar(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    const select = getSelect(toolbarEl);
    select.value = 'heading1';
    select.dispatchEvent(new Event('change'));
    expect(editor.doc.blocks[0].type).toBe('heading1');
  });

  it('changing to bullet-list-item works', () => {
    const { editor, toolbarEl } = createEditorAndToolbar(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    const select = getSelect(toolbarEl);
    select.value = 'bullet-list-item';
    select.dispatchEvent(new Event('change'));
    expect(editor.doc.blocks[0].type).toBe('bullet-list-item');
  });

  it('changing to numbered-list-item works', () => {
    const { editor, toolbarEl } = createEditorAndToolbar(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    const select = getSelect(toolbarEl);
    select.value = 'numbered-list-item';
    select.dispatchEvent(new Event('change'));
    expect(editor.doc.blocks[0].type).toBe('numbered-list-item');
  });
});

describe('Toolbar - alignment actions', () => {
  it('clicking align-center changes block alignment', () => {
    const { editor, toolbarEl } = createEditorAndToolbar(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    getButton(toolbarEl, 'align-center').click();
    expect(editor.doc.blocks[0].alignment).toBe('center');
  });

  it('clicking align-right changes block alignment', () => {
    const { editor, toolbarEl } = createEditorAndToolbar(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    getButton(toolbarEl, 'align-right').click();
    expect(editor.doc.blocks[0].alignment).toBe('right');
  });

  it('clicking align-left resets to left alignment', () => {
    const { editor, toolbarEl } = createEditorAndToolbar(makeDoc([{
      id: 'b1',
      type: 'paragraph',
      alignment: 'center',
      runs: [{ text: 'hello', style: {} }],
    }]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    getButton(toolbarEl, 'align-left').click();
    expect(editor.doc.blocks[0].alignment).toBe('left');
  });
});

describe('Toolbar - active state', () => {
  it('bold button is active when cursor is in bold text', () => {
    const { toolbarEl } = createEditorAndToolbar(makeDoc([{
      id: 'b1',
      type: 'paragraph',
      alignment: 'left',
      runs: [{ text: 'hello', style: { bold: true } }],
    }]));
    const btn = getButton(toolbarEl, 'bold');
    expect(btn.classList.contains('active')).toBe(true);
  });

  it('bold button is not active when cursor is in plain text', () => {
    const { toolbarEl } = createEditorAndToolbar(makeDoc([makeBlock('hello')]));
    const btn = getButton(toolbarEl, 'bold');
    expect(btn.classList.contains('active')).toBe(false);
  });

  it('multiple formatting buttons can be active at once', () => {
    const { toolbarEl } = createEditorAndToolbar(makeDoc([{
      id: 'b1',
      type: 'paragraph',
      alignment: 'left',
      runs: [{ text: 'hello', style: { bold: true, italic: true } }],
    }]));
    expect(getButton(toolbarEl, 'bold').classList.contains('active')).toBe(true);
    expect(getButton(toolbarEl, 'italic').classList.contains('active')).toBe(true);
    expect(getButton(toolbarEl, 'underline').classList.contains('active')).toBe(false);
  });

  it('align-left button is active by default', () => {
    const { toolbarEl } = createEditorAndToolbar(makeDoc([makeBlock('hello')]));
    expect(getButton(toolbarEl, 'align-left').classList.contains('active')).toBe(true);
    expect(getButton(toolbarEl, 'align-center').classList.contains('active')).toBe(false);
  });

  it('align-center button is active when block is center-aligned', () => {
    const { toolbarEl } = createEditorAndToolbar(makeDoc([{
      id: 'b1',
      type: 'paragraph',
      alignment: 'center',
      runs: [{ text: 'hello', style: {} }],
    }]));
    expect(getButton(toolbarEl, 'align-center').classList.contains('active')).toBe(true);
    expect(getButton(toolbarEl, 'align-left').classList.contains('active')).toBe(false);
  });

  it('block type select reflects current block type', () => {
    const { toolbarEl } = createEditorAndToolbar(makeDoc([{
      id: 'b1',
      type: 'heading1',
      alignment: 'left',
      runs: [{ text: 'hello', style: {} }],
    }]));
    const select = getSelect(toolbarEl);
    expect(select.value).toBe('heading1');
  });

  it('active states update after formatting action', () => {
    const { editor, toolbar, toolbarEl } = createEditorAndToolbar(makeDoc([makeBlock('hello')]));
    editor.cursor = {
      anchor: { blockIndex: 0, offset: 0 },
      focus: { blockIndex: 0, offset: 5 },
    };
    expect(getButton(toolbarEl, 'bold').classList.contains('active')).toBe(false);

    getButton(toolbarEl, 'bold').click();
    expect(getButton(toolbarEl, 'bold').classList.contains('active')).toBe(true);
  });

  it('active states update after block type change', () => {
    const { editor, toolbarEl } = createEditorAndToolbar(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    const select = getSelect(toolbarEl);
    expect(select.value).toBe('paragraph');

    select.value = 'heading2';
    select.dispatchEvent(new Event('change'));
    expect(select.value).toBe('heading2');
  });
});

describe('Toolbar - shortcuts panel', () => {
  it('renders a shortcuts button', () => {
    const { toolbarEl } = createEditorAndToolbar(makeDoc([makeBlock('hello')]));
    const btn = getButton(toolbarEl, 'shortcuts');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toBe('?');
    expect(btn.title).toContain('Keyboard Shortcuts');
  });

  it('clicking shortcuts button opens the panel', () => {
    const { toolbar, toolbarEl } = createEditorAndToolbar(makeDoc([makeBlock('hello')]));
    const btn = getButton(toolbarEl, 'shortcuts');
    btn.click();
    const overlay = document.querySelector('.shortcuts-overlay');
    expect(overlay).toBeTruthy();
    // Clean up
    toolbar.toggleShortcutsPanel();
  });

  it('toggleShortcutsPanel() method works', () => {
    const { toolbar } = createEditorAndToolbar(makeDoc([makeBlock('hello')]));
    toolbar.toggleShortcutsPanel();
    expect(document.querySelector('.shortcuts-overlay')).toBeTruthy();
    toolbar.toggleShortcutsPanel();
    expect(document.querySelector('.shortcuts-overlay')).toBeFalsy();
  });
});

describe('Toolbar - undo/redo integration', () => {
  it('block type change can be undone', () => {
    const { editor, toolbarEl } = createEditorAndToolbar(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    const select = getSelect(toolbarEl);
    select.value = 'heading1';
    select.dispatchEvent(new Event('change'));
    expect(editor.doc.blocks[0].type).toBe('heading1');

    editor.undo();
    expect(editor.doc.blocks[0].type).toBe('paragraph');
  });

  it('alignment change can be undone', () => {
    const { editor, toolbarEl } = createEditorAndToolbar(makeDoc([makeBlock('hello')]));
    editor.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    getButton(toolbarEl, 'align-center').click();
    expect(editor.doc.blocks[0].alignment).toBe('center');

    editor.undo();
    expect(editor.doc.blocks[0].alignment).toBe('left');
  });
});
