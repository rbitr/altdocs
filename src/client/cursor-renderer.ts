import type { CursorState } from '../shared/cursor.js';
import type { Document, Position } from '../shared/model.js';
import { blockTextLength } from '../shared/model.js';
import { isCollapsed, getSelectionRange, comparePositions } from '../shared/cursor.js';

/**
 * Resolve a document Position to a DOM node and offset within the editor container.
 *
 * The editor DOM structure is:
 *   container > block-element[data-block-id] > span (per run)
 *
 * For list items, the structure is:
 *   container > ul/ol > li[data-block-id] > span (per run)
 *
 * Returns { node, offset } suitable for use with the DOM Selection API,
 * or null if the position could not be resolved.
 */
export function resolvePosition(
  container: HTMLElement,
  doc: Document,
  pos: Position
): { node: Node; offset: number } | null {
  const block = doc.blocks[pos.blockIndex];
  if (!block) return null;

  // Find the block element by data-block-id
  const blockEl = container.querySelector(`[data-block-id="${block.id}"]`);
  if (!blockEl) return null;

  // Walk through span children to find the right text node
  const spans = blockEl.querySelectorAll('span');
  let remaining = pos.offset;

  for (const span of spans) {
    const textNode = span.firstChild;
    if (!textNode) continue;

    const textLen = (textNode.textContent || '').length;
    if (remaining <= textLen) {
      return { node: textNode, offset: remaining };
    }
    remaining -= textLen;
  }

  // If offset is at the end or block is empty, use the last text node or block element
  if (spans.length > 0) {
    const lastSpan = spans[spans.length - 1];
    const textNode = lastSpan.firstChild;
    if (textNode) {
      return { node: textNode, offset: (textNode.textContent || '').length };
    }
  }

  // Empty block — return the block element itself
  return { node: blockEl, offset: 0 };
}

/**
 * Resolve a DOM position (node + offset) back to a document Position.
 */
export function resolveDocumentPosition(
  container: HTMLElement,
  doc: Document,
  node: Node,
  domOffset: number
): Position | null {
  // Find which block element this node is inside
  let el: HTMLElement | null = node instanceof HTMLElement ? node : node.parentElement;
  let blockEl: HTMLElement | null = null;

  while (el && el !== container) {
    if (el.dataset && el.dataset.blockId) {
      blockEl = el;
      break;
    }
    el = el.parentElement;
  }

  if (!blockEl) return null;

  const blockId = blockEl.dataset.blockId;
  const blockIndex = doc.blocks.findIndex((b) => b.id === blockId);
  if (blockIndex === -1) return null;

  // Calculate the character offset within the block
  const spans = blockEl.querySelectorAll('span');
  let offset = 0;

  for (const span of spans) {
    const textNode = span.firstChild;
    if (!textNode) continue;

    if (span.contains(node)) {
      // This is the span containing our target node
      offset += domOffset;
      return { blockIndex, offset };
    }

    offset += (textNode.textContent || '').length;
  }

  // Fallback: if we couldn't find the node in spans, use block end
  return { blockIndex, offset: blockTextLength(doc.blocks[blockIndex]) };
}

/**
 * Set the browser's selection to match our cursor state.
 */
export function applyCursorToDOM(
  container: HTMLElement,
  doc: Document,
  cursor: CursorState
): void {
  const selection = window.getSelection();
  if (!selection) return;

  const anchorResolved = resolvePosition(container, doc, cursor.anchor);
  const focusResolved = resolvePosition(container, doc, cursor.focus);

  if (!anchorResolved || !focusResolved) return;

  selection.removeAllRanges();

  if (isCollapsed(cursor)) {
    const range = document.createRange();
    range.setStart(anchorResolved.node, anchorResolved.offset);
    range.collapse(true);
    selection.addRange(range);
  } else {
    // For extended selections, we need to use setBaseAndExtent
    selection.setBaseAndExtent(
      anchorResolved.node,
      anchorResolved.offset,
      focusResolved.node,
      focusResolved.offset
    );
  }
}

/**
 * Read the browser's current selection and convert it to a CursorState.
 */
export function readCursorFromDOM(
  container: HTMLElement,
  doc: Document
): CursorState | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const anchorNode = selection.anchorNode;
  const focusNode = selection.focusNode;
  if (!anchorNode || !focusNode) return null;

  // Make sure the selection is within our container
  if (!container.contains(anchorNode) || !container.contains(focusNode)) return null;

  const anchor = resolveDocumentPosition(container, doc, anchorNode, selection.anchorOffset);
  const focus = resolveDocumentPosition(container, doc, focusNode, selection.focusOffset);

  if (!anchor || !focus) return null;

  return { anchor, focus };
}
