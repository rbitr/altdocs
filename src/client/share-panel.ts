import { createShareLink, fetchShares, deleteShareLink } from './api-client.js';
import type { ShareRecord } from './api-client.js';
import { toast } from './toast.js';

export class SharePanel {
  private overlay: HTMLElement;
  private docId: string;
  private isOpen = false;

  constructor(docId: string) {
    this.docId = docId;
    this.overlay = document.createElement('div');
    this.overlay.className = 'share-panel-overlay';
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });
  }

  async open(): Promise<void> {
    if (this.isOpen) return;
    this.isOpen = true;
    this.overlay.innerHTML = '';

    const panel = document.createElement('div');
    panel.className = 'share-panel';

    // Header
    const header = document.createElement('div');
    header.className = 'share-panel-header';
    const title = document.createElement('h2');
    title.textContent = 'Share Document';
    header.appendChild(title);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'share-panel-close';
    closeBtn.textContent = '\u00d7';
    closeBtn.addEventListener('click', () => this.close());
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Create new share section
    const createSection = document.createElement('div');
    createSection.className = 'share-create-section';
    const createLabel = document.createElement('label');
    createLabel.textContent = 'Create a share link:';
    createSection.appendChild(createLabel);

    const createRow = document.createElement('div');
    createRow.className = 'share-create-row';

    const select = document.createElement('select');
    select.className = 'share-permission-select';
    const viewOpt = document.createElement('option');
    viewOpt.value = 'view';
    viewOpt.textContent = 'View only';
    select.appendChild(viewOpt);
    const editOpt = document.createElement('option');
    editOpt.value = 'edit';
    editOpt.textContent = 'Can edit';
    select.appendChild(editOpt);
    createRow.appendChild(select);

    const createBtn = document.createElement('button');
    createBtn.className = 'share-create-btn';
    createBtn.textContent = 'Create Link';
    createBtn.addEventListener('click', async () => {
      createBtn.disabled = true;
      createBtn.textContent = 'Creating...';
      try {
        await createShareLink(this.docId, select.value as 'view' | 'edit');
        toast('Share link created', 'success');
        await this.refreshList(listContainer);
      } catch {
        toast('Failed to create share link', 'error');
      }
      createBtn.disabled = false;
      createBtn.textContent = 'Create Link';
    });
    createRow.appendChild(createBtn);
    createSection.appendChild(createRow);
    panel.appendChild(createSection);

    // Existing shares list
    const listContainer = document.createElement('div');
    listContainer.className = 'share-list-container';
    panel.appendChild(listContainer);

    this.overlay.appendChild(panel);
    document.body.appendChild(this.overlay);

    await this.refreshList(listContainer);
  }

  private async refreshList(container: HTMLElement): Promise<void> {
    container.innerHTML = '';
    const listTitle = document.createElement('h3');
    listTitle.textContent = 'Active Share Links';
    container.appendChild(listTitle);

    let shares: ShareRecord[];
    try {
      shares = await fetchShares(this.docId);
    } catch {
      const err = document.createElement('p');
      err.className = 'share-list-empty';
      err.textContent = 'Could not load shares.';
      container.appendChild(err);
      return;
    }

    if (shares.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'share-list-empty';
      empty.textContent = 'No share links yet.';
      container.appendChild(empty);
      return;
    }

    const list = document.createElement('ul');
    list.className = 'share-list';
    for (const share of shares) {
      const li = document.createElement('li');
      li.className = 'share-list-item';

      const info = document.createElement('div');
      info.className = 'share-item-info';
      const permBadge = document.createElement('span');
      permBadge.className = `share-permission-badge share-permission-${share.permission}`;
      permBadge.textContent = share.permission === 'edit' ? 'Can edit' : 'View only';
      info.appendChild(permBadge);
      const date = document.createElement('span');
      date.className = 'share-item-date';
      date.textContent = new Date(share.created_at).toLocaleDateString();
      info.appendChild(date);
      li.appendChild(info);

      const actions = document.createElement('div');
      actions.className = 'share-item-actions';

      const copyBtn = document.createElement('button');
      copyBtn.className = 'share-copy-btn';
      copyBtn.textContent = 'Copy Link';
      copyBtn.addEventListener('click', () => {
        const url = `${window.location.origin}${window.location.pathname}#/doc/${encodeURIComponent(this.docId)}?share=${share.token}`;
        navigator.clipboard.writeText(url).then(() => {
          copyBtn.textContent = 'Copied!';
          setTimeout(() => { copyBtn.textContent = 'Copy Link'; }, 2000);
        }).catch(() => {
          toast('Failed to copy link', 'error');
        });
      });
      actions.appendChild(copyBtn);

      const revokeBtn = document.createElement('button');
      revokeBtn.className = 'share-revoke-btn';
      revokeBtn.textContent = 'Revoke';
      revokeBtn.addEventListener('click', async () => {
        revokeBtn.disabled = true;
        revokeBtn.textContent = 'Revoking...';
        try {
          await deleteShareLink(this.docId, share.id);
          toast('Share link revoked', 'success');
          await this.refreshList(container);
        } catch {
          revokeBtn.disabled = false;
          revokeBtn.textContent = 'Revoke';
          toast('Failed to revoke share link', 'error');
        }
      });
      actions.appendChild(revokeBtn);

      li.appendChild(actions);
      list.appendChild(li);
    }
    container.appendChild(list);
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.overlay.remove();
  }

  get visible(): boolean {
    return this.isOpen;
  }
}
