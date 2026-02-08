import type { Document, Position } from '../shared/model.js';
import { blockToPlainText, blockTextLength } from '../shared/model.js';
import type { Editor } from './editor.js';
import { collapsedCursor } from '../shared/cursor.js';

export interface FindMatch {
  blockIndex: number;
  startOffset: number;
  endOffset: number;
}

/** Search a document for all occurrences of a query string */
export function findAllMatches(doc: Document, query: string, caseSensitive = false): FindMatch[] {
  if (!query) return [];
  const matches: FindMatch[] = [];
  const searchQuery = caseSensitive ? query : query.toLowerCase();

  for (let i = 0; i < doc.blocks.length; i++) {
    const text = blockToPlainText(doc.blocks[i]);
    const searchText = caseSensitive ? text : text.toLowerCase();
    let pos = 0;
    while (pos <= searchText.length - searchQuery.length) {
      const idx = searchText.indexOf(searchQuery, pos);
      if (idx === -1) break;
      matches.push({ blockIndex: i, startOffset: idx, endOffset: idx + searchQuery.length });
      pos = idx + 1;
    }
  }

  return matches;
}

export class FindReplaceBar {
  private container: HTMLElement;
  private editor: Editor;
  private barElement: HTMLElement | null = null;
  private findInput: HTMLInputElement | null = null;
  private replaceInput: HTMLInputElement | null = null;
  private matchCountLabel: HTMLElement | null = null;
  private replaceRow: HTMLElement | null = null;

  private matches: FindMatch[] = [];
  private currentMatchIndex = -1;
  private highlightElements: HTMLElement[] = [];
  private visible = false;
  private showReplace = false;

  constructor(container: HTMLElement, editor: Editor) {
    this.container = container;
    this.editor = editor;
  }

  show(withReplace = false): void {
    this.showReplace = withReplace;
    if (!this.barElement) {
      this.createBar();
    }
    this.barElement!.style.display = 'flex';
    if (this.replaceRow) {
      this.replaceRow.style.display = withReplace ? 'flex' : 'none';
    }
    this.visible = true;
    this.findInput!.focus();
    this.findInput!.select();

    // Pre-fill with selected text
    const selectedText = this.editor.getSelectedText();
    if (selectedText && !selectedText.includes('\n')) {
      this.findInput!.value = selectedText;
      this.performSearch();
    }
  }

  hide(): void {
    if (this.barElement) {
      this.barElement.style.display = 'none';
    }
    this.visible = false;
    this.clearHighlights();
    this.matches = [];
    this.currentMatchIndex = -1;
    this.editor.focus();
  }

  isVisible(): boolean {
    return this.visible;
  }

  /** Refresh highlights after document changes */
  refresh(): void {
    if (!this.visible || !this.findInput) return;
    const query = this.findInput.value;
    if (!query) {
      this.clearHighlights();
      this.matches = [];
      this.currentMatchIndex = -1;
      this.updateMatchCount();
      return;
    }
    this.matches = findAllMatches(this.editor.doc, query);
    // Keep current match index valid
    if (this.matches.length === 0) {
      this.currentMatchIndex = -1;
    } else if (this.currentMatchIndex >= this.matches.length) {
      this.currentMatchIndex = 0;
    }
    this.updateHighlights();
    this.updateMatchCount();
  }

  destroy(): void {
    this.clearHighlights();
    this.visible = false;
    if (this.barElement) {
      this.barElement.remove();
      this.barElement = null;
    }
    this.findInput = null;
    this.replaceInput = null;
    this.matchCountLabel = null;
    this.replaceRow = null;
  }

  private createBar(): void {
    this.barElement = document.createElement('div');
    this.barElement.className = 'find-replace-bar';

    // Find row
    const findRow = document.createElement('div');
    findRow.className = 'find-replace-row';

    this.findInput = document.createElement('input');
    this.findInput.type = 'text';
    this.findInput.className = 'find-input';
    this.findInput.placeholder = 'Find...';
    this.findInput.addEventListener('input', () => this.performSearch());
    this.findInput.addEventListener('keydown', (e) => this.handleFindKeyDown(e));

    this.matchCountLabel = document.createElement('span');
    this.matchCountLabel.className = 'find-match-count';
    this.matchCountLabel.textContent = '';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'find-btn';
    prevBtn.textContent = '\u2191'; // ↑
    prevBtn.title = 'Previous match (Shift+Enter)';
    prevBtn.addEventListener('click', () => this.goToPreviousMatch());
    prevBtn.addEventListener('mousedown', (e) => e.preventDefault());

    const nextBtn = document.createElement('button');
    nextBtn.className = 'find-btn';
    nextBtn.textContent = '\u2193'; // ↓
    nextBtn.title = 'Next match (Enter)';
    nextBtn.addEventListener('click', () => this.goToNextMatch());
    nextBtn.addEventListener('mousedown', (e) => e.preventDefault());

    const closeBtn = document.createElement('button');
    closeBtn.className = 'find-btn find-close-btn';
    closeBtn.textContent = '\u00d7'; // ×
    closeBtn.title = 'Close (Escape)';
    closeBtn.addEventListener('click', () => this.hide());
    closeBtn.addEventListener('mousedown', (e) => e.preventDefault());

    findRow.appendChild(this.findInput);
    findRow.appendChild(this.matchCountLabel);
    findRow.appendChild(prevBtn);
    findRow.appendChild(nextBtn);
    findRow.appendChild(closeBtn);

    // Replace row
    this.replaceRow = document.createElement('div');
    this.replaceRow.className = 'find-replace-row';
    this.replaceRow.style.display = 'none';

    this.replaceInput = document.createElement('input');
    this.replaceInput.type = 'text';
    this.replaceInput.className = 'find-input';
    this.replaceInput.placeholder = 'Replace...';
    this.replaceInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.hide();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.replaceCurrent();
      }
    });

    const replaceBtn = document.createElement('button');
    replaceBtn.className = 'find-btn';
    replaceBtn.textContent = 'Replace';
    replaceBtn.addEventListener('click', () => this.replaceCurrent());
    replaceBtn.addEventListener('mousedown', (e) => e.preventDefault());

    const replaceAllBtn = document.createElement('button');
    replaceAllBtn.className = 'find-btn';
    replaceAllBtn.textContent = 'All';
    replaceAllBtn.title = 'Replace all';
    replaceAllBtn.addEventListener('click', () => this.replaceAll());
    replaceAllBtn.addEventListener('mousedown', (e) => e.preventDefault());

    this.replaceRow.appendChild(this.replaceInput);
    this.replaceRow.appendChild(replaceBtn);
    this.replaceRow.appendChild(replaceAllBtn);

    this.barElement.appendChild(findRow);
    this.barElement.appendChild(this.replaceRow);

    // Insert at the top of the container's parent (editor-wrapper)
    const wrapper = this.container.closest('.editor-wrapper') || this.container.parentElement;
    if (wrapper) {
      wrapper.insertBefore(this.barElement, wrapper.firstChild);
    }
  }

  private handleFindKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.hide();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        this.goToPreviousMatch();
      } else {
        this.goToNextMatch();
      }
    }
  }

  private performSearch(): void {
    const query = this.findInput?.value || '';
    this.matches = findAllMatches(this.editor.doc, query);
    this.currentMatchIndex = this.matches.length > 0 ? 0 : -1;
    this.updateHighlights();
    this.updateMatchCount();
    if (this.currentMatchIndex >= 0) {
      this.navigateToMatch(this.currentMatchIndex);
    }
  }

  private goToNextMatch(): void {
    if (this.matches.length === 0) return;
    this.currentMatchIndex = (this.currentMatchIndex + 1) % this.matches.length;
    this.updateHighlights();
    this.updateMatchCount();
    this.navigateToMatch(this.currentMatchIndex);
  }

  private goToPreviousMatch(): void {
    if (this.matches.length === 0) return;
    this.currentMatchIndex = (this.currentMatchIndex - 1 + this.matches.length) % this.matches.length;
    this.updateHighlights();
    this.updateMatchCount();
    this.navigateToMatch(this.currentMatchIndex);
  }

  private navigateToMatch(index: number): void {
    const match = this.matches[index];
    if (!match) return;
    // Move cursor to the match position
    this.editor.cursor = collapsedCursor({
      blockIndex: match.blockIndex,
      offset: match.startOffset,
    });
    // Scroll the active highlight into view
    const activeEl = this.container.querySelector('.find-highlight-active');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  private replaceCurrent(): void {
    if (this.currentMatchIndex < 0 || this.currentMatchIndex >= this.matches.length) return;
    const match = this.matches[this.currentMatchIndex];
    const replaceText = this.replaceInput?.value || '';

    // Select the match text and replace it
    this.editor.cursor = {
      anchor: { blockIndex: match.blockIndex, offset: match.startOffset },
      focus: { blockIndex: match.blockIndex, offset: match.endOffset },
    };
    this.editor.insertText(replaceText);

    // Re-search and adjust index
    this.matches = findAllMatches(this.editor.doc, this.findInput?.value || '');
    if (this.currentMatchIndex >= this.matches.length) {
      this.currentMatchIndex = this.matches.length > 0 ? 0 : -1;
    }
    this.updateHighlights();
    this.updateMatchCount();
    if (this.currentMatchIndex >= 0) {
      this.navigateToMatch(this.currentMatchIndex);
    }
  }

  private replaceAll(): void {
    const query = this.findInput?.value || '';
    const replaceText = this.replaceInput?.value || '';
    if (!query) return;

    // Replace from last to first to preserve positions
    const matches = findAllMatches(this.editor.doc, query);
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i];
      this.editor.cursor = {
        anchor: { blockIndex: match.blockIndex, offset: match.startOffset },
        focus: { blockIndex: match.blockIndex, offset: match.endOffset },
      };
      this.editor.insertText(replaceText);
    }

    // Re-search
    this.matches = findAllMatches(this.editor.doc, query);
    this.currentMatchIndex = this.matches.length > 0 ? 0 : -1;
    this.updateHighlights();
    this.updateMatchCount();
  }

  private updateMatchCount(): void {
    if (!this.matchCountLabel) return;
    if (this.matches.length === 0) {
      const query = this.findInput?.value || '';
      this.matchCountLabel.textContent = query ? 'No results' : '';
    } else {
      this.matchCountLabel.textContent = `${this.currentMatchIndex + 1} of ${this.matches.length}`;
    }
  }

  private clearHighlights(): void {
    for (const el of this.highlightElements) {
      el.remove();
    }
    this.highlightElements = [];
  }

  private updateHighlights(): void {
    this.clearHighlights();

    for (let i = 0; i < this.matches.length; i++) {
      const match = this.matches[i];
      const isActive = i === this.currentMatchIndex;

      // Find the block element in the DOM
      const blockElements = this.container.querySelectorAll('[data-block-id]');
      let blockEl: Element | null = null;
      for (const el of blockElements) {
        if (el.getAttribute('data-block-id') === this.editor.doc.blocks[match.blockIndex]?.id) {
          blockEl = el;
          break;
        }
      }
      if (!blockEl) continue;

      // Use Range API to get the bounding rect(s) of the match text
      const rects = this.getMatchRects(blockEl, match.startOffset, match.endOffset);
      for (const rect of rects) {
        const containerRect = this.container.getBoundingClientRect();
        const highlight = document.createElement('div');
        highlight.className = isActive ? 'find-highlight find-highlight-active' : 'find-highlight';
        highlight.style.position = 'absolute';
        highlight.style.left = `${rect.left - containerRect.left + this.container.scrollLeft}px`;
        highlight.style.top = `${rect.top - containerRect.top + this.container.scrollTop}px`;
        highlight.style.width = `${rect.width}px`;
        highlight.style.height = `${rect.height}px`;
        highlight.style.pointerEvents = 'none';
        this.container.appendChild(highlight);
        this.highlightElements.push(highlight);
      }
    }
  }

  private getMatchRects(blockEl: Element, startOffset: number, endOffset: number): DOMRect[] {
    // Walk text nodes in the block to find the character range
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(blockEl, NodeFilter.SHOW_TEXT);
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      textNodes.push(node);
    }

    let charCount = 0;
    let startNode: Text | null = null;
    let startNodeOffset = 0;
    let endNode: Text | null = null;
    let endNodeOffset = 0;

    for (const tn of textNodes) {
      const len = tn.textContent?.length || 0;
      if (!startNode && charCount + len > startOffset) {
        startNode = tn;
        startNodeOffset = startOffset - charCount;
      }
      if (charCount + len >= endOffset) {
        endNode = tn;
        endNodeOffset = endOffset - charCount;
        break;
      }
      charCount += len;
    }

    if (!startNode || !endNode) return [];

    try {
      const range = document.createRange();
      range.setStart(startNode, startNodeOffset);
      range.setEnd(endNode, endNodeOffset);
      return Array.from(range.getClientRects());
    } catch {
      return [];
    }
  }
}
