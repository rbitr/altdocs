/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SharePanel } from '../src/client/share-panel.js';

// Mock the api-client module
vi.mock('../src/client/api-client.js', () => ({
  createShareLink: vi.fn(),
  fetchShares: vi.fn(),
  deleteShareLink: vi.fn(),
}));

// Mock the toast module
vi.mock('../src/client/toast.js', () => ({
  toast: vi.fn(),
}));

import { createShareLink, fetchShares, deleteShareLink } from '../src/client/api-client.js';
import { toast } from '../src/client/toast.js';

const mockCreateShareLink = createShareLink as ReturnType<typeof vi.fn>;
const mockFetchShares = fetchShares as ReturnType<typeof vi.fn>;
const mockDeleteShareLink = deleteShareLink as ReturnType<typeof vi.fn>;
const mockToast = toast as ReturnType<typeof vi.fn>;

describe('SharePanel', () => {
  let panel: SharePanel;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchShares.mockResolvedValue([]);
    panel = new SharePanel('doc-123');
  });

  afterEach(() => {
    panel.close();
    document.body.innerHTML = '';
  });

  describe('constructor and visibility', () => {
    it('starts not visible', () => {
      expect(panel.visible).toBe(false);
    });

    it('creates overlay element', () => {
      expect(panel.visible).toBe(false);
      // Overlay should not be in DOM yet
      expect(document.querySelector('.share-panel-overlay')).toBeNull();
    });
  });

  describe('open()', () => {
    it('appends overlay to document body', async () => {
      await panel.open();
      expect(document.querySelector('.share-panel-overlay')).not.toBeNull();
      expect(panel.visible).toBe(true);
    });

    it('renders panel with header, create section, and list', async () => {
      await panel.open();
      expect(document.querySelector('.share-panel')).not.toBeNull();
      expect(document.querySelector('.share-panel-header')).not.toBeNull();
      expect(document.querySelector('h2')?.textContent).toBe('Share Document');
      expect(document.querySelector('.share-create-section')).not.toBeNull();
      expect(document.querySelector('.share-list-container')).not.toBeNull();
    });

    it('renders permission select with view and edit options', async () => {
      await panel.open();
      const select = document.querySelector('.share-permission-select') as HTMLSelectElement;
      expect(select).not.toBeNull();
      expect(select.options.length).toBe(2);
      expect(select.options[0].value).toBe('view');
      expect(select.options[0].textContent).toBe('View only');
      expect(select.options[1].value).toBe('edit');
      expect(select.options[1].textContent).toBe('Can edit');
    });

    it('renders Create Link button', async () => {
      await panel.open();
      const btn = document.querySelector('.share-create-btn') as HTMLButtonElement;
      expect(btn).not.toBeNull();
      expect(btn.textContent).toBe('Create Link');
    });

    it('does not open twice', async () => {
      await panel.open();
      await panel.open(); // Second call should be no-op
      const overlays = document.querySelectorAll('.share-panel-overlay');
      expect(overlays.length).toBe(1);
    });

    it('fetches existing shares on open', async () => {
      await panel.open();
      expect(mockFetchShares).toHaveBeenCalledWith('doc-123');
    });
  });

  describe('close()', () => {
    it('removes overlay from DOM', async () => {
      await panel.open();
      expect(document.querySelector('.share-panel-overlay')).not.toBeNull();
      panel.close();
      expect(document.querySelector('.share-panel-overlay')).toBeNull();
      expect(panel.visible).toBe(false);
    });

    it('is no-op when already closed', () => {
      panel.close(); // Should not throw
      expect(panel.visible).toBe(false);
    });
  });

  describe('close button', () => {
    it('closes panel when close button is clicked', async () => {
      await panel.open();
      const closeBtn = document.querySelector('.share-panel-close') as HTMLButtonElement;
      expect(closeBtn).not.toBeNull();
      closeBtn.click();
      expect(panel.visible).toBe(false);
    });
  });

  describe('overlay click to close', () => {
    it('closes panel when clicking the overlay background', async () => {
      await panel.open();
      const overlay = document.querySelector('.share-panel-overlay') as HTMLElement;
      // Simulate click on the overlay itself (not on panel inside)
      overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(panel.visible).toBe(false);
    });

    it('does NOT close when clicking inside the panel', async () => {
      await panel.open();
      const panelEl = document.querySelector('.share-panel') as HTMLElement;
      // Click on the panel should not close (target !== overlay)
      panelEl.click();
      expect(panel.visible).toBe(true);
    });
  });

  describe('share list rendering', () => {
    it('shows empty message when no shares exist', async () => {
      mockFetchShares.mockResolvedValue([]);
      await panel.open();
      const empty = document.querySelector('.share-list-empty');
      expect(empty).not.toBeNull();
      expect(empty?.textContent).toBe('No share links yet.');
    });

    it('shows error message when fetch fails', async () => {
      mockFetchShares.mockRejectedValue(new Error('Network error'));
      await panel.open();
      const err = document.querySelector('.share-list-empty');
      expect(err).not.toBeNull();
      expect(err?.textContent).toBe('Could not load shares.');
    });

    it('renders share items with permission badges', async () => {
      mockFetchShares.mockResolvedValue([
        { id: 's1', token: 'tok1', permission: 'view', created_at: '2026-01-01T00:00:00Z' },
        { id: 's2', token: 'tok2', permission: 'edit', created_at: '2026-01-02T00:00:00Z' },
      ]);
      await panel.open();
      const items = document.querySelectorAll('.share-list-item');
      expect(items.length).toBe(2);

      const badge1 = items[0].querySelector('.share-permission-badge');
      expect(badge1?.textContent).toBe('View only');
      expect(badge1?.classList.contains('share-permission-view')).toBe(true);

      const badge2 = items[1].querySelector('.share-permission-badge');
      expect(badge2?.textContent).toBe('Can edit');
      expect(badge2?.classList.contains('share-permission-edit')).toBe(true);
    });

    it('renders share item dates', async () => {
      mockFetchShares.mockResolvedValue([
        { id: 's1', token: 'tok1', permission: 'view', created_at: '2026-01-15T12:00:00Z' },
      ]);
      await panel.open();
      const dateEl = document.querySelector('.share-item-date');
      expect(dateEl).not.toBeNull();
      // Date should be formatted (locale-dependent but present)
      expect(dateEl?.textContent).toBeTruthy();
    });

    it('renders Copy Link and Revoke buttons per share', async () => {
      mockFetchShares.mockResolvedValue([
        { id: 's1', token: 'tok1', permission: 'view', created_at: '2026-01-01T00:00:00Z' },
      ]);
      await panel.open();
      expect(document.querySelector('.share-copy-btn')?.textContent).toBe('Copy Link');
      expect(document.querySelector('.share-revoke-btn')?.textContent).toBe('Revoke');
    });

    it('renders Active Share Links header', async () => {
      await panel.open();
      const h3 = document.querySelector('.share-list-container h3');
      expect(h3?.textContent).toBe('Active Share Links');
    });
  });

  describe('create share link', () => {
    it('calls createShareLink with selected permission', async () => {
      mockCreateShareLink.mockResolvedValue({ id: 's-new', token: 'newtok', permission: 'view', created_at: '' });
      await panel.open();

      const createBtn = document.querySelector('.share-create-btn') as HTMLButtonElement;
      createBtn.click();
      await vi.waitFor(() => {
        expect(mockCreateShareLink).toHaveBeenCalledWith('doc-123', 'view');
      });
    });

    it('calls createShareLink with edit permission when selected', async () => {
      mockCreateShareLink.mockResolvedValue({ id: 's-new', token: 'newtok', permission: 'edit', created_at: '' });
      await panel.open();

      const select = document.querySelector('.share-permission-select') as HTMLSelectElement;
      select.value = 'edit';
      const createBtn = document.querySelector('.share-create-btn') as HTMLButtonElement;
      createBtn.click();
      await vi.waitFor(() => {
        expect(mockCreateShareLink).toHaveBeenCalledWith('doc-123', 'edit');
      });
    });

    it('shows toast on successful creation', async () => {
      mockCreateShareLink.mockResolvedValue({ id: 's-new', token: 'newtok', permission: 'view', created_at: '' });
      await panel.open();

      const createBtn = document.querySelector('.share-create-btn') as HTMLButtonElement;
      createBtn.click();
      await vi.waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith('Share link created', 'success');
      });
    });

    it('shows toast on creation failure', async () => {
      mockCreateShareLink.mockRejectedValue(new Error('fail'));
      await panel.open();

      const createBtn = document.querySelector('.share-create-btn') as HTMLButtonElement;
      createBtn.click();
      await vi.waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith('Failed to create share link', 'error');
      });
    });

    it('disables button during creation and re-enables after', async () => {
      let resolveCreate: Function;
      mockCreateShareLink.mockReturnValue(new Promise(r => { resolveCreate = r; }));
      await panel.open();

      const createBtn = document.querySelector('.share-create-btn') as HTMLButtonElement;
      createBtn.click();

      // Button should be disabled with "Creating..." text
      expect(createBtn.disabled).toBe(true);
      expect(createBtn.textContent).toBe('Creating...');

      // Resolve the promise
      resolveCreate!({ id: 's-new', token: 'newtok', permission: 'view', created_at: '' });
      await vi.waitFor(() => {
        expect(createBtn.disabled).toBe(false);
        expect(createBtn.textContent).toBe('Create Link');
      });
    });

    it('refreshes share list after successful creation', async () => {
      mockCreateShareLink.mockResolvedValue({ id: 's-new', token: 'newtok', permission: 'view', created_at: '' });
      await panel.open();

      // First call is on open
      expect(mockFetchShares).toHaveBeenCalledTimes(1);

      const createBtn = document.querySelector('.share-create-btn') as HTMLButtonElement;
      createBtn.click();
      await vi.waitFor(() => {
        // Second call is the refresh after creation
        expect(mockFetchShares).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('revoke share link', () => {
    it('calls deleteShareLink with correct arguments', async () => {
      mockFetchShares.mockResolvedValue([
        { id: 's1', token: 'tok1', permission: 'view', created_at: '2026-01-01T00:00:00Z' },
      ]);
      mockDeleteShareLink.mockResolvedValue(undefined);
      await panel.open();

      const revokeBtn = document.querySelector('.share-revoke-btn') as HTMLButtonElement;
      revokeBtn.click();
      await vi.waitFor(() => {
        expect(mockDeleteShareLink).toHaveBeenCalledWith('doc-123', 's1');
      });
    });

    it('shows toast on successful revocation', async () => {
      mockFetchShares.mockResolvedValue([
        { id: 's1', token: 'tok1', permission: 'view', created_at: '2026-01-01T00:00:00Z' },
      ]);
      mockDeleteShareLink.mockResolvedValue(undefined);
      await panel.open();

      const revokeBtn = document.querySelector('.share-revoke-btn') as HTMLButtonElement;
      revokeBtn.click();
      await vi.waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith('Share link revoked', 'success');
      });
    });

    it('shows toast on revocation failure', async () => {
      mockFetchShares.mockResolvedValue([
        { id: 's1', token: 'tok1', permission: 'view', created_at: '2026-01-01T00:00:00Z' },
      ]);
      mockDeleteShareLink.mockRejectedValue(new Error('fail'));
      await panel.open();

      const revokeBtn = document.querySelector('.share-revoke-btn') as HTMLButtonElement;
      revokeBtn.click();
      await vi.waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith('Failed to revoke share link', 'error');
      });
    });

    it('disables revoke button during operation', async () => {
      let resolveDelete: Function;
      mockFetchShares.mockResolvedValue([
        { id: 's1', token: 'tok1', permission: 'view', created_at: '2026-01-01T00:00:00Z' },
      ]);
      mockDeleteShareLink.mockReturnValue(new Promise(r => { resolveDelete = r; }));
      await panel.open();

      const revokeBtn = document.querySelector('.share-revoke-btn') as HTMLButtonElement;
      revokeBtn.click();
      expect(revokeBtn.disabled).toBe(true);
      expect(revokeBtn.textContent).toBe('Revoking...');

      resolveDelete!();
      await vi.waitFor(() => {
        // After successful revoke, the list refreshes (so the button is gone)
        expect(mockFetchShares).toHaveBeenCalledTimes(2);
      });
    });

    it('re-enables revoke button on failure', async () => {
      mockFetchShares.mockResolvedValue([
        { id: 's1', token: 'tok1', permission: 'view', created_at: '2026-01-01T00:00:00Z' },
      ]);
      mockDeleteShareLink.mockRejectedValue(new Error('fail'));
      await panel.open();

      const revokeBtn = document.querySelector('.share-revoke-btn') as HTMLButtonElement;
      revokeBtn.click();
      await vi.waitFor(() => {
        expect(revokeBtn.disabled).toBe(false);
        expect(revokeBtn.textContent).toBe('Revoke');
      });
    });
  });

  describe('copy link', () => {
    it('constructs correct share URL and copies to clipboard', async () => {
      mockFetchShares.mockResolvedValue([
        { id: 's1', token: 'tok1', permission: 'view', created_at: '2026-01-01T00:00:00Z' },
      ]);
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });
      await panel.open();

      const copyBtn = document.querySelector('.share-copy-btn') as HTMLButtonElement;
      copyBtn.click();

      await vi.waitFor(() => {
        expect(writeText).toHaveBeenCalledTimes(1);
      });
      const copiedUrl = writeText.mock.calls[0][0] as string;
      expect(copiedUrl).toContain('#/doc/doc-123?share=tok1');
    });

    it('changes button text to "Copied!" after successful copy', async () => {
      mockFetchShares.mockResolvedValue([
        { id: 's1', token: 'tok1', permission: 'view', created_at: '2026-01-01T00:00:00Z' },
      ]);
      Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
      await panel.open();

      const copyBtn = document.querySelector('.share-copy-btn') as HTMLButtonElement;
      copyBtn.click();
      await vi.waitFor(() => {
        expect(copyBtn.textContent).toBe('Copied!');
      });
    });

    it('shows toast on clipboard failure', async () => {
      mockFetchShares.mockResolvedValue([
        { id: 's1', token: 'tok1', permission: 'view', created_at: '2026-01-01T00:00:00Z' },
      ]);
      Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
      await panel.open();

      const copyBtn = document.querySelector('.share-copy-btn') as HTMLButtonElement;
      copyBtn.click();
      await vi.waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith('Failed to copy link', 'error');
      });
    });
  });
});
