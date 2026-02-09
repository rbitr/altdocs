import { Editor } from './editor.js';
import { Toolbar } from './toolbar.js';
import { createEmptyDocument } from '../shared/model.js';
import type { Document } from '../shared/model.js';
import {
  fetchDocumentList, fetchDocument, saveDocument, deleteDocumentById, duplicateDocument,
  ensureSession, updateMe, setShareToken, clearShareToken, getShareToken, fetchSharedDocument,
} from './api-client.js';
import type { UserInfo } from './api-client.js';
import { toast } from './toast.js';
import { CollaborationClient } from './collaboration.js';
import { RemoteCursorRenderer } from './remote-cursors.js';
import { SharePanel } from './share-panel.js';
import { FindReplaceBar } from './find-replace.js';
import type { Block } from '../shared/model.js';

let editor: Editor | null = null;
let toolbar: Toolbar | null = null;
let collab: CollaborationClient | null = null;
let remoteCursors: RemoteCursorRenderer | null = null;
let sharePanel: SharePanel | null = null;
let findReplaceBar: FindReplaceBar | null = null;
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSavedJSON = '';
let currentUser: UserInfo | null = null;
let currentDocPermission: string | null = null;

const AUTO_SAVE_DELAY = 2000; // 2 seconds after last change

export function generateId(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function scheduleAutoSave(): void {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(doAutoSave, AUTO_SAVE_DELAY);
}

async function doAutoSave(): Promise<void> {
  if (!editor) return;
  const doc = editor.getDocument();
  const currentJSON = JSON.stringify(doc.blocks);
  if (currentJSON === lastSavedJSON) return; // No changes
  updateSaveStatus('Saving...');
  try {
    await saveDocument(doc);
    lastSavedJSON = currentJSON;
    updateSaveStatus('Saved');
  } catch {
    updateSaveStatus('Save failed');
  }
}

export function updateSaveStatus(text: string): void {
  const el = document.getElementById('save-status');
  if (!el) return;
  el.textContent = text;
  el.className = '';
  if (text === 'Saving...') {
    el.classList.add('save-status-saving');
  } else if (text === 'Save failed') {
    el.classList.add('save-status-error');
  }
  if (text === 'Saved') {
    setTimeout(() => {
      const el2 = document.getElementById('save-status');
      if (el2 && el2.textContent === 'Saved') {
        el2.textContent = '';
        el2.className = '';
      }
    }, 2000);
  }
}

/** Parse doc ID and share token from hash: #/doc/{id}?share={token} */
export function parseHash(): { docId: string | null; shareToken: string | null } {
  const hash = window.location.hash;
  const match = hash.match(/^#\/doc\/([^?]+)(?:\?(.*))?$/);
  if (!match) return { docId: null, shareToken: null };
  const docId = decodeURIComponent(match[1]);
  let shareToken: string | null = null;
  if (match[2]) {
    const params = new URLSearchParams(match[2]);
    shareToken = params.get('share');
  }
  return { docId, shareToken };
}

export function createLoadingIndicator(message = 'Loading...'): HTMLElement {
  const container = document.createElement('div');
  container.className = 'loading-container';
  const spinner = document.createElement('div');
  spinner.className = 'loading-spinner';
  container.appendChild(spinner);
  const label = document.createElement('span');
  label.textContent = message;
  container.appendChild(label);
  return container;
}

// ── User profile bar ────────────────────────────────

function renderUserProfile(): void {
  // Remove existing if any
  const existing = document.getElementById('user-profile-bar');
  if (existing) existing.remove();

  if (!currentUser) return;

  const bar = document.createElement('div');
  bar.id = 'user-profile-bar';
  bar.className = 'user-profile-bar';

  const colorDot = document.createElement('span');
  colorDot.className = 'user-color-dot';
  colorDot.style.backgroundColor = currentUser.color;
  bar.appendChild(colorDot);

  const nameSpan = document.createElement('span');
  nameSpan.className = 'user-display-name';
  nameSpan.textContent = currentUser.display_name;
  nameSpan.title = 'Click to edit your display name';
  nameSpan.addEventListener('click', () => startNameEdit(bar, nameSpan));
  bar.appendChild(nameSpan);

  // Insert before #app
  const app = document.getElementById('app');
  if (app && app.parentNode) {
    app.parentNode.insertBefore(bar, app);
  }
}

function startNameEdit(bar: HTMLElement, nameSpan: HTMLElement): void {
  // Replace name span with an input
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'user-name-input';
  input.value = currentUser?.display_name || '';
  input.maxLength = 50;

  nameSpan.replaceWith(input);
  input.focus();
  input.select();

  const finish = async () => {
    const newName = input.value.trim();
    if (newName && newName !== currentUser?.display_name) {
      try {
        currentUser = await updateMe(newName);
        toast('Display name updated', 'success');
      } catch {
        toast('Failed to update name', 'error');
      }
    }
    // Replace input back with span
    const span = document.createElement('span');
    span.className = 'user-display-name';
    span.textContent = currentUser?.display_name || '';
    span.title = 'Click to edit your display name';
    span.addEventListener('click', () => startNameEdit(bar, span));
    input.replaceWith(span);
  };

  input.addEventListener('blur', finish);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      input.blur();
    } else if (e.key === 'Escape') {
      input.value = currentUser?.display_name || '';
      input.blur();
    }
  });
}

function updateCollaboratorsList(users: Array<{ userId: string; displayName: string; color: string }>): void {
  const el = document.getElementById('collab-users');
  if (!el) return;
  el.innerHTML = '';
  for (const user of users) {
    const dot = document.createElement('span');
    dot.className = 'collab-user-dot';
    dot.style.backgroundColor = user.color;
    dot.title = user.displayName;
    el.appendChild(dot);
  }
}

// ── Views ───────────────────────────────────────────

async function renderDocumentList(container: HTMLElement): Promise<void> {
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'doc-list-header';
  header.innerHTML = '<h1>AltDocs</h1>';

  const newBtn = document.createElement('button');
  newBtn.className = 'new-doc-btn';
  newBtn.textContent = 'New Document';
  newBtn.addEventListener('click', () => {
    const id = generateId();
    window.location.hash = `#/doc/${id}`;
  });
  header.appendChild(newBtn);
  container.appendChild(header);

  // Show loading indicator while fetching
  const loading = createLoadingIndicator('Loading documents...');
  container.appendChild(loading);

  try {
    const docs = await fetchDocumentList();
    loading.remove();
    if (docs.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'doc-list-empty';
      empty.textContent = 'No documents yet. Create one to get started!';
      container.appendChild(empty);
    } else {
      const list = document.createElement('ul');
      list.className = 'doc-list';
      for (const doc of docs) {
        const li = document.createElement('li');
        li.className = 'doc-list-item';

        const titleArea = document.createElement('div');
        titleArea.className = 'doc-item-title-area';

        const link = document.createElement('a');
        link.href = `#/doc/${encodeURIComponent(doc.id)}`;
        link.textContent = doc.title || 'Untitled';
        if (!doc.title || doc.title === 'Untitled') {
          link.classList.add('doc-title-untitled');
        }
        titleArea.appendChild(link);

        const date = document.createElement('span');
        date.className = 'doc-list-date';
        date.textContent = new Date(doc.updated_at).toLocaleDateString();
        titleArea.appendChild(date);

        li.appendChild(titleArea);

        // Action buttons
        const actions = document.createElement('div');
        actions.className = 'doc-item-actions';

        const dupBtn = document.createElement('button');
        dupBtn.className = 'doc-action-btn';
        dupBtn.textContent = 'Duplicate';
        dupBtn.title = 'Duplicate document';
        dupBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          dupBtn.disabled = true;
          dupBtn.textContent = 'Duplicating...';
          const newId = generateId();
          const newTitle = (doc.title || 'Untitled') + ' (Copy)';
          try {
            await duplicateDocument(doc.id, newId, newTitle);
            toast('Document duplicated', 'success');
            await renderDocumentList(container);
          } catch {
            dupBtn.disabled = false;
            dupBtn.textContent = 'Duplicate';
            toast('Failed to duplicate document', 'error');
          }
        });
        actions.appendChild(dupBtn);

        const delBtn = document.createElement('button');
        delBtn.className = 'doc-action-btn doc-action-btn-danger';
        delBtn.textContent = 'Delete';
        delBtn.title = 'Delete document';
        delBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!confirm(`Delete "${doc.title || 'Untitled'}"? This cannot be undone.`)) return;
          delBtn.disabled = true;
          delBtn.textContent = 'Deleting...';
          try {
            await deleteDocumentById(doc.id);
            toast('Document deleted', 'success');
            await renderDocumentList(container);
          } catch {
            delBtn.disabled = false;
            delBtn.textContent = 'Delete';
            toast('Failed to delete document', 'error');
          }
        });
        actions.appendChild(delBtn);

        li.appendChild(actions);
        list.appendChild(li);
      }
      container.appendChild(list);
    }
  } catch {
    loading.remove();
    const err = document.createElement('p');
    err.className = 'doc-list-empty';
    err.textContent = 'Could not load documents. Is the server running?';
    container.appendChild(err);
  }
}

async function openEditor(container: HTMLElement, docId: string): Promise<void> {
  container.innerHTML = '';

  // Status bar
  const statusBar = document.createElement('div');
  statusBar.className = 'status-bar';

  const backLink = document.createElement('a');
  backLink.href = '#/';
  backLink.textContent = 'All Documents';
  backLink.className = 'back-link';
  statusBar.appendChild(backLink);

  const saveStatus = document.createElement('span');
  saveStatus.id = 'save-status';
  statusBar.appendChild(saveStatus);
  container.appendChild(statusBar);

  // Show loading indicator while fetching document
  const loading = createLoadingIndicator('Loading document...');
  container.appendChild(loading);

  // Resolve share token if present
  const shareToken = getShareToken();
  let doc: Document;
  let permission: string = 'owner';

  // If opening via share token, resolve access first
  if (shareToken) {
    try {
      const shared = await fetchSharedDocument(shareToken);
      const blocks = JSON.parse(shared.document.content);
      doc = { id: shared.document.id, title: shared.document.title, blocks };
      permission = shared.permission;
      if (doc.blocks.length === 0) {
        doc = createEmptyDocument(docId, shared.document.title);
      }
    } catch {
      loading.remove();
      const err = document.createElement('p');
      err.className = 'doc-list-empty';
      err.textContent = 'This share link is invalid or has been revoked.';
      container.appendChild(err);
      return;
    }
  } else {
    // Load or create document normally
    try {
      const record = await fetchDocument(docId);
      const blocks = JSON.parse(record.content);
      doc = { id: record.id, title: record.title, blocks };
      permission = record.permission || 'owner';
      if (doc.blocks.length === 0) {
        doc = createEmptyDocument(docId, record.title);
      }
    } catch {
      doc = createEmptyDocument(docId, 'Untitled');
    }
  }

  currentDocPermission = permission;

  // Remove loading indicator and render editor UI
  loading.remove();

  // Read-only banner for view-only users
  if (permission === 'view') {
    const banner = document.createElement('div');
    banner.className = 'readonly-banner';
    banner.textContent = 'View only \u2014 you cannot edit this document';
    container.appendChild(banner);
  }

  // Title input
  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.className = 'doc-title-input';
  titleInput.placeholder = 'Untitled';
  titleInput.id = 'doc-title';
  if (permission === 'view') {
    titleInput.readOnly = true;
  }
  container.appendChild(titleInput);

  // Toolbar
  const toolbarEl = document.createElement('div');
  container.appendChild(toolbarEl);

  // Editor
  const editorEl = document.createElement('div');
  editorEl.className = 'altdocs-editor';
  if (permission === 'view') {
    editorEl.setAttribute('contenteditable', 'false');
  }
  container.appendChild(editorEl);

  // Set title
  titleInput.value = doc.title === 'Untitled' ? '' : doc.title;

  // Title change handler — save title on change
  let titleSaveTimer: ReturnType<typeof setTimeout> | null = null;
  if (permission !== 'view') {
    titleInput.addEventListener('input', () => {
      if (!editor) return;
      const newTitle = titleInput.value.trim() || 'Untitled';
      editor.doc = { ...editor.doc, title: newTitle };
      // Debounce title save
      if (titleSaveTimer) clearTimeout(titleSaveTimer);
      titleSaveTimer = setTimeout(async () => {
        updateSaveStatus('Saving...');
        try {
          await saveDocument(editor!.getDocument());
          updateSaveStatus('Saved');
        } catch {
          updateSaveStatus('Save failed');
        }
      }, 500);
    });
  }

  editor = new Editor(editorEl, doc);
  toolbar = new Toolbar(toolbarEl, editor);
  editor.onShortcutsToggle(() => toolbar!.toggleShortcutsPanel());

  // Create remote cursor renderer (needs a wrapper div for relative positioning)
  const editorWrapper = document.createElement('div');
  editorWrapper.className = 'editor-wrapper';
  editorEl.parentElement!.insertBefore(editorWrapper, editorEl);
  editorWrapper.appendChild(editorEl);

  // Create find/replace bar
  findReplaceBar = new FindReplaceBar(editorEl, editor);
  editor.onFindReplace((withReplace) => {
    if (findReplaceBar) {
      findReplaceBar.show(withReplace);
    }
  });
  remoteCursors = new RemoteCursorRenderer(editorEl);
  toolbar.setVersionRestoreHandler((record) => {
    if (!editor) return;
    const blocks: Block[] = JSON.parse(record.content);
    const restoredDoc = { id: docId, title: record.title, blocks };
    editor.setDocument(restoredDoc);
    titleInput.value = record.title === 'Untitled' ? '' : record.title;
    lastSavedJSON = record.content;
    toast('Version restored', 'success');
  });
  lastSavedJSON = JSON.stringify(doc.blocks);

  // Auto-save on editor changes + refresh remote cursors (only if can write)
  editor.onUpdate(() => {
    if (permission !== 'view') {
      scheduleAutoSave();
    }
    if (remoteCursors && editor) {
      remoteCursors.refresh(editor.getDocument());
    }
    if (findReplaceBar) {
      findReplaceBar.refresh();
    }
  });

  // Initial save to create on server if new (only if owner)
  if (!shareToken) {
    try {
      await saveDocument(doc);
      lastSavedJSON = JSON.stringify(doc.blocks);
    } catch {
      // Server may not be running in dev/test mode — that's OK
    }
  }

  // Start real-time collaboration
  collab = new CollaborationClient(editor, docId, {
    onConnectionChange: (state) => {
      const indicator = document.getElementById('collab-status');
      if (indicator) {
        indicator.textContent = state === 'connected' ? 'Live' : '';
        indicator.className = `collab-status collab-status-${state}`;
      }
    },
    onRemoteUsersChange: (users) => {
      updateCollaboratorsList(users);
      if (remoteCursors && editor) {
        remoteCursors.update(users, editor.getDocument());
      }
    },
  });
  collab.connect();

  // Add collaboration status indicator to status bar
  const collabStatus = document.createElement('span');
  collabStatus.id = 'collab-status';
  collabStatus.className = 'collab-status collab-status-connecting';
  statusBar.appendChild(collabStatus);

  // Collaborators list
  const collabList = document.createElement('span');
  collabList.id = 'collab-users';
  collabList.className = 'collab-users';
  statusBar.appendChild(collabList);

  // Share button (only show for owners)
  if (permission === 'owner') {
    const shareBtn = document.createElement('button');
    shareBtn.className = 'share-btn';
    shareBtn.textContent = 'Share';
    shareBtn.title = 'Share this document';
    shareBtn.addEventListener('click', () => {
      if (sharePanel && sharePanel.visible) {
        sharePanel.close();
        return;
      }
      if (sharePanel) {
        sharePanel.close();
      }
      sharePanel = new SharePanel(docId);
      sharePanel.open();
    });
    statusBar.appendChild(shareBtn);
  }

  // Permission badge in status bar
  if (permission === 'view' || permission === 'edit') {
    const permBadge = document.createElement('span');
    permBadge.className = `permission-badge permission-${permission}`;
    permBadge.textContent = permission === 'edit' ? 'Can edit' : 'View only';
    statusBar.appendChild(permBadge);
  }

  // Make editor read-only for view-only users
  if (permission === 'view') {
    editorEl.setAttribute('contenteditable', 'false');
  }

  // Expose for debugging
  (window as any).__editor = editor;
  (window as any).__toolbar = toolbar;
  (window as any).__collab = collab;
}

async function route(): Promise<void> {
  const app = document.getElementById('app');
  if (!app) return;

  // Clean up auto-save
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
  // Disconnect collaboration and flush pending save before navigating away
  if (findReplaceBar) {
    findReplaceBar.destroy();
    findReplaceBar = null;
  }
  if (sharePanel) {
    sharePanel.close();
    sharePanel = null;
  }
  if (remoteCursors) {
    remoteCursors.destroy();
    remoteCursors = null;
  }
  if (collab) {
    collab.disconnect();
    collab = null;
  }
  if (editor) {
    await doAutoSave();
    editor = null;
    toolbar = null;
  }
  currentDocPermission = null;

  const { docId, shareToken } = parseHash();
  if (shareToken) {
    setShareToken(shareToken);
  } else {
    clearShareToken();
  }

  if (docId) {
    await openEditor(app, docId);
  } else {
    clearShareToken();
    await renderDocumentList(app);
  }
}

// ── App initialization ──────────────────────────────

async function init(): Promise<void> {
  // Initialize session (creates anonymous user if needed)
  try {
    currentUser = await ensureSession();
  } catch {
    // Server may not be running — continue without auth
  }

  // Render user profile bar
  renderUserProfile();

  // Route on hash change
  window.addEventListener('hashchange', () => route());

  // Initial route
  await route();
}

init();
