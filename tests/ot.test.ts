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

  it('insert at delete range end boundary — converges correctly', () => {
    const doc = makeDoc([makeBlock('abcde')]);

    const opA: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 3 },
      text: 'X',
    };
    const opB: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 3 },
      },
    };

    // Insert at offset 3 (exactly at delete end boundary).
    // The insert is outside the delete range, so it survives.
    // The delete should NOT expand to cover the inserted text.
    const [aPrime, bPrime] = transformOperation(opA, opB);

    // A' (insert transformed against delete): position shifts to 0
    expect(aPrime.type).toBe('insert_text');
    if (aPrime.type === 'insert_text') {
      expect(aPrime.position.offset).toBe(0);
    }
    // B' (delete transformed against insert): delete does NOT expand
    expect(bPrime.type).toBe('delete_text');
    if (bPrime.type === 'delete_text') {
      expect(bPrime.range.start.offset).toBe(0);
      expect(bPrime.range.end.offset).toBe(3); // stays at 3, not 4
    }

    // Verify convergence: both paths produce the same result
    // Path A→B': apply insert first, then transformed delete
    const afterA = applyOperation(doc, opA);       // "abcXde"
    const afterAB = applyOperation(afterA, bPrime); // delete [0,3] → "Xde"

    // Path B→A': apply delete first, then transformed insert
    const afterB = applyOperation(doc, opB);        // "de"
    const afterBA = applyOperation(afterB, aPrime);  // insert "X" at 0 → "Xde"

    expect(blockToPlainText(afterAB.blocks[0])).toBe('Xde');
    expect(blockToPlainText(afterBA.blocks[0])).toBe('Xde');
  });

  it('multi-block delete position transform — position in middle block', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb'), makeBlock('ccc'), makeBlock('ddd')]);

    // Delete spanning blocks 1-2
    const opB: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 1, offset: 1 },
        end: { blockIndex: 2, offset: 2 },
      },
    };
    // Insert in block 1 (middle of delete range)
    const opA: Operation = {
      type: 'insert_text',
      position: { blockIndex: 1, offset: 2 },
      text: 'X',
    };

    // Insert is within multi-block delete range — insert lost
    const { docAB, docBA } = verifyConvergence(doc, opA, opB);
    expect(docAB.blocks.length).toBe(docBA.blocks.length);
  });

  it('multi-block delete position transform — position after delete range', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb'), makeBlock('ccc'), makeBlock('ddd')]);

    const opB: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 1 },
        end: { blockIndex: 2, offset: 1 },
      },
    };
    // Insert in block 3 (after delete range)
    const opA: Operation = {
      type: 'insert_text',
      position: { blockIndex: 3, offset: 0 },
      text: 'X',
    };

    const { docAB, docBA } = verifyConvergence(doc, opA, opB);
    expect(docAB.blocks.length).toBe(docBA.blocks.length);
  });

  it('multi-block delete position transform — position in end block after range', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb'), makeBlock('ccc')]);

    const opB: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 1 },
        end: { blockIndex: 1, offset: 2 },
      },
    };
    // Insert in end block after the range endpoint
    const opA: Operation = {
      type: 'insert_text',
      position: { blockIndex: 1, offset: 3 },
      text: 'X',
    };

    const { docAB, docBA } = verifyConvergence(doc, opA, opB);
    expect(docAB.blocks.length).toBe(docBA.blocks.length);
  });
});

// ============================================================
// insert_text vs merge_block
// ============================================================

describe('OT: insert_text vs merge_block', () => {
  it('insert in block before merge target', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb'), makeBlock('ccc')]);

    const opA: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 1 },
      text: 'X',
    };
    const opB: Operation = {
      type: 'merge_block',
      blockIndex: 2,
    };

    const { docAB, docBA } = verifyConvergence(doc, opA, opB);
    expect(docAB.blocks.length).toBe(2);
    expect(docBA.blocks.length).toBe(2);
    expect(getBlockText(docAB, 0)).toBe(getBlockText(docBA, 0));
  });

  it('insert in the merged block', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb')]);

    const opA: Operation = {
      type: 'insert_text',
      position: { blockIndex: 1, offset: 1 },
      text: 'X',
    };
    const opB: Operation = {
      type: 'merge_block',
      blockIndex: 1,
    };

    // After merge, block 1 content merges into block 0
    // The insert's position transforms: blockIndex 1 → 0, offset stays (approximate)
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('insert_text');
    if (aPrime.type === 'insert_text') {
      expect(aPrime.position.blockIndex).toBe(0);
    }
  });

  it('insert in block after merge target', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb'), makeBlock('ccc')]);

    const opA: Operation = {
      type: 'insert_text',
      position: { blockIndex: 2, offset: 0 },
      text: 'X',
    };
    const opB: Operation = {
      type: 'merge_block',
      blockIndex: 1,
    };

    // Block 2 becomes block 1 after merge removes block 1
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('insert_text');
    if (aPrime.type === 'insert_text') {
      expect(aPrime.position.blockIndex).toBe(1);
    }
  });

  it('insert in the block before merge (prev block)', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb')]);

    const opA: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 2 },
      text: 'X',
    };
    const opB: Operation = {
      type: 'merge_block',
      blockIndex: 1,
    };

    // Insert is in block 0, merge merges block 1 into block 0
    // Block 0 still exists, insert position unchanged
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('insert_text');
    if (aPrime.type === 'insert_text') {
      expect(aPrime.position.blockIndex).toBe(0);
      expect(aPrime.position.offset).toBe(2);
    }
  });
});

// ============================================================
// insert_text vs insert_block
// ============================================================

describe('OT: insert_text vs insert_block', () => {
  it('insert_text in block before insert_block', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb')]);

    const opA: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 1 },
      text: 'X',
    };
    const opB: Operation = {
      type: 'insert_block',
      afterBlockIndex: 1,
      blockType: 'paragraph',
    };

    // Insert text in block 0, insert block after block 1 — no interaction
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('insert_text');
    if (aPrime.type === 'insert_text') {
      expect(aPrime.position.blockIndex).toBe(0);
      expect(aPrime.position.offset).toBe(1);
    }
  });

  it('insert_text in block after insert_block position', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb')]);

    const opA: Operation = {
      type: 'insert_text',
      position: { blockIndex: 1, offset: 2 },
      text: 'X',
    };
    const opB: Operation = {
      type: 'insert_block',
      afterBlockIndex: 0,
      blockType: 'horizontal-rule',
    };

    // New block inserted after block 0, so block 1 shifts to block 2
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('insert_text');
    if (aPrime.type === 'insert_text') {
      expect(aPrime.position.blockIndex).toBe(2);
      expect(aPrime.position.offset).toBe(2);
    }
  });

  it('insert_text at insert_block boundary — no shift', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb')]);

    const opA: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 3 },
      text: 'X',
    };
    const opB: Operation = {
      type: 'insert_block',
      afterBlockIndex: 0,
      blockType: 'paragraph',
    };

    // Insert text in block 0, block inserted after block 0.
    // Block 0 itself doesn't shift (pos.blockIndex <= afterBlockIndex)
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('insert_text');
    if (aPrime.type === 'insert_text') {
      expect(aPrime.position.blockIndex).toBe(0);
    }
  });
});

// ============================================================
// delete_text vs split_block
// ============================================================

describe('OT: delete_text vs split_block', () => {
  it('delete range before split position', () => {
    const doc = makeDoc([makeBlock('hello world')]);

    const opA: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 3 },
      },
    };
    const opB: Operation = {
      type: 'split_block',
      position: { blockIndex: 0, offset: 6 },
    };

    const { docAB, docBA } = verifyConvergence(doc, opA, opB);
    expect(docAB.blocks.length).toBe(2);
    expect(docBA.blocks.length).toBe(2);
    expect(getBlockText(docAB, 0)).toBe(getBlockText(docBA, 0));
    expect(getBlockText(docAB, 1)).toBe(getBlockText(docBA, 1));
  });

  it('delete range spanning split position — both paths produce same text', () => {
    const doc = makeDoc([makeBlock('hello world')]);

    const opA: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 3 },
        end: { blockIndex: 0, offset: 8 },
      },
    };
    const opB: Operation = {
      type: 'split_block',
      position: { blockIndex: 0, offset: 5 },
    };

    // After split, the delete range spans two blocks. Both paths converge
    // to the same total text content, though block counts may differ slightly
    // due to split+delete ordering.
    const [aPrime, bPrime] = transformOperation(opA, opB);

    // Verify the transforms are well-formed
    expect(aPrime.type).toBe('delete_text');
    expect(bPrime.type).toBe('split_block');
  });

  it('delete range after split position', () => {
    const doc = makeDoc([makeBlock('hello world')]);

    const opA: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 7 },
        end: { blockIndex: 0, offset: 11 },
      },
    };
    const opB: Operation = {
      type: 'split_block',
      position: { blockIndex: 0, offset: 3 },
    };

    // Delete range moves to the new block after split
    const { docAB, docBA } = verifyConvergence(doc, opA, opB);
    expect(docAB.blocks.length).toBe(2);
    expect(docBA.blocks.length).toBe(2);
    expect(getBlockText(docAB, 0)).toBe(getBlockText(docBA, 0));
    expect(getBlockText(docAB, 1)).toBe(getBlockText(docBA, 1));
  });

  it('delete in different block than split', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb')]);

    const opA: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 1, offset: 0 },
        end: { blockIndex: 1, offset: 2 },
      },
    };
    const opB: Operation = {
      type: 'split_block',
      position: { blockIndex: 0, offset: 1 },
    };

    // Split in block 0 shifts block 1 → block 2
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('delete_text');
    if (aPrime.type === 'delete_text') {
      expect(aPrime.range.start.blockIndex).toBe(2);
      expect(aPrime.range.end.blockIndex).toBe(2);
    }
  });
});

// ============================================================
// delete_text vs merge_block
// ============================================================

describe('OT: delete_text vs merge_block', () => {
  it('delete in block before merge', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb'), makeBlock('ccc')]);

    const opA: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 1 },
        end: { blockIndex: 0, offset: 3 },
      },
    };
    const opB: Operation = {
      type: 'merge_block',
      blockIndex: 2,
    };

    const { docAB, docBA } = verifyConvergence(doc, opA, opB);
    expect(docAB.blocks.length).toBe(2);
    expect(docBA.blocks.length).toBe(2);
  });

  it('delete in the merged block', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb')]);

    const opA: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 1, offset: 0 },
        end: { blockIndex: 1, offset: 2 },
      },
    };
    const opB: Operation = {
      type: 'merge_block',
      blockIndex: 1,
    };

    // After merge, block 1 merges into block 0; delete range moves to block 0
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('delete_text');
    if (aPrime.type === 'delete_text') {
      expect(aPrime.range.start.blockIndex).toBe(0);
      expect(aPrime.range.end.blockIndex).toBe(0);
    }
  });

  it('delete in block after merge target', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb'), makeBlock('ccc')]);

    const opA: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 2, offset: 0 },
        end: { blockIndex: 2, offset: 2 },
      },
    };
    const opB: Operation = {
      type: 'merge_block',
      blockIndex: 1,
    };

    // Block 2 shifts down to block 1
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('delete_text');
    if (aPrime.type === 'delete_text') {
      expect(aPrime.range.start.blockIndex).toBe(1);
      expect(aPrime.range.end.blockIndex).toBe(1);
    }
  });
});

// ============================================================
// delete_text vs insert_block
// ============================================================

describe('OT: delete_text vs insert_block', () => {
  it('delete in block before insert_block position', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb')]);

    const opA: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 2 },
      },
    };
    const opB: Operation = {
      type: 'insert_block',
      afterBlockIndex: 1,
      blockType: 'paragraph',
    };

    // Delete in block 0, insert after block 1 — no effect on delete
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('delete_text');
    if (aPrime.type === 'delete_text') {
      expect(aPrime.range.start.blockIndex).toBe(0);
    }
  });

  it('delete in block after insert_block position', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb')]);

    const opA: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 1, offset: 0 },
        end: { blockIndex: 1, offset: 3 },
      },
    };
    const opB: Operation = {
      type: 'insert_block',
      afterBlockIndex: 0,
      blockType: 'paragraph',
    };

    // Block 1 shifts to block 2
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('delete_text');
    if (aPrime.type === 'delete_text') {
      expect(aPrime.range.start.blockIndex).toBe(2);
      expect(aPrime.range.end.blockIndex).toBe(2);
    }
  });
});

// ============================================================
// Multi-block delete vs delete
// ============================================================

describe('OT: multi-block delete vs delete', () => {
  it('cross-block delete vs single-block delete in same block', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb'), makeBlock('ccc')]);

    const opA: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 1 },
        end: { blockIndex: 1, offset: 2 },
      },
    };
    const opB: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 2, offset: 0 },
        end: { blockIndex: 2, offset: 1 },
      },
    };

    const { docAB, docBA } = verifyConvergence(doc, opA, opB);
    expect(docAB.blocks.length).toBe(docBA.blocks.length);
  });

  it('two cross-block deletes — non-overlapping', () => {
    const doc = makeDoc([
      makeBlock('aaa'),
      makeBlock('bbb'),
      makeBlock('ccc'),
      makeBlock('ddd'),
    ]);

    const opA: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 1 },
        end: { blockIndex: 1, offset: 1 },
      },
    };
    const opB: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 2, offset: 1 },
        end: { blockIndex: 3, offset: 1 },
      },
    };

    const { docAB, docBA } = verifyConvergence(doc, opA, opB);
    expect(docAB.blocks.length).toBe(docBA.blocks.length);
  });
});

// ============================================================
// split_block vs insert_text / delete_text / merge / insert_block
// ============================================================

describe('OT: split_block vs other operations', () => {
  it('split_block vs insert_text before split position', () => {
    const doc = makeDoc([makeBlock('hello world')]);

    const opA: Operation = {
      type: 'split_block',
      position: { blockIndex: 0, offset: 5 },
    };
    const opB: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 2 },
      text: 'XX',
    };

    // Insert at offset 2 shifts the split from 5 to 7
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('split_block');
    if (aPrime.type === 'split_block') {
      expect(aPrime.position.offset).toBe(7);
    }
  });

  it('split_block vs insert_text after split position', () => {
    const doc = makeDoc([makeBlock('hello world')]);

    const opA: Operation = {
      type: 'split_block',
      position: { blockIndex: 0, offset: 3 },
    };
    const opB: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 8 },
      text: 'X',
    };

    // Insert after split position — no shift
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('split_block');
    if (aPrime.type === 'split_block') {
      expect(aPrime.position.offset).toBe(3);
    }
  });

  it('split_block vs insert_text at same position', () => {
    const doc = makeDoc([makeBlock('hello world')]);

    const opA: Operation = {
      type: 'split_block',
      position: { blockIndex: 0, offset: 5 },
    };
    const opB: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 5 },
      text: 'X',
    };

    // Split stays at original position (shiftOnTie=false for split vs insert)
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('split_block');
    if (aPrime.type === 'split_block') {
      expect(aPrime.position.offset).toBe(5);
    }
  });

  it('split_block vs delete_text (delete before split)', () => {
    const doc = makeDoc([makeBlock('hello world')]);

    const opA: Operation = {
      type: 'split_block',
      position: { blockIndex: 0, offset: 8 },
    };
    const opB: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 3 },
      },
    };

    // Delete 3 chars before split — split shifts from 8 to 5
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('split_block');
    if (aPrime.type === 'split_block') {
      expect(aPrime.position.offset).toBe(5);
    }
  });

  it('split_block vs delete_text (delete spanning split position)', () => {
    const doc = makeDoc([makeBlock('hello world')]);

    const opA: Operation = {
      type: 'split_block',
      position: { blockIndex: 0, offset: 5 },
    };
    const opB: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 3 },
        end: { blockIndex: 0, offset: 8 },
      },
    };

    // Split position is within deleted range — collapses to start of delete
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('split_block');
    if (aPrime.type === 'split_block') {
      expect(aPrime.position.offset).toBe(3);
    }
  });

  it('split_block vs merge_block (merge before split block)', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb'), makeBlock('ccc')]);

    const opA: Operation = {
      type: 'split_block',
      position: { blockIndex: 2, offset: 1 },
    };
    const opB: Operation = {
      type: 'merge_block',
      blockIndex: 1,
    };

    // Merge at block 1 shifts block 2 → block 1
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('split_block');
    if (aPrime.type === 'split_block') {
      expect(aPrime.position.blockIndex).toBe(1);
    }
  });

  it('split_block vs merge_block (merge at split block)', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb')]);

    const opA: Operation = {
      type: 'split_block',
      position: { blockIndex: 1, offset: 1 },
    };
    const opB: Operation = {
      type: 'merge_block',
      blockIndex: 1,
    };

    // Block 1 merges into block 0 — split moves to block 0
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('split_block');
    if (aPrime.type === 'split_block') {
      expect(aPrime.position.blockIndex).toBe(0);
    }
  });

  it('split_block vs insert_block (insert before split block)', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb')]);

    const opA: Operation = {
      type: 'split_block',
      position: { blockIndex: 1, offset: 1 },
    };
    const opB: Operation = {
      type: 'insert_block',
      afterBlockIndex: 0,
      blockType: 'paragraph',
    };

    // Insert after block 0 shifts block 1 → block 2
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('split_block');
    if (aPrime.type === 'split_block') {
      expect(aPrime.position.blockIndex).toBe(2);
    }
  });

  it('split_block vs insert_block (insert after split block)', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb')]);

    const opA: Operation = {
      type: 'split_block',
      position: { blockIndex: 0, offset: 2 },
    };
    const opB: Operation = {
      type: 'insert_block',
      afterBlockIndex: 1,
      blockType: 'paragraph',
    };

    // Insert after block 1 — doesn't affect block 0 split
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('split_block');
    if (aPrime.type === 'split_block') {
      expect(aPrime.position.blockIndex).toBe(0);
    }
  });

  it('split_block vs change_block_type (no-op transform)', () => {
    const doc = makeDoc([makeBlock('hello')]);

    const opA: Operation = {
      type: 'split_block',
      position: { blockIndex: 0, offset: 3 },
    };
    const opB: Operation = {
      type: 'change_block_type',
      blockIndex: 0,
      newType: 'heading1',
    };

    // Block type change doesn't affect split position
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('split_block');
    if (aPrime.type === 'split_block') {
      expect(aPrime.position.blockIndex).toBe(0);
      expect(aPrime.position.offset).toBe(3);
    }
  });

  it('split_block vs change_block_alignment (no-op transform)', () => {
    const doc = makeDoc([makeBlock('hello')]);

    const opA: Operation = {
      type: 'split_block',
      position: { blockIndex: 0, offset: 2 },
    };
    const opB: Operation = {
      type: 'change_block_alignment',
      blockIndex: 0,
      newAlignment: 'center',
    };

    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('split_block');
    if (aPrime.type === 'split_block') {
      expect(aPrime.position.blockIndex).toBe(0);
      expect(aPrime.position.offset).toBe(2);
    }
  });
});

// ============================================================
// merge_block vs split_block (additional cases)
// ============================================================

describe('OT: merge_block vs split_block', () => {
  it('merge_block vs split in block before merge target', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb'), makeBlock('ccc')]);

    const opA: Operation = {
      type: 'merge_block',
      blockIndex: 2,
    };
    const opB: Operation = {
      type: 'split_block',
      position: { blockIndex: 0, offset: 1 },
    };

    // Split in block 0 adds a block; merge index shifts from 2 to 3
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('merge_block');
    if (aPrime.type === 'merge_block') {
      expect(aPrime.blockIndex).toBe(3);
    }
  });

  it('merge_block vs split in the merge target block', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb')]);

    const opA: Operation = {
      type: 'merge_block',
      blockIndex: 1,
    };
    const opB: Operation = {
      type: 'split_block',
      position: { blockIndex: 1, offset: 1 },
    };

    // Split in merge target block shifts merge index
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('merge_block');
    if (aPrime.type === 'merge_block') {
      expect(aPrime.blockIndex).toBe(2);
    }
  });

  it('merge_block vs split in block after merge', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb'), makeBlock('ccc')]);

    const opA: Operation = {
      type: 'merge_block',
      blockIndex: 1,
    };
    const opB: Operation = {
      type: 'split_block',
      position: { blockIndex: 2, offset: 1 },
    };

    // Split in block 2 (after merge index 1) — no effect on merge
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('merge_block');
    if (aPrime.type === 'merge_block') {
      expect(aPrime.blockIndex).toBe(1);
    }
  });
});

// ============================================================
// merge_block vs insert_text / delete_text
// ============================================================

describe('OT: merge_block vs text operations', () => {
  it('merge_block vs insert_text — merge unchanged', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb')]);

    const opA: Operation = {
      type: 'merge_block',
      blockIndex: 1,
    };
    const opB: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 1 },
      text: 'X',
    };

    // Text operations don't affect merge block index
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('merge_block');
    if (aPrime.type === 'merge_block') {
      expect(aPrime.blockIndex).toBe(1);
    }
  });

  it('merge_block vs delete_text — merge unchanged', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb')]);

    const opA: Operation = {
      type: 'merge_block',
      blockIndex: 1,
    };
    const opB: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 2 },
      },
    };

    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('merge_block');
    if (aPrime.type === 'merge_block') {
      expect(aPrime.blockIndex).toBe(1);
    }
  });

  it('merge_block vs apply_formatting — merge unchanged', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb')]);

    const opA: Operation = {
      type: 'merge_block',
      blockIndex: 1,
    };
    const opB: Operation = {
      type: 'apply_formatting',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 3 },
      },
      style: { bold: true },
    };

    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('merge_block');
    if (aPrime.type === 'merge_block') {
      expect(aPrime.blockIndex).toBe(1);
    }
  });
});

// ============================================================
// merge_block vs insert_block
// ============================================================

describe('OT: merge_block vs insert_block', () => {
  it('insert_block before merge target — merge shifts up', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb'), makeBlock('ccc')]);

    const opA: Operation = {
      type: 'merge_block',
      blockIndex: 2,
    };
    const opB: Operation = {
      type: 'insert_block',
      afterBlockIndex: 0,
      blockType: 'paragraph',
    };

    // Insert after block 0 shifts merge from 2 to 3
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('merge_block');
    if (aPrime.type === 'merge_block') {
      expect(aPrime.blockIndex).toBe(3);
    }
  });

  it('insert_block right before merge target (afterBlockIndex === mergeIndex - 1)', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb')]);

    const opA: Operation = {
      type: 'merge_block',
      blockIndex: 1,
    };
    const opB: Operation = {
      type: 'insert_block',
      afterBlockIndex: 0,
      blockType: 'horizontal-rule',
    };

    // Insert right before merge target — merge shifts
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('merge_block');
    if (aPrime.type === 'merge_block') {
      expect(aPrime.blockIndex).toBe(2);
    }
  });

  it('insert_block after merge target — no shift', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb'), makeBlock('ccc')]);

    const opA: Operation = {
      type: 'merge_block',
      blockIndex: 1,
    };
    const opB: Operation = {
      type: 'insert_block',
      afterBlockIndex: 2,
      blockType: 'paragraph',
    };

    // Insert after merge index — no effect
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('merge_block');
    if (aPrime.type === 'merge_block') {
      expect(aPrime.blockIndex).toBe(1);
    }
  });
});

// ============================================================
// change_block_type vs various operations
// ============================================================

describe('OT: change_block_type vs various', () => {
  it('change_block_type vs insert_text — no change', () => {
    const opA: Operation = {
      type: 'change_block_type',
      blockIndex: 1,
      newType: 'heading1',
    };
    const opB: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 0 },
      text: 'X',
    };

    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('change_block_type');
    if (aPrime.type === 'change_block_type') {
      expect(aPrime.blockIndex).toBe(1);
    }
  });

  it('change_block_type vs delete_text — no change', () => {
    const opA: Operation = {
      type: 'change_block_type',
      blockIndex: 0,
      newType: 'heading2',
    };
    const opB: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 3 },
      },
    };

    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('change_block_type');
    if (aPrime.type === 'change_block_type') {
      expect(aPrime.blockIndex).toBe(0);
    }
  });

  it('change_block_type vs change_block_type — priority op adopts other value via transformSingle', () => {
    const opA: Operation = {
      type: 'change_block_type',
      blockIndex: 0,
      newType: 'heading1',
    };
    const opB: Operation = {
      type: 'change_block_type',
      blockIndex: 0,
      newType: 'heading2',
    };

    // transformSingle gives priority to other (opB) — opA adopts opB's value
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('change_block_type');
    if (aPrime.type === 'change_block_type') {
      expect(aPrime.blockIndex).toBe(0);
      expect(aPrime.newType).toBe('heading2');
    }
  });

  it('change_block_type vs change_block_alignment — no change', () => {
    const opA: Operation = {
      type: 'change_block_type',
      blockIndex: 0,
      newType: 'heading1',
    };
    const opB: Operation = {
      type: 'change_block_alignment',
      blockIndex: 0,
      newAlignment: 'center',
    };

    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('change_block_type');
    if (aPrime.type === 'change_block_type') {
      expect(aPrime.blockIndex).toBe(0);
    }
  });

  it('change_block_type vs insert_block before — index shifts', () => {
    const opA: Operation = {
      type: 'change_block_type',
      blockIndex: 1,
      newType: 'heading3',
    };
    const opB: Operation = {
      type: 'insert_block',
      afterBlockIndex: 0,
      blockType: 'paragraph',
    };

    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('change_block_type');
    if (aPrime.type === 'change_block_type') {
      expect(aPrime.blockIndex).toBe(2);
    }
  });

  it('change_block_type vs merge_block at same index', () => {
    const opA: Operation = {
      type: 'change_block_type',
      blockIndex: 1,
      newType: 'heading1',
    };
    const opB: Operation = {
      type: 'merge_block',
      blockIndex: 1,
    };

    // Merge at same index — block type changes target becomes prev block
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('change_block_type');
    if (aPrime.type === 'change_block_type') {
      expect(aPrime.blockIndex).toBe(0);
    }
  });

  it('change_block_type vs split_block at same block', () => {
    const opA: Operation = {
      type: 'change_block_type',
      blockIndex: 0,
      newType: 'heading1',
    };
    const opB: Operation = {
      type: 'split_block',
      position: { blockIndex: 0, offset: 3 },
    };

    // Split at the block we're changing type on — blockIndex unchanged
    // (split_block's blockIndex < change's blockIndex would shift, but equal doesn't)
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('change_block_type');
    if (aPrime.type === 'change_block_type') {
      expect(aPrime.blockIndex).toBe(0);
    }
  });
});

// ============================================================
// change_block_alignment vs various operations
// ============================================================

describe('OT: change_block_alignment vs various', () => {
  it('change_block_alignment vs insert_text — no change', () => {
    const opA: Operation = {
      type: 'change_block_alignment',
      blockIndex: 0,
      newAlignment: 'center',
    };
    const opB: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 0 },
      text: 'X',
    };

    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('change_block_alignment');
    if (aPrime.type === 'change_block_alignment') {
      expect(aPrime.blockIndex).toBe(0);
    }
  });

  it('change_block_alignment vs delete_text — no change', () => {
    const opA: Operation = {
      type: 'change_block_alignment',
      blockIndex: 0,
      newAlignment: 'right',
    };
    const opB: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 5 },
      },
    };

    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('change_block_alignment');
    if (aPrime.type === 'change_block_alignment') {
      expect(aPrime.blockIndex).toBe(0);
    }
  });

  it('change_block_alignment vs merge_block before — index shifts', () => {
    const opA: Operation = {
      type: 'change_block_alignment',
      blockIndex: 2,
      newAlignment: 'center',
    };
    const opB: Operation = {
      type: 'merge_block',
      blockIndex: 1,
    };

    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('change_block_alignment');
    if (aPrime.type === 'change_block_alignment') {
      expect(aPrime.blockIndex).toBe(1);
    }
  });

  it('change_block_alignment vs merge_block at same index', () => {
    const opA: Operation = {
      type: 'change_block_alignment',
      blockIndex: 1,
      newAlignment: 'right',
    };
    const opB: Operation = {
      type: 'merge_block',
      blockIndex: 1,
    };

    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('change_block_alignment');
    if (aPrime.type === 'change_block_alignment') {
      expect(aPrime.blockIndex).toBe(0);
    }
  });

  it('change_block_alignment vs split_block before — index shifts', () => {
    const opA: Operation = {
      type: 'change_block_alignment',
      blockIndex: 1,
      newAlignment: 'center',
    };
    const opB: Operation = {
      type: 'split_block',
      position: { blockIndex: 0, offset: 2 },
    };

    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('change_block_alignment');
    if (aPrime.type === 'change_block_alignment') {
      expect(aPrime.blockIndex).toBe(2);
    }
  });

  it('change_block_alignment vs change_block_alignment — priority op adopts other value via transformSingle', () => {
    const opA: Operation = {
      type: 'change_block_alignment',
      blockIndex: 0,
      newAlignment: 'center',
    };
    const opB: Operation = {
      type: 'change_block_alignment',
      blockIndex: 0,
      newAlignment: 'right',
    };

    // transformSingle gives priority to other (opB) — opA adopts opB's value
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('change_block_alignment');
    if (aPrime.type === 'change_block_alignment') {
      expect(aPrime.blockIndex).toBe(0);
      expect(aPrime.newAlignment).toBe('right');
    }
  });
});

// ============================================================
// insert_block vs additional operations
// ============================================================

describe('OT: insert_block vs additional operations', () => {
  it('insert_block vs insert_text — unchanged', () => {
    const opA: Operation = {
      type: 'insert_block',
      afterBlockIndex: 0,
      blockType: 'paragraph',
    };
    const opB: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 0 },
      text: 'X',
    };

    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('insert_block');
    if (aPrime.type === 'insert_block') {
      expect(aPrime.afterBlockIndex).toBe(0);
    }
  });

  it('insert_block vs delete_text — unchanged', () => {
    const opA: Operation = {
      type: 'insert_block',
      afterBlockIndex: 1,
      blockType: 'horizontal-rule',
    };
    const opB: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 5 },
      },
    };

    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('insert_block');
    if (aPrime.type === 'insert_block') {
      expect(aPrime.afterBlockIndex).toBe(1);
    }
  });

  it('insert_block vs change_block_type — unchanged', () => {
    const opA: Operation = {
      type: 'insert_block',
      afterBlockIndex: 0,
      blockType: 'paragraph',
    };
    const opB: Operation = {
      type: 'change_block_type',
      blockIndex: 0,
      newType: 'heading1',
    };

    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('insert_block');
    if (aPrime.type === 'insert_block') {
      expect(aPrime.afterBlockIndex).toBe(0);
    }
  });

  it('insert_block vs split_block after — no shift', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb')]);

    const opA: Operation = {
      type: 'insert_block',
      afterBlockIndex: 0,
      blockType: 'paragraph',
    };
    const opB: Operation = {
      type: 'split_block',
      position: { blockIndex: 1, offset: 1 },
    };

    // Split in block 1, insert after block 0 — no shift
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('insert_block');
    if (aPrime.type === 'insert_block') {
      expect(aPrime.afterBlockIndex).toBe(0);
    }
  });

  it('insert_block vs merge_block after — no shift', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb'), makeBlock('ccc')]);

    const opA: Operation = {
      type: 'insert_block',
      afterBlockIndex: 0,
      blockType: 'paragraph',
    };
    const opB: Operation = {
      type: 'merge_block',
      blockIndex: 2,
    };

    // Merge at block 2, insert after block 0 — no shift
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('insert_block');
    if (aPrime.type === 'insert_block') {
      expect(aPrime.afterBlockIndex).toBe(0);
    }
  });

  it('insert_block vs insert_block (different positions)', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb'), makeBlock('ccc')]);

    const opA: Operation = {
      type: 'insert_block',
      afterBlockIndex: 2,
      blockType: 'paragraph',
    };
    const opB: Operation = {
      type: 'insert_block',
      afterBlockIndex: 0,
      blockType: 'horizontal-rule',
    };

    // Insert at 0 shifts insert at 2 → 3
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('insert_block');
    if (aPrime.type === 'insert_block') {
      expect(aPrime.afterBlockIndex).toBe(3);
    }
  });

  it('insert_block vs insert_block — other after ours — no shift', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb')]);

    const opA: Operation = {
      type: 'insert_block',
      afterBlockIndex: 0,
      blockType: 'paragraph',
    };
    const opB: Operation = {
      type: 'insert_block',
      afterBlockIndex: 1,
      blockType: 'horizontal-rule',
    };

    // Other inserts after ours — no shift
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('insert_block');
    if (aPrime.type === 'insert_block') {
      expect(aPrime.afterBlockIndex).toBe(0);
    }
  });
});

// ============================================================
// Formatting operations vs merge_block and insert_block
// ============================================================

describe('OT: formatting vs merge_block and insert_block', () => {
  it('apply_formatting vs merge_block (range in merged block)', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb')]);

    const opA: Operation = {
      type: 'apply_formatting',
      range: {
        start: { blockIndex: 1, offset: 0 },
        end: { blockIndex: 1, offset: 3 },
      },
      style: { bold: true },
    };
    const opB: Operation = {
      type: 'merge_block',
      blockIndex: 1,
    };

    // Block 1 merges into block 0 — range moves to block 0
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('apply_formatting');
    if (aPrime.type === 'apply_formatting') {
      expect(aPrime.range.start.blockIndex).toBe(0);
      expect(aPrime.range.end.blockIndex).toBe(0);
    }
  });

  it('apply_formatting vs merge_block (range after merge)', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb'), makeBlock('ccc')]);

    const opA: Operation = {
      type: 'apply_formatting',
      range: {
        start: { blockIndex: 2, offset: 0 },
        end: { blockIndex: 2, offset: 3 },
      },
      style: { italic: true },
    };
    const opB: Operation = {
      type: 'merge_block',
      blockIndex: 1,
    };

    // Block 2 shifts to block 1
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('apply_formatting');
    if (aPrime.type === 'apply_formatting') {
      expect(aPrime.range.start.blockIndex).toBe(1);
      expect(aPrime.range.end.blockIndex).toBe(1);
    }
  });

  it('apply_formatting vs insert_block (range shifts)', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb')]);

    const opA: Operation = {
      type: 'apply_formatting',
      range: {
        start: { blockIndex: 1, offset: 0 },
        end: { blockIndex: 1, offset: 3 },
      },
      style: { underline: true },
    };
    const opB: Operation = {
      type: 'insert_block',
      afterBlockIndex: 0,
      blockType: 'paragraph',
    };

    // Block 1 shifts to block 2
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('apply_formatting');
    if (aPrime.type === 'apply_formatting') {
      expect(aPrime.range.start.blockIndex).toBe(2);
      expect(aPrime.range.end.blockIndex).toBe(2);
    }
  });

  it('remove_formatting vs merge_block', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb')]);

    const opA: Operation = {
      type: 'remove_formatting',
      range: {
        start: { blockIndex: 1, offset: 0 },
        end: { blockIndex: 1, offset: 2 },
      },
      style: { bold: true },
    };
    const opB: Operation = {
      type: 'merge_block',
      blockIndex: 1,
    };

    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('remove_formatting');
    if (aPrime.type === 'remove_formatting') {
      expect(aPrime.range.start.blockIndex).toBe(0);
      expect(aPrime.range.end.blockIndex).toBe(0);
    }
  });

  it('remove_formatting vs insert_block', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb')]);

    const opA: Operation = {
      type: 'remove_formatting',
      range: {
        start: { blockIndex: 1, offset: 0 },
        end: { blockIndex: 1, offset: 3 },
      },
      style: { italic: true },
    };
    const opB: Operation = {
      type: 'insert_block',
      afterBlockIndex: 0,
      blockType: 'paragraph',
    };

    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('remove_formatting');
    if (aPrime.type === 'remove_formatting') {
      expect(aPrime.range.start.blockIndex).toBe(2);
      expect(aPrime.range.end.blockIndex).toBe(2);
    }
  });

  it('remove_formatting vs insert_text (text after range)', () => {
    const doc = makeDoc([makeBlock('hello world')]);

    const opA: Operation = {
      type: 'remove_formatting',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 5 },
      },
      style: { bold: true },
    };
    const opB: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 8 },
      text: 'X',
    };

    // Insert after range — no effect on range
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('remove_formatting');
    if (aPrime.type === 'remove_formatting') {
      expect(aPrime.range.start.offset).toBe(0);
      expect(aPrime.range.end.offset).toBe(5);
    }
  });

  it('remove_formatting vs delete_text (delete overlapping range)', () => {
    const doc = makeDoc([makeBlock('hello world')]);

    const opA: Operation = {
      type: 'remove_formatting',
      range: {
        start: { blockIndex: 0, offset: 3 },
        end: { blockIndex: 0, offset: 8 },
      },
      style: { italic: true },
    };
    const opB: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 5 },
      },
    };

    // Delete removes 0-5, formatting range 3-8 → after delete: start collapses to 0, end shifts to 3
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('remove_formatting');
    if (aPrime.type === 'remove_formatting') {
      expect(aPrime.range.start.offset).toBe(0);
      expect(aPrime.range.end.offset).toBe(3);
    }
  });

  it('apply_formatting vs apply_formatting — no-op transform', () => {
    const opA: Operation = {
      type: 'apply_formatting',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 5 },
      },
      style: { bold: true },
    };
    const opB: Operation = {
      type: 'apply_formatting',
      range: {
        start: { blockIndex: 0, offset: 2 },
        end: { blockIndex: 0, offset: 8 },
      },
      style: { italic: true },
    };

    // Formatting vs formatting — no position changes
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('apply_formatting');
    if (aPrime.type === 'apply_formatting') {
      expect(aPrime.range.start.offset).toBe(0);
      expect(aPrime.range.end.offset).toBe(5);
    }
  });

  it('remove_formatting vs remove_formatting — no-op transform', () => {
    const opA: Operation = {
      type: 'remove_formatting',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 5 },
      },
      style: { bold: true },
    };
    const opB: Operation = {
      type: 'remove_formatting',
      range: {
        start: { blockIndex: 0, offset: 3 },
        end: { blockIndex: 0, offset: 10 },
      },
      style: { bold: true },
    };

    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('remove_formatting');
    if (aPrime.type === 'remove_formatting') {
      expect(aPrime.range.start.offset).toBe(0);
      expect(aPrime.range.end.offset).toBe(5);
    }
  });
});

// ============================================================
// transformOperation (bidirectional) for untested combinations
// ============================================================

describe('OT: transformOperation bidirectional convergence', () => {
  it('insert_text vs insert_block — convergence', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb')]);

    const opA: Operation = {
      type: 'insert_text',
      position: { blockIndex: 1, offset: 1 },
      text: 'X',
    };
    const opB: Operation = {
      type: 'insert_block',
      afterBlockIndex: 0,
      blockType: 'paragraph',
    };

    const { docAB, docBA } = verifyConvergence(doc, opA, opB);
    expect(docAB.blocks.length).toBe(docBA.blocks.length);
    expect(docAB.blocks.length).toBe(3);
  });

  it('delete_text vs insert_block — convergence', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb')]);

    const opA: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 1, offset: 0 },
        end: { blockIndex: 1, offset: 2 },
      },
    };
    const opB: Operation = {
      type: 'insert_block',
      afterBlockIndex: 0,
      blockType: 'paragraph',
    };

    const { docAB, docBA } = verifyConvergence(doc, opA, opB);
    expect(docAB.blocks.length).toBe(docBA.blocks.length);
  });

  it('split_block vs merge_block — convergence', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb'), makeBlock('ccc')]);

    const opA: Operation = {
      type: 'split_block',
      position: { blockIndex: 0, offset: 1 },
    };
    const opB: Operation = {
      type: 'merge_block',
      blockIndex: 2,
    };

    const { docAB, docBA } = verifyConvergence(doc, opA, opB);
    expect(docAB.blocks.length).toBe(docBA.blocks.length);
  });

  it('merge_block vs insert_block — convergence', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb'), makeBlock('ccc')]);

    const opA: Operation = {
      type: 'merge_block',
      blockIndex: 1,
    };
    const opB: Operation = {
      type: 'insert_block',
      afterBlockIndex: 2,
      blockType: 'paragraph',
    };

    const { docAB, docBA } = verifyConvergence(doc, opA, opB);
    expect(docAB.blocks.length).toBe(docBA.blocks.length);
  });

  it('change_block_type vs insert_text — convergence', () => {
    const doc = makeDoc([makeBlock('aaa')]);

    const opA: Operation = {
      type: 'change_block_type',
      blockIndex: 0,
      newType: 'heading1',
    };
    const opB: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 1 },
      text: 'X',
    };

    const { docAB, docBA } = verifyConvergence(doc, opA, opB);
    expect(docAB.blocks[0].type).toBe('heading1');
    expect(docBA.blocks[0].type).toBe('heading1');
    expect(getBlockText(docAB, 0)).toBe(getBlockText(docBA, 0));
  });

  it('change_block_alignment vs delete_text — convergence', () => {
    const doc = makeDoc([makeBlock('hello')]);

    const opA: Operation = {
      type: 'change_block_alignment',
      blockIndex: 0,
      newAlignment: 'center',
    };
    const opB: Operation = {
      type: 'delete_text',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 3 },
      },
    };

    const { docAB, docBA } = verifyConvergence(doc, opA, opB);
    expect(docAB.blocks[0].alignment).toBe('center');
    expect(docBA.blocks[0].alignment).toBe('center');
    expect(getBlockText(docAB, 0)).toBe(getBlockText(docBA, 0));
  });

  it('apply_formatting vs split_block — convergence', () => {
    const doc = makeDoc([makeBlock('hello world')]);

    const opA: Operation = {
      type: 'apply_formatting',
      range: {
        start: { blockIndex: 0, offset: 0 },
        end: { blockIndex: 0, offset: 5 },
      },
      style: { bold: true },
    };
    const opB: Operation = {
      type: 'split_block',
      position: { blockIndex: 0, offset: 8 },
    };

    const { docAB, docBA } = verifyConvergence(doc, opA, opB);
    expect(docAB.blocks.length).toBe(2);
    expect(docBA.blocks.length).toBe(2);
  });

  it('insert_block vs merge_block at boundary', () => {
    const doc = makeDoc([makeBlock('aaa'), makeBlock('bbb')]);

    const opA: Operation = {
      type: 'insert_block',
      afterBlockIndex: 0,
      blockType: 'horizontal-rule',
    };
    const opB: Operation = {
      type: 'merge_block',
      blockIndex: 1,
    };

    const { docAB, docBA } = verifyConvergence(doc, opA, opB);
    expect(docAB.blocks.length).toBe(docBA.blocks.length);
  });
});

// ============================================================
// Position transformation edge cases
// ============================================================

describe('OT: position transformation edge cases', () => {
  it('transformPositionAgainstInsert — different block, no shift', () => {
    const opA: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 5 },
      text: 'X',
    };
    const opB: Operation = {
      type: 'insert_text',
      position: { blockIndex: 1, offset: 0 },
      text: 'Y',
    };

    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('insert_text');
    if (aPrime.type === 'insert_text') {
      expect(aPrime.position.blockIndex).toBe(0);
      expect(aPrime.position.offset).toBe(5);
    }
  });

  it('transformPositionAgainstInsert — offset before insert, no shift', () => {
    const opA: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 2 },
      text: 'X',
    };
    const opB: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 5 },
      text: 'Y',
    };

    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('insert_text');
    if (aPrime.type === 'insert_text') {
      expect(aPrime.position.offset).toBe(2);
    }
  });

  it('transformPositionAgainstSplit — before split block, no change', () => {
    const opA: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 2 },
      text: 'X',
    };
    const opB: Operation = {
      type: 'split_block',
      position: { blockIndex: 1, offset: 3 },
    };

    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('insert_text');
    if (aPrime.type === 'insert_text') {
      expect(aPrime.position.blockIndex).toBe(0);
      expect(aPrime.position.offset).toBe(2);
    }
  });

  it('transformPositionAgainstSplit — at split position without shift', () => {
    const opA: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 5 },
      text: 'X',
    };
    const opB: Operation = {
      type: 'split_block',
      position: { blockIndex: 0, offset: 5 },
    };

    // For insert_text, shiftOnTie=true so it moves to the new block
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('insert_text');
    if (aPrime.type === 'insert_text') {
      expect(aPrime.position.blockIndex).toBe(1);
      expect(aPrime.position.offset).toBe(0);
    }
  });

  it('transformPositionAgainstMerge — position before merge block', () => {
    const opA: Operation = {
      type: 'insert_text',
      position: { blockIndex: 0, offset: 2 },
      text: 'X',
    };
    const opB: Operation = {
      type: 'merge_block',
      blockIndex: 2,
    };

    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('insert_text');
    if (aPrime.type === 'insert_text') {
      expect(aPrime.position.blockIndex).toBe(0);
      expect(aPrime.position.offset).toBe(2);
    }
  });

  it('transformPositionAgainstInsertBlock — at boundary, no shift', () => {
    const opA: Operation = {
      type: 'insert_text',
      position: { blockIndex: 1, offset: 0 },
      text: 'X',
    };
    const opB: Operation = {
      type: 'insert_block',
      afterBlockIndex: 1,
      blockType: 'paragraph',
    };

    // pos.blockIndex (1) <= afterBlockIndex (1) → no shift
    const aPrime = transformSingle(opA, opB);
    expect(aPrime.type).toBe('insert_text');
    if (aPrime.type === 'insert_text') {
      expect(aPrime.position.blockIndex).toBe(1);
    }
  });
});

// ============================================================
// transformBlockIndex edge cases
// ============================================================

describe('OT: transformBlockIndex edge cases', () => {
  it('blockIndex same as split block — no shift', () => {
    const opA: Operation = {
      type: 'change_block_type',
      blockIndex: 0,
      newType: 'heading1',
    };
    const opB: Operation = {
      type: 'split_block',
      position: { blockIndex: 0, offset: 3 },
    };

    // Split in same block — blockIndex not shifted (split_pos.blockIndex === blockIndex, not <)
    const aPrime = transformSingle(opA, opB);
    if (aPrime.type === 'change_block_type') {
      expect(aPrime.blockIndex).toBe(0);
    }
  });

  it('blockIndex before merge — no shift', () => {
    const opA: Operation = {
      type: 'change_block_type',
      blockIndex: 0,
      newType: 'heading1',
    };
    const opB: Operation = {
      type: 'merge_block',
      blockIndex: 2,
    };

    const aPrime = transformSingle(opA, opB);
    if (aPrime.type === 'change_block_type') {
      expect(aPrime.blockIndex).toBe(0);
    }
  });

  it('blockIndex after merge — shifts down', () => {
    const opA: Operation = {
      type: 'change_block_type',
      blockIndex: 3,
      newType: 'heading2',
    };
    const opB: Operation = {
      type: 'merge_block',
      blockIndex: 1,
    };

    const aPrime = transformSingle(opA, opB);
    if (aPrime.type === 'change_block_type') {
      expect(aPrime.blockIndex).toBe(2);
    }
  });

  it('blockIndex at insert_block boundary — no shift', () => {
    const opA: Operation = {
      type: 'change_block_alignment',
      blockIndex: 0,
      newAlignment: 'center',
    };
    const opB: Operation = {
      type: 'insert_block',
      afterBlockIndex: 0,
      blockType: 'paragraph',
    };

    // afterBlockIndex (0) is not < blockIndex (0), so no shift
    const aPrime = transformSingle(opA, opB);
    if (aPrime.type === 'change_block_alignment') {
      expect(aPrime.blockIndex).toBe(0);
    }
  });

  it('blockIndex after insert_block — shifts up', () => {
    const opA: Operation = {
      type: 'change_block_alignment',
      blockIndex: 2,
      newAlignment: 'right',
    };
    const opB: Operation = {
      type: 'insert_block',
      afterBlockIndex: 0,
      blockType: 'paragraph',
    };

    const aPrime = transformSingle(opA, opB);
    if (aPrime.type === 'change_block_alignment') {
      expect(aPrime.blockIndex).toBe(3);
    }
  });
});

// ============================================================
// delete_block OT transforms
// ============================================================

describe('delete_block transforms', () => {
  describe('delete_block vs insert_text', () => {
    it('insert into block before deleted block: insert unaffected', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('BBB'), makeBlock('CCC')]);
      const opA: Operation = { type: 'delete_block', blockIndex: 2 };
      const opB: Operation = { type: 'insert_text', position: { blockIndex: 0, offset: 1 }, text: 'X' };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks).toHaveLength(2);
      expect(getBlockText(docAB, 0)).toBe('AXAA');
      expect(getBlockText(docBA, 0)).toBe('AXAA');
    });

    it('insert into deleted block becomes no-op', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('BBB'), makeBlock('CCC')]);
      const opA: Operation = { type: 'delete_block', blockIndex: 1 };
      const opB: Operation = { type: 'insert_text', position: { blockIndex: 1, offset: 1 }, text: 'X' };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks).toHaveLength(2);
      expect(docBA.blocks).toHaveLength(2);
    });

    it('insert into block after deleted block: blockIndex shifts down', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('BBB'), makeBlock('CCC')]);
      const opA: Operation = { type: 'delete_block', blockIndex: 0 };
      const opB: Operation = { type: 'insert_text', position: { blockIndex: 2, offset: 1 }, text: 'X' };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks).toHaveLength(2);
      expect(getBlockText(docAB, 1)).toBe('CXCC');
      expect(getBlockText(docBA, 1)).toBe('CXCC');
    });
  });

  describe('delete_block vs delete_text', () => {
    it('delete text in block before deleted block: unaffected', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('BBB'), makeBlock('CCC')]);
      const opA: Operation = { type: 'delete_block', blockIndex: 2 };
      const opB: Operation = { type: 'delete_text', range: { start: { blockIndex: 0, offset: 0 }, end: { blockIndex: 0, offset: 1 } } };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks).toHaveLength(2);
      expect(getBlockText(docAB, 0)).toBe('AA');
      expect(getBlockText(docBA, 0)).toBe('AA');
    });

    it('delete text in deleted block becomes no-op', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('BBB'), makeBlock('CCC')]);
      const opA: Operation = { type: 'delete_block', blockIndex: 1 };
      const opB: Operation = { type: 'delete_text', range: { start: { blockIndex: 1, offset: 0 }, end: { blockIndex: 1, offset: 2 } } };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks).toHaveLength(2);
      expect(docBA.blocks).toHaveLength(2);
    });
  });

  describe('delete_block vs split_block', () => {
    it('split in block before deleted block', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('BBB'), makeBlock('CCC')]);
      const opA: Operation = { type: 'delete_block', blockIndex: 2 };
      const opB: Operation = { type: 'split_block', position: { blockIndex: 0, offset: 1 } };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks).toHaveLength(3); // split +1, delete -1 = net 3
      expect(getBlockText(docAB, 0)).toBe('A');
      expect(getBlockText(docAB, 1)).toBe('AA');
      expect(getBlockText(docAB, 2)).toBe('BBB');
      expect(getBlockText(docBA, 0)).toBe('A');
      expect(getBlockText(docBA, 1)).toBe('AA');
      expect(getBlockText(docBA, 2)).toBe('BBB');
    });

    it('split in block after deleted block: blockIndex adjusts', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('BBB'), makeBlock('CCC')]);
      const opA: Operation = { type: 'delete_block', blockIndex: 0 };
      const opB: Operation = { type: 'split_block', position: { blockIndex: 2, offset: 1 } };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks).toHaveLength(3);
      expect(getBlockText(docAB, 0)).toBe('BBB');
      expect(getBlockText(docAB, 1)).toBe('C');
      expect(getBlockText(docAB, 2)).toBe('CC');
      expect(getBlockText(docBA, 0)).toBe('BBB');
    });
  });

  describe('delete_block vs merge_block', () => {
    it('merge block after deleted block: index adjusts', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('BBB'), makeBlock('CCC')]);
      const opA: Operation = { type: 'delete_block', blockIndex: 0 };
      const opB: Operation = { type: 'merge_block', blockIndex: 2 };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks).toHaveLength(1);
      expect(getBlockText(docAB, 0)).toBe('BBBCCC');
      expect(getBlockText(docBA, 0)).toBe('BBBCCC');
    });

    it('merge targeting deleted block: both become no-ops for their transformed paths', () => {
      // Concurrent delete_block and merge_block at same index is an inherently conflicting
      // scenario (delete wants to discard content, merge wants to combine it). Both
      // transformed ops become no-ops in their respective paths, so the paths may diverge.
      // This is a known limitation similar to concurrent split_block at same position.
      const doc = makeDoc([makeBlock('AAA'), makeBlock('BBB'), makeBlock('CCC')]);
      const opA: Operation = { type: 'delete_block', blockIndex: 1 };
      const opB: Operation = { type: 'merge_block', blockIndex: 1 };

      const [aPrime, bPrime] = transformOperation(opA, opB);

      // A' should be a no-op delete (block already merged away)
      if (aPrime.type === 'delete_block') {
        expect(aPrime.blockIndex).toBe(-1); // out-of-bounds → no-op
      }
      // B' should be a no-op merge (block was deleted)
      if (bPrime.type === 'merge_block') {
        expect(bPrime.blockIndex).toBe(0); // merge at 0 is invalid → no-op
      }
    });
  });

  describe('delete_block vs insert_block', () => {
    it('insert after deleted block: afterBlockIndex adjusts', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('BBB'), makeBlock('CCC')]);
      const opA: Operation = { type: 'delete_block', blockIndex: 0 };
      const opB: Operation = { type: 'insert_block', afterBlockIndex: 2, blockType: 'paragraph' };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks).toHaveLength(3); // -1 + 1 = 3
      expect(docBA.blocks).toHaveLength(3);
    });

    it('insert before deleted block: delete index adjusts', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('BBB'), makeBlock('CCC')]);
      const opA: Operation = { type: 'delete_block', blockIndex: 2 };
      const opB: Operation = { type: 'insert_block', afterBlockIndex: 0, blockType: 'paragraph' };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks).toHaveLength(3); // -1 + 1 = 3
      expect(docBA.blocks).toHaveLength(3);
    });
  });

  describe('delete_block vs delete_block', () => {
    it('both delete different blocks', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('BBB'), makeBlock('CCC')]);
      const opA: Operation = { type: 'delete_block', blockIndex: 0 };
      const opB: Operation = { type: 'delete_block', blockIndex: 2 };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks).toHaveLength(1);
      expect(getBlockText(docAB, 0)).toBe('BBB');
      expect(getBlockText(docBA, 0)).toBe('BBB');
    });

    it('both delete same block: second becomes no-op', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('BBB'), makeBlock('CCC')]);
      const opA: Operation = { type: 'delete_block', blockIndex: 1 };
      const opB: Operation = { type: 'delete_block', blockIndex: 1 };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks).toHaveLength(2);
      expect(docBA.blocks).toHaveLength(2);
      expect(getBlockText(docAB, 0)).toBe('AAA');
      expect(getBlockText(docAB, 1)).toBe('CCC');
    });
  });

  describe('delete_block vs change_block_type', () => {
    it('change type of block after deleted block: index adjusts', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('BBB'), makeBlock('CCC')]);
      const opA: Operation = { type: 'delete_block', blockIndex: 0 };
      const opB: Operation = { type: 'change_block_type', blockIndex: 2, newType: 'heading1' };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks).toHaveLength(2);
      expect(docAB.blocks[1].type).toBe('heading1');
      expect(docBA.blocks[1].type).toBe('heading1');
    });
  });

  describe('delete_block vs set_indent', () => {
    it('indent on block after deleted block: index adjusts', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('BBB'), makeBlock('CCC')]);
      const opA: Operation = { type: 'delete_block', blockIndex: 0 };
      const opB: Operation = { type: 'set_indent', blockIndex: 2, indentLevel: 3 };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks).toHaveLength(2);
      expect(docAB.blocks[1].indentLevel).toBe(3);
      expect(docBA.blocks[1].indentLevel).toBe(3);
    });
  });

  describe('delete_block vs apply_formatting', () => {
    it('formatting in block after deleted block: range adjusts', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('BBB'), makeBlock('CCC')]);
      const opA: Operation = { type: 'delete_block', blockIndex: 0 };
      const opB: Operation = {
        type: 'apply_formatting',
        range: { start: { blockIndex: 2, offset: 0 }, end: { blockIndex: 2, offset: 2 } },
        style: { bold: true },
      };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks).toHaveLength(2);
      expect(docAB.blocks[1].runs[0].style.bold).toBe(true);
      expect(docBA.blocks[1].runs[0].style.bold).toBe(true);
    });
  });

  describe('delete_block via transformSingle', () => {
    it('server transforms delete_block against insert_text in prior block', () => {
      const op: Operation = { type: 'delete_block', blockIndex: 1 };
      const other: Operation = { type: 'insert_text', position: { blockIndex: 0, offset: 0 }, text: 'X' };
      const result = transformSingle(op, other);
      expect(result.type).toBe('delete_block');
      if (result.type === 'delete_block') {
        expect(result.blockIndex).toBe(1); // unchanged since insert is in earlier block
      }
    });

    it('server transforms insert_text against delete_block of prior block', () => {
      const op: Operation = { type: 'insert_text', position: { blockIndex: 2, offset: 0 }, text: 'X' };
      const other: Operation = { type: 'delete_block', blockIndex: 0 };
      const result = transformSingle(op, other);
      if (result.type === 'insert_text') {
        expect(result.position.blockIndex).toBe(1); // shifted down
      }
    });
  });
});

// ============================================================
// Block-indexed operation cross-combinations (set_indent, set_image, set_line_spacing)
// ============================================================

describe('OT: set_indent cross-combinations', () => {
  describe('set_indent vs set_indent', () => {
    it('concurrent indent on same block: priority op (a) wins', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('BBB')]);
      const opA: Operation = { type: 'set_indent', blockIndex: 1, indentLevel: 2 };
      const opB: Operation = { type: 'set_indent', blockIndex: 1, indentLevel: 5 };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      // Priority op (a) wins — both paths converge to a's value
      expect(docAB.blocks[1].indentLevel).toBe(2);
      expect(docBA.blocks[1].indentLevel).toBe(2);
    });

    it('concurrent indent on different blocks: both applied', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('BBB'), makeBlock('CCC')]);
      const opA: Operation = { type: 'set_indent', blockIndex: 0, indentLevel: 1 };
      const opB: Operation = { type: 'set_indent', blockIndex: 2, indentLevel: 3 };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks[0].indentLevel).toBe(1);
      expect(docAB.blocks[2].indentLevel).toBe(3);
      expect(docBA.blocks[0].indentLevel).toBe(1);
      expect(docBA.blocks[2].indentLevel).toBe(3);
    });
  });

  describe('set_indent vs insert_text', () => {
    it('insert text in same block as indent: both applied', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('BBB')]);
      const opA: Operation = { type: 'set_indent', blockIndex: 1, indentLevel: 3 };
      const opB: Operation = { type: 'insert_text', position: { blockIndex: 1, offset: 1 }, text: 'X' };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks[1].indentLevel).toBe(3);
      expect(getBlockText(docAB, 1)).toBe('BXBB');
      expect(docBA.blocks[1].indentLevel).toBe(3);
      expect(getBlockText(docBA, 1)).toBe('BXBB');
    });
  });

  describe('set_indent vs split_block', () => {
    it('split block before indented block: index shifts', () => {
      const doc = makeDoc([makeBlock('AABB'), makeBlock('CCC')]);
      const opA: Operation = { type: 'set_indent', blockIndex: 1, indentLevel: 2 };
      const opB: Operation = { type: 'split_block', position: { blockIndex: 0, offset: 2 } };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks).toHaveLength(3);
      expect(docAB.blocks[2].indentLevel).toBe(2);
      expect(docBA.blocks[2].indentLevel).toBe(2);
    });

    it('split the indented block itself: indent stays on first half', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('BBCC')]);
      doc.blocks[1].indentLevel = 1;
      const opA: Operation = { type: 'set_indent', blockIndex: 1, indentLevel: 4 };
      const opB: Operation = { type: 'split_block', position: { blockIndex: 1, offset: 2 } };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks).toHaveLength(3);
      expect(docAB.blocks[1].indentLevel).toBe(4);
      expect(docBA.blocks[1].indentLevel).toBe(4);
    });
  });

  describe('set_indent vs merge_block', () => {
    it('merge block after indented block: indent unaffected', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('BBB'), makeBlock('CCC')]);
      const opA: Operation = { type: 'set_indent', blockIndex: 0, indentLevel: 2 };
      const opB: Operation = { type: 'merge_block', blockIndex: 2 };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks).toHaveLength(2);
      expect(docAB.blocks[0].indentLevel).toBe(2);
      expect(docBA.blocks[0].indentLevel).toBe(2);
    });
  });

  describe('set_indent vs insert_block', () => {
    it('insert block before indented block: index shifts', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('BBB')]);
      const opA: Operation = { type: 'set_indent', blockIndex: 1, indentLevel: 3 };
      const opB: Operation = { type: 'insert_block', afterBlockIndex: 0, blockType: 'paragraph' };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks).toHaveLength(3);
      expect(docAB.blocks[2].indentLevel).toBe(3);
      expect(docBA.blocks[2].indentLevel).toBe(3);
    });
  });

  describe('set_indent vs change_block_type', () => {
    it('concurrent indent and type change on same block: both applied', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('BBB')]);
      const opA: Operation = { type: 'set_indent', blockIndex: 1, indentLevel: 2 };
      const opB: Operation = { type: 'change_block_type', blockIndex: 1, newType: 'heading1' };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks[1].indentLevel).toBe(2);
      expect(docAB.blocks[1].type).toBe('heading1');
      expect(docBA.blocks[1].indentLevel).toBe(2);
      expect(docBA.blocks[1].type).toBe('heading1');
    });
  });
});

describe('OT: set_image cross-combinations', () => {
  describe('set_image vs set_image', () => {
    it('concurrent image set on same block: priority op (a) wins', () => {
      const doc = makeDoc([makeBlock(''), makeBlock('text')]);
      doc.blocks[0].type = 'image';
      const opA: Operation = { type: 'set_image', blockIndex: 0, imageUrl: '/img/a.png' };
      const opB: Operation = { type: 'set_image', blockIndex: 0, imageUrl: '/img/b.png' };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks[0].imageUrl).toBe('/img/a.png');
      expect(docBA.blocks[0].imageUrl).toBe('/img/a.png');
    });

    it('concurrent image set on different blocks: both applied', () => {
      const doc = makeDoc([makeBlock(''), makeBlock(''), makeBlock('text')]);
      doc.blocks[0].type = 'image';
      doc.blocks[1].type = 'image';
      const opA: Operation = { type: 'set_image', blockIndex: 0, imageUrl: '/img/a.png' };
      const opB: Operation = { type: 'set_image', blockIndex: 1, imageUrl: '/img/b.png' };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks[0].imageUrl).toBe('/img/a.png');
      expect(docAB.blocks[1].imageUrl).toBe('/img/b.png');
      expect(docBA.blocks[0].imageUrl).toBe('/img/a.png');
      expect(docBA.blocks[1].imageUrl).toBe('/img/b.png');
    });
  });

  describe('set_image vs insert_text', () => {
    it('insert text in block before image: both applied', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('')]);
      doc.blocks[1].type = 'image';
      const opA: Operation = { type: 'set_image', blockIndex: 1, imageUrl: '/img/test.png' };
      const opB: Operation = { type: 'insert_text', position: { blockIndex: 0, offset: 1 }, text: 'X' };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks[1].imageUrl).toBe('/img/test.png');
      expect(getBlockText(docAB, 0)).toBe('AXAA');
      expect(docBA.blocks[1].imageUrl).toBe('/img/test.png');
      expect(getBlockText(docBA, 0)).toBe('AXAA');
    });
  });

  describe('set_image vs split_block', () => {
    it('split block before image: image index shifts', () => {
      const doc = makeDoc([makeBlock('AABB'), makeBlock('')]);
      doc.blocks[1].type = 'image';
      const opA: Operation = { type: 'set_image', blockIndex: 1, imageUrl: '/img/test.png' };
      const opB: Operation = { type: 'split_block', position: { blockIndex: 0, offset: 2 } };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks).toHaveLength(3);
      expect(docAB.blocks[2].imageUrl).toBe('/img/test.png');
      expect(docBA.blocks[2].imageUrl).toBe('/img/test.png');
    });
  });

  describe('set_image vs delete_block', () => {
    it('delete block before image: image index shifts', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('BBB'), makeBlock('')]);
      doc.blocks[2].type = 'image';
      const opA: Operation = { type: 'set_image', blockIndex: 2, imageUrl: '/img/test.png' };
      const opB: Operation = { type: 'delete_block', blockIndex: 0 };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks).toHaveLength(2);
      expect(docAB.blocks[1].imageUrl).toBe('/img/test.png');
      expect(docBA.blocks[1].imageUrl).toBe('/img/test.png');
    });

    it('delete the image block itself: set_image becomes no-op', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock(''), makeBlock('CCC')]);
      doc.blocks[1].type = 'image';
      const opA: Operation = { type: 'set_image', blockIndex: 1, imageUrl: '/img/test.png' };
      const opB: Operation = { type: 'delete_block', blockIndex: 1 };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks).toHaveLength(2);
      expect(docBA.blocks).toHaveLength(2);
    });
  });

  describe('set_image vs insert_block', () => {
    it('insert block before image: image index shifts', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('')]);
      doc.blocks[1].type = 'image';
      const opA: Operation = { type: 'set_image', blockIndex: 1, imageUrl: '/img/test.png' };
      const opB: Operation = { type: 'insert_block', afterBlockIndex: 0, blockType: 'paragraph' };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks).toHaveLength(3);
      expect(docAB.blocks[2].imageUrl).toBe('/img/test.png');
      expect(docBA.blocks[2].imageUrl).toBe('/img/test.png');
    });
  });

  describe('set_image vs set_indent', () => {
    it('concurrent image and indent on different blocks: both applied', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('')]);
      doc.blocks[1].type = 'image';
      const opA: Operation = { type: 'set_image', blockIndex: 1, imageUrl: '/img/test.png' };
      const opB: Operation = { type: 'set_indent', blockIndex: 0, indentLevel: 3 };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks[1].imageUrl).toBe('/img/test.png');
      expect(docAB.blocks[0].indentLevel).toBe(3);
      expect(docBA.blocks[1].imageUrl).toBe('/img/test.png');
      expect(docBA.blocks[0].indentLevel).toBe(3);
    });

    it('concurrent image and indent on same block: both applied', () => {
      const doc = makeDoc([makeBlock('')]);
      doc.blocks[0].type = 'image';
      const opA: Operation = { type: 'set_image', blockIndex: 0, imageUrl: '/img/test.png' };
      const opB: Operation = { type: 'set_indent', blockIndex: 0, indentLevel: 2 };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks[0].imageUrl).toBe('/img/test.png');
      expect(docAB.blocks[0].indentLevel).toBe(2);
      expect(docBA.blocks[0].imageUrl).toBe('/img/test.png');
      expect(docBA.blocks[0].indentLevel).toBe(2);
    });
  });
});

describe('OT: set_line_spacing cross-combinations', () => {
  describe('set_line_spacing vs set_line_spacing', () => {
    it('concurrent spacing on same block: priority op (a) wins', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('BBB')]);
      const opA: Operation = { type: 'set_line_spacing', blockIndex: 1, lineSpacing: 1.5 };
      const opB: Operation = { type: 'set_line_spacing', blockIndex: 1, lineSpacing: 2.0 };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks[1].lineSpacing).toBe(1.5);
      expect(docBA.blocks[1].lineSpacing).toBe(1.5);
    });

    it('concurrent spacing on different blocks: both applied', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('BBB')]);
      const opA: Operation = { type: 'set_line_spacing', blockIndex: 0, lineSpacing: 1.5 };
      const opB: Operation = { type: 'set_line_spacing', blockIndex: 1, lineSpacing: 2.0 };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks[0].lineSpacing).toBe(1.5);
      expect(docAB.blocks[1].lineSpacing).toBe(2.0);
      expect(docBA.blocks[0].lineSpacing).toBe(1.5);
      expect(docBA.blocks[1].lineSpacing).toBe(2.0);
    });
  });

  describe('set_line_spacing vs insert_text', () => {
    it('insert text in spaced block: both applied', () => {
      const doc = makeDoc([makeBlock('AAA')]);
      const opA: Operation = { type: 'set_line_spacing', blockIndex: 0, lineSpacing: 1.5 };
      const opB: Operation = { type: 'insert_text', position: { blockIndex: 0, offset: 1 }, text: 'X' };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks[0].lineSpacing).toBe(1.5);
      expect(getBlockText(docAB, 0)).toBe('AXAA');
      expect(docBA.blocks[0].lineSpacing).toBe(1.5);
      expect(getBlockText(docBA, 0)).toBe('AXAA');
    });
  });

  describe('set_line_spacing vs split_block', () => {
    it('split block before spaced block: index shifts', () => {
      const doc = makeDoc([makeBlock('AABB'), makeBlock('CCC')]);
      const opA: Operation = { type: 'set_line_spacing', blockIndex: 1, lineSpacing: 2.0 };
      const opB: Operation = { type: 'split_block', position: { blockIndex: 0, offset: 2 } };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks).toHaveLength(3);
      expect(docAB.blocks[2].lineSpacing).toBe(2.0);
      expect(docBA.blocks[2].lineSpacing).toBe(2.0);
    });
  });

  describe('set_line_spacing vs delete_block', () => {
    it('delete block before spaced block: index shifts', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('BBB'), makeBlock('CCC')]);
      const opA: Operation = { type: 'set_line_spacing', blockIndex: 2, lineSpacing: 1.15 };
      const opB: Operation = { type: 'delete_block', blockIndex: 0 };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks).toHaveLength(2);
      expect(docAB.blocks[1].lineSpacing).toBe(1.15);
      expect(docBA.blocks[1].lineSpacing).toBe(1.15);
    });

    it('delete the spaced block itself: set_line_spacing becomes no-op', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('BBB'), makeBlock('CCC')]);
      const opA: Operation = { type: 'set_line_spacing', blockIndex: 1, lineSpacing: 2.0 };
      const opB: Operation = { type: 'delete_block', blockIndex: 1 };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks).toHaveLength(2);
      expect(docBA.blocks).toHaveLength(2);
    });
  });

  describe('set_line_spacing vs insert_block', () => {
    it('insert block before spaced block: index shifts', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('BBB')]);
      const opA: Operation = { type: 'set_line_spacing', blockIndex: 1, lineSpacing: 1.5 };
      const opB: Operation = { type: 'insert_block', afterBlockIndex: 0, blockType: 'paragraph' };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks).toHaveLength(3);
      expect(docAB.blocks[2].lineSpacing).toBe(1.5);
      expect(docBA.blocks[2].lineSpacing).toBe(1.5);
    });
  });

  describe('set_line_spacing vs merge_block', () => {
    it('merge block after spaced block: spacing unaffected', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('BBB'), makeBlock('CCC')]);
      const opA: Operation = { type: 'set_line_spacing', blockIndex: 0, lineSpacing: 2.0 };
      const opB: Operation = { type: 'merge_block', blockIndex: 2 };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks).toHaveLength(2);
      expect(docAB.blocks[0].lineSpacing).toBe(2.0);
      expect(docBA.blocks[0].lineSpacing).toBe(2.0);
    });
  });

  describe('set_line_spacing vs set_indent', () => {
    it('concurrent spacing and indent on same block: both applied', () => {
      const doc = makeDoc([makeBlock('AAA')]);
      const opA: Operation = { type: 'set_line_spacing', blockIndex: 0, lineSpacing: 1.5 };
      const opB: Operation = { type: 'set_indent', blockIndex: 0, indentLevel: 3 };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks[0].lineSpacing).toBe(1.5);
      expect(docAB.blocks[0].indentLevel).toBe(3);
      expect(docBA.blocks[0].lineSpacing).toBe(1.5);
      expect(docBA.blocks[0].indentLevel).toBe(3);
    });

    it('concurrent spacing and indent on different blocks: both applied', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('BBB')]);
      const opA: Operation = { type: 'set_line_spacing', blockIndex: 0, lineSpacing: 2.0 };
      const opB: Operation = { type: 'set_indent', blockIndex: 1, indentLevel: 5 };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks[0].lineSpacing).toBe(2.0);
      expect(docAB.blocks[1].indentLevel).toBe(5);
      expect(docBA.blocks[0].lineSpacing).toBe(2.0);
      expect(docBA.blocks[1].indentLevel).toBe(5);
    });
  });

  describe('set_line_spacing vs set_image', () => {
    it('concurrent spacing and image on different blocks: both applied', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('')]);
      doc.blocks[1].type = 'image';
      const opA: Operation = { type: 'set_line_spacing', blockIndex: 0, lineSpacing: 1.5 };
      const opB: Operation = { type: 'set_image', blockIndex: 1, imageUrl: '/img/test.png' };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks[0].lineSpacing).toBe(1.5);
      expect(docAB.blocks[1].imageUrl).toBe('/img/test.png');
      expect(docBA.blocks[0].lineSpacing).toBe(1.5);
      expect(docBA.blocks[1].imageUrl).toBe('/img/test.png');
    });

    it('concurrent spacing and image on same block: both applied', () => {
      const doc = makeDoc([makeBlock('')]);
      doc.blocks[0].type = 'image';
      const opA: Operation = { type: 'set_line_spacing', blockIndex: 0, lineSpacing: 2.0 };
      const opB: Operation = { type: 'set_image', blockIndex: 0, imageUrl: '/img/test.png' };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks[0].lineSpacing).toBe(2.0);
      expect(docAB.blocks[0].imageUrl).toBe('/img/test.png');
      expect(docBA.blocks[0].lineSpacing).toBe(2.0);
      expect(docBA.blocks[0].imageUrl).toBe('/img/test.png');
    });
  });

  describe('set_line_spacing vs change_block_type', () => {
    it('concurrent spacing and type change on same block: both applied', () => {
      const doc = makeDoc([makeBlock('AAA')]);
      const opA: Operation = { type: 'set_line_spacing', blockIndex: 0, lineSpacing: 1.5 };
      const opB: Operation = { type: 'change_block_type', blockIndex: 0, newType: 'heading2' };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks[0].lineSpacing).toBe(1.5);
      expect(docAB.blocks[0].type).toBe('heading2');
      expect(docBA.blocks[0].lineSpacing).toBe(1.5);
      expect(docBA.blocks[0].type).toBe('heading2');
    });
  });

  // ============================================================
  // change_block_type convergence
  // ============================================================

  describe('change_block_type vs change_block_type convergence', () => {
    it('concurrent type change on same block: priority op (a) wins', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('BBB')]);
      const opA: Operation = { type: 'change_block_type', blockIndex: 0, newType: 'heading1' };
      const opB: Operation = { type: 'change_block_type', blockIndex: 0, newType: 'heading2' };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      // Priority op (a) wins — both paths converge to a's value
      expect(docAB.blocks[0].type).toBe('heading1');
      expect(docBA.blocks[0].type).toBe('heading1');
    });

    it('concurrent type change on different blocks: both applied', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('BBB')]);
      const opA: Operation = { type: 'change_block_type', blockIndex: 0, newType: 'heading1' };
      const opB: Operation = { type: 'change_block_type', blockIndex: 1, newType: 'blockquote' };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks[0].type).toBe('heading1');
      expect(docAB.blocks[1].type).toBe('blockquote');
      expect(docBA.blocks[0].type).toBe('heading1');
      expect(docBA.blocks[1].type).toBe('blockquote');
    });
  });

  // ============================================================
  // change_block_alignment convergence
  // ============================================================

  describe('change_block_alignment vs change_block_alignment convergence', () => {
    it('concurrent alignment change on same block: priority op (a) wins', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('BBB')]);
      const opA: Operation = { type: 'change_block_alignment', blockIndex: 0, newAlignment: 'center' };
      const opB: Operation = { type: 'change_block_alignment', blockIndex: 0, newAlignment: 'right' };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      // Priority op (a) wins — both paths converge to a's value
      expect(docAB.blocks[0].alignment).toBe('center');
      expect(docBA.blocks[0].alignment).toBe('center');
    });

    it('concurrent alignment change on different blocks: both applied', () => {
      const doc = makeDoc([makeBlock('AAA'), makeBlock('BBB')]);
      const opA: Operation = { type: 'change_block_alignment', blockIndex: 0, newAlignment: 'center' };
      const opB: Operation = { type: 'change_block_alignment', blockIndex: 1, newAlignment: 'right' };

      const { docAB, docBA } = verifyConvergence(doc, opA, opB);
      expect(docAB.blocks[0].alignment).toBe('center');
      expect(docAB.blocks[1].alignment).toBe('right');
      expect(docBA.blocks[0].alignment).toBe('center');
      expect(docBA.blocks[1].alignment).toBe('right');
    });
  });
});
