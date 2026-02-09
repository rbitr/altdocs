// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderDocumentToElement } from '../src/client/renderer.js';
import { generateBlockId, resetBlockIdCounter } from '../src/shared/model.js';
import type { Document, Block, TableCell } from '../src/shared/model.js';

function makeTableBlock(rows = 2, cols = 2, content?: string[][]): Block {
  const tableData: TableCell[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: TableCell[] = [];
    for (let c = 0; c < cols; c++) {
      const text = content?.[r]?.[c] || '';
      row.push({ runs: [{ text, style: {} }] });
    }
    tableData.push(row);
  }
  return {
    id: generateBlockId(),
    type: 'table',
    alignment: 'left',
    runs: [{ text: '', style: {} }],
    tableData,
  };
}

describe('Table Rendering', () => {
  beforeEach(() => {
    resetBlockIdCounter();
  });

  it('renders a table block as a table-block wrapper', () => {
    const doc: Document = {
      id: 'test',
      title: 'Test',
      blocks: [makeTableBlock()],
    };
    const el = renderDocumentToElement(doc);
    const wrapper = el.querySelector('.table-block');
    expect(wrapper).not.toBeNull();
    expect(wrapper!.getAttribute('data-block-id')).toBeTruthy();
  });

  it('renders a table element with tbody', () => {
    const doc: Document = {
      id: 'test',
      title: 'Test',
      blocks: [makeTableBlock()],
    };
    const el = renderDocumentToElement(doc);
    const table = el.querySelector('.altdocs-table');
    expect(table).not.toBeNull();
    expect(table!.querySelector('tbody')).not.toBeNull();
  });

  it('renders correct number of rows and cells', () => {
    const doc: Document = {
      id: 'test',
      title: 'Test',
      blocks: [makeTableBlock(3, 4)],
    };
    const el = renderDocumentToElement(doc);
    const rows = el.querySelectorAll('tr');
    expect(rows.length).toBe(3);
    rows.forEach((tr) => {
      expect(tr.querySelectorAll('td').length).toBe(4);
    });
  });

  it('renders cell content from text runs', () => {
    const doc: Document = {
      id: 'test',
      title: 'Test',
      blocks: [makeTableBlock(2, 2, [['Hello', 'World'], ['Foo', 'Bar']])],
    };
    const el = renderDocumentToElement(doc);
    const cells = el.querySelectorAll('td');
    expect(cells.length).toBe(4);
    expect(cells[0].textContent).toBe('Hello');
    expect(cells[1].textContent).toBe('World');
    expect(cells[2].textContent).toBe('Foo');
    expect(cells[3].textContent).toBe('Bar');
  });

  it('renders empty cells with <br>', () => {
    const doc: Document = {
      id: 'test',
      title: 'Test',
      blocks: [makeTableBlock(1, 1)],
    };
    const el = renderDocumentToElement(doc);
    const td = el.querySelector('td');
    expect(td).not.toBeNull();
    expect(td!.querySelector('br')).not.toBeNull();
  });

  it('renders data-row and data-col attributes on cells', () => {
    const doc: Document = {
      id: 'test',
      title: 'Test',
      blocks: [makeTableBlock(2, 3)],
    };
    const el = renderDocumentToElement(doc);
    const cells = el.querySelectorAll('td');

    expect(cells[0].dataset.row).toBe('0');
    expect(cells[0].dataset.col).toBe('0');
    expect(cells[2].dataset.row).toBe('0');
    expect(cells[2].dataset.col).toBe('2');
    expect(cells[3].dataset.row).toBe('1');
    expect(cells[3].dataset.col).toBe('0');
  });

  it('renders add-row and add-col buttons', () => {
    const doc: Document = {
      id: 'test',
      title: 'Test',
      blocks: [makeTableBlock()],
    };
    const el = renderDocumentToElement(doc);
    const addRow = el.querySelector('.table-add-row');
    const addCol = el.querySelector('.table-add-col');
    expect(addRow).not.toBeNull();
    expect(addCol).not.toBeNull();
    expect(addRow!.textContent).toBe('+ Row');
    expect(addCol!.textContent).toBe('+ Col');
  });

  it('renders styled text runs in cells', () => {
    const tableData: TableCell[][] = [
      [
        {
          runs: [
            { text: 'bold', style: { bold: true } },
            { text: ' and normal', style: {} },
          ],
        },
      ],
    ];
    const block: Block = {
      id: generateBlockId(),
      type: 'table',
      alignment: 'left',
      runs: [{ text: '', style: {} }],
      tableData,
    };
    const doc: Document = { id: 'test', title: 'Test', blocks: [block] };
    const el = renderDocumentToElement(doc);
    const td = el.querySelector('td');
    expect(td).not.toBeNull();
    const spans = td!.querySelectorAll('span');
    expect(spans.length).toBe(2);
    expect(spans[0].style.fontWeight).toBe('bold');
    expect(spans[0].textContent).toBe('bold');
    expect(spans[1].textContent).toBe(' and normal');
  });

  it('renders table with indent data attribute', () => {
    const block = makeTableBlock();
    block.indentLevel = 2;
    const doc: Document = { id: 'test', title: 'Test', blocks: [block] };
    const el = renderDocumentToElement(doc);
    const wrapper = el.querySelector('.table-block');
    expect(wrapper!.getAttribute('data-indent')).toBe('2');
  });

  it('renders table among other blocks', () => {
    const doc: Document = {
      id: 'test',
      title: 'Test',
      blocks: [
        { id: generateBlockId(), type: 'paragraph', alignment: 'left', runs: [{ text: 'Before', style: {} }] },
        makeTableBlock(1, 1, [['Cell']]),
        { id: generateBlockId(), type: 'paragraph', alignment: 'left', runs: [{ text: 'After', style: {} }] },
      ],
    };
    const el = renderDocumentToElement(doc);
    const children = el.children;
    expect(children.length).toBe(3);
    expect(children[0].tagName).toBe('P');
    expect(children[1].classList.contains('table-block')).toBe(true);
    expect(children[2].tagName).toBe('P');
  });
});
