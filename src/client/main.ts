import { Editor } from './editor.js';
import { Toolbar } from './toolbar.js';
import { createEmptyDocument } from '../shared/model.js';
import type { Document } from '../shared/model.js';
import { fetchDocumentList, fetchDocument, saveDocument } from './api-client.js';

let editor: Editor | null = null;
let toolbar: Toolbar | null = null;
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSavedJSON = '';

const AUTO_SAVE_DELAY = 2000; // 2 seconds after last change

function generateId(): string {
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
  try {
    await saveDocument(doc);
    lastSavedJSON = currentJSON;
    updateSaveStatus('Saved');
  } catch {
    updateSaveStatus('Save failed');
  }
}

function updateSaveStatus(text: string): void {
  const el = document.getElementById('save-status');
  if (el) el.textContent = text;
  if (text === 'Saved') {
    setTimeout(() => {
      const el2 = document.getElementById('save-status');
      if (el2 && el2.textContent === 'Saved') el2.textContent = '';
    }, 2000);
  }
}

function getDocIdFromHash(): string | null {
  const hash = window.location.hash;
  const match = hash.match(/^#\/doc\/(.+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

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

  try {
    const docs = await fetchDocumentList();
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
        const link = document.createElement('a');
        link.href = `#/doc/${encodeURIComponent(doc.id)}`;
        link.textContent = doc.title || 'Untitled';
        const date = document.createElement('span');
        date.className = 'doc-list-date';
        date.textContent = new Date(doc.updated_at).toLocaleDateString();
        li.appendChild(link);
        li.appendChild(date);
        list.appendChild(li);
      }
      container.appendChild(list);
    }
  } catch {
    const err = document.createElement('p');
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

  // Toolbar
  const toolbarEl = document.createElement('div');
  container.appendChild(toolbarEl);

  // Editor
  const editorEl = document.createElement('div');
  editorEl.className = 'altdocs-editor';
  container.appendChild(editorEl);

  // Load or create document
  let doc: Document;
  try {
    const record = await fetchDocument(docId);
    const blocks = JSON.parse(record.content);
    doc = { id: record.id, title: record.title, blocks };
    // If blocks are empty, create a default block
    if (doc.blocks.length === 0) {
      doc = createEmptyDocument(docId, record.title);
    }
  } catch {
    // Document doesn't exist yet — create a new one
    doc = createEmptyDocument(docId, 'Untitled');
  }

  editor = new Editor(editorEl, doc);
  toolbar = new Toolbar(toolbarEl, editor);
  lastSavedJSON = JSON.stringify(doc.blocks);

  // Auto-save on editor changes
  editor.onUpdate(() => {
    scheduleAutoSave();
  });

  // Initial save to create on server if new
  try {
    await saveDocument(doc);
    lastSavedJSON = JSON.stringify(doc.blocks);
  } catch {
    // Server may not be running in dev/test mode — that's OK
  }

  // Expose for debugging
  (window as any).__editor = editor;
  (window as any).__toolbar = toolbar;
}

async function route(): Promise<void> {
  const app = document.getElementById('app');
  if (!app) return;

  // Clean up auto-save
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
  // Flush pending save before navigating away
  if (editor) {
    await doAutoSave();
    editor = null;
    toolbar = null;
  }

  const docId = getDocIdFromHash();
  if (docId) {
    await openEditor(app, docId);
  } else {
    await renderDocumentList(app);
  }
}

// Route on hash change
window.addEventListener('hashchange', () => route());

// Initial route
route();
