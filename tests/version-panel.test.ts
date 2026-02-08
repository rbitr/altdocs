/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VersionPanel } from '../src/client/version-panel.js';

// Mock the api-client module
vi.mock('../src/client/api-client.js', () => ({
  fetchVersions: vi.fn(),
  restoreVersion: vi.fn(),
}));

import { fetchVersions, restoreVersion } from '../src/client/api-client.js';

const mockFetchVersions = fetchVersions as ReturnType<typeof vi.fn>;
const mockRestoreVersion = restoreVersion as ReturnType<typeof vi.fn>;

describe('VersionPanel', () => {
  let panel: VersionPanel;
  let onRestore: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchVersions.mockResolvedValue([]);
    panel = new VersionPanel();
    onRestore = vi.fn();
  });

  afterEach(() => {
    panel.close();
    document.body.innerHTML = '';
  });

  describe('initial state', () => {
    it('starts closed', () => {
      expect(panel.isOpen()).toBe(false);
    });
  });

  describe('open()', () => {
    it('appends overlay to document body', () => {
      panel.open('doc-1', onRestore);
      expect(document.querySelector('.version-overlay')).not.toBeNull();
      expect(panel.isOpen()).toBe(true);
    });

    it('renders panel with header', () => {
      panel.open('doc-1', onRestore);
      expect(document.querySelector('.version-panel')).not.toBeNull();
      expect(document.querySelector('.version-panel-header')).not.toBeNull();
      expect(document.querySelector('h2')?.textContent).toBe('Version History');
    });

    it('shows loading state initially', () => {
      // Use a pending promise so versions don't load immediately
      mockFetchVersions.mockReturnValue(new Promise(() => {}));
      panel.open('doc-1', onRestore);
      const loading = document.querySelector('.version-panel-loading');
      expect(loading).not.toBeNull();
      expect(loading?.textContent).toBe('Loading versions...');
    });

    it('fetches versions for the given doc ID', () => {
      panel.open('doc-42', onRestore);
      expect(mockFetchVersions).toHaveBeenCalledWith('doc-42');
    });

    it('closes existing panel before opening new one', async () => {
      mockFetchVersions.mockResolvedValue([]);
      panel.open('doc-1', onRestore);
      await vi.waitFor(() => {
        expect(document.querySelectorAll('.version-overlay').length).toBe(1);
      });
      panel.open('doc-2', onRestore);
      await vi.waitFor(() => {
        expect(document.querySelectorAll('.version-overlay').length).toBe(1);
      });
      expect(mockFetchVersions).toHaveBeenCalledWith('doc-2');
    });

    it('sets data-testid on version list body', () => {
      panel.open('doc-1', onRestore);
      expect(document.querySelector('[data-testid="version-list"]')).not.toBeNull();
    });
  });

  describe('close()', () => {
    it('removes overlay from DOM', () => {
      panel.open('doc-1', onRestore);
      expect(document.querySelector('.version-overlay')).not.toBeNull();
      panel.close();
      expect(document.querySelector('.version-overlay')).toBeNull();
      expect(panel.isOpen()).toBe(false);
    });

    it('is safe to call when already closed', () => {
      panel.close(); // Should not throw
      expect(panel.isOpen()).toBe(false);
    });
  });

  describe('close button', () => {
    it('closes panel when close button is clicked', () => {
      panel.open('doc-1', onRestore);
      const closeBtn = document.querySelector('.version-panel-close') as HTMLButtonElement;
      expect(closeBtn).not.toBeNull();
      expect(closeBtn.textContent).toBe('\u00d7');
      closeBtn.click();
      expect(panel.isOpen()).toBe(false);
    });
  });

  describe('overlay click to close', () => {
    it('closes panel when clicking the overlay background', () => {
      panel.open('doc-1', onRestore);
      const overlay = document.querySelector('.version-overlay') as HTMLElement;
      overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(panel.isOpen()).toBe(false);
    });

    it('does NOT close when clicking inside the panel', () => {
      panel.open('doc-1', onRestore);
      const panelEl = document.querySelector('.version-panel') as HTMLElement;
      panelEl.click();
      expect(panel.isOpen()).toBe(true);
    });
  });

  describe('version list rendering', () => {
    it('shows empty message when no versions exist', async () => {
      mockFetchVersions.mockResolvedValue([]);
      panel.open('doc-1', onRestore);
      await vi.waitFor(() => {
        const empty = document.querySelector('.version-panel-empty');
        expect(empty).not.toBeNull();
        expect(empty?.textContent).toContain('No version history yet');
      });
    });

    it('shows error message when fetch fails', async () => {
      mockFetchVersions.mockRejectedValue(new Error('Network error'));
      panel.open('doc-1', onRestore);
      await vi.waitFor(() => {
        const err = document.querySelector('.version-panel-empty');
        expect(err).not.toBeNull();
        expect(err?.textContent).toBe('Could not load version history.');
      });
    });

    it('renders version items with labels, dates, and titles', async () => {
      mockFetchVersions.mockResolvedValue([
        { version_number: 3, title: 'My Doc v3', created_at: '2026-02-01T12:00:00Z' },
        { version_number: 2, title: 'My Doc v2', created_at: '2026-01-15T10:00:00Z' },
        { version_number: 1, title: 'My Doc v1', created_at: '2026-01-01T08:00:00Z' },
      ]);
      panel.open('doc-1', onRestore);
      await vi.waitFor(() => {
        const items = document.querySelectorAll('.version-item');
        expect(items.length).toBe(3);
      });

      const items = document.querySelectorAll('.version-item');

      // First item: version 3
      expect(items[0].querySelector('.version-item-label')?.textContent).toBe('Version 3');
      expect(items[0].querySelector('.version-item-title')?.textContent).toBe('My Doc v3');
      expect(items[0].getAttribute('data-version')).toBe('3');

      // Version item date should be present
      expect(items[0].querySelector('.version-item-date')?.textContent).toBeTruthy();

      // Last item: version 1
      expect(items[2].querySelector('.version-item-label')?.textContent).toBe('Version 1');
    });

    it('renders restore button for each version', async () => {
      mockFetchVersions.mockResolvedValue([
        { version_number: 1, title: 'Doc', created_at: '2026-01-01T00:00:00Z' },
      ]);
      panel.open('doc-1', onRestore);
      await vi.waitFor(() => {
        const btn = document.querySelector('.version-restore-btn') as HTMLButtonElement;
        expect(btn).not.toBeNull();
        expect(btn.textContent).toBe('Restore');
        expect(btn.title).toBe('Restore version 1');
      });
    });

    it('clears loading state when versions load', async () => {
      mockFetchVersions.mockResolvedValue([
        { version_number: 1, title: 'Doc', created_at: '2026-01-01T00:00:00Z' },
      ]);
      panel.open('doc-1', onRestore);
      await vi.waitFor(() => {
        expect(document.querySelector('.version-panel-loading')).toBeNull();
        expect(document.querySelector('.version-list')).not.toBeNull();
      });
    });
  });

  describe('restore version', () => {
    it('calls restoreVersion with correct doc ID and version number', async () => {
      mockFetchVersions.mockResolvedValue([
        { version_number: 2, title: 'Doc v2', created_at: '2026-01-01T00:00:00Z' },
      ]);
      mockRestoreVersion.mockResolvedValue({ title: 'Doc v2', content: '[]' });
      panel.open('doc-1', onRestore);
      await vi.waitFor(() => {
        expect(document.querySelector('.version-restore-btn')).not.toBeNull();
      });

      const restoreBtn = document.querySelector('.version-restore-btn') as HTMLButtonElement;
      restoreBtn.click();
      await vi.waitFor(() => {
        expect(mockRestoreVersion).toHaveBeenCalledWith('doc-1', 2);
      });
    });

    it('calls onRestore callback with restored record', async () => {
      mockFetchVersions.mockResolvedValue([
        { version_number: 1, title: 'Doc', created_at: '2026-01-01T00:00:00Z' },
      ]);
      mockRestoreVersion.mockResolvedValue({ title: 'Restored Doc', content: '[{"type":"paragraph","runs":[]}]' });
      panel.open('doc-1', onRestore);
      await vi.waitFor(() => {
        expect(document.querySelector('.version-restore-btn')).not.toBeNull();
      });

      const restoreBtn = document.querySelector('.version-restore-btn') as HTMLButtonElement;
      restoreBtn.click();
      await vi.waitFor(() => {
        expect(onRestore).toHaveBeenCalledWith({
          title: 'Restored Doc',
          content: '[{"type":"paragraph","runs":[]}]',
        });
      });
    });

    it('closes panel after successful restore', async () => {
      mockFetchVersions.mockResolvedValue([
        { version_number: 1, title: 'Doc', created_at: '2026-01-01T00:00:00Z' },
      ]);
      mockRestoreVersion.mockResolvedValue({ title: 'Doc', content: '[]' });
      panel.open('doc-1', onRestore);
      await vi.waitFor(() => {
        expect(document.querySelector('.version-restore-btn')).not.toBeNull();
      });

      const restoreBtn = document.querySelector('.version-restore-btn') as HTMLButtonElement;
      restoreBtn.click();
      await vi.waitFor(() => {
        expect(panel.isOpen()).toBe(false);
      });
    });

    it('shows "Restoring..." during restore and disables button', async () => {
      let resolveRestore: Function;
      mockFetchVersions.mockResolvedValue([
        { version_number: 1, title: 'Doc', created_at: '2026-01-01T00:00:00Z' },
      ]);
      mockRestoreVersion.mockReturnValue(new Promise(r => { resolveRestore = r; }));
      panel.open('doc-1', onRestore);
      await vi.waitFor(() => {
        expect(document.querySelector('.version-restore-btn')).not.toBeNull();
      });

      const restoreBtn = document.querySelector('.version-restore-btn') as HTMLButtonElement;
      restoreBtn.click();

      expect(restoreBtn.disabled).toBe(true);
      expect(restoreBtn.textContent).toBe('Restoring...');

      resolveRestore!({ title: 'Doc', content: '[]' });
      await vi.waitFor(() => {
        expect(panel.isOpen()).toBe(false);
      });
    });

    it('re-enables button on restore failure', async () => {
      mockFetchVersions.mockResolvedValue([
        { version_number: 1, title: 'Doc', created_at: '2026-01-01T00:00:00Z' },
      ]);
      mockRestoreVersion.mockRejectedValue(new Error('Restore failed'));
      panel.open('doc-1', onRestore);
      await vi.waitFor(() => {
        expect(document.querySelector('.version-restore-btn')).not.toBeNull();
      });

      const restoreBtn = document.querySelector('.version-restore-btn') as HTMLButtonElement;
      restoreBtn.click();
      await vi.waitFor(() => {
        expect(restoreBtn.disabled).toBe(false);
        expect(restoreBtn.textContent).toBe('Restore');
      });
    });

    it('does NOT call onRestore on failure', async () => {
      mockFetchVersions.mockResolvedValue([
        { version_number: 1, title: 'Doc', created_at: '2026-01-01T00:00:00Z' },
      ]);
      mockRestoreVersion.mockRejectedValue(new Error('fail'));
      panel.open('doc-1', onRestore);
      await vi.waitFor(() => {
        expect(document.querySelector('.version-restore-btn')).not.toBeNull();
      });

      const restoreBtn = document.querySelector('.version-restore-btn') as HTMLButtonElement;
      restoreBtn.click();
      await vi.waitFor(() => {
        expect(restoreBtn.disabled).toBe(false);
      });
      expect(onRestore).not.toHaveBeenCalled();
    });

    it('panel stays open on restore failure', async () => {
      mockFetchVersions.mockResolvedValue([
        { version_number: 1, title: 'Doc', created_at: '2026-01-01T00:00:00Z' },
      ]);
      mockRestoreVersion.mockRejectedValue(new Error('fail'));
      panel.open('doc-1', onRestore);
      await vi.waitFor(() => {
        expect(document.querySelector('.version-restore-btn')).not.toBeNull();
      });

      const restoreBtn = document.querySelector('.version-restore-btn') as HTMLButtonElement;
      restoreBtn.click();
      await vi.waitFor(() => {
        expect(restoreBtn.disabled).toBe(false);
      });
      expect(panel.isOpen()).toBe(true);
    });
  });
});
