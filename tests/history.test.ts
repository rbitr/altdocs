import { describe, it, expect, beforeEach } from 'vitest';
import { HistoryManager } from '../src/shared/history.js';
import type { Document, Block } from '../src/shared/model.js';
import { collapsedCursor } from '../src/shared/cursor.js';

function makeDoc(text: string): Document {
  return {
    id: 'test',
    title: 'Test',
    blocks: [
      {
        id: 'b1',
        type: 'paragraph',
        alignment: 'left',
        runs: [{ text, style: {} }],
      },
    ],
  };
}

function makeEntry(text: string) {
  return {
    doc: makeDoc(text),
    cursor: collapsedCursor({ blockIndex: 0, offset: text.length }),
  };
}

describe('HistoryManager', () => {
  let history: HistoryManager;

  beforeEach(() => {
    history = new HistoryManager();
  });

  describe('basic operations', () => {
    it('starts with empty stacks', () => {
      expect(history.canUndo()).toBe(false);
      expect(history.canRedo()).toBe(false);
      expect(history.undoDepth()).toBe(0);
      expect(history.redoDepth()).toBe(0);
    });

    it('push adds to undo stack', () => {
      history.push(makeEntry('hello'));
      expect(history.canUndo()).toBe(true);
      expect(history.undoDepth()).toBe(1);
    });

    it('push clears redo stack', () => {
      history.push(makeEntry('v1'));
      history.push(makeEntry('v2'));

      // Undo to create a redo entry
      history.undo(makeEntry('v3'));
      expect(history.canRedo()).toBe(true);

      // Push clears redo
      history.push(makeEntry('v4'));
      expect(history.canRedo()).toBe(false);
    });
  });

  describe('undo', () => {
    it('returns null when nothing to undo', () => {
      const result = history.undo(makeEntry('current'));
      expect(result).toBeNull();
    });

    it('returns previous state', () => {
      history.push(makeEntry('hello'));
      const result = history.undo(makeEntry('hello world'));

      expect(result).not.toBeNull();
      expect(result!.doc.blocks[0].runs[0].text).toBe('hello');
    });

    it('pushes current state to redo stack', () => {
      history.push(makeEntry('v1'));
      history.undo(makeEntry('v2'));

      expect(history.canRedo()).toBe(true);
      expect(history.redoDepth()).toBe(1);
    });

    it('can undo multiple times', () => {
      history.push(makeEntry('v1'));
      history.push(makeEntry('v2'));
      history.push(makeEntry('v3'));

      let result = history.undo(makeEntry('v4'));
      expect(result!.doc.blocks[0].runs[0].text).toBe('v3');

      result = history.undo(makeEntry('v3'));
      expect(result!.doc.blocks[0].runs[0].text).toBe('v2');

      result = history.undo(makeEntry('v2'));
      expect(result!.doc.blocks[0].runs[0].text).toBe('v1');

      result = history.undo(makeEntry('v1'));
      expect(result).toBeNull();
    });
  });

  describe('redo', () => {
    it('returns null when nothing to redo', () => {
      const result = history.redo(makeEntry('current'));
      expect(result).toBeNull();
    });

    it('returns the state that was undone', () => {
      history.push(makeEntry('v1'));
      history.undo(makeEntry('v2'));

      const result = history.redo(makeEntry('v1'));
      expect(result).not.toBeNull();
      expect(result!.doc.blocks[0].runs[0].text).toBe('v2');
    });

    it('pushes current state back to undo stack', () => {
      history.push(makeEntry('v1'));
      history.undo(makeEntry('v2'));
      expect(history.undoDepth()).toBe(0);

      history.redo(makeEntry('v1'));
      expect(history.undoDepth()).toBe(1);
    });

    it('can redo multiple times', () => {
      history.push(makeEntry('v1'));
      history.push(makeEntry('v2'));
      history.push(makeEntry('v3'));

      // Undo 3 times
      history.undo(makeEntry('v4'));
      history.undo(makeEntry('v3'));
      history.undo(makeEntry('v2'));

      // Redo 3 times
      let result = history.redo(makeEntry('v1'));
      expect(result!.doc.blocks[0].runs[0].text).toBe('v2');

      result = history.redo(makeEntry('v2'));
      expect(result!.doc.blocks[0].runs[0].text).toBe('v3');

      result = history.redo(makeEntry('v3'));
      expect(result!.doc.blocks[0].runs[0].text).toBe('v4');

      result = history.redo(makeEntry('v4'));
      expect(result).toBeNull();
    });
  });

  describe('max depth', () => {
    it('enforces max depth', () => {
      const smallHistory = new HistoryManager(3);

      smallHistory.push(makeEntry('v1'));
      smallHistory.push(makeEntry('v2'));
      smallHistory.push(makeEntry('v3'));
      smallHistory.push(makeEntry('v4')); // Should evict v1

      expect(smallHistory.undoDepth()).toBe(3);

      // Undo 3 times — should get v4, v3, v2 (v1 was evicted)
      let result = smallHistory.undo(makeEntry('v5'));
      expect(result!.doc.blocks[0].runs[0].text).toBe('v4');

      result = smallHistory.undo(makeEntry('v4'));
      expect(result!.doc.blocks[0].runs[0].text).toBe('v3');

      result = smallHistory.undo(makeEntry('v3'));
      expect(result!.doc.blocks[0].runs[0].text).toBe('v2');

      result = smallHistory.undo(makeEntry('v2'));
      expect(result).toBeNull();
    });
  });

  describe('clear', () => {
    it('clears both stacks', () => {
      history.push(makeEntry('v1'));
      history.push(makeEntry('v2'));
      history.undo(makeEntry('v3'));

      history.clear();
      expect(history.canUndo()).toBe(false);
      expect(history.canRedo()).toBe(false);
    });
  });

  describe('immutability', () => {
    it('does not share references between stored entries', () => {
      const entry = makeEntry('hello');
      history.push(entry);

      // Mutate the original entry
      entry.doc.blocks[0].runs[0].text = 'MUTATED';

      // The stored entry should not be affected
      const result = history.undo(makeEntry('current'));
      expect(result!.doc.blocks[0].runs[0].text).toBe('hello');
    });

    it('undo result is independent from stored state', () => {
      history.push(makeEntry('v1'));
      history.push(makeEntry('v2'));

      const result = history.undo(makeEntry('v3'));
      result!.doc.blocks[0].runs[0].text = 'MUTATED';

      // Redo should give us v3, not affected by mutation
      const redoResult = history.redo(makeEntry('v1'));
      expect(redoResult!.doc.blocks[0].runs[0].text).toBe('v3');
    });
  });
});
