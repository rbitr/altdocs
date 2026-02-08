/**
 * @vitest-environment jsdom
 *
 * Integration tests for main.ts — tests the private functions (renderDocumentList,
 * openEditor, route, scheduleAutoSave, doAutoSave, renderUserProfile, startNameEdit,
 * updateCollaboratorsList) through their public side effects (DOM mutations, mock calls).
 *
 * Key testing insights:
 * - Static imports are hoisted above inline code, so #app must be created in vi.hoisted()
 * - init() fires at module load (fire-and-forget async), we use beforeAll to wait for it
 * - Setting window.location.hash in jsdom fires hashchange async (via setTimeout)
 * - Module state (editor, collab, currentUser) persists across tests in the same file
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi, type Mock } from 'vitest';

// ── Shared mock objects ──

const mockEditor = {
  getDocument: vi.fn(() => ({
    id: 'doc1', title: 'Test',
    blocks: [{ type: 'paragraph', runs: [{ text: 'hello' }], alignment: 'left' }],
  })),
  onUpdate: vi.fn(),
  onOperation: vi.fn(),
  onShortcutsToggle: vi.fn(),
  onFindReplace: vi.fn(),
  setDocument: vi.fn(),
  doc: { id: 'doc1', title: 'Test', blocks: [] } as any,
};

const mockToolbar = {
  toggleShortcutsPanel: vi.fn(),
  setVersionRestoreHandler: vi.fn(),
};

const mockCollab = { connect: vi.fn(), disconnect: vi.fn() };
const mockRemoteCursors = { destroy: vi.fn(), update: vi.fn(), refresh: vi.fn() };
const mockSharePanel = { open: vi.fn(), close: vi.fn(), visible: false };
const mockFindReplaceBar = { show: vi.fn(), hide: vi.fn(), isVisible: vi.fn(() => false), destroy: vi.fn(), refresh: vi.fn() };

// ── Module mocks ──

vi.mock('../src/client/editor.js', () => ({ Editor: vi.fn(() => mockEditor) }));
vi.mock('../src/client/toolbar.js', () => ({ Toolbar: vi.fn(() => mockToolbar) }));
vi.mock('../src/shared/model.js', () => ({
  createEmptyDocument: vi.fn((id: string, title: string) => ({
    id, title, blocks: [{ type: 'paragraph', runs: [{ text: '' }], alignment: 'left' }],
  })),
}));
vi.mock('../src/client/api-client.js', () => ({
  fetchDocumentList: vi.fn(),
  fetchDocument: vi.fn(),
  saveDocument: vi.fn().mockResolvedValue({}),
  deleteDocumentById: vi.fn(),
  duplicateDocument: vi.fn(),
  ensureSession: vi.fn().mockResolvedValue({ id: 'u1', display_name: 'Anonymous Cat 42', color: '#ff6b6b' }),
  updateMe: vi.fn(),
  setShareToken: vi.fn(),
  clearShareToken: vi.fn(),
  getShareToken: vi.fn(() => null),
  fetchSharedDocument: vi.fn(),
}));
vi.mock('../src/client/toast.js', () => ({ toast: vi.fn() }));
vi.mock('../src/client/collaboration.js', () => ({ CollaborationClient: vi.fn(() => mockCollab) }));
vi.mock('../src/client/remote-cursors.js', () => ({ RemoteCursorRenderer: vi.fn(() => mockRemoteCursors) }));
vi.mock('../src/client/share-panel.js', () => ({ SharePanel: vi.fn(() => mockSharePanel) }));
vi.mock('../src/client/find-replace.js', () => ({ FindReplaceBar: vi.fn(() => mockFindReplaceBar) }));

// ── Imports ──

import {
  fetchDocumentList, fetchDocument, saveDocument, deleteDocumentById, duplicateDocument,
  ensureSession, updateMe, getShareToken, fetchSharedDocument, setShareToken, clearShareToken,
} from '../src/client/api-client.js';
import { toast } from '../src/client/toast.js';
import { Editor } from '../src/client/editor.js';
import { CollaborationClient } from '../src/client/collaboration.js';

// Create #app in hoisted block so it exists before main.js is imported.
// vitest hoists imports above inline code, so creating #app inline would be too late.
vi.hoisted(() => {
  const el = document.createElement('div');
  el.id = 'app';
  document.body.appendChild(el);
});

// Importing main.js triggers init() (fire-and-forget async)
import '../src/client/main.js';

// ── Helpers ──

/** Navigate by setting hash (jsdom fires hashchange async) and advancing timers */
async function navigateTo(hash: string): Promise<void> {
  window.location.hash = hash;
  await vi.advanceTimersByTimeAsync(100);
}

/** Standard mock setup for fetchDocument */
function mockFetchDoc(overrides: Record<string, any> = {}) {
  (fetchDocument as Mock).mockResolvedValue({
    id: 'doc1', title: 'Test Doc',
    content: JSON.stringify([{ type: 'paragraph', runs: [{ text: 'hello' }], alignment: 'left' }]),
    permission: 'owner',
    created_at: '2024-01-15T12:00:00Z',
    updated_at: '2024-01-15T12:00:00Z',
    ...overrides,
  });
}

// ── Test suite ──

// Wait for init() async chain to complete before tests install fake timers
beforeAll(async () => {
  await new Promise<void>(r => setTimeout(r, 100));
});

describe('main.ts integration tests', () => {
  let app: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // Re-establish default mock implementations after clearAllMocks
    (ensureSession as Mock).mockResolvedValue({ id: 'u1', display_name: 'Anonymous Cat 42', color: '#ff6b6b' });
    (saveDocument as Mock).mockResolvedValue({});
    (getShareToken as Mock).mockReturnValue(null);
    mockEditor.getDocument.mockReturnValue({
      id: 'doc1', title: 'Test',
      blocks: [{ type: 'paragraph', runs: [{ text: 'hello' }], alignment: 'left' }],
    });
    mockEditor.doc = { id: 'doc1', title: 'Test', blocks: [] };
    mockSharePanel.visible = false;

    app = document.getElementById('app')!;
    app.innerHTML = '';
    window.location.hash = '';
  });

  afterEach(() => {
    vi.useRealTimers();
    window.location.hash = '';
  });

  // ── renderDocumentList ──

  describe('renderDocumentList (via route)', () => {
    it('shows loading indicator while fetching documents', async () => {
      let resolveList!: (value: any) => void;
      (fetchDocumentList as Mock).mockReturnValue(new Promise(r => { resolveList = r; }));

      window.location.hash = '#/';
      await vi.advanceTimersByTimeAsync(10);

      expect(app.querySelector('.loading-container')).not.toBeNull();
      resolveList([]);
      await vi.advanceTimersByTimeAsync(10);
    });

    it('renders empty state when no documents exist', async () => {
      (fetchDocumentList as Mock).mockResolvedValue([]);
      await navigateTo('#/');

      const empty = app.querySelector('.doc-list-empty');
      expect(empty).not.toBeNull();
      expect(empty?.textContent).toContain('No documents yet');
    });

    it('renders document list with titles and links', async () => {
      (fetchDocumentList as Mock).mockResolvedValue([
        { id: 'doc1', title: 'My Doc', updated_at: '2024-01-15T12:00:00Z' },
        { id: 'doc2', title: 'Another', updated_at: '2024-01-16T12:00:00Z' },
      ]);
      await navigateTo('#/');

      const items = app.querySelectorAll('.doc-list-item');
      expect(items.length).toBe(2);
      expect(items[0].querySelector('a')?.textContent).toBe('My Doc');
      expect(items[0].querySelector('a')?.href).toContain('#/doc/doc1');
    });

    it('marks untitled documents with special class', async () => {
      (fetchDocumentList as Mock).mockResolvedValue([
        { id: 'doc1', title: '', updated_at: '2024-01-15T12:00:00Z' },
      ]);
      await navigateTo('#/');

      const link = app.querySelector('.doc-title-untitled');
      expect(link?.textContent).toBe('Untitled');
    });

    it('shows error message when fetch fails', async () => {
      (fetchDocumentList as Mock).mockRejectedValue(new Error('fail'));
      await navigateTo('#/');

      expect(app.querySelector('.doc-list-empty')?.textContent).toContain('Could not load documents');
    });

    it('has New Document button', async () => {
      (fetchDocumentList as Mock).mockResolvedValue([]);
      await navigateTo('#/');

      const btn = app.querySelector('.new-doc-btn') as HTMLButtonElement;
      expect(btn?.textContent).toBe('New Document');
    });

    it('duplicate button calls API and shows toast', async () => {
      (fetchDocumentList as Mock).mockResolvedValue([
        { id: 'doc1', title: 'My Doc', updated_at: '2024-01-15T12:00:00Z' },
      ]);
      (duplicateDocument as Mock).mockResolvedValue({});
      await navigateTo('#/');

      (fetchDocumentList as Mock).mockResolvedValue([]); // for re-render
      const dupBtn = app.querySelector('.doc-action-btn') as HTMLButtonElement;
      dupBtn.click();
      await vi.advanceTimersByTimeAsync(50);

      expect(duplicateDocument).toHaveBeenCalledWith('doc1', expect.any(String), 'My Doc (Copy)');
      expect(toast).toHaveBeenCalledWith('Document duplicated', 'success');
    });

    it('duplicate button shows error toast on failure', async () => {
      (fetchDocumentList as Mock).mockResolvedValue([
        { id: 'doc1', title: 'My Doc', updated_at: '2024-01-15T12:00:00Z' },
      ]);
      (duplicateDocument as Mock).mockRejectedValue(new Error('fail'));
      await navigateTo('#/');

      const dupBtn = app.querySelector('.doc-action-btn') as HTMLButtonElement;
      dupBtn.click();
      await vi.advanceTimersByTimeAsync(50);

      expect(toast).toHaveBeenCalledWith('Failed to duplicate document', 'error');
      expect(dupBtn.disabled).toBe(false);
    });

    it('delete button calls API when confirmed', async () => {
      (fetchDocumentList as Mock).mockResolvedValue([
        { id: 'doc1', title: 'My Doc', updated_at: '2024-01-15T12:00:00Z' },
      ]);
      (deleteDocumentById as Mock).mockResolvedValue({});
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      await navigateTo('#/');

      (fetchDocumentList as Mock).mockResolvedValue([]);
      app.querySelector<HTMLButtonElement>('.doc-action-btn-danger')!.click();
      await vi.advanceTimersByTimeAsync(50);

      expect(deleteDocumentById).toHaveBeenCalledWith('doc1');
      expect(toast).toHaveBeenCalledWith('Document deleted', 'success');
    });

    it('delete button does nothing when cancelled', async () => {
      (fetchDocumentList as Mock).mockResolvedValue([
        { id: 'doc1', title: 'My Doc', updated_at: '2024-01-15T12:00:00Z' },
      ]);
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      await navigateTo('#/');

      app.querySelector<HTMLButtonElement>('.doc-action-btn-danger')!.click();
      await vi.advanceTimersByTimeAsync(50);

      expect(deleteDocumentById).not.toHaveBeenCalled();
    });

    it('delete button shows error toast on failure', async () => {
      (fetchDocumentList as Mock).mockResolvedValue([
        { id: 'doc1', title: 'My Doc', updated_at: '2024-01-15T12:00:00Z' },
      ]);
      (deleteDocumentById as Mock).mockRejectedValue(new Error('fail'));
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      await navigateTo('#/');

      app.querySelector<HTMLButtonElement>('.doc-action-btn-danger')!.click();
      await vi.advanceTimersByTimeAsync(50);

      expect(toast).toHaveBeenCalledWith('Failed to delete document', 'error');
    });
  });

  // ── openEditor ──

  describe('openEditor (via route)', () => {
    beforeEach(() => mockFetchDoc());

    it('fetches document and creates Editor', async () => {
      await navigateTo('#/doc/doc1');
      expect(fetchDocument).toHaveBeenCalledWith('doc1');
      expect(Editor).toHaveBeenCalled();
    });

    it('sets up status bar elements', async () => {
      await navigateTo('#/doc/doc1');
      expect(app.querySelector('.back-link')?.textContent).toBe('All Documents');
      expect(app.querySelector('#save-status')).not.toBeNull();
    });

    it('populates title input', async () => {
      await navigateTo('#/doc/doc1');
      expect(app.querySelector<HTMLInputElement>('#doc-title')?.value).toBe('Test Doc');
    });

    it('clears title for "Untitled" documents', async () => {
      mockFetchDoc({ title: 'Untitled' });
      await navigateTo('#/doc/doc1');
      expect(app.querySelector<HTMLInputElement>('#doc-title')?.value).toBe('');
    });

    it('creates empty document when fetch fails', async () => {
      (fetchDocument as Mock).mockRejectedValue(new Error('404'));
      await navigateTo('#/doc/newdoc');
      expect(Editor).toHaveBeenCalled();
    });

    it('starts collaboration', async () => {
      await navigateTo('#/doc/doc1');
      expect(CollaborationClient).toHaveBeenCalledWith(mockEditor, 'doc1', expect.any(Object));
      expect(mockCollab.connect).toHaveBeenCalled();
    });

    it('shows collab status indicator', async () => {
      await navigateTo('#/doc/doc1');
      expect(app.querySelector('#collab-status')?.className).toContain('collab-status-connecting');
    });

    it('shows Share button for owner', async () => {
      await navigateTo('#/doc/doc1');
      expect(app.querySelector('.share-btn')?.textContent).toBe('Share');
    });

    it('hides Share button for non-owner', async () => {
      mockFetchDoc({ permission: 'edit' });
      await navigateTo('#/doc/doc1');
      expect(app.querySelector('.share-btn')).toBeNull();
    });

    it('shows edit permission badge', async () => {
      mockFetchDoc({ permission: 'edit' });
      await navigateTo('#/doc/doc1');
      const badge = app.querySelector('.permission-badge');
      expect(badge?.textContent).toBe('Can edit');
      expect(badge?.classList.contains('permission-edit')).toBe(true);
    });

    it('shows view-only banner and badge', async () => {
      mockFetchDoc({ permission: 'view' });
      await navigateTo('#/doc/doc1');
      expect(app.querySelector('.readonly-banner')?.textContent).toContain('View only');
      expect(app.querySelector('.permission-badge')?.textContent).toBe('View only');
    });

    it('makes title readonly for view-only', async () => {
      mockFetchDoc({ permission: 'view' });
      await navigateTo('#/doc/doc1');
      expect(app.querySelector<HTMLInputElement>('#doc-title')?.readOnly).toBe(true);
    });

    it('hides permission badge for owner', async () => {
      await navigateTo('#/doc/doc1');
      expect(app.querySelector('.permission-badge')).toBeNull();
    });

    it('performs initial save for owned documents', async () => {
      await navigateTo('#/doc/doc1');
      expect(saveDocument).toHaveBeenCalled();
    });

    it('skips initial save for share token access', async () => {
      // First navigate to #/ to clean up any editor state from previous tests
      (fetchDocumentList as Mock).mockResolvedValue([]);
      await navigateTo('#/');

      // Now set up share token mocks and clear call counts
      (getShareToken as Mock).mockReturnValue('tok123');
      (fetchSharedDocument as Mock).mockResolvedValue({
        document: { id: 'doc1', title: 'Shared', content: JSON.stringify([{ type: 'paragraph', runs: [{ text: 'x' }], alignment: 'left' }]) },
        permission: 'edit',
        share_token: 'tok123',
      });
      (saveDocument as Mock).mockClear();

      await navigateTo('#/doc/doc1?share=tok123');

      expect(saveDocument).not.toHaveBeenCalled();
    });

    it('shows error for invalid share link', async () => {
      (getShareToken as Mock).mockReturnValue('bad');
      (fetchSharedDocument as Mock).mockRejectedValue(new Error('404'));
      await navigateTo('#/doc/doc1?share=bad');
      expect(app.querySelector('.doc-list-empty')?.textContent).toContain('share link is invalid');
    });

    it('wraps editor in editor-wrapper', async () => {
      await navigateTo('#/doc/doc1');
      expect(app.querySelector('.editor-wrapper .altdocs-editor')).not.toBeNull();
    });
  });

  // ── route() cleanup ──

  describe('route() cleanup', () => {
    async function openDoc() {
      mockFetchDoc();
      await navigateTo('#/doc/doc1');
    }

    it('disconnects collaboration when navigating away', async () => {
      await openDoc();
      (fetchDocumentList as Mock).mockResolvedValue([]);
      await navigateTo('#/');
      expect(mockCollab.disconnect).toHaveBeenCalled();
    });

    it('destroys remote cursors when navigating away', async () => {
      await openDoc();
      (fetchDocumentList as Mock).mockResolvedValue([]);
      await navigateTo('#/');
      expect(mockRemoteCursors.destroy).toHaveBeenCalled();
    });

    it('flushes auto-save when navigating away', async () => {
      await openDoc();
      mockEditor.getDocument.mockReturnValue({
        id: 'doc1', title: 'Test Doc',
        blocks: [{ type: 'paragraph', runs: [{ text: 'changed' }], alignment: 'left' }],
      });
      (saveDocument as Mock).mockClear();

      (fetchDocumentList as Mock).mockResolvedValue([]);
      await navigateTo('#/');
      expect(saveDocument).toHaveBeenCalled();
    });

    it('sets share token when navigating to share URL', async () => {
      (getShareToken as Mock).mockReturnValue('tok');
      (fetchSharedDocument as Mock).mockResolvedValue({
        document: { id: 'd1', title: 'S', content: JSON.stringify([{ type: 'paragraph', runs: [{ text: '' }], alignment: 'left' }]) },
        permission: 'edit', share_token: 'tok',
      });
      await navigateTo('#/doc/d1?share=tok');
      expect(setShareToken).toHaveBeenCalledWith('tok');
    });

    it('clears share token for non-share URL', async () => {
      mockFetchDoc();
      await navigateTo('#/doc/doc1');
      expect(clearShareToken).toHaveBeenCalled();
    });
  });

  // ── Auto-save ──

  describe('auto-save', () => {
    beforeEach(async () => {
      mockFetchDoc({ content: JSON.stringify([{ type: 'paragraph', runs: [{ text: 'initial' }], alignment: 'left' }]) });
      await navigateTo('#/doc/doc1');
      (saveDocument as Mock).mockClear();
    });

    function getLatestOnUpdate() {
      const calls = mockEditor.onUpdate.mock.calls;
      return calls[calls.length - 1][0];
    }

    it('saves after 2s debounce when content changes', async () => {
      mockEditor.getDocument.mockReturnValue({
        id: 'doc1', title: 'Test Doc',
        blocks: [{ type: 'paragraph', runs: [{ text: 'changed' }], alignment: 'left' }],
      });
      getLatestOnUpdate()();
      expect(saveDocument).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(2000);
      expect(saveDocument).toHaveBeenCalled();
    });

    it('skips save when content unchanged', async () => {
      mockEditor.getDocument.mockReturnValue({
        id: 'doc1', title: 'Test Doc',
        blocks: [{ type: 'paragraph', runs: [{ text: 'initial' }], alignment: 'left' }],
      });
      getLatestOnUpdate()();
      await vi.advanceTimersByTimeAsync(2000);
      expect(saveDocument).not.toHaveBeenCalled();
    });

    it('skips auto-save for view-only documents', async () => {
      (fetchDocumentList as Mock).mockResolvedValue([]);
      await navigateTo('#/');
      (saveDocument as Mock).mockClear();

      mockFetchDoc({ id: 'doc2', permission: 'view' });
      await navigateTo('#/doc/doc2');
      (saveDocument as Mock).mockClear();

      getLatestOnUpdate()();
      await vi.advanceTimersByTimeAsync(2000);
      expect(saveDocument).not.toHaveBeenCalled();
    });

    it('debounces multiple rapid updates', async () => {
      mockEditor.getDocument.mockReturnValue({
        id: 'doc1', title: 'Test Doc',
        blocks: [{ type: 'paragraph', runs: [{ text: 'changed' }], alignment: 'left' }],
      });
      const cb = getLatestOnUpdate();
      cb(); await vi.advanceTimersByTimeAsync(500);
      cb(); await vi.advanceTimersByTimeAsync(500);
      cb(); await vi.advanceTimersByTimeAsync(2000);
      expect(saveDocument).toHaveBeenCalledTimes(1);
    });
  });

  // ── Collaboration callbacks ──

  describe('collaboration callbacks', () => {
    function getCollabCallbacks() {
      const calls = (CollaborationClient as unknown as Mock).mock.calls;
      return calls[calls.length - 1][2];
    }

    beforeEach(async () => {
      mockFetchDoc();
      await navigateTo('#/doc/doc1');
    });

    it('updates status to "Live" on connected', () => {
      getCollabCallbacks().onConnectionChange('connected');
      const el = app.querySelector('#collab-status');
      expect(el?.textContent).toBe('Live');
      expect(el?.className).toContain('collab-status-connected');
    });

    it('clears status on disconnected', () => {
      getCollabCallbacks().onConnectionChange('disconnected');
      expect(app.querySelector('#collab-status')?.textContent).toBe('');
    });

    it('renders user dots on remote users change', () => {
      getCollabCallbacks().onRemoteUsersChange([
        { userId: 'u2', displayName: 'Bob', color: '#ff0000' },
        { userId: 'u3', displayName: 'Alice', color: '#00ff00' },
      ]);
      const dots = app.querySelectorAll('.collab-user-dot');
      expect(dots.length).toBe(2);
      expect((dots[0] as HTMLElement).title).toBe('Bob');
    });

    it('updates remote cursors on users change', () => {
      const users = [{ userId: 'u2', displayName: 'Bob', color: '#ff0000' }];
      getCollabCallbacks().onRemoteUsersChange(users);
      expect(mockRemoteCursors.update).toHaveBeenCalledWith(users, mockEditor.getDocument());
    });

    it('clears dots when all users leave', () => {
      getCollabCallbacks().onRemoteUsersChange([{ userId: 'u2', displayName: 'Bob', color: '#ff0000' }]);
      expect(app.querySelectorAll('.collab-user-dot').length).toBe(1);
      getCollabCallbacks().onRemoteUsersChange([]);
      expect(app.querySelectorAll('.collab-user-dot').length).toBe(0);
    });
  });

  // ── Title editing ──

  describe('title input', () => {
    beforeEach(async () => {
      mockFetchDoc();
      await navigateTo('#/doc/doc1');
      (saveDocument as Mock).mockClear();
    });

    it('saves after 500ms debounce', async () => {
      const input = app.querySelector('#doc-title') as HTMLInputElement;
      input.value = 'New Title';
      input.dispatchEvent(new Event('input'));
      expect(saveDocument).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(500);
      expect(saveDocument).toHaveBeenCalled();
    });

    it('updates editor doc title', () => {
      const input = app.querySelector('#doc-title') as HTMLInputElement;
      input.value = 'New Title';
      input.dispatchEvent(new Event('input'));
      expect(mockEditor.doc.title).toBe('New Title');
    });

    it('defaults to "Untitled" when empty', () => {
      const input = app.querySelector('#doc-title') as HTMLInputElement;
      input.value = '';
      input.dispatchEvent(new Event('input'));
      expect(mockEditor.doc.title).toBe('Untitled');
    });
  });

  // ── Version restore ──

  describe('version restore', () => {
    beforeEach(async () => {
      mockFetchDoc();
      await navigateTo('#/doc/doc1');
    });

    function getVersionHandler() {
      const calls = mockToolbar.setVersionRestoreHandler.mock.calls;
      return calls[calls.length - 1][0];
    }

    it('registers handler on toolbar', () => {
      expect(mockToolbar.setVersionRestoreHandler).toHaveBeenCalledWith(expect.any(Function));
    });

    it('restores document and shows toast', () => {
      getVersionHandler()({
        title: 'Old', content: JSON.stringify([{ type: 'paragraph', runs: [{ text: 'old' }], alignment: 'left' }]),
      });
      expect(mockEditor.setDocument).toHaveBeenCalledWith(expect.objectContaining({ title: 'Old' }));
      expect(toast).toHaveBeenCalledWith('Version restored', 'success');
    });

    it('updates title input on restore', () => {
      getVersionHandler()({
        title: 'Restored', content: JSON.stringify([{ type: 'paragraph', runs: [{ text: '' }], alignment: 'left' }]),
      });
      expect(app.querySelector<HTMLInputElement>('#doc-title')?.value).toBe('Restored');
    });

    it('clears title input for "Untitled" restore', () => {
      getVersionHandler()({
        title: 'Untitled', content: JSON.stringify([{ type: 'paragraph', runs: [{ text: '' }], alignment: 'left' }]),
      });
      expect(app.querySelector<HTMLInputElement>('#doc-title')?.value).toBe('');
    });
  });

  // ── User profile ──

  describe('renderUserProfile', () => {
    it('creates profile bar with color dot and name', () => {
      const bar = document.getElementById('user-profile-bar');
      expect(bar).not.toBeNull();
      expect(bar?.querySelector('.user-color-dot')).not.toBeNull();
      const name = bar?.querySelector('.user-display-name');
      expect(name?.textContent).toBe('Anonymous Cat 42');
      expect(name?.getAttribute('title')).toBe('Click to edit your display name');
    });
  });

  // ── Name editing ──

  describe('startNameEdit', () => {
    // Helper to complete an edit cycle (restoring the span)
    async function completeEdit(newName?: string) {
      const input = document.querySelector('.user-name-input') as HTMLInputElement;
      if (!input) return;
      if (newName !== undefined) input.value = newName;
      (updateMe as Mock).mockResolvedValue({
        id: 'u1', display_name: input.value.trim() || 'Anonymous Cat 42', color: '#ff6b6b',
      });
      input.dispatchEvent(new Event('blur'));
      await vi.advanceTimersByTimeAsync(50);
    }

    // Before each test, ensure we're in a clean state with the display name span visible
    beforeEach(async () => {
      // If there's a stale input, complete it
      if (document.querySelector('.user-name-input')) {
        (updateMe as Mock).mockResolvedValue({ id: 'u1', display_name: 'Anonymous Cat 42', color: '#ff6b6b' });
        await completeEdit('ResetName');
      }
      // If currentUser.display_name was mutated, reset it via an edit cycle
      const span = document.querySelector('.user-display-name') as HTMLElement;
      if (span && span.textContent !== 'Anonymous Cat 42') {
        span.click();
        (updateMe as Mock).mockResolvedValue({ id: 'u1', display_name: 'Anonymous Cat 42', color: '#ff6b6b' });
        const input = document.querySelector('.user-name-input') as HTMLInputElement;
        if (input) {
          input.value = 'Anonymous Cat 42_reset';
          input.dispatchEvent(new Event('blur'));
          await vi.advanceTimersByTimeAsync(50);
        }
      }
      vi.clearAllMocks();
      (ensureSession as Mock).mockResolvedValue({ id: 'u1', display_name: 'Anonymous Cat 42', color: '#ff6b6b' });
      (saveDocument as Mock).mockResolvedValue({});
      (getShareToken as Mock).mockReturnValue(null);
    });

    afterEach(async () => {
      // Complete any pending edit to restore the span
      if (document.querySelector('.user-name-input')) {
        (updateMe as Mock).mockResolvedValue({ id: 'u1', display_name: 'Anonymous Cat 42', color: '#ff6b6b' });
        await completeEdit('Anonymous Cat 42_cleanup');
      }
    });

    it('replaces name span with input on click', async () => {
      const span = document.querySelector('.user-display-name') as HTMLElement;
      expect(span).not.toBeNull();
      span.click();

      const input = document.querySelector('.user-name-input') as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.value).toBe('Anonymous Cat 42');
      expect(input.maxLength).toBe(50);
    });

    it('calls updateMe on name change + blur', async () => {
      document.querySelector<HTMLElement>('.user-display-name')!.click();
      const input = document.querySelector('.user-name-input') as HTMLInputElement;
      input.value = 'New Name';

      (updateMe as Mock).mockResolvedValue({ id: 'u1', display_name: 'New Name', color: '#ff6b6b' });
      input.dispatchEvent(new Event('blur'));
      await vi.advanceTimersByTimeAsync(50);

      expect(updateMe).toHaveBeenCalledWith('New Name');
      expect(toast).toHaveBeenCalledWith('Display name updated', 'success');
    });

    it('skips updateMe when name unchanged', async () => {
      document.querySelector<HTMLElement>('.user-display-name')!.click();
      const input = document.querySelector('.user-name-input') as HTMLInputElement;
      // Value is already the current name
      input.dispatchEvent(new Event('blur'));
      await vi.advanceTimersByTimeAsync(50);

      expect(updateMe).not.toHaveBeenCalled();
    });

    it('skips updateMe when name is whitespace', async () => {
      document.querySelector<HTMLElement>('.user-display-name')!.click();
      const input = document.querySelector('.user-name-input') as HTMLInputElement;
      input.value = '   ';
      input.dispatchEvent(new Event('blur'));
      await vi.advanceTimersByTimeAsync(50);

      expect(updateMe).not.toHaveBeenCalled();
    });

    it('shows error toast when updateMe fails', async () => {
      document.querySelector<HTMLElement>('.user-display-name')!.click();
      const input = document.querySelector('.user-name-input') as HTMLInputElement;
      input.value = 'FailName';

      (updateMe as Mock).mockRejectedValue(new Error('fail'));
      input.dispatchEvent(new Event('blur'));
      await vi.advanceTimersByTimeAsync(50);

      expect(toast).toHaveBeenCalledWith('Failed to update name', 'error');
    });

    it('restores span after successful edit', async () => {
      document.querySelector<HTMLElement>('.user-display-name')!.click();
      const input = document.querySelector('.user-name-input') as HTMLInputElement;
      input.value = 'New Name';

      (updateMe as Mock).mockResolvedValue({ id: 'u1', display_name: 'New Name', color: '#ff6b6b' });
      input.dispatchEvent(new Event('blur'));
      await vi.advanceTimersByTimeAsync(50);

      expect(document.querySelector('.user-display-name')?.textContent).toBe('New Name');
      expect(document.querySelector('.user-name-input')).toBeNull();
    });

    it('Enter key triggers blur', async () => {
      document.querySelector<HTMLElement>('.user-display-name')!.click();
      const input = document.querySelector('.user-name-input') as HTMLInputElement;
      const blurSpy = vi.spyOn(input, 'blur');
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(blurSpy).toHaveBeenCalled();
    });

    it('Escape reverts to current name and blurs', async () => {
      document.querySelector<HTMLElement>('.user-display-name')!.click();
      const input = document.querySelector('.user-name-input') as HTMLInputElement;
      input.value = 'Changed';
      const blurSpy = vi.spyOn(input, 'blur');

      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      // Should revert to the current display_name from module state
      expect(input.value).toBe('Anonymous Cat 42');
      expect(blurSpy).toHaveBeenCalled();
    });
  });

  // ── Editor onUpdate refreshes remote cursors ──

  describe('onUpdate refreshes remote cursors', () => {
    it('calls remoteCursors.refresh on update', async () => {
      mockFetchDoc();
      await navigateTo('#/doc/doc1');
      mockRemoteCursors.refresh.mockClear();

      const calls = mockEditor.onUpdate.mock.calls;
      calls[calls.length - 1][0]();

      expect(mockRemoteCursors.refresh).toHaveBeenCalledWith(mockEditor.getDocument());
    });
  });
});
