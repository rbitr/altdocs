import type { Document } from './model.js';
import type { CursorState } from './cursor.js';

export interface HistoryEntry {
  doc: Document;
  cursor: CursorState;
}

export class HistoryManager {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private maxDepth: number;

  constructor(maxDepth: number = 200) {
    this.maxDepth = maxDepth;
  }

  /** Push a new state onto the undo stack. Clears redo stack. */
  push(entry: HistoryEntry): void {
    this.undoStack.push(this.cloneEntry(entry));
    this.redoStack = [];

    // Enforce max depth
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
  }

  /** Undo: pop from undo stack, push current state to redo stack, return previous state */
  undo(current: HistoryEntry): HistoryEntry | null {
    if (this.undoStack.length === 0) return null;

    this.redoStack.push(this.cloneEntry(current));
    return this.cloneEntry(this.undoStack.pop()!);
  }

  /** Redo: pop from redo stack, push current state to undo stack, return next state */
  redo(current: HistoryEntry): HistoryEntry | null {
    if (this.redoStack.length === 0) return null;

    this.undoStack.push(this.cloneEntry(current));
    return this.cloneEntry(this.redoStack.pop()!);
  }

  /** Check if undo is possible */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /** Check if redo is possible */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Get the current undo stack depth */
  undoDepth(): number {
    return this.undoStack.length;
  }

  /** Get the current redo stack depth */
  redoDepth(): number {
    return this.redoStack.length;
  }

  /** Clear all history */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  private cloneEntry(entry: HistoryEntry): HistoryEntry {
    return {
      doc: JSON.parse(JSON.stringify(entry.doc)),
      cursor: JSON.parse(JSON.stringify(entry.cursor)),
    };
  }
}
