import type { Document, Block, TextRun, BlockType } from '../shared/model.js';
import { blockTextLength } from '../shared/model.js';

/** Map from BlockType to the HTML tag used to render it */
const BLOCK_TAG_MAP: Record<BlockType, string> = {
  'paragraph': 'p',
  'heading1': 'h1',
  'heading2': 'h2',
  'heading3': 'h3',
  'bullet-list-item': 'li',
  'numbered-list-item': 'li',
  'blockquote': 'blockquote',
  'code-block': 'pre',
  'horizontal-rule': 'hr',
};

/** Render a single text run to a DOM element */
function renderRun(run: TextRun, useCodeTag = false): HTMLElement {
  const tagName = (run.style.code || useCodeTag) ? 'code' : 'span';
  const el = document.createElement(tagName);
  el.textContent = run.text;

  if (run.style.bold) el.style.fontWeight = 'bold';
  if (run.style.italic) el.style.fontStyle = 'italic';
  if (run.style.underline) el.style.textDecoration = 'underline';
  if (run.style.strikethrough) {
    el.style.textDecoration = el.style.textDecoration
      ? `${el.style.textDecoration} line-through`
      : 'line-through';
  }
  if (run.style.fontSize) el.style.fontSize = `${run.style.fontSize}px`;
  if (run.style.fontFamily) el.style.fontFamily = run.style.fontFamily;

  return el;
}

/** Render a single block to a DOM element */
function renderBlock(block: Block): HTMLElement {
  // Horizontal rules are self-closing — render as <hr> with no content
  if (block.type === 'horizontal-rule') {
    const el = document.createElement('hr');
    el.dataset.blockId = block.id;
    return el;
  }

  const tag = BLOCK_TAG_MAP[block.type] || 'p';
  const el = document.createElement(tag);

  el.dataset.blockId = block.id;

  if (block.alignment !== 'left') {
    el.style.textAlign = block.alignment;
  }

  const isEmpty = blockTextLength(block) === 0;
  const isCodeBlock = block.type === 'code-block';

  if (isEmpty) {
    // Empty blocks need a <br> to be visible and allow caret placement
    if (isCodeBlock) {
      const code = document.createElement('code');
      code.appendChild(document.createElement('br'));
      el.appendChild(code);
    } else {
      el.appendChild(document.createElement('br'));
    }
  } else if (isCodeBlock) {
    // Code blocks: wrap all runs in a single <code> element
    const code = document.createElement('code');
    for (const run of block.runs) {
      const span = document.createElement('span');
      span.textContent = run.text;
      code.appendChild(span);
    }
    el.appendChild(code);
  } else {
    for (const run of block.runs) {
      el.appendChild(renderRun(run));
    }
  }

  return el;
}

/**
 * Group consecutive list items into their parent list elements (ul/ol).
 * Non-list blocks pass through unchanged.
 */
function groupListItems(blocks: Block[]): Array<{ block: Block; element: HTMLElement }> {
  const result: Array<{ block: Block; element: HTMLElement }> = [];

  for (const block of blocks) {
    result.push({ block, element: renderBlock(block) });
  }

  return result;
}

/**
 * Render an entire document model to a container element.
 * This does a full re-render (replaces all children).
 */
export function renderDocument(doc: Document, container: HTMLElement): void {
  container.innerHTML = '';

  let currentList: HTMLElement | null = null;
  let currentListType: 'bullet-list-item' | 'numbered-list-item' | null = null;

  for (const block of doc.blocks) {
    const blockEl = renderBlock(block);

    if (block.type === 'bullet-list-item' || block.type === 'numbered-list-item') {
      // Need to wrap in a ul or ol
      if (currentListType !== block.type) {
        // Start a new list
        const listTag = block.type === 'bullet-list-item' ? 'ul' : 'ol';
        currentList = document.createElement(listTag);
        container.appendChild(currentList);
        currentListType = block.type;
      }
      currentList!.appendChild(blockEl);
    } else {
      // Not a list item — reset list tracking
      currentList = null;
      currentListType = null;
      container.appendChild(blockEl);
    }
  }
}

/**
 * Render a document and return the container (useful for testing).
 */
export function renderDocumentToElement(doc: Document): HTMLElement {
  const container = document.createElement('div');
  container.className = 'altdocs-editor';
  renderDocument(doc, container);
  return container;
}
