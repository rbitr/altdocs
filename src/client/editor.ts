import type { Document, Operation, Position, TextStyle, BlockType, Alignment, LineSpacing, TableCell, SetTableDataOp } from '../shared/model.js';
import { applyOperation, blockTextLength, blockToPlainText, createEmptyDocument, getTextInRange, generateBlockId, getIndentLevel, MAX_INDENT_LEVEL, createTableData, normalizeRuns } from '../shared/model.js';
import { uploadImage } from './api-client.js';
import type { CursorState } from '../shared/cursor.js';
import {
  collapsedCursor,
  isCollapsed,
  getSelectionRange,
  moveLeft,
  moveRight,
  moveUp,
  moveDown,
  moveToLineStart,
  moveToLineEnd,
  moveToDocStart,
  moveToDocEnd,
  selectAll,
} from '../shared/cursor.js';
import { HistoryManager } from '../shared/history.js';
import { renderDocument } from './renderer.js';
import { applyCursorToDOM, readCursorFromDOM, resolveDocumentPosition } from './cursor-renderer.js';

/** Check if a block type is a void/container block that doesn't use standard text editing */
function isVoidBlock(type: BlockType): boolean {
  return type === 'horizontal-rule' || type === 'image' || type === 'table';
}

export class Editor {
  public doc: Document;
  public cursor: CursorState;
  public history: HistoryManager;
  private container: HTMLElement;
  private rendering = false;
  private onUpdateCallbacks: Array<() => void> = [];
  private onOperationCallbacks: Array<(op: Operation) => void> = [];
  private onShortcutsPanelToggle: (() => void) | null = null;
  /** Currently focused table cell [row, col] or null if not in a table */
  private activeTableCell: { blockIndex: number; row: number; col: number } | null = null;

  constructor(container: HTMLElement, doc?: Document) {
    this.container = container;
    this.doc = doc || createEmptyDocument('new-doc', 'Untitled');
    this.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    this.history = new HistoryManager();

    this.container.setAttribute('contenteditable', 'true');
    this.container.setAttribute('spellcheck', 'false');
    this.container.style.outline = 'none';
    this.container.style.whiteSpace = 'pre-wrap';
    this.container.style.wordBreak = 'break-word';

    this.render();
    this.bindEvents();
  }

  private render(): void {
    this.rendering = true;
    renderDocument(this.doc, this.container);
    applyCursorToDOM(this.container, this.doc, this.cursor);
    this.highlightActiveTableCell();
    this.rendering = false;
    this.notifyUpdate();
  }

  /** Apply the active-cell CSS class to the currently active table cell */
  private highlightActiveTableCell(): void {
    // Remove all existing active cell highlights
    this.container.querySelectorAll('td.active-cell').forEach((el) => {
      el.classList.remove('active-cell');
    });
    if (!this.activeTableCell) return;
    const { blockIndex, row, col } = this.activeTableCell;
    const block = this.doc.blocks[blockIndex];
    if (!block || block.type !== 'table') return;
    const wrapper = this.container.querySelector(`.table-block[data-block-id="${block.id}"]`);
    if (!wrapper) return;
    const td = wrapper.querySelector(`td[data-row="${row}"][data-col="${col}"]`);
    if (td) td.classList.add('active-cell');
  }

  private notifyUpdate(): void {
    for (const cb of this.onUpdateCallbacks) {
      cb();
    }
  }

  /** Register a callback to be called when the editor state changes */
  onUpdate(callback: () => void): void {
    this.onUpdateCallbacks.push(callback);
  }

  /** Register a callback that fires when a local operation is applied */
  onOperation(callback: (op: Operation) => void): void {
    this.onOperationCallbacks.push(callback);
  }

  private notifyOperation(op: Operation): void {
    for (const cb of this.onOperationCallbacks) {
      cb(op);
    }
  }

  /** Apply an operation from a remote collaborator (no history push, no operation callback) */
  applyRemoteOperation(op: Operation): void {
    this.doc = applyOperation(this.doc, op);
    this.render();
  }

  /** Apply a local operation: update doc, notify operation listeners */
  private applyLocal(op: Operation): void {
    this.doc = applyOperation(this.doc, op);
    this.notifyOperation(op);
  }

  /** Update cursor in DOM and notify listeners */
  private updateCursor(): void {
    applyCursorToDOM(this.container, this.doc, this.cursor);
    this.notifyUpdate();
  }

  /** Focus the editor container */
  focus(): void {
    this.container.focus();
  }

  private bindEvents(): void {
    this.container.addEventListener('keydown', (e) => this.handleKeyDown(e));
    this.container.addEventListener('beforeinput', (e) => this.handleBeforeInput(e as InputEvent));
    this.container.addEventListener('mouseup', () => this.handleMouseUp());
    this.container.addEventListener('click', (e) => this.handleClick(e));
    this.container.addEventListener('copy', (e) => this.handleCopy(e));
    this.container.addEventListener('cut', (e) => this.handleCut(e));
    this.container.addEventListener('paste', (e) => this.handlePaste(e));
  }

  private handleClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;

    // Check if clicking a table cell
    const td = target.closest('td[data-row][data-col]') as HTMLElement | null;
    if (td) {
      const tableWrapper = td.closest('.table-block[data-block-id]') as HTMLElement | null;
      if (tableWrapper) {
        const blockId = tableWrapper.dataset.blockId;
        const blockIndex = this.doc.blocks.findIndex((b) => b.id === blockId);
        if (blockIndex >= 0) {
          const row = parseInt(td.dataset.row || '0', 10);
          const col = parseInt(td.dataset.col || '0', 10);
          this.setActiveTableCell(blockIndex, row, col);
          return;
        }
      }
    }

    // Check if clicking table control buttons
    const actionBtn = target.closest('[data-action]') as HTMLElement | null;
    if (actionBtn) {
      const tableWrapper = actionBtn.closest('.table-block[data-block-id]') as HTMLElement | null;
      if (tableWrapper) {
        const blockId = tableWrapper.dataset.blockId;
        const blockIndex = this.doc.blocks.findIndex((b) => b.id === blockId);
        if (blockIndex >= 0) {
          const action = actionBtn.dataset.action;
          if (action === 'add-row') {
            this.addTableRow(blockIndex);
          } else if (action === 'add-col') {
            this.addTableColumn(blockIndex);
          }
          return;
        }
      }
    }

    // Not clicking a table — clear active table cell
    this.clearActiveTableCell();
    this.syncCursorFromDOM();
  }

  private handleMouseUp(): void {
    this.syncCursorFromDOM();
  }

  private syncCursorFromDOM(): void {
    // Try to read cursor position immediately
    const newCursor = readCursorFromDOM(this.container, this.doc);
    if (newCursor) {
      this.cursor = newCursor;
      this.notifyUpdate();
    }
    // Also schedule a delayed read in case the browser hasn't finished positioning
    setTimeout(() => {
      const delayedCursor = readCursorFromDOM(this.container, this.doc);
      if (delayedCursor) {
        this.cursor = delayedCursor;
        this.notifyUpdate();
      }
    }, 0);
  }

  handleKeyDown(e: KeyboardEvent): void {
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;

    // Undo/Redo
    if (ctrl && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (shift) {
        this.redo();
      } else {
        this.undo();
      }
      return;
    }
    if (ctrl && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      this.redo();
      return;
    }

    // Formatting shortcuts
    if (ctrl && !shift) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          this.toggleFormatting({ bold: true });
          return;
        case 'i':
          e.preventDefault();
          this.toggleFormatting({ italic: true });
          return;
        case 'u':
          e.preventDefault();
          this.toggleFormatting({ underline: true });
          return;
        case 'd':
          e.preventDefault();
          this.toggleFormatting({ strikethrough: true });
          return;
        case '`':
          e.preventDefault();
          this.toggleFormatting({ code: true });
          return;
        case 'a':
          e.preventDefault();
          this.cursor = selectAll(this.doc);
          this.updateCursor();
          return;
        case '/':
          e.preventDefault();
          if (this.onShortcutsPanelToggle) {
            this.onShortcutsPanelToggle();
          }
          return;
      }
    }

    // Ctrl+Home / Ctrl+End
    if (ctrl && e.key === 'Home') {
      e.preventDefault();
      this.cursor = moveToDocStart(shift, this.cursor);
      this.updateCursor();
      return;
    }
    if (ctrl && e.key === 'End') {
      e.preventDefault();
      this.cursor = moveToDocEnd(this.doc, shift, this.cursor);
      this.updateCursor();
      return;
    }

    // Tab / Shift+Tab: table cell navigation or indent/outdent
    if (e.key === 'Tab') {
      e.preventDefault();
      if (this.activeTableCell) {
        this.navigateTableCell(shift ? 'prev' : 'next');
        return;
      }
      if (shift) {
        this.outdent();
      } else {
        this.indent();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        this.cursor = moveLeft(this.cursor, this.doc, shift);
        this.updateCursor();
        return;

      case 'ArrowRight':
        e.preventDefault();
        this.cursor = moveRight(this.cursor, this.doc, shift);
        this.updateCursor();
        return;

      case 'ArrowUp':
        e.preventDefault();
        this.cursor = moveUp(this.cursor, this.doc, shift);
        this.updateCursor();
        return;

      case 'ArrowDown':
        e.preventDefault();
        this.cursor = moveDown(this.cursor, this.doc, shift);
        this.updateCursor();
        return;

      case 'Home':
        e.preventDefault();
        this.cursor = moveToLineStart(this.cursor, shift);
        this.updateCursor();
        return;

      case 'End':
        e.preventDefault();
        this.cursor = moveToLineEnd(this.cursor, this.doc, shift);
        this.updateCursor();
        return;

      case 'Backspace':
        e.preventDefault();
        this.handleBackspace();
        return;

      case 'Delete':
        e.preventDefault();
        this.handleDelete();
        return;

      case 'Enter':
        e.preventDefault();
        this.handleEnter();
        return;
    }

    // For printable characters not handled above, insert them directly.
    // This handles cases where beforeinput doesn't fire (e.g., headless browsers).
    if (!ctrl && !e.altKey && e.key.length === 1) {
      e.preventDefault();
      // Block text input on void blocks (horizontal rules, images, tables)
      const block = this.doc.blocks[this.cursor.focus.blockIndex];
      if (block && isVoidBlock(block.type)) {
        // Tables handle their own text input via cell editing
        if (block.type === 'table' && this.activeTableCell) {
          this.insertTextInTableCell(e.key);
        }
        return;
      }
      this.insertText(e.key);
      return;
    }
  }

  handleBeforeInput(e: InputEvent): void {
    if (e.inputType === 'insertText' && e.data) {
      e.preventDefault();
      this.insertText(e.data);
    }
    // Other input types (insertParagraph, etc.) are handled by keydown
  }

  /** Get the selected text as plain text */
  getSelectedText(): string {
    if (isCollapsed(this.cursor)) return '';
    const range = getSelectionRange(this.cursor);
    return getTextInRange(this.doc, range);
  }

  private handleCopy(e: ClipboardEvent): void {
    if (isCollapsed(this.cursor)) return;
    e.preventDefault();
    const text = this.getSelectedText();
    e.clipboardData?.setData('text/plain', text);
  }

  private handleCut(e: ClipboardEvent): void {
    if (isCollapsed(this.cursor)) return;
    e.preventDefault();
    const text = this.getSelectedText();
    e.clipboardData?.setData('text/plain', text);

    this.pushHistory();
    this.deleteSelection();
    this.render();
  }

  private handlePaste(e: ClipboardEvent): void {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain');
    if (!text) return;
    this.pasteText(text);
  }

  /** Paste plain text, splitting on newlines to create new blocks */
  pasteText(text: string): void {
    this.pushHistory();

    // Delete selection if present
    if (!isCollapsed(this.cursor)) {
      this.deleteSelection();
    }

    const lines = text.split('\n');

    if (lines.length === 1) {
      // Single line paste — just insert text
      const op: Operation = {
        type: 'insert_text',
        position: { ...this.cursor.focus },
        text: lines[0],
      };
      this.applyLocal(op);
      this.cursor = collapsedCursor({
        blockIndex: this.cursor.focus.blockIndex,
        offset: this.cursor.focus.offset + lines[0].length,
      });
    } else {
      // Multi-line paste: insert first line, split, insert subsequent lines
      let currentBlockIndex = this.cursor.focus.blockIndex;
      let currentOffset = this.cursor.focus.offset;

      // Insert first line at current position
      if (lines[0].length > 0) {
        const op: Operation = {
          type: 'insert_text',
          position: { blockIndex: currentBlockIndex, offset: currentOffset },
          text: lines[0],
        };
        this.applyLocal(op);
        currentOffset += lines[0].length;
      }

      // For each subsequent line, split the block and insert text
      for (let i = 1; i < lines.length; i++) {
        const splitOp: Operation = {
          type: 'split_block',
          position: { blockIndex: currentBlockIndex, offset: currentOffset },
        };
        this.applyLocal(splitOp);
        currentBlockIndex++;
        currentOffset = 0;

        if (lines[i].length > 0) {
          const insertOp: Operation = {
            type: 'insert_text',
            position: { blockIndex: currentBlockIndex, offset: 0 },
            text: lines[i],
          };
          this.applyLocal(insertOp);
          currentOffset = lines[i].length;
        }
      }

      this.cursor = collapsedCursor({
        blockIndex: currentBlockIndex,
        offset: currentOffset,
      });
    }

    this.render();
  }

  private pushHistory(): void {
    this.history.push({ doc: this.doc, cursor: this.cursor });
  }

  undo(): void {
    const entry = this.history.undo({ doc: this.doc, cursor: this.cursor });
    if (entry) {
      this.doc = entry.doc;
      this.cursor = entry.cursor;
      this.render();
    }
  }

  redo(): void {
    const entry = this.history.redo({ doc: this.doc, cursor: this.cursor });
    if (entry) {
      this.doc = entry.doc;
      this.cursor = entry.cursor;
      this.render();
    }
  }

  insertText(text: string): void {
    this.pushHistory();

    // If there's a selection, delete it first
    if (!isCollapsed(this.cursor)) {
      this.deleteSelection();
    }

    const op: Operation = {
      type: 'insert_text',
      position: { ...this.cursor.focus },
      text,
    };
    this.applyLocal(op);

    // Move cursor forward by the inserted text length
    this.cursor = collapsedCursor({
      blockIndex: this.cursor.focus.blockIndex,
      offset: this.cursor.focus.offset + text.length,
    });

    this.render();
  }

  private handleBackspace(): void {
    this.pushHistory();

    if (!isCollapsed(this.cursor)) {
      this.deleteSelection();
      this.render();
      return;
    }

    const pos = this.cursor.focus;
    const currentBlock = this.doc.blocks[pos.blockIndex];

    // If current block is a table with active cell, handle backspace in cell
    if (currentBlock && currentBlock.type === 'table' && this.activeTableCell) {
      this.backspaceInTableCell();
      return;
    }

    // If current block is a void block (horizontal rule, image, table), delete it
    if (currentBlock && isVoidBlock(currentBlock.type)) {
      const deleteOp: Operation = {
        type: 'delete_block',
        blockIndex: pos.blockIndex,
      };
      this.applyLocal(deleteOp);
      if (pos.blockIndex > 0) {
        const prevBlockLen = blockTextLength(this.doc.blocks[pos.blockIndex - 1]);
        this.cursor = collapsedCursor({
          blockIndex: pos.blockIndex - 1,
          offset: prevBlockLen,
        });
      } else {
        this.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
      }
      this.render();
      return;
    }

    if (pos.offset > 0) {
      // Delete character before cursor
      const op: Operation = {
        type: 'delete_text',
        range: {
          start: { blockIndex: pos.blockIndex, offset: pos.offset - 1 },
          end: { blockIndex: pos.blockIndex, offset: pos.offset },
        },
      };
      this.applyLocal(op);
      this.cursor = collapsedCursor({
        blockIndex: pos.blockIndex,
        offset: pos.offset - 1,
      });
    } else if (pos.blockIndex > 0) {
      const prevBlock = this.doc.blocks[pos.blockIndex - 1];

      // If previous block is a void block (HR, image, table), delete it via operation
      if (isVoidBlock(prevBlock.type)) {
        const deleteOp: Operation = {
          type: 'delete_block',
          blockIndex: pos.blockIndex - 1,
        };
        this.applyLocal(deleteOp);
        this.cursor = collapsedCursor({
          blockIndex: pos.blockIndex - 1,
          offset: 0,
        });
      } else {
        // Normal merge with previous
        const prevBlockLen = blockTextLength(prevBlock);
        const op: Operation = {
          type: 'merge_block',
          blockIndex: pos.blockIndex,
        };
        this.applyLocal(op);
        this.cursor = collapsedCursor({
          blockIndex: pos.blockIndex - 1,
          offset: prevBlockLen,
        });
      }
    }

    this.render();
  }

  private handleDelete(): void {
    this.pushHistory();

    if (!isCollapsed(this.cursor)) {
      this.deleteSelection();
      this.render();
      return;
    }

    const pos = this.cursor.focus;
    const blockLen = blockTextLength(this.doc.blocks[pos.blockIndex]);

    if (pos.offset < blockLen) {
      // Delete character after cursor
      const op: Operation = {
        type: 'delete_text',
        range: {
          start: { blockIndex: pos.blockIndex, offset: pos.offset },
          end: { blockIndex: pos.blockIndex, offset: pos.offset + 1 },
        },
      };
      this.applyLocal(op);
      // Cursor stays in place
    } else if (pos.blockIndex < this.doc.blocks.length - 1) {
      // At end of block — merge next block into this one
      const op: Operation = {
        type: 'merge_block',
        blockIndex: pos.blockIndex + 1,
      };
      this.applyLocal(op);
      // Cursor stays in place
    }

    this.render();
  }

  private handleEnter(): void {
    this.pushHistory();

    // If there's a selection, delete it first
    if (!isCollapsed(this.cursor)) {
      this.deleteSelection();
    }

    const currentBlock = this.doc.blocks[this.cursor.focus.blockIndex];

    // Void blocks (HR, images, tables): Enter inserts a new paragraph after
    if (currentBlock && isVoidBlock(currentBlock.type)) {
      const op: Operation = {
        type: 'insert_block',
        afterBlockIndex: this.cursor.focus.blockIndex,
        blockType: 'paragraph',
      };
      this.applyLocal(op);
      this.cursor = collapsedCursor({
        blockIndex: this.cursor.focus.blockIndex + 1,
        offset: 0,
      });
      this.render();
      return;
    }

    const op: Operation = {
      type: 'split_block',
      position: { ...this.cursor.focus },
    };
    this.applyLocal(op);

    // Move cursor to start of new block
    this.cursor = collapsedCursor({
      blockIndex: this.cursor.focus.blockIndex + 1,
      offset: 0,
    });

    this.render();
  }

  private deleteSelection(): void {
    const range = getSelectionRange(this.cursor);
    const op: Operation = {
      type: 'delete_text',
      range,
    };
    this.applyLocal(op);
    this.cursor = collapsedCursor(range.start);
  }

  toggleFormatting(style: Partial<TextStyle>): void {
    if (isCollapsed(this.cursor)) return; // No selection to format

    this.pushHistory();

    const range = getSelectionRange(this.cursor);

    // Check if the selection already has this formatting
    // Simple approach: check the first character's style
    const hasFormatting = this.selectionHasFormatting(style);

    if (hasFormatting) {
      const op: Operation = {
        type: 'remove_formatting',
        range,
        style,
      };
      this.applyLocal(op);
    } else {
      const op: Operation = {
        type: 'apply_formatting',
        range,
        style,
      };
      this.applyLocal(op);
    }

    this.render();
  }

  private selectionHasFormatting(style: Partial<TextStyle>): boolean {
    const range = getSelectionRange(this.cursor);

    // Check the first run that overlaps with the selection start
    const block = this.doc.blocks[range.start.blockIndex];
    if (!block) return false;

    let offset = 0;
    for (const run of block.runs) {
      const runEnd = offset + run.text.length;
      if (runEnd > range.start.offset) {
        // This run overlaps with the selection start
        for (const [key, value] of Object.entries(style)) {
          if (value && !run.style[key as keyof TextStyle]) {
            return false;
          }
        }
        return true;
      }
      offset = runEnd;
    }

    return false;
  }

  /** Apply a font size to the current selection */
  applyFontSize(size: number | undefined): void {
    if (isCollapsed(this.cursor)) return;
    this.pushHistory();
    const range = getSelectionRange(this.cursor);
    if (size === undefined) {
      const op: Operation = { type: 'remove_formatting', range, style: { fontSize: 0 } };
      this.applyLocal(op);
    } else {
      const op: Operation = { type: 'apply_formatting', range, style: { fontSize: size } };
      this.applyLocal(op);
    }
    this.render();
  }

  /** Apply a text color to the current selection */
  applyColor(color: string | undefined): void {
    if (isCollapsed(this.cursor)) return;
    this.pushHistory();
    const range = getSelectionRange(this.cursor);
    if (color === undefined) {
      const op: Operation = { type: 'remove_formatting', range, style: { color: '' } };
      this.applyLocal(op);
    } else {
      const op: Operation = { type: 'apply_formatting', range, style: { color } };
      this.applyLocal(op);
    }
    this.render();
  }

  /** Apply a background/highlight color to the current selection */
  applyBackgroundColor(backgroundColor: string | undefined): void {
    if (isCollapsed(this.cursor)) return;
    this.pushHistory();
    const range = getSelectionRange(this.cursor);
    if (backgroundColor === undefined) {
      const op: Operation = { type: 'remove_formatting', range, style: { backgroundColor: '' } };
      this.applyLocal(op);
    } else {
      const op: Operation = { type: 'apply_formatting', range, style: { backgroundColor } };
      this.applyLocal(op);
    }
    this.render();
  }

  /** Get the active text color at cursor position (or undefined for default) */
  getActiveColor(): string | undefined {
    const formatting = this.getActiveFormatting();
    return formatting.color;
  }

  /** Get the active background color at cursor position (or undefined for default) */
  getActiveBackgroundColor(): string | undefined {
    const formatting = this.getActiveFormatting();
    return formatting.backgroundColor;
  }

  /** Apply a font family to the current selection */
  applyFontFamily(family: string | undefined): void {
    if (isCollapsed(this.cursor)) return;
    this.pushHistory();
    const range = getSelectionRange(this.cursor);
    if (family === undefined) {
      const op: Operation = { type: 'remove_formatting', range, style: { fontFamily: '' } };
      this.applyLocal(op);
    } else {
      const op: Operation = { type: 'apply_formatting', range, style: { fontFamily: family } };
      this.applyLocal(op);
    }
    this.render();
  }

  /** Get the active font size at cursor position (or undefined for default) */
  getActiveFontSize(): number | undefined {
    const formatting = this.getActiveFormatting();
    return formatting.fontSize;
  }

  /** Get the active font family at cursor position (or undefined for default) */
  getActiveFontFamily(): string | undefined {
    const formatting = this.getActiveFormatting();
    return formatting.fontFamily;
  }

  /** Change the block type of the block at the cursor */
  changeBlockType(newType: BlockType): void {
    this.pushHistory();
    const blockIndex = this.cursor.focus.blockIndex;
    const op: Operation = {
      type: 'change_block_type',
      blockIndex,
      newType,
    };
    this.applyLocal(op);
    this.render();
  }

  /** Insert a horizontal rule after the current block */
  insertHorizontalRule(): void {
    this.pushHistory();

    // If there's a selection, delete it first
    if (!isCollapsed(this.cursor)) {
      this.deleteSelection();
    }

    const blockIndex = this.cursor.focus.blockIndex;

    // Insert the HR block after the current block
    const insertOp: Operation = {
      type: 'insert_block',
      afterBlockIndex: blockIndex,
      blockType: 'horizontal-rule',
    };
    this.applyLocal(insertOp);

    // Insert a new paragraph after the HR for continued editing
    const paraOp: Operation = {
      type: 'insert_block',
      afterBlockIndex: blockIndex + 1,
      blockType: 'paragraph',
    };
    this.applyLocal(paraOp);

    // Move cursor to the new paragraph
    this.cursor = collapsedCursor({
      blockIndex: blockIndex + 2,
      offset: 0,
    });

    this.render();
  }

  /** Insert an image by opening a file picker, uploading, and creating an image block */
  insertImage(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/gif,image/webp';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      this.pushHistory();

      // If there's a selection, delete it first
      if (!isCollapsed(this.cursor)) {
        this.deleteSelection();
      }

      const blockIndex = this.cursor.focus.blockIndex;

      // Insert the image block after the current block
      const insertOp: Operation = {
        type: 'insert_block',
        afterBlockIndex: blockIndex,
        blockType: 'image',
      };
      this.applyLocal(insertOp);

      const imageBlockIndex = blockIndex + 1;

      // Insert a new paragraph after the image for continued editing
      const paraOp: Operation = {
        type: 'insert_block',
        afterBlockIndex: imageBlockIndex,
        blockType: 'paragraph',
      };
      this.applyLocal(paraOp);

      // Move cursor to the new paragraph
      this.cursor = collapsedCursor({
        blockIndex: imageBlockIndex + 1,
        offset: 0,
      });

      this.render();

      // Upload the file and set the image URL
      try {
        const result = await uploadImage(file);
        const setImageOp: Operation = {
          type: 'set_image',
          blockIndex: imageBlockIndex,
          imageUrl: result.url,
        };
        this.applyLocal(setImageOp);
        this.render();
      } catch {
        // Upload failed — remove the image block via operation
        if (this.doc.blocks[imageBlockIndex]?.type === 'image') {
          const deleteOp: Operation = {
            type: 'delete_block',
            blockIndex: imageBlockIndex,
          };
          this.applyLocal(deleteOp);
          this.cursor = collapsedCursor({
            blockIndex: Math.min(blockIndex, this.doc.blocks.length - 1),
            offset: 0,
          });
          this.render();
        }
      }
    };
    input.click();
  }

  /** Insert a table after the current block */
  insertTable(rows = 2, cols = 2): void {
    this.pushHistory();

    if (!isCollapsed(this.cursor)) {
      this.deleteSelection();
    }

    const blockIndex = this.cursor.focus.blockIndex;

    const insertOp: Operation = {
      type: 'insert_block',
      afterBlockIndex: blockIndex,
      blockType: 'table',
    };
    this.applyLocal(insertOp);

    const tableBlockIndex = blockIndex + 1;

    // If non-default dimensions, update the table data
    if (rows !== 2 || cols !== 2) {
      const tableData = createTableData(rows, cols);
      const setOp: Operation = {
        type: 'set_table_data',
        blockIndex: tableBlockIndex,
        tableData,
      };
      this.applyLocal(setOp);
    }

    // Insert a paragraph after the table
    const paraOp: Operation = {
      type: 'insert_block',
      afterBlockIndex: tableBlockIndex,
      blockType: 'paragraph',
    };
    this.applyLocal(paraOp);

    // Move cursor to the paragraph after the table
    this.cursor = collapsedCursor({
      blockIndex: tableBlockIndex + 1,
      offset: 0,
    });

    this.render();
  }

  /** Get the currently active table cell, if any */
  getActiveTableCell(): { blockIndex: number; row: number; col: number } | null {
    return this.activeTableCell;
  }

  /** Set the active table cell for editing */
  setActiveTableCell(blockIndex: number, row: number, col: number): void {
    const block = this.doc.blocks[blockIndex];
    if (!block || block.type !== 'table' || !block.tableData) return;
    if (row < 0 || row >= block.tableData.length) return;
    if (col < 0 || col >= block.tableData[0].length) return;
    this.activeTableCell = { blockIndex, row, col };
    this.cursor = collapsedCursor({ blockIndex, offset: 0 });
    this.render();
  }

  /** Clear active table cell (e.g. when clicking outside table) */
  clearActiveTableCell(): void {
    this.activeTableCell = null;
  }

  /** Insert text into the active table cell */
  private insertTextInTableCell(text: string): void {
    if (!this.activeTableCell) return;
    const { blockIndex, row, col } = this.activeTableCell;
    const block = this.doc.blocks[blockIndex];
    if (!block || !block.tableData) return;
    const cell = block.tableData[row]?.[col];
    if (!cell) return;

    this.pushHistory();

    // Clone the tableData and modify the target cell
    const newTableData = block.tableData.map((r) =>
      r.map((c) => ({ runs: c.runs.map((run) => ({ text: run.text, style: { ...run.style } })) }))
    );
    const targetCell = newTableData[row][col];
    // Append text to the last run (or the first empty run)
    const lastRun = targetCell.runs[targetCell.runs.length - 1];
    lastRun.text += text;

    const op: Operation = {
      type: 'set_table_data',
      blockIndex,
      tableData: newTableData,
    };
    this.applyLocal(op);
    this.render();
  }

  /** Handle backspace in the active table cell */
  private backspaceInTableCell(): void {
    if (!this.activeTableCell) return;
    const { blockIndex, row, col } = this.activeTableCell;
    const block = this.doc.blocks[blockIndex];
    if (!block || !block.tableData) return;
    const cell = block.tableData[row]?.[col];
    if (!cell) return;

    const totalText = cell.runs.reduce((s, r) => s + r.text, '');
    if (totalText.length === 0) return; // nothing to delete

    this.pushHistory();

    const newTableData = block.tableData.map((r) =>
      r.map((c) => ({ runs: c.runs.map((run) => ({ text: run.text, style: { ...run.style } })) }))
    );
    const targetCell = newTableData[row][col];
    // Remove last character from the last non-empty run
    for (let i = targetCell.runs.length - 1; i >= 0; i--) {
      if (targetCell.runs[i].text.length > 0) {
        targetCell.runs[i].text = targetCell.runs[i].text.slice(0, -1);
        break;
      }
    }
    // Normalize: remove empty runs, ensure at least one
    targetCell.runs = normalizeRuns(targetCell.runs);
    if (targetCell.runs.length === 0) {
      targetCell.runs = [{ text: '', style: {} }];
    }

    const op: Operation = {
      type: 'set_table_data',
      blockIndex,
      tableData: newTableData,
    };
    this.applyLocal(op);
    this.render();
  }

  /** Navigate to prev/next table cell */
  private navigateTableCell(direction: 'next' | 'prev'): void {
    if (!this.activeTableCell) return;
    const { blockIndex, row, col } = this.activeTableCell;
    const block = this.doc.blocks[blockIndex];
    if (!block || !block.tableData) return;

    const rowCount = block.tableData.length;
    const colCount = block.tableData[0].length;

    if (direction === 'next') {
      if (col < colCount - 1) {
        this.setActiveTableCell(blockIndex, row, col + 1);
      } else if (row < rowCount - 1) {
        this.setActiveTableCell(blockIndex, row + 1, 0);
      }
      // At last cell, do nothing
    } else {
      if (col > 0) {
        this.setActiveTableCell(blockIndex, row, col - 1);
      } else if (row > 0) {
        this.setActiveTableCell(blockIndex, row - 1, colCount - 1);
      }
      // At first cell, do nothing
    }
  }

  /** Add a row to a table */
  addTableRow(blockIndex: number): void {
    const block = this.doc.blocks[blockIndex];
    if (!block || block.type !== 'table' || !block.tableData) return;
    const colCount = block.tableData[0]?.length || 2;

    this.pushHistory();
    const newTableData = block.tableData.map((r) =>
      r.map((c) => ({ runs: c.runs.map((run) => ({ text: run.text, style: { ...run.style } })) }))
    );
    const newRow: TableCell[] = [];
    for (let c = 0; c < colCount; c++) {
      newRow.push({ runs: [{ text: '', style: {} }] });
    }
    newTableData.push(newRow);

    const op: Operation = {
      type: 'set_table_data',
      blockIndex,
      tableData: newTableData,
    };
    this.applyLocal(op);
    this.render();
  }

  /** Add a column to a table */
  addTableColumn(blockIndex: number): void {
    const block = this.doc.blocks[blockIndex];
    if (!block || block.type !== 'table' || !block.tableData) return;

    this.pushHistory();
    const newTableData = block.tableData.map((r) => {
      const newRow = r.map((c) => ({ runs: c.runs.map((run) => ({ text: run.text, style: { ...run.style } })) }));
      newRow.push({ runs: [{ text: '', style: {} }] });
      return newRow;
    });

    const op: Operation = {
      type: 'set_table_data',
      blockIndex,
      tableData: newTableData,
    };
    this.applyLocal(op);
    this.render();
  }

  /** Remove a row from a table (minimum 1 row) */
  removeTableRow(blockIndex: number, rowIndex: number): void {
    const block = this.doc.blocks[blockIndex];
    if (!block || block.type !== 'table' || !block.tableData) return;
    if (block.tableData.length <= 1) return;

    this.pushHistory();
    const newTableData = block.tableData
      .filter((_, i) => i !== rowIndex)
      .map((r) => r.map((c) => ({ runs: c.runs.map((run) => ({ text: run.text, style: { ...run.style } })) })));

    const op: Operation = {
      type: 'set_table_data',
      blockIndex,
      tableData: newTableData,
    };
    this.applyLocal(op);
    if (this.activeTableCell && this.activeTableCell.blockIndex === blockIndex) {
      if (this.activeTableCell.row >= newTableData.length) {
        this.activeTableCell.row = newTableData.length - 1;
      }
    }
    this.render();
  }

  /** Remove a column from a table (minimum 1 column) */
  removeTableColumn(blockIndex: number, colIndex: number): void {
    const block = this.doc.blocks[blockIndex];
    if (!block || block.type !== 'table' || !block.tableData) return;
    if (block.tableData[0].length <= 1) return;

    this.pushHistory();
    const newTableData = block.tableData.map((r) =>
      r.filter((_, i) => i !== colIndex)
        .map((c) => ({ runs: c.runs.map((run) => ({ text: run.text, style: { ...run.style } })) }))
    );

    const op: Operation = {
      type: 'set_table_data',
      blockIndex,
      tableData: newTableData,
    };
    this.applyLocal(op);
    if (this.activeTableCell && this.activeTableCell.blockIndex === blockIndex) {
      if (this.activeTableCell.col >= newTableData[0].length) {
        this.activeTableCell.col = newTableData[0].length - 1;
      }
    }
    this.render();
  }

  /** Change the alignment of the block at the cursor */
  changeAlignment(newAlignment: Alignment): void {
    this.pushHistory();
    const blockIndex = this.cursor.focus.blockIndex;
    const op: Operation = {
      type: 'change_block_alignment',
      blockIndex,
      newAlignment,
    };
    this.applyLocal(op);
    this.render();
  }

  /** Indent the current block by one level */
  indent(): void {
    const blockIndex = this.cursor.focus.blockIndex;
    const block = this.doc.blocks[blockIndex];
    if (!block) return;
    const current = getIndentLevel(block);
    if (current >= MAX_INDENT_LEVEL) return;

    this.pushHistory();
    const op: Operation = {
      type: 'set_indent',
      blockIndex,
      indentLevel: current + 1,
    };
    this.applyLocal(op);
    this.render();
  }

  /** Outdent the current block by one level */
  outdent(): void {
    const blockIndex = this.cursor.focus.blockIndex;
    const block = this.doc.blocks[blockIndex];
    if (!block) return;
    const current = getIndentLevel(block);
    if (current <= 0) return;

    this.pushHistory();
    const op: Operation = {
      type: 'set_indent',
      blockIndex,
      indentLevel: current - 1,
    };
    this.applyLocal(op);
    this.render();
  }

  /** Get the indent level of the current block */
  getActiveIndentLevel(): number {
    const block = this.doc.blocks[this.cursor.focus.blockIndex];
    return block ? getIndentLevel(block) : 0;
  }

  /** Set the line spacing of the current block */
  setLineSpacing(lineSpacing: LineSpacing): void {
    const blockIndex = this.cursor.focus.blockIndex;
    const block = this.doc.blocks[blockIndex];
    if (!block) return;

    this.pushHistory();
    const op: Operation = {
      type: 'set_line_spacing',
      blockIndex,
      lineSpacing,
    };
    this.applyLocal(op);
    this.render();
  }

  /** Get the line spacing of the current block (undefined means default) */
  getActiveLineSpacing(): LineSpacing | undefined {
    const block = this.doc.blocks[this.cursor.focus.blockIndex];
    return block?.lineSpacing;
  }

  /** Get the current formatting state at cursor/selection for toolbar display */
  getActiveFormatting(): TextStyle {
    // When there's a selection, use the anchor position (where selection started)
    // to determine formatting — this better reflects the selected content's style
    const pos = isCollapsed(this.cursor) ? this.cursor.focus : this.cursor.anchor;
    const block = this.doc.blocks[pos.blockIndex];
    if (!block) return {};

    // Find style at the position
    let offset = 0;
    for (const run of block.runs) {
      const runEnd = offset + run.text.length;
      if (pos.offset <= runEnd && pos.offset >= offset) {
        // At a boundary, prefer the run before the cursor (left-biased)
        if (pos.offset === offset && offset > 0) {
          continue;
        }
        return { ...run.style };
      }
      offset = runEnd;
    }
    // Fallback: use last run's style
    if (block.runs.length > 0) {
      return { ...block.runs[block.runs.length - 1].style };
    }
    return {};
  }

  /** Get the block type of the current block */
  getActiveBlockType(): BlockType {
    const block = this.doc.blocks[this.cursor.focus.blockIndex];
    return block ? block.type : 'paragraph';
  }

  /** Get the alignment of the current block */
  getActiveAlignment(): Alignment {
    const block = this.doc.blocks[this.cursor.focus.blockIndex];
    return block ? block.alignment : 'left';
  }

  /** Get the editor container element */
  getContainer(): HTMLElement {
    return this.container;
  }

  /** Get the current document (for external use) */
  getDocument(): Document {
    return this.doc;
  }

  /** Get the current cursor state (for external use) */
  getCursor(): CursorState {
    return this.cursor;
  }

  /** Register a callback for when the shortcuts panel toggle is requested (Ctrl+/) */
  onShortcutsToggle(callback: () => void): void {
    this.onShortcutsPanelToggle = callback;
  }

  /** Set the document and re-render */
  setDocument(doc: Document): void {
    this.doc = doc;
    this.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    this.render();
  }
}
