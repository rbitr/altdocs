import { fetchVersions, restoreVersion } from './api-client.js';
import type { VersionListItem } from './api-client.js';

export class VersionPanel {
  private overlay: HTMLElement | null = null;
  private docId: string = '';
  private onRestore: ((record: { title: string; content: string }) => void) | null = null;

  open(docId: string, onRestore: (record: { title: string; content: string }) => void): void {
    this.docId = docId;
    this.onRestore = onRestore;
    if (this.overlay) this.close();
    this.overlay = this.buildOverlay();
    document.body.appendChild(this.overlay);
    this.loadVersions();
  }

  close(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  isOpen(): boolean {
    return this.overlay !== null;
  }

  private buildOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'version-overlay';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });

    const panel = document.createElement('div');
    panel.className = 'version-panel';

    // Header
    const header = document.createElement('div');
    header.className = 'version-panel-header';

    const title = document.createElement('h2');
    title.textContent = 'Version History';
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'version-panel-close';
    closeBtn.textContent = '\u00d7';
    closeBtn.title = 'Close';
    closeBtn.addEventListener('click', () => this.close());
    header.appendChild(closeBtn);

    panel.appendChild(header);

    // Body (will be populated by loadVersions)
    const body = document.createElement('div');
    body.className = 'version-panel-body';
    body.setAttribute('data-testid', 'version-list');

    const loading = document.createElement('div');
    loading.className = 'version-panel-loading';
    loading.textContent = 'Loading versions...';
    body.appendChild(loading);

    panel.appendChild(body);
    overlay.appendChild(panel);
    return overlay;
  }

  private async loadVersions(): Promise<void> {
    const body = this.overlay?.querySelector('.version-panel-body');
    if (!body) return;

    try {
      const versions = await fetchVersions(this.docId);
      body.innerHTML = '';
      if (versions.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'version-panel-empty';
        empty.textContent = 'No version history yet. Versions are created when you save changes.';
        body.appendChild(empty);
        return;
      }
      const list = document.createElement('ul');
      list.className = 'version-list';
      for (const version of versions) {
        list.appendChild(this.buildVersionItem(version));
      }
      body.appendChild(list);
    } catch {
      body.innerHTML = '';
      const err = document.createElement('div');
      err.className = 'version-panel-empty';
      err.textContent = 'Could not load version history.';
      body.appendChild(err);
    }
  }

  private buildVersionItem(version: VersionListItem): HTMLElement {
    const li = document.createElement('li');
    li.className = 'version-item';
    li.setAttribute('data-version', String(version.version_number));

    const info = document.createElement('div');
    info.className = 'version-item-info';

    const label = document.createElement('span');
    label.className = 'version-item-label';
    label.textContent = `Version ${version.version_number}`;
    info.appendChild(label);

    const date = document.createElement('span');
    date.className = 'version-item-date';
    const d = new Date(version.created_at);
    date.textContent = d.toLocaleString();
    info.appendChild(date);

    const titleEl = document.createElement('span');
    titleEl.className = 'version-item-title';
    titleEl.textContent = version.title;
    info.appendChild(titleEl);

    li.appendChild(info);

    const restoreBtn = document.createElement('button');
    restoreBtn.type = 'button';
    restoreBtn.className = 'version-restore-btn';
    restoreBtn.textContent = 'Restore';
    restoreBtn.title = `Restore version ${version.version_number}`;
    restoreBtn.addEventListener('click', async () => {
      restoreBtn.disabled = true;
      restoreBtn.textContent = 'Restoring...';
      try {
        const record = await restoreVersion(this.docId, version.version_number);
        if (this.onRestore) {
          this.onRestore({ title: record.title, content: record.content });
        }
        this.close();
      } catch {
        restoreBtn.disabled = false;
        restoreBtn.textContent = 'Restore';
      }
    });
    li.appendChild(restoreBtn);

    return li;
  }
}
