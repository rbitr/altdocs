/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resolvePosition, resolveDocumentPosition } from '../src/client/cursor-renderer.js';
import { renderDocument } from '../src/client/renderer.js';
import type { Document, Block, TextRun } from '../src/shared/model.js';

// ============================================================
// Test Helpers
// ============================================================

function makeDoc(blocks: Block[]): Document {
  return { id: 'test-doc', title: 'Test', blocks };
}

function makeBlock(
  id: string,
  text: string,
  type: Block['type'] = 'paragraph',
  alignment: Block['alignment'] = 'left'
): Block {
  return { id, type, alignment, runs: [{ text, style: {} }] };
}

function makeStyledBlock(
  id: string,
  runs: TextRun[],
  type: Block['type'] = 'paragraph',
  alignment: Block['alignment'] = 'left'
): Block {
  return { id, type, alignment, runs };
}

function setupRenderedDoc(doc: Document): HTMLElement {
  const container = document.createElement('div');
  renderDocument(doc, container);
  return container;
}

// ============================================================
// resolvePosition
// ============================================================

describe('resolvePosition', () => {
  it('resolves position at start of single-run block', () => {
    const doc = makeDoc([makeBlock('b1', 'Hello')]);
    const container = setupRenderedDoc(doc);

    const result = resolvePosition(container, doc, { blockIndex: 0, offset: 0 });
    expect(result).not.toBeNull();
    expect(result!.offset).toBe(0);
    expect(result!.node.textContent).toBe('Hello');
  });

  it('resolves position in middle of single-run block', () => {
    const doc = makeDoc([makeBlock('b1', 'Hello')]);
    const container = setupRenderedDoc(doc);

    const result = resolvePosition(container, doc, { blockIndex: 0, offset: 3 });
    expect(result).not.toBeNull();
    expect(result!.offset).toBe(3);
    expect(result!.node.textContent).toBe('Hello');
  });

  it('resolves position at end of single-run block', () => {
    const doc = makeDoc([makeBlock('b1', 'Hello')]);
    const container = setupRenderedDoc(doc);

    const result = resolvePosition(container, doc, { blockIndex: 0, offset: 5 });
    expect(result).not.toBeNull();
    expect(result!.offset).toBe(5);
    expect(result!.node.textContent).toBe('Hello');
  });

  it('resolves position in second run of multi-run block', () => {
    const doc = makeDoc([
      makeStyledBlock('b1', [
        { text: 'Hello', style: {} },
        { text: ' World', style: { bold: true } },
      ]),
    ]);
    const container = setupRenderedDoc(doc);

    // offset 7 = "Hello " (5) + "Wo" (2) => second span, offset 2
    const result = resolvePosition(container, doc, { blockIndex: 0, offset: 7 });
    expect(result).not.toBeNull();
    expect(result!.offset).toBe(2);
    expect(result!.node.textContent).toBe(' World');
  });

  it('resolves position at boundary between runs', () => {
    const doc = makeDoc([
      makeStyledBlock('b1', [
        { text: 'Hello', style: {} },
        { text: ' World', style: { bold: true } },
      ]),
    ]);
    const container = setupRenderedDoc(doc);

    // offset 5 = exactly at the end of "Hello" / start of " World"
    // resolvePosition walks spans: remaining=5, first span len=5, 5 <= 5 => return first span offset 5
    const result = resolvePosition(container, doc, { blockIndex: 0, offset: 5 });
    expect(result).not.toBeNull();
    expect(result!.offset).toBe(5);
    expect(result!.node.textContent).toBe('Hello');
  });

  it('resolves position in second block', () => {
    const doc = makeDoc([
      makeBlock('b1', 'First'),
      makeBlock('b2', 'Second'),
    ]);
    const container = setupRenderedDoc(doc);

    const result = resolvePosition(container, doc, { blockIndex: 1, offset: 3 });
    expect(result).not.toBeNull();
    expect(result!.offset).toBe(3);
    expect(result!.node.textContent).toBe('Second');
  });

  it('resolves position in empty block to the block element', () => {
    const doc = makeDoc([makeBlock('b1', '')]);
    const container = setupRenderedDoc(doc);

    const result = resolvePosition(container, doc, { blockIndex: 0, offset: 0 });
    expect(result).not.toBeNull();
    // Empty blocks have <br> so resolvePosition falls through to the block element
    // Spans query returns empty, so it falls to "Empty block" case
    expect(result!.offset).toBe(0);
  });

  it('returns null for out-of-range block index', () => {
    const doc = makeDoc([makeBlock('b1', 'Hello')]);
    const container = setupRenderedDoc(doc);

    const result = resolvePosition(container, doc, { blockIndex: 5, offset: 0 });
    expect(result).toBeNull();
  });

  it('returns null for negative block index', () => {
    const doc = makeDoc([makeBlock('b1', 'Hello')]);
    const container = setupRenderedDoc(doc);

    const result = resolvePosition(container, doc, { blockIndex: -1, offset: 0 });
    expect(result).toBeNull();
  });

  it('resolves position in a heading block', () => {
    const doc = makeDoc([makeBlock('b1', 'Title', 'heading1')]);
    const container = setupRenderedDoc(doc);

    const result = resolvePosition(container, doc, { blockIndex: 0, offset: 2 });
    expect(result).not.toBeNull();
    expect(result!.offset).toBe(2);
    expect(result!.node.textContent).toBe('Title');
  });

  it('resolves position in a list item within ul', () => {
    const doc = makeDoc([makeBlock('b1', 'Item 1', 'bullet-list-item')]);
    const container = setupRenderedDoc(doc);

    const result = resolvePosition(container, doc, { blockIndex: 0, offset: 4 });
    expect(result).not.toBeNull();
    expect(result!.offset).toBe(4);
    expect(result!.node.textContent).toBe('Item 1');
  });

  it('resolves position in a blockquote', () => {
    const doc = makeDoc([makeBlock('b1', 'Quoted text', 'blockquote')]);
    const container = setupRenderedDoc(doc);

    const result = resolvePosition(container, doc, { blockIndex: 0, offset: 6 });
    expect(result).not.toBeNull();
    expect(result!.offset).toBe(6);
  });

  it('handles offset beyond text length gracefully', () => {
    const doc = makeDoc([makeBlock('b1', 'Hi')]);
    const container = setupRenderedDoc(doc);

    // offset 10 > text length 2 — should fall through to last text node
    const result = resolvePosition(container, doc, { blockIndex: 0, offset: 10 });
    expect(result).not.toBeNull();
    // Falls through loop, lands on last span's text node at its end
    expect(result!.offset).toBe(2);
  });

  it('resolves position for horizontal rule block', () => {
    const doc = makeDoc([makeBlock('b1', '', 'horizontal-rule')]);
    const container = setupRenderedDoc(doc);

    const result = resolvePosition(container, doc, { blockIndex: 0, offset: 0 });
    expect(result).not.toBeNull();
    // HR has no spans, returns {node: blockEl, offset: 0}
    expect(result!.offset).toBe(0);
  });

  it('resolves position with three runs', () => {
    const doc = makeDoc([
      makeStyledBlock('b1', [
        { text: 'AAA', style: {} },
        { text: 'BBB', style: { bold: true } },
        { text: 'CCC', style: { italic: true } },
      ]),
    ]);
    const container = setupRenderedDoc(doc);

    // offset 7 = 3 (AAA) + 3 (BBB) + 1 => third span, offset 1
    const result = resolvePosition(container, doc, { blockIndex: 0, offset: 7 });
    expect(result).not.toBeNull();
    expect(result!.offset).toBe(1);
    expect(result!.node.textContent).toBe('CCC');
  });
});

// ============================================================
// resolveDocumentPosition
// ============================================================

describe('resolveDocumentPosition', () => {
  it('resolves a text node in first span back to document position', () => {
    const doc = makeDoc([makeBlock('b1', 'Hello')]);
    const container = setupRenderedDoc(doc);

    const blockEl = container.querySelector('[data-block-id="b1"]')!;
    const span = blockEl.querySelector('span')!;
    const textNode = span.firstChild!;

    const result = resolveDocumentPosition(container, doc, textNode, 3);
    expect(result).not.toBeNull();
    expect(result!.blockIndex).toBe(0);
    expect(result!.offset).toBe(3);
  });

  it('resolves text node in second span with accumulated offset', () => {
    const doc = makeDoc([
      makeStyledBlock('b1', [
        { text: 'Hello', style: {} },
        { text: ' World', style: { bold: true } },
      ]),
    ]);
    const container = setupRenderedDoc(doc);

    const blockEl = container.querySelector('[data-block-id="b1"]')!;
    const spans = blockEl.querySelectorAll('span');
    const secondSpan = spans[1];
    const textNode = secondSpan.firstChild!;

    // DOM offset 2 within second span => document offset = 5 ("Hello") + 2 = 7
    const result = resolveDocumentPosition(container, doc, textNode, 2);
    expect(result).not.toBeNull();
    expect(result!.blockIndex).toBe(0);
    expect(result!.offset).toBe(7);
  });

  it('resolves position in second block', () => {
    const doc = makeDoc([
      makeBlock('b1', 'First'),
      makeBlock('b2', 'Second'),
    ]);
    const container = setupRenderedDoc(doc);

    const blockEl = container.querySelector('[data-block-id="b2"]')!;
    const span = blockEl.querySelector('span')!;
    const textNode = span.firstChild!;

    const result = resolveDocumentPosition(container, doc, textNode, 4);
    expect(result).not.toBeNull();
    expect(result!.blockIndex).toBe(1);
    expect(result!.offset).toBe(4);
  });

  it('returns null for node outside the container', () => {
    const doc = makeDoc([makeBlock('b1', 'Hello')]);
    const container = setupRenderedDoc(doc);

    const outsideNode = document.createTextNode('outside');
    document.body.appendChild(outsideNode);

    const result = resolveDocumentPosition(container, doc, outsideNode, 0);
    expect(result).toBeNull();

    document.body.removeChild(outsideNode);
  });

  it('returns null for node in container but without data-block-id ancestor', () => {
    const doc = makeDoc([makeBlock('b1', 'Hello')]);
    const container = setupRenderedDoc(doc);

    // Add a rogue element to the container without data-block-id
    const rogue = document.createElement('div');
    rogue.textContent = 'rogue';
    container.appendChild(rogue);

    const result = resolveDocumentPosition(container, doc, rogue.firstChild!, 0);
    expect(result).toBeNull();
  });

  it('resolves position in a list item', () => {
    const doc = makeDoc([
      makeBlock('b1', 'Item one', 'bullet-list-item'),
      makeBlock('b2', 'Item two', 'bullet-list-item'),
    ]);
    const container = setupRenderedDoc(doc);

    const blockEl = container.querySelector('[data-block-id="b2"]')!;
    const span = blockEl.querySelector('span')!;
    const textNode = span.firstChild!;

    const result = resolveDocumentPosition(container, doc, textNode, 4);
    expect(result).not.toBeNull();
    expect(result!.blockIndex).toBe(1);
    expect(result!.offset).toBe(4);
  });

  it('falls back to block end for node not found in spans', () => {
    const doc = makeDoc([makeBlock('b1', 'Hello')]);
    const container = setupRenderedDoc(doc);

    // Use the block element itself (not a text node inside a span)
    const blockEl = container.querySelector('[data-block-id="b1"]')! as HTMLElement;

    const result = resolveDocumentPosition(container, doc, blockEl, 0);
    expect(result).not.toBeNull();
    expect(result!.blockIndex).toBe(0);
    // Falls through to blockTextLength fallback
    expect(result!.offset).toBe(5);
  });

  it('resolves a span element (not text node) correctly', () => {
    const doc = makeDoc([makeBlock('b1', 'Hello')]);
    const container = setupRenderedDoc(doc);

    const blockEl = container.querySelector('[data-block-id="b1"]')!;
    const span = blockEl.querySelector('span')!;

    // Passing span element (parentElement of text) — span.contains(span) is true
    const result = resolveDocumentPosition(container, doc, span, 3);
    expect(result).not.toBeNull();
    expect(result!.blockIndex).toBe(0);
    expect(result!.offset).toBe(3);
  });

  it('resolves position with three runs in third span', () => {
    const doc = makeDoc([
      makeStyledBlock('b1', [
        { text: 'AAA', style: {} },
        { text: 'BBB', style: { bold: true } },
        { text: 'CCC', style: { italic: true } },
      ]),
    ]);
    const container = setupRenderedDoc(doc);

    const blockEl = container.querySelector('[data-block-id="b1"]')!;
    const spans = blockEl.querySelectorAll('span');
    const thirdSpan = spans[2];
    const textNode = thirdSpan.firstChild!;

    // DOM offset 2 in third span => doc offset = 3 + 3 + 2 = 8
    const result = resolveDocumentPosition(container, doc, textNode, 2);
    expect(result).not.toBeNull();
    expect(result!.blockIndex).toBe(0);
    expect(result!.offset).toBe(8);
  });

  it('resolves position at offset 0 in first span', () => {
    const doc = makeDoc([makeBlock('b1', 'Test')]);
    const container = setupRenderedDoc(doc);

    const blockEl = container.querySelector('[data-block-id="b1"]')!;
    const span = blockEl.querySelector('span')!;
    const textNode = span.firstChild!;

    const result = resolveDocumentPosition(container, doc, textNode, 0);
    expect(result).not.toBeNull();
    expect(result!.blockIndex).toBe(0);
    expect(result!.offset).toBe(0);
  });

  it('returns null when block id does not match any document block', () => {
    const doc = makeDoc([makeBlock('b1', 'Hello')]);
    const container = setupRenderedDoc(doc);

    // Manually create a block element with a non-matching id
    const fakeBlock = document.createElement('p');
    fakeBlock.dataset.blockId = 'nonexistent';
    fakeBlock.textContent = 'fake';
    container.appendChild(fakeBlock);

    const result = resolveDocumentPosition(container, doc, fakeBlock.firstChild!, 0);
    expect(result).toBeNull();
  });
});
