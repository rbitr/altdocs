import type { Document, Block, TextRun, BlockType } from '../shared/model.js';
import { blockTextLength, getIndentLevel } from '../shared/model.js';

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
  if (run.style.color) el.style.color = run.style.color;
  if (run.style.backgroundColor) el.style.backgroundColor = run.style.backgroundColor;

  return el;
}

/** Render a single block to a DOM element */
function renderBlock(block: Block): HTMLElement {
  // Horizontal rules are self-closing — render as <hr> with no content
  if (block.type === 'horizontal-rule') {
    const el = document.createElement('hr');
    el.dataset.blockId = block.id;
    const indent = getIndentLevel(block);
    if (indent > 0) {
      el.dataset.indent = String(indent);
    }
    return el;
  }

  const tag = BLOCK_TAG_MAP[block.type] || 'p';
  const el = document.createElement(tag);

  el.dataset.blockId = block.id;

  if (block.alignment !== 'left') {
    el.style.textAlign = block.alignment;
  }

  // For non-list blocks, apply indent as margin-left via data attribute
  const indent = getIndentLevel(block);
  if (indent > 0 && block.type !== 'bullet-list-item' && block.type !== 'numbered-list-item') {
    el.dataset.indent = String(indent);
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

/** Get the list tag for a block type */
function listTagForType(type: 'bullet-list-item' | 'numbered-list-item'): string {
  return type === 'bullet-list-item' ? 'ul' : 'ol';
}

/**
 * Append a list item to a nested list structure.
 *
 * listStack: array of { element: HTMLElement (ul/ol), indent: number, type: string }
 * representing the current nesting. listStack[0] is the outermost list.
 *
 * The function adjusts the stack to match the target indent level,
 * creating or closing nested lists as needed.
 */
function appendListItem(
  container: HTMLElement,
  listStack: Array<{ element: HTMLElement; indent: number; type: string }>,
  blockEl: HTMLElement,
  blockType: 'bullet-list-item' | 'numbered-list-item',
  indent: number
): void {
  const tag = listTagForType(blockType);

  if (listStack.length === 0) {
    // Start a new top-level list
    const list = document.createElement(tag);
    container.appendChild(list);
    listStack.push({ element: list, indent: 0, type: tag });
  }

  // Pop levels deeper than our target
  while (listStack.length > 1 && listStack[listStack.length - 1].indent > indent) {
    listStack.pop();
  }

  const currentLevel = listStack[listStack.length - 1];

  if (currentLevel.indent === indent && currentLevel.type === tag) {
    // Same indent and same list type — just append
    currentLevel.element.appendChild(blockEl);
  } else if (currentLevel.indent === indent && currentLevel.type !== tag) {
    // Same indent but different list type — pop and create new sibling list
    if (listStack.length > 1) {
      listStack.pop();
      const parentList = listStack[listStack.length - 1];
      const lastLi = parentList.element.lastElementChild as HTMLElement | null;
      const newList = document.createElement(tag);
      if (lastLi && lastLi.tagName === 'LI') {
        lastLi.appendChild(newList);
      } else {
        parentList.element.appendChild(newList);
      }
      listStack.push({ element: newList, indent, type: tag });
      newList.appendChild(blockEl);
    } else {
      // Top-level type switch — start a new root list
      listStack.length = 0;
      const list = document.createElement(tag);
      container.appendChild(list);
      listStack.push({ element: list, indent: 0, type: tag });
      list.appendChild(blockEl);
    }
  } else if (currentLevel.indent < indent) {
    // Need to go deeper — create sub-lists for each level
    let parentEl = currentLevel.element;
    for (let level = currentLevel.indent + 1; level <= indent; level++) {
      const lastLi = parentEl.lastElementChild as HTMLElement | null;
      const newList = document.createElement(tag);
      if (lastLi && lastLi.tagName === 'LI') {
        lastLi.appendChild(newList);
      } else {
        // No <li> to attach to — append to the list directly
        parentEl.appendChild(newList);
      }
      listStack.push({ element: newList, indent: level, type: tag });
      parentEl = newList;
    }
    parentEl.appendChild(blockEl);
  } else {
    // currentLevel.indent > indent but we already popped — shouldn't happen, but handle gracefully
    currentLevel.element.appendChild(blockEl);
  }
}

/**
 * Render an entire document model to a container element.
 * This does a full re-render (replaces all children).
 */
export function renderDocument(doc: Document, container: HTMLElement): void {
  container.innerHTML = '';

  // listStack tracks the nesting of list elements for proper sub-list rendering
  let listStack: Array<{ element: HTMLElement; indent: number; type: string }> = [];

  for (const block of doc.blocks) {
    const blockEl = renderBlock(block);

    if (block.type === 'bullet-list-item' || block.type === 'numbered-list-item') {
      const indent = getIndentLevel(block);
      appendListItem(container, listStack, blockEl, block.type, indent);
    } else {
      // Not a list item — reset list stack
      listStack = [];
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
