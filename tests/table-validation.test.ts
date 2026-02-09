import { describe, it, expect } from 'vitest';
import { validateContent } from '../src/shared/validation.js';

function makeTableBlock(tableData?: unknown) {
  const block: Record<string, unknown> = {
    id: 'block_1',
    type: 'table',
    alignment: 'left',
    runs: [{ text: '', style: {} }],
  };
  if (tableData !== undefined) {
    block.tableData = tableData;
  }
  return block;
}

describe('Table Validation', () => {
  it('accepts valid table block with tableData', () => {
    const block = makeTableBlock([
      [
        { runs: [{ text: 'A1', style: {} }] },
        { runs: [{ text: 'B1', style: {} }] },
      ],
      [
        { runs: [{ text: 'A2', style: {} }] },
        { runs: [{ text: 'B2', style: {} }] },
      ],
    ]);
    const result = validateContent(JSON.stringify([block]));
    expect(result).toBeNull();
  });

  it('accepts table block without tableData', () => {
    const block = makeTableBlock();
    const result = validateContent(JSON.stringify([block]));
    expect(result).toBeNull();
  });

  it('accepts 1x1 table', () => {
    const block = makeTableBlock([[{ runs: [{ text: '', style: {} }] }]]);
    const result = validateContent(JSON.stringify([block]));
    expect(result).toBeNull();
  });

  it('rejects non-array tableData', () => {
    const block = makeTableBlock('not an array');
    const result = validateContent(JSON.stringify([block]));
    expect(result).toContain('tableData');
    expect(result).toContain('must be an array');
  });

  it('rejects empty tableData array', () => {
    const block = makeTableBlock([]);
    const result = validateContent(JSON.stringify([block]));
    expect(result).toContain('at least one row');
  });

  it('rejects non-array row', () => {
    const block = makeTableBlock([
      [{ runs: [{ text: '', style: {} }] }],
      'not a row',
    ]);
    const result = validateContent(JSON.stringify([block]));
    expect(result).toContain('row 1 must be an array');
  });

  it('rejects empty row', () => {
    const block = makeTableBlock([[]]);
    const result = validateContent(JSON.stringify([block]));
    expect(result).toContain('at least one cell');
  });

  it('rejects inconsistent column counts', () => {
    const block = makeTableBlock([
      [{ runs: [{ text: '', style: {} }] }, { runs: [{ text: '', style: {} }] }],
      [{ runs: [{ text: '', style: {} }] }], // only 1 cell
    ]);
    const result = validateContent(JSON.stringify([block]));
    expect(result).toContain('row 1 has 1 cells, expected 2');
  });

  it('rejects non-object cell', () => {
    const block = makeTableBlock([['not an object']]);
    const result = validateContent(JSON.stringify([block]));
    expect(result).toContain('cell [0][0] must be an object');
  });

  it('rejects cell without runs array', () => {
    const block = makeTableBlock([[{ runs: 'not an array' }]]);
    const result = validateContent(JSON.stringify([block]));
    expect(result).toContain("'runs' must be an array");
  });

  it('rejects cell with empty runs', () => {
    const block = makeTableBlock([[{ runs: [] }]]);
    const result = validateContent(JSON.stringify([block]));
    expect(result).toContain("'runs' must have at least one element");
  });

  it('rejects cell with invalid run', () => {
    const block = makeTableBlock([[{ runs: [{ text: 123, style: {} }] }]]);
    const result = validateContent(JSON.stringify([block]));
    expect(result).toContain("'text' must be a string");
  });

  it('rejects cell with invalid style key', () => {
    const block = makeTableBlock([[{ runs: [{ text: 'ok', style: { badKey: true } }] }]]);
    const result = validateContent(JSON.stringify([block]));
    expect(result).toContain("unknown style key 'badKey'");
  });

  it('accepts table block as "table" type', () => {
    const content = JSON.stringify([{
      id: 'b1',
      type: 'table',
      alignment: 'left',
      runs: [{ text: '', style: {} }],
    }]);
    expect(validateContent(content)).toBeNull();
  });
});
