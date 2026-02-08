/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderDocument, renderDocumentToElement } from '../src/client/renderer.js';
import type { Document, Block, TextRun } from '../src/shared/model.js';

// ============================================================
// Test Helpers
// ============================================================

function makeDoc(blocks: Block[]): Document {
  return { id: 'test-doc', title: 'Test', blocks };
}

function makeBlock(
  text: string,
  type: Block['type'] = 'paragraph',
  alignment: Block['alignment'] = 'left'
): Block {
  return {
    id: `b-${Math.random()}`,
    type,
    alignment,
    runs: [{ text, style: {} }],
  };
}

function makeStyledBlock(
  runs: TextRun[],
  type: Block['type'] = 'paragraph',
  alignment: Block['alignment'] = 'left'
): Block {
  return {
    id: `b-${Math.random()}`,
    type,
    alignment,
    runs,
  };
}

// ============================================================
// Tests
// ============================================================

describe('renderDocument', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  describe('block rendering', () => {
    it('renders a paragraph as a <p> element', () => {
      const doc = makeDoc([makeBlock('Hello world')]);
      renderDocument(doc, container);
      const p = container.querySelector('p');
      expect(p).not.toBeNull();
      expect(p!.textContent).toBe('Hello world');
    });

    it('renders heading1 as <h1>', () => {
      const doc = makeDoc([makeBlock('Title', 'heading1')]);
      renderDocument(doc, container);
      const h1 = container.querySelector('h1');
      expect(h1).not.toBeNull();
      expect(h1!.textContent).toBe('Title');
    });

    it('renders heading2 as <h2>', () => {
      const doc = makeDoc([makeBlock('Subtitle', 'heading2')]);
      renderDocument(doc, container);
      const h2 = container.querySelector('h2');
      expect(h2).not.toBeNull();
      expect(h2!.textContent).toBe('Subtitle');
    });

    it('renders heading3 as <h3>', () => {
      const doc = makeDoc([makeBlock('Section', 'heading3')]);
      renderDocument(doc, container);
      const h3 = container.querySelector('h3');
      expect(h3).not.toBeNull();
      expect(h3!.textContent).toBe('Section');
    });

    it('renders bullet list items wrapped in <ul>', () => {
      const doc = makeDoc([
        makeBlock('Item 1', 'bullet-list-item'),
        makeBlock('Item 2', 'bullet-list-item'),
      ]);
      renderDocument(doc, container);
      const ul = container.querySelector('ul');
      expect(ul).not.toBeNull();
      const items = ul!.querySelectorAll('li');
      expect(items).toHaveLength(2);
      expect(items[0].textContent).toBe('Item 1');
      expect(items[1].textContent).toBe('Item 2');
    });

    it('renders numbered list items wrapped in <ol>', () => {
      const doc = makeDoc([
        makeBlock('First', 'numbered-list-item'),
        makeBlock('Second', 'numbered-list-item'),
      ]);
      renderDocument(doc, container);
      const ol = container.querySelector('ol');
      expect(ol).not.toBeNull();
      const items = ol!.querySelectorAll('li');
      expect(items).toHaveLength(2);
      expect(items[0].textContent).toBe('First');
      expect(items[1].textContent).toBe('Second');
    });

    it('separates different list types into different lists', () => {
      const doc = makeDoc([
        makeBlock('Bullet', 'bullet-list-item'),
        makeBlock('Numbered', 'numbered-list-item'),
      ]);
      renderDocument(doc, container);
      const ul = container.querySelector('ul');
      const ol = container.querySelector('ol');
      expect(ul).not.toBeNull();
      expect(ol).not.toBeNull();
      expect(ul!.children).toHaveLength(1);
      expect(ol!.children).toHaveLength(1);
    });

    it('renders multiple blocks in order', () => {
      const doc = makeDoc([
        makeBlock('Title', 'heading1'),
        makeBlock('Paragraph text'),
        makeBlock('Item', 'bullet-list-item'),
      ]);
      renderDocument(doc, container);
      const children = container.children;
      expect(children[0].tagName).toBe('H1');
      expect(children[1].tagName).toBe('P');
      expect(children[2].tagName).toBe('UL');
    });

    it('sets data-block-id attribute', () => {
      const doc = makeDoc([{
        id: 'block-123',
        type: 'paragraph',
        alignment: 'left',
        runs: [{ text: 'test', style: {} }],
      }]);
      renderDocument(doc, container);
      const p = container.querySelector('p');
      expect(p!.dataset.blockId).toBe('block-123');
    });
  });

  describe('alignment rendering', () => {
    it('renders center-aligned block', () => {
      const doc = makeDoc([makeBlock('Centered', 'paragraph', 'center')]);
      renderDocument(doc, container);
      const p = container.querySelector('p');
      expect(p!.style.textAlign).toBe('center');
    });

    it('renders right-aligned block', () => {
      const doc = makeDoc([makeBlock('Right', 'paragraph', 'right')]);
      renderDocument(doc, container);
      const p = container.querySelector('p');
      expect(p!.style.textAlign).toBe('right');
    });

    it('does not set text-align for left-aligned block (default)', () => {
      const doc = makeDoc([makeBlock('Left', 'paragraph', 'left')]);
      renderDocument(doc, container);
      const p = container.querySelector('p');
      expect(p!.style.textAlign).toBe('');
    });
  });

  describe('inline formatting rendering', () => {
    it('renders bold text with font-weight bold', () => {
      const doc = makeDoc([
        makeStyledBlock([{ text: 'bold text', style: { bold: true } }]),
      ]);
      renderDocument(doc, container);
      const span = container.querySelector('span');
      expect(span!.style.fontWeight).toBe('bold');
    });

    it('renders italic text with font-style italic', () => {
      const doc = makeDoc([
        makeStyledBlock([{ text: 'italic text', style: { italic: true } }]),
      ]);
      renderDocument(doc, container);
      const span = container.querySelector('span');
      expect(span!.style.fontStyle).toBe('italic');
    });

    it('renders underlined text', () => {
      const doc = makeDoc([
        makeStyledBlock([{ text: 'underlined', style: { underline: true } }]),
      ]);
      renderDocument(doc, container);
      const span = container.querySelector('span');
      expect(span!.style.textDecoration).toContain('underline');
    });

    it('renders strikethrough text', () => {
      const doc = makeDoc([
        makeStyledBlock([{ text: 'struck', style: { strikethrough: true } }]),
      ]);
      renderDocument(doc, container);
      const span = container.querySelector('span');
      expect(span!.style.textDecoration).toContain('line-through');
    });

    it('renders combined underline and strikethrough', () => {
      const doc = makeDoc([
        makeStyledBlock([
          { text: 'both', style: { underline: true, strikethrough: true } },
        ]),
      ]);
      renderDocument(doc, container);
      const span = container.querySelector('span');
      expect(span!.style.textDecoration).toContain('underline');
      expect(span!.style.textDecoration).toContain('line-through');
    });

    it('renders multiple runs with different styles', () => {
      const doc = makeDoc([
        makeStyledBlock([
          { text: 'normal ', style: {} },
          { text: 'bold ', style: { bold: true } },
          { text: 'italic', style: { italic: true } },
        ]),
      ]);
      renderDocument(doc, container);
      const spans = container.querySelectorAll('span');
      expect(spans).toHaveLength(3);
      expect(spans[0].textContent).toBe('normal ');
      expect(spans[0].style.fontWeight).toBe('');
      expect(spans[1].textContent).toBe('bold ');
      expect(spans[1].style.fontWeight).toBe('bold');
      expect(spans[2].textContent).toBe('italic');
      expect(spans[2].style.fontStyle).toBe('italic');
    });

    it('renders unstyled text without inline styles', () => {
      const doc = makeDoc([
        makeStyledBlock([{ text: 'plain', style: {} }]),
      ]);
      renderDocument(doc, container);
      const span = container.querySelector('span');
      expect(span!.style.fontWeight).toBe('');
      expect(span!.style.fontStyle).toBe('');
      expect(span!.style.textDecoration).toBe('');
    });

    it('renders text with fontSize', () => {
      const doc = makeDoc([
        makeStyledBlock([{ text: 'big text', style: { fontSize: 24 } }]),
      ]);
      renderDocument(doc, container);
      const span = container.querySelector('span');
      expect(span!.style.fontSize).toBe('24px');
    });

    it('renders text with fontFamily', () => {
      const doc = makeDoc([
        makeStyledBlock([{ text: 'styled', style: { fontFamily: 'Georgia' } }]),
      ]);
      renderDocument(doc, container);
      const span = container.querySelector('span');
      expect(span!.style.fontFamily).toBe('Georgia');
    });

    it('renders text with both fontSize and fontFamily', () => {
      const doc = makeDoc([
        makeStyledBlock([{ text: 'styled', style: { fontSize: 18, fontFamily: 'Arial' } }]),
      ]);
      renderDocument(doc, container);
      const span = container.querySelector('span');
      expect(span!.style.fontSize).toBe('18px');
      expect(span!.style.fontFamily).toBe('Arial');
    });

    it('does not set fontSize for unstyled text', () => {
      const doc = makeDoc([
        makeStyledBlock([{ text: 'plain', style: {} }]),
      ]);
      renderDocument(doc, container);
      const span = container.querySelector('span');
      expect(span!.style.fontSize).toBe('');
    });

    it('renders text with color', () => {
      const doc = makeDoc([
        makeStyledBlock([{ text: 'red text', style: { color: '#ff0000' } }]),
      ]);
      renderDocument(doc, container);
      const span = container.querySelector('span');
      expect(span!.style.color).toBe('rgb(255, 0, 0)');
    });

    it('renders text with backgroundColor', () => {
      const doc = makeDoc([
        makeStyledBlock([{ text: 'highlighted', style: { backgroundColor: '#ffff00' } }]),
      ]);
      renderDocument(doc, container);
      const span = container.querySelector('span');
      expect(span!.style.backgroundColor).toBe('rgb(255, 255, 0)');
    });

    it('renders text with both color and backgroundColor', () => {
      const doc = makeDoc([
        makeStyledBlock([{ text: 'styled', style: { color: '#0000ff', backgroundColor: '#ffff00' } }]),
      ]);
      renderDocument(doc, container);
      const span = container.querySelector('span');
      expect(span!.style.color).toBe('rgb(0, 0, 255)');
      expect(span!.style.backgroundColor).toBe('rgb(255, 255, 0)');
    });

    it('does not set color for unstyled text', () => {
      const doc = makeDoc([
        makeStyledBlock([{ text: 'plain', style: {} }]),
      ]);
      renderDocument(doc, container);
      const span = container.querySelector('span');
      expect(span!.style.color).toBe('');
      expect(span!.style.backgroundColor).toBe('');
    });

    it('renders mixed color runs', () => {
      const doc = makeDoc([
        makeStyledBlock([
          { text: 'normal ', style: {} },
          { text: 'red', style: { color: '#ff0000' } },
          { text: ' and ', style: {} },
          { text: 'highlighted', style: { backgroundColor: '#00ff00' } },
        ]),
      ]);
      renderDocument(doc, container);
      const spans = container.querySelectorAll('span');
      expect(spans[0].style.color).toBe('');
      expect(spans[1].style.color).toBe('rgb(255, 0, 0)');
      expect(spans[2].style.color).toBe('');
      expect(spans[3].style.backgroundColor).toBe('rgb(0, 255, 0)');
    });

    it('renders mixed font size runs', () => {
      const doc = makeDoc([
        makeStyledBlock([
          { text: 'normal ', style: {} },
          { text: 'big', style: { fontSize: 36 } },
        ]),
      ]);
      renderDocument(doc, container);
      const spans = container.querySelectorAll('span');
      expect(spans[0].style.fontSize).toBe('');
      expect(spans[1].style.fontSize).toBe('36px');
    });
  });

  describe('re-rendering', () => {
    it('clears previous content on re-render', () => {
      const doc1 = makeDoc([makeBlock('First')]);
      renderDocument(doc1, container);
      expect(container.querySelector('p')!.textContent).toBe('First');

      const doc2 = makeDoc([makeBlock('Second')]);
      renderDocument(doc2, container);
      expect(container.querySelectorAll('p')).toHaveLength(1);
      expect(container.querySelector('p')!.textContent).toBe('Second');
    });
  });

  describe('renderDocumentToElement', () => {
    it('returns a div with class altdocs-editor', () => {
      const doc = makeDoc([makeBlock('Hello')]);
      const el = renderDocumentToElement(doc);
      expect(el.tagName).toBe('DIV');
      expect(el.className).toBe('altdocs-editor');
    });

    it('contains rendered content', () => {
      const doc = makeDoc([makeBlock('Hello')]);
      const el = renderDocumentToElement(doc);
      expect(el.querySelector('p')!.textContent).toBe('Hello');
    });
  });

  describe('blockquote rendering', () => {
    it('renders a blockquote as <blockquote>', () => {
      const doc = makeDoc([makeBlock('A quote', 'blockquote')]);
      renderDocument(doc, container);
      const bq = container.querySelector('blockquote');
      expect(bq).not.toBeNull();
      expect(bq!.textContent).toBe('A quote');
    });

    it('renders empty blockquote with <br>', () => {
      const doc = makeDoc([makeBlock('', 'blockquote')]);
      renderDocument(doc, container);
      const bq = container.querySelector('blockquote');
      expect(bq).not.toBeNull();
      expect(bq!.querySelector('br')).not.toBeNull();
    });

    it('sets data-block-id on blockquote', () => {
      const doc = makeDoc([{
        id: 'bq-1',
        type: 'blockquote' as const,
        alignment: 'left' as const,
        runs: [{ text: 'quote', style: {} }],
      }]);
      renderDocument(doc, container);
      const bq = container.querySelector('blockquote');
      expect(bq!.dataset.blockId).toBe('bq-1');
    });
  });

  describe('horizontal rule rendering', () => {
    it('renders a horizontal-rule as <hr>', () => {
      const doc = makeDoc([makeBlock('', 'horizontal-rule')]);
      renderDocument(doc, container);
      const hr = container.querySelector('hr');
      expect(hr).not.toBeNull();
    });

    it('sets data-block-id on hr', () => {
      const doc = makeDoc([{
        id: 'hr-1',
        type: 'horizontal-rule' as const,
        alignment: 'left' as const,
        runs: [{ text: '', style: {} }],
      }]);
      renderDocument(doc, container);
      const hr = container.querySelector('hr');
      expect(hr!.dataset.blockId).toBe('hr-1');
    });

    it('renders hr between paragraphs', () => {
      const doc = makeDoc([
        makeBlock('before'),
        makeBlock('', 'horizontal-rule'),
        makeBlock('after'),
      ]);
      renderDocument(doc, container);
      const children = Array.from(container.children);
      expect(children[0].tagName).toBe('P');
      expect(children[1].tagName).toBe('HR');
      expect(children[2].tagName).toBe('P');
    });
  });

  describe('code block rendering', () => {
    it('renders a code-block as <pre> with <code>', () => {
      const doc = makeDoc([makeBlock('var x = 1;', 'code-block')]);
      renderDocument(doc, container);
      const pre = container.querySelector('pre');
      expect(pre).not.toBeNull();
      const code = pre!.querySelector('code');
      expect(code).not.toBeNull();
      expect(code!.textContent).toBe('var x = 1;');
    });

    it('renders empty code-block with <br>', () => {
      const doc = makeDoc([makeBlock('', 'code-block')]);
      renderDocument(doc, container);
      const pre = container.querySelector('pre');
      expect(pre).not.toBeNull();
      const code = pre!.querySelector('code');
      expect(code).not.toBeNull();
      expect(code!.querySelector('br')).not.toBeNull();
    });

    it('sets data-block-id on code-block', () => {
      const doc = makeDoc([{
        id: 'cb-1',
        type: 'code-block' as const,
        alignment: 'left' as const,
        runs: [{ text: 'code', style: {} }],
      }]);
      renderDocument(doc, container);
      const pre = container.querySelector('pre');
      expect(pre!.dataset.blockId).toBe('cb-1');
    });
  });

  describe('inline code rendering', () => {
    it('renders code-styled text as <code> element', () => {
      const doc = makeDoc([
        makeStyledBlock([
          { text: 'use ', style: {} },
          { text: 'console.log', style: { code: true } },
          { text: ' here', style: {} },
        ]),
      ]);
      renderDocument(doc, container);
      const codeEl = container.querySelector('p code');
      expect(codeEl).not.toBeNull();
      expect(codeEl!.textContent).toBe('console.log');
    });

    it('non-code text renders as <span>', () => {
      const doc = makeDoc([
        makeStyledBlock([{ text: 'normal', style: {} }]),
      ]);
      renderDocument(doc, container);
      const span = container.querySelector('span');
      expect(span).not.toBeNull();
      expect(span!.tagName).toBe('SPAN');
      expect(container.querySelector('p > code')).toBeNull();
    });

    it('renders code with bold as <code> with bold style', () => {
      const doc = makeDoc([
        makeStyledBlock([
          { text: 'bold code', style: { bold: true, code: true } },
        ]),
      ]);
      renderDocument(doc, container);
      const codeEl = container.querySelector('code');
      expect(codeEl).not.toBeNull();
      expect(codeEl!.textContent).toBe('bold code');
      expect(codeEl!.style.fontWeight).toBe('bold');
    });
  });

  describe('empty document', () => {
    it('renders empty paragraph for empty block', () => {
      const doc = makeDoc([makeBlock('')]);
      renderDocument(doc, container);
      const p = container.querySelector('p');
      expect(p).not.toBeNull();
      expect(p!.textContent).toBe('');
    });
  });

  describe('complex documents', () => {
    it('renders a realistic document structure', () => {
      const doc = makeDoc([
        makeBlock('Document Title', 'heading1'),
        makeBlock('This is an introduction paragraph.'),
        makeBlock('Section Header', 'heading2'),
        makeStyledBlock([
          { text: 'This has ', style: {} },
          { text: 'bold', style: { bold: true } },
          { text: ' and ', style: {} },
          { text: 'italic', style: { italic: true } },
          { text: ' text.', style: {} },
        ]),
        makeBlock('First item', 'bullet-list-item'),
        makeBlock('Second item', 'bullet-list-item'),
        makeBlock('Third item', 'bullet-list-item'),
        makeBlock('Final paragraph.'),
      ]);
      renderDocument(doc, container);

      // Verify structure
      const children = Array.from(container.children);
      expect(children[0].tagName).toBe('H1');
      expect(children[1].tagName).toBe('P');
      expect(children[2].tagName).toBe('H2');
      expect(children[3].tagName).toBe('P');
      expect(children[4].tagName).toBe('UL');
      expect(children[5].tagName).toBe('P');

      // Verify list has 3 items
      const ul = container.querySelector('ul');
      expect(ul!.children).toHaveLength(3);

      // Verify formatted text
      const formattedP = children[3];
      const spans = formattedP.querySelectorAll('span');
      expect(spans).toHaveLength(5);
    });
  });
});
