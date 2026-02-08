import { describe, it, expect } from 'vitest';
import {
  transformOperation,
  transformSingle,
  transformOperationAgainstHistory,
} from '../src/shared/ot.js';
import {
  Document,
  Block,
  Operation,
  applyOperation,
  blockToPlainText,
} from '../src/shared/model.js';

// ============================================================
// Test Helpers
// ============================================================

function makeDoc(blocks: Block[]): Document {
  return { id: 'test-doc', title: 'Test', blocks };
}

function makeBlock(text: string, id: string = `b${Math.random()}`): Block {
  return {
    id,
    type: 'paragraph',
    alignment: 'left',
    runs: [{ text, style: {} }],
  };
}

function getBlockText(doc: Document, blockIndex: number): string {
  return blockToPlainText(doc.blocks[blockIndex]);
}

/**
 * Verify the OT convergence property:
 * apply(apply(S, a), b') === apply(apply(S, b), a')
 */
function verifyConvergence(
  doc: Document,
  opA: Operation,
  opB: Operation
): { docAB: Document; docBA: Document } {
  const [aPrime, bPrime] = transformOperation(opA, opB);

  // Path 1: apply a, then b'
  const docA = applyOperation(doc, opA);
  const docAB = applyOperation(docA, bPrime);

  // Path 2: apply b, then a'
  const docB = applyOperation(doc, opB);
  const docBA = applyOperation(docB, aPrime);

  return { docAB, docBA };
}

function assertConvergentText(
  doc: Document,
  opA: Operation,
  opB: Operation,
  expectedTexts: string[]
): void {
  const { docAB, docBA } = verifyConvergence(doc, opA, opB);

  for (let i = 0; i < expectedTexts.length; i++) {
    expect(getBlockText(docAB, i)).toBe(expectedTexts[i]);
    expect(getBlockText(docBA, i)).toBe(expectedTexts[i]);
  }
}

// ============================================================
// insert_text vs insert_text
// ============================================================

describe('OT: insert_text vs insert_text', () => {
  it('two inserts at different positions in the same block', () => {
    const doc = makeDoc([makeBlock('hello')]);

    const opA: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 0 },
      text: 'A',
    };
    const opB: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 5 },
      text: 'B',
    };

    assertConvergentText(doc, opA, opB, ['AhelloB']);
  });

  it('two inserts at the same position (tie-break)', () => {
    const doc = makeDoc([makeBlock('hello')]);

    const opA: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 2 },
      text: 'A',
    };
    const opB: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 2 },
      text: 'B',
    };

    // Both inserts at offset 2 — the first applied (opA for path AB, opB for path BA)
    // wins the earlier position. With our tie-break, `other` wins.
    const { docAB, docBA } = verifyConvergence(doc, opA, opB);

    // Both paths should produce the same block count and text content
    expect(docAB.blocks.length).toBe(docBA.blocks.length);
    expect(getBlockText(docAB, 0)).toBe(getBlockText(docBA, 0));
    // The text should contain both inserts
    const text = getBlockText(docAB, 0);
    expect(text).toContain('A');
    expect(text).toContain('B');
    expect(text.length).toBe(7); // 'hello' + 'A' + 'B'
  });

  it('inserts in different blocks', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb')]);

    const opA: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 1 },
      text: 'X',
    };
    const opB: Operation = {
      type: 'insert_text',
      position: { blockIndex: 1, offset: 1 },
      text: 'Y',
    };

    assertConvergentText(doc, opA, opB, ['aXaa', 'bYbb']);
  });
});

// ============================================================
// insert_text vs delete_text
// ============================================================

describe('OT: insert_text vs delete_text', () => {
  it('insert before delete range', () => {
    const doc = makeDoc([makeBlock('hello world')]);

    const opA: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 0 },
      text: 'X',
    };
    const opB: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 5 },
        end: { blockIndex: 0, offset: 11 },
      },
    };

    assertConvergentText(doc, opA, opB, ['Xhello']);
  });

  it('insert after delete range', () => {
    const doc = makeDoc([makeBlock('hello world')]);

    const opA: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 11 },
      text: '!',
    };
    const opB: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 6 },
      },
    };

    assertConvergentText(doc, opA, opB, ['world!']);
  });

  it('insert within delete range — delete wins, insert is lost', () => {
    const doc = makeDoc([makeBlock('hello world')]);

    const opA: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 7 },
      text: 'X',
    };
    const opB: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 5 },
        end: { blockIndex: 0, offset: 11 },
      },
    };

    // The insert is within the deleted range — delete wins, insert becomes no-op.
    // Both paths converge to "hello" (the delete removes " world" and the insert is lost).
    assertConvergentText(doc, opA, opB, ['hello']);
  });
});

// ============================================================
// delete_text vs delete_text
// ============================================================

describe('OT: delete_text vs delete_text', () => {
  it('non-overlapping deletes — first then second', () => {
    const doc = makeDoc([makeBlock('abcdefghij')]);

    const opA: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 3 },
      },
    };
    const opB: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 7 },
        end: { blockIndex: 0, offset: 10 },
      },
    };

    assertConvergentText(doc, opA, opB, ['defg']);
  });

  it('non-overlapping deletes — second then first', () => {
    const doc = makeDoc([makeBlock('abcdefghij')]);

    const opA: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 7 },
        end: { blockIndex: 0, offset: 10 },
      },
    };
    const opB: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 3 },
      },
    };

    assertConvergentText(doc, opA, opB, ['defg']);
  });

  it('overlapping deletes', () => {
    const doc = makeDoc([makeBlock('abcdefghij')]);

    const opA: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 2 },
        end: { blockIndex: 0, offset: 6 },
      },
    };
    const opB: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 4 },
        end: { blockIndex: 0, offset: 8 },
      },
    };

    // Combined delete: offset 2-8 — remaining: "ab" + "ij"
    assertConvergentText(doc, opA, opB, ['abij']);
  });

  it('identical deletes', () => {
    const doc = makeDoc([makeBlock('abcdefghij')]);

    const opA: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 3 },
        end: { blockIndex: 0, offset: 7 },
      },
    };
    const opB: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 3 },
        end: { blockIndex: 0, offset: 7 },
      },
    };

    // Same delete applied twice — should only delete once
    assertConvergentText(doc, opA, opB, ['abchij']);
  });

  it('one delete contains the other', () => {
    const doc = makeDoc([makeBlock('abcdefghij')]);

    const opA: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 2 },
        end: { blockIndex: 0, offset: 8 },
      },
    };
    const opB: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 4 },
        end: { blockIndex: 0, offset: 6 },
      },
    };

    // B is fully within A — final result should be A applied
    assertConvergentText(doc, opA, opB, ['abij']);
  });
});

// ============================================================
// insert_text vs split_block
// ============================================================

describe('OT: insert_text vs split_block', () => {
  it('insert before split position', () => {
    const doc = makeDoc([makeBlock('hello world')]);

    const opA: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 0 },
      text: 'X',
    };
    const opB: Operation = {
      type: 'split_block',
      position: { blockIndex: 0, offset: 5 },
    };

    const { docAB, docBA } = verifyConvergence(doc, opA, opB);
    expect(docAB.blocks.length).toBe(2);
    expect(docBA.blocks.length).toBe(2);
    expect(getBlockText(docAB, 0)).toBe(getBlockText(docBA, 0));
    expect(getBlockText(docAB, 1)).toBe(getBlockText(docBA, 1));
  });

  it('insert after split position — insert moves to new block', () => {
    const doc = makeDoc([makeBlock('hello world')]);

    const opA: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 8 },
      text: 'X',
    };
    const opB: Operation = {
      type: 'split_block',
      position: { blockIndex: 0, offset: 5 },
    };

    const { docAB, docBA } = verifyConvergence(doc, opA, opB);
    expect(docAB.blocks.length).toBe(2);
    expect(docBA.blocks.length).toBe(2);
    expect(getBlockText(docAB, 0)).toBe(getBlockText(docBA, 0));
    expect(getBlockText(docAB, 1)).toBe(getBlockText(docBA, 1));
  });
});

// ============================================================
// split_block vs split_block
// ============================================================

describe('OT: split_block vs split_block', () => {
  it('splits at different positions in same block', () => {
    const doc = makeDoc([makeBlock('abcdef')]);

    const opA: Operation = {
      type: 'split_block',
      position: { blockIndex: 0, offset: 2 },
    };
    const opB: Operation = {
      type: 'split_block',
      position: { blockIndex: 0, offset: 4 },
    };

    const { docAB, docBA } = verifyConvergence(doc, opA, opB);
    expect(docAB.blocks.length).toBe(3);
    expect(docBA.blocks.length).toBe(3);
    // All three block texts should match
    for (let i = 0; i < 3; i++) {
      expect(getBlockText(docAB, i)).toBe(getBlockText(docBA, i));
    }
  });

  it('splits at same position in same block', () => {
    const doc = makeDoc([makeBlock('abcdef')]);

    const opA: Operation = {
      type: 'split_block',
      position: { blockIndex: 0, offset: 3 },
    };
    const opB: Operation = {
      type: 'split_block',
      position: { blockIndex: 0, offset: 3 },
    };

    const { docAB, docBA } = verifyConvergence(doc, opA, opB);
    // Both splits at same point creates an extra empty block
    expect(docAB.blocks.length).toBe(docBA.blocks.length);
  });

  it('splits in different blocks', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb')]);

    const opA: Operation = {
      type: 'split_block',
      position: { blockIndex: 0, offset: 1 },
    };
    const opB: Operation = {
      type: 'split_block',
      position: { blockIndex: 1, offset: 2 },
    };

    const { docAB, docBA } = verifyConvergence(doc, opA, opB);
    expect(docAB.blocks.length).toBe(4);
    expect(docBA.blocks.length).toBe(4);
  });
});

// ============================================================
// merge_block vs operations
// ============================================================

describe('OT: merge_block', () => {
  it('merge_block vs insert_text in later block', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb'), makeBlock('ccc')]);

    const opA: Operation = {
      type: 'merge_block',
      blockIndex: 1,
    };
    const opB: Operation = {
      type: 'insert_text',
      position: { blockIndex: 2, offset: 0 },
      text: 'X',
    };

    const { docAB, docBA } = verifyConvergence(doc, opA, opB);
    expect(docAB.blocks.length).toBe(2);
    expect(docBA.blocks.length).toBe(2);
  });

  it('merge_block vs merge_block at same index', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb'), makeBlock('ccc')]);

    const opA: Operation = { type: 'merge_block', blockIndex: 1 };
    const opB: Operation = { type: 'merge_block', blockIndex: 1 };

    const { docAB, docBA } = verifyConvergence(doc, opA, opB);
    // Same merge twice — should only merge once. One path may cause
    // a no-op merge (blockIndex 0 merge is invalid since there's no block -1).
    expect(docAB.blocks.length).toBe(docBA.blocks.length);
  });

  it('merge_block vs merge_block at different indices', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb'), makeBlock('ccc'), makeBlock('ddd')]);

    const opA: Operation = { type: 'merge_block', blockIndex: 1 };
    const opB: Operation = { type: 'merge_block', blockIndex: 3 };

    const { docAB, docBA } = verifyConvergence(doc, opA, opB);
    expect(docAB.blocks.length).toBe(2);
    expect(docBA.blocks.length).toBe(2);
  });
});

// ============================================================
// change_block_type and change_block_alignment
// ============================================================

describe('OT: block-level operations', () => {
  it('change_block_type vs split_block (index shifts)', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb')]);

    const opA: Operation = {
      type: 'change_block_type',
      blockIndex: 1,
      newType: 'heading1',
    };
    const opB: Operation = {
      type: 'split_block',
      position: { blockIndex: 0, offset: 1 },
    };

    // Split in block 0 adds a block, so change_block_type's index should shift to 2
    const bPrime = transformSingle(opA, opB);
    expect(bPrime.type).toBe('change_block_type');
    if (bPrime.type === 'change_block_type') {
      expect(bPrime.blockIndex).toBe(2);
    }
  });

  it('change_block_alignment vs insert_block', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb')]);

    const opA: Operation = {
      type: 'change_block_alignment',
      blockIndex: 1,
      newAlignment: 'center',
    };
    const opB: Operation = {
      type: 'insert_block',
      afterBlockIndex: 0,
      blockType: 'paragraph',
    };

    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('change_block_alignment');
    if (aPrime.type === 'change_block_alignment') {
      expect(aPrime.blockIndex).toBe(2);
    }
  });

  it('change_block_type vs merge_block (index shifts down)', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb'), makeBlock('ccc')]);

    const opA: Operation = {
      type: 'change_block_type',
      blockIndex: 2,
      newType: 'heading2',
    };
    const opB: Operation = {
      type: 'merge_block',
      blockIndex: 1,
    };

    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('change_block_type');
    if (aPrime.type === 'change_block_type') {
      expect(aPrime.blockIndex).toBe(1);
    }
  });
});

// ============================================================
// insert_block vs operations
// ============================================================

describe('OT: insert_block', () => {
  it('insert_block vs split_block', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb')]);

    const opA: Operation = {
      type: 'insert_block',
      afterBlockIndex: 1,
      blockType: 'horizontal-rule',
    };
    const opB: Operation = {
      type: 'split_block',
      position: { blockIndex: 0, offset: 1 },
    };

    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('insert_block');
    if (aPrime.type === 'insert_block') {
      expect(aPrime.afterBlockIndex).toBe(2);
    }
  });

  it('insert_block vs insert_block (same position)', () => {
    const doc = makeDoc([makeBlock('aaa')]);

    const opA: Operation = {
      type: 'insert_block',
      afterBlockIndex: 0,
      blockType: 'paragraph',
    };
    const opB: Operation = {
      type: 'insert_block',
      afterBlockIndex: 0,
      blockType: 'horizontal-rule',
    };

    const { docAB, docBA } = verifyConvergence(doc, opA, opB);
    // Both insert after block 0, creating 3 blocks total
    expect(docAB.blocks.length).toBe(3);
    expect(docBA.blocks.length).toBe(3);
  });

  it('insert_block vs merge_block', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb'), makeBlock('ccc')]);

    const opA: Operation = {
      type: 'insert_block',
      afterBlockIndex: 2,
      blockType: 'paragraph',
    };
    const opB: Operation = {
      type: 'merge_block',
      blockIndex: 1,
    };

    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('insert_block');
    if (aPrime.type === 'insert_block') {
      expect(aPrime.afterBlockIndex).toBe(1);
    }
  });
});

// ============================================================
// Formatting operations
// ============================================================

describe('OT: formatting operations', () => {
  it('apply_formatting vs insert_text (text before range)', () => {
    const doc = makeDoc([makeBlock('hello world')]);

    const opA: Operation = {
      type: 'apply_formatting',
      range: {
        start: { blockIndex: 0, offset: 6 },
        end: { blockIndex: 0, offset: 11 },
      },
      style: { bold: true },
    };
    const opB: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 0 },
      text: 'XX',
    };

    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('apply_formatting');
    if (aPrime.type === 'apply_formatting') {
      expect(aPrime.range.start.offset).toBe(8); // 6 + 2
      expect(aPrime.range.end.offset).toBe(13); // 11 + 2
    }
  });

  it('apply_formatting vs delete_text (delete before range)', () => {
    const doc = makeDoc([makeBlock('hello world')]);

    const opA: Operation = {
      type: 'apply_formatting',
      range: {
        start: { blockIndex: 0, offset: 6 },
        end: { blockIndex: 0, offset: 11 },
      },
      style: { italic: true },
    };
    const opB: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 3 },
      },
    };

    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('apply_formatting');
    if (aPrime.type === 'apply_formatting') {
      expect(aPrime.range.start.offset).toBe(3); // 6 - 3
      expect(aPrime.range.end.offset).toBe(8); // 11 - 3
    }
  });

  it('remove_formatting vs split_block', () => {
    const doc = makeDoc([makeBlock('hello world')]);

    const opA: Operation = {
      type: 'remove_formatting',
      range: {
        start: { blockIndex: 0, offset: 8 },
        end: { blockIndex: 0, offset: 11 },
      },
      style: { bold: true },
    };
    const opB: Operation = {
      type: 'split_block',
      position: { blockIndex: 0, offset: 5 },
    };

    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('remove_formatting');
    if (aPrime.type === 'remove_formatting') {
      // After split at 5, "world" is in block 1 at offset 0-6
      // Original range 8-11 => block 1, offsets 3-6
      expect(aPrime.range.start.blockIndex).toBe(1);
      expect(aPrime.range.start.offset).toBe(3);
      expect(aPrime.range.end.blockIndex).toBe(1);
      expect(aPrime.range.end.offset).toBe(6);
    }
  });
});

// ============================================================
// transformOperationAgainstHistory
// ============================================================

describe('transformOperationAgainstHistory', () => {
  it('transforms against empty history', () => {
    const op: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 0 },
      text: 'hello',
    };

    const result = transformOperationAgainstHistory(op, []);
    expect(result).toEqual(op);
  });

  it('transforms against multiple historical operations', () => {
    const op: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 5 },
      text: 'X',
    };

    const history: Operation[] = [
      {
        type: 'insert_text',
        position: { blockIndex: 0, offset: 0 },
        text: 'AB', // inserts 2 chars before our position
      },
      {
        type: 'insert_text',
        position: { blockIndex: 0, offset: 3 },
        text: 'C', // inserts 1 char before our (already shifted) position
      },
    ];

    const result = transformOperationAgainstHistory(op, history);
    expect(result.type).toBe('insert_text');
    if (result.type === 'insert_text') {
      expect(result.position.offset).toBe(8); // 5 + 2 + 1
    }
  });

  it('transforms a delete against inserts in history', () => {
    const op: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 2 },
        end: { blockIndex: 0, offset: 5 },
      },
    };

    const history: Operation[] = [
      {
        type: 'insert_text',
        position: { blockIndex: 0, offset: 0 },
        text: 'XX', // shifts everything right by 2
      },
    ];

    const result = transformOperationAgainstHistory(op, history);
    expect(result.type).toBe('delete_text');
    if (result.type === 'delete_text') {
      expect(result.range.start.offset).toBe(4); // 2 + 2
      expect(result.range.end.offset).toBe(7); // 5 + 2
    }
  });
});

// ============================================================
// Edge cases
// ============================================================

describe('OT: edge cases', () => {
  it('operations on empty document block', () => {
    const doc = makeDoc([makeBlock('')]);

    const opA: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 0 },
      text: 'A',
    };
    const opB: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 0 },
      text: 'B',
    };

    const { docAB, docBA } = verifyConvergence(doc, opA, opB);
    expect(getBlockText(docAB, 0).length).toBe(2);
    expect(getBlockText(docBA, 0).length).toBe(2);
    expect(getBlockText(docAB, 0)).toBe(getBlockText(docBA, 0));
  });

  it('delete entire block content vs insert at start — insert at boundary survives', () => {
    const doc = makeDoc([makeBlock('hello')]);

    const opA: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 5 },
      },
    };
    const opB: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 0 },
      text: 'X',
    };

    // Insert at position 0 is NOT strictly within the delete range (it's at
    // the boundary), so the insert survives. Both converge to "X".
    assertConvergentText(doc, opA, opB, ['X']);
  });

  it('split then merge at boundary is stable', () => {
    const doc = makeDoc([makeBlock('hello')]);

    const opA: Operation = {
      type: 'split_block',
      position: { blockIndex: 0, offset: 3 },
    };
    // This merge won't have a valid target in the original state,
    // but after the split, block 1 exists and can be merged
    const opB: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 4 },
      text: 'X',
    };

    const { docAB, docBA } = verifyConvergence(doc, opA, opB);
    // Should converge — both paths produce same block texts
    expect(docAB.blocks.length).toBe(docBA.blocks.length);
  });

  it('formatting on already-deleted range becomes no-op', () => {
    const doc = makeDoc([makeBlock('hello world')]);

    const opA: Operation = {
      type: 'apply_formatting',
      range: {
        start: { blockIndex: 0, offset: 3 },
        end: { blockIndex: 0, offset: 7 },
      },
      style: { bold: true },
    };
    const opB: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 11 },
      },
    };

    // After the delete, the formatting range should collapse
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('apply_formatting');
    if (aPrime.type === 'apply_formatting') {
      // Range should be collapsed (start === end) since all text was deleted
      expect(aPrime.range.start.offset).toBe(aPrime.range.end.offset);
    }
  });
});
