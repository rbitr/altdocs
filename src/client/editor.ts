import type { Document, Operation, Position, TextStyle, BlockType, Alignment } from '../shared/model.js';
import { applyOperation, blockTextLength, blockToPlainText, createEmptyDocument, getTextInRange } from '../shared/model.js';
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

export class Editor {
  public doc: Document;
  public cursor: CursorState;
  public history: HistoryManager;
  private container: HTMLElement;
  private rendering = false;
  private onUpdateCallbacks: Array<() => void> = [];

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
    this.rendering = false;
    this.notifyUpdate();
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
        case 'a':
          e.preventDefault();
          this.cursor = selectAll(this.doc);
          this.updateCursor();
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
      this.doc = applyOperation(this.doc, op);
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
        this.doc = applyOperation(this.doc, op);
        currentOffset += lines[0].length;
      }

      // For each subsequent line, split the block and insert text
      for (let i = 1; i < lines.length; i++) {
        const splitOp: Operation = {
          type: 'split_block',
          position: { blockIndex: currentBlockIndex, offset: currentOffset },
        };
        this.doc = applyOperation(this.doc, splitOp);
        currentBlockIndex++;
        currentOffset = 0;

        if (lines[i].length > 0) {
          const insertOp: Operation = {
            type: 'insert_text',
            position: { blockIndex: currentBlockIndex, offset: 0 },
            text: lines[i],
          };
          this.doc = applyOperation(this.doc, insertOp);
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
    this.doc = applyOperation(this.doc, op);

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

    if (pos.offset > 0) {
      // Delete character before cursor
      const op: Operation = {
        type: 'delete_text',
        range: {
          start: { blockIndex: pos.blockIndex, offset: pos.offset - 1 },
          end: { blockIndex: pos.blockIndex, offset: pos.offset },
        },
      };
      this.doc = applyOperation(this.doc, op);
      this.cursor = collapsedCursor({
        blockIndex: pos.blockIndex,
        offset: pos.offset - 1,
      });
    } else if (pos.blockIndex > 0) {
      // At start of block — merge with previous
      const prevBlockLen = blockTextLength(this.doc.blocks[pos.blockIndex - 1]);
      const op: Operation = {
        type: 'merge_block',
        blockIndex: pos.blockIndex,
      };
      this.doc = applyOperation(this.doc, op);
      this.cursor = collapsedCursor({
        blockIndex: pos.blockIndex - 1,
        offset: prevBlockLen,
      });
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
      this.doc = applyOperation(this.doc, op);
      // Cursor stays in place
    } else if (pos.blockIndex < this.doc.blocks.length - 1) {
      // At end of block — merge next block into this one
      const op: Operation = {
        type: 'merge_block',
        blockIndex: pos.blockIndex + 1,
      };
      this.doc = applyOperation(this.doc, op);
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

    const op: Operation = {
      type: 'split_block',
      position: { ...this.cursor.focus },
    };
    this.doc = applyOperation(this.doc, op);

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
    this.doc = applyOperation(this.doc, op);
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
      this.doc = applyOperation(this.doc, op);
    } else {
      const op: Operation = {
        type: 'apply_formatting',
        range,
        style,
      };
      this.doc = applyOperation(this.doc, op);
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

  /** Change the block type of the block at the cursor */
  changeBlockType(newType: BlockType): void {
    this.pushHistory();
    const blockIndex = this.cursor.focus.blockIndex;
    const op: Operation = {
      type: 'change_block_type',
      blockIndex,
      newType,
    };
    this.doc = applyOperation(this.doc, op);
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
    this.doc = applyOperation(this.doc, op);
    this.render();
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

  /** Set the document and re-render */
  setDocument(doc: Document): void {
    this.doc = doc;
    this.cursor = collapsedCursor({ blockIndex: 0, offset: 0 });
    this.render();
  }
}
