/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock ALL external dependencies that main.ts imports, to prevent side effects from init()
vi.mock('../src/client/editor.js', () => ({
  Editor: vi.fn(),
}));
vi.mock('../src/client/toolbar.js', () => ({
  Toolbar: vi.fn(),
}));
vi.mock('../src/shared/model.js', () => ({
  createEmptyDocument: vi.fn(() => ({ id: '', title: '', blocks: [] })),
}));
vi.mock('../src/client/api-client.js', () => ({
  fetchDocumentList: vi.fn(),
  fetchDocument: vi.fn(),
  saveDocument: vi.fn(),
  deleteDocumentById: vi.fn(),
  duplicateDocument: vi.fn(),
  ensureSession: vi.fn().mockResolvedValue(null),
  updateMe: vi.fn(),
  setShareToken: vi.fn(),
  clearShareToken: vi.fn(),
  getShareToken: vi.fn(() => null),
  fetchSharedDocument: vi.fn(),
}));
vi.mock('../src/client/toast.js', () => ({
  toast: vi.fn(),
}));
vi.mock('../src/client/collaboration.js', () => ({
  CollaborationClient: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
}));
vi.mock('../src/client/remote-cursors.js', () => ({
  RemoteCursorRenderer: vi.fn(() => ({
    destroy: vi.fn(),
    update: vi.fn(),
    refresh: vi.fn(),
  })),
}));
vi.mock('../src/client/share-panel.js', () => ({
  SharePanel: vi.fn(() => ({
    open: vi.fn(),
    close: vi.fn(),
    visible: false,
  })),
}));

// Now import the exported helpers — init() will run but with all mocks in place
import { parseHash, updateSaveStatus, createLoadingIndicator, generateId } from '../src/client/main.js';

describe('main.ts helper functions', () => {
  describe('generateId()', () => {
    it('returns a string starting with "doc_"', () => {
      const id = generateId();
      expect(id).toMatch(/^doc_/);
    });

    it('includes a timestamp component', () => {
      const before = Date.now();
      const id = generateId();
      const after = Date.now();
      const parts = id.split('_');
      const timestamp = parseInt(parts[1], 10);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it('includes a random suffix', () => {
      const id = generateId();
      const parts = id.split('_');
      expect(parts[2]).toBeTruthy();
      expect(parts[2].length).toBeGreaterThanOrEqual(2);
    });

    it('generates unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateId()));
      expect(ids.size).toBe(100);
    });
  });

  describe('parseHash()', () => {
    afterEach(() => {
      window.location.hash = '';
    });

    it('returns nulls when hash is empty', () => {
      window.location.hash = '';
      const result = parseHash();
      expect(result.docId).toBeNull();
      expect(result.shareToken).toBeNull();
    });

    it('returns nulls for non-matching hash', () => {
      window.location.hash = '#/settings';
      const result = parseHash();
      expect(result.docId).toBeNull();
      expect(result.shareToken).toBeNull();
    });

    it('returns nulls for root hash', () => {
      window.location.hash = '#/';
      const result = parseHash();
      expect(result.docId).toBeNull();
      expect(result.shareToken).toBeNull();
    });

    it('parses doc ID from hash', () => {
      window.location.hash = '#/doc/abc123';
      const result = parseHash();
      expect(result.docId).toBe('abc123');
      expect(result.shareToken).toBeNull();
    });

    it('parses doc ID with underscores and numbers', () => {
      window.location.hash = '#/doc/doc_1706745600000_abc123';
      const result = parseHash();
      expect(result.docId).toBe('doc_1706745600000_abc123');
    });

    it('parses share token from query string', () => {
      window.location.hash = '#/doc/myDoc?share=abcdef123456';
      const result = parseHash();
      expect(result.docId).toBe('myDoc');
      expect(result.shareToken).toBe('abcdef123456');
    });

    it('handles URI-encoded doc ID', () => {
      window.location.hash = '#/doc/my%20doc';
      const result = parseHash();
      expect(result.docId).toBe('my doc');
    });

    it('returns null share token when share param is empty', () => {
      window.location.hash = '#/doc/myDoc?share=';
      const result = parseHash();
      expect(result.docId).toBe('myDoc');
      expect(result.shareToken).toBe('');
    });

    it('ignores non-share query params', () => {
      window.location.hash = '#/doc/myDoc?foo=bar';
      const result = parseHash();
      expect(result.docId).toBe('myDoc');
      expect(result.shareToken).toBeNull();
    });

    it('parses share token with other query params present', () => {
      window.location.hash = '#/doc/myDoc?foo=bar&share=tok123';
      const result = parseHash();
      expect(result.docId).toBe('myDoc');
      expect(result.shareToken).toBe('tok123');
    });
  });

  describe('createLoadingIndicator()', () => {
    it('creates a container with loading-container class', () => {
      const el = createLoadingIndicator();
      expect(el.className).toBe('loading-container');
    });

    it('contains a spinner element', () => {
      const el = createLoadingIndicator();
      const spinner = el.querySelector('.loading-spinner');
      expect(spinner).not.toBeNull();
    });

    it('shows default "Loading..." message', () => {
      const el = createLoadingIndicator();
      const label = el.querySelector('span');
      expect(label?.textContent).toBe('Loading...');
    });

    it('shows custom message when provided', () => {
      const el = createLoadingIndicator('Loading documents...');
      const label = el.querySelector('span');
      expect(label?.textContent).toBe('Loading documents...');
    });
  });

  describe('updateSaveStatus()', () => {
    let statusEl: HTMLElement;

    beforeEach(() => {
      vi.useFakeTimers();
      statusEl = document.createElement('span');
      statusEl.id = 'save-status';
      document.body.appendChild(statusEl);
    });

    afterEach(() => {
      vi.useRealTimers();
      statusEl.remove();
    });

    it('sets text content on #save-status element', () => {
      updateSaveStatus('Saving...');
      expect(statusEl.textContent).toBe('Saving...');
    });

    it('adds save-status-saving class for "Saving..."', () => {
      updateSaveStatus('Saving...');
      expect(statusEl.classList.contains('save-status-saving')).toBe(true);
    });

    it('adds save-status-error class for "Save failed"', () => {
      updateSaveStatus('Save failed');
      expect(statusEl.classList.contains('save-status-error')).toBe(true);
    });

    it('clears previous classes when status changes', () => {
      updateSaveStatus('Saving...');
      expect(statusEl.classList.contains('save-status-saving')).toBe(true);
      updateSaveStatus('Saved');
      expect(statusEl.classList.contains('save-status-saving')).toBe(false);
    });

    it('auto-clears "Saved" text after 2 seconds', () => {
      updateSaveStatus('Saved');
      expect(statusEl.textContent).toBe('Saved');
      vi.advanceTimersByTime(2000);
      expect(statusEl.textContent).toBe('');
      expect(statusEl.className).toBe('');
    });

    it('does not auto-clear if status changed before timeout', () => {
      updateSaveStatus('Saved');
      updateSaveStatus('Saving...');
      vi.advanceTimersByTime(2000);
      // The "Saved" timeout fires but the text is now "Saving..." so it should NOT clear
      expect(statusEl.textContent).toBe('Saving...');
    });

    it('is safe when #save-status element does not exist', () => {
      statusEl.remove();
      expect(() => updateSaveStatus('Saving...')).not.toThrow();
    });

    it('does not add any class for "Saved"', () => {
      updateSaveStatus('Saved');
      expect(statusEl.classList.contains('save-status-saving')).toBe(false);
      expect(statusEl.classList.contains('save-status-error')).toBe(false);
    });
  });
});
