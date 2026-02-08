import type { Document } from '../shared/model.js';

export interface DocumentListItem {
  id: string;
  title: string;
  updated_at: string;
}

export interface DocumentRecord {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

const BASE = '/api/documents';
const TIMEOUT_MS = 3000;

function fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export async function fetchDocumentList(): Promise<DocumentListItem[]> {
  const res = await fetchWithTimeout(BASE);
  if (!res.ok) throw new Error(`Failed to list documents: ${res.status}`);
  return res.json();
}

export async function fetchDocument(id: string): Promise<DocumentRecord> {
  const res = await fetchWithTimeout(`${BASE}/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Failed to load document: ${res.status}`);
  return res.json();
}

export async function saveDocument(doc: Document): Promise<DocumentRecord> {
  const res = await fetchWithTimeout(`${BASE}/${encodeURIComponent(doc.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: doc.title,
      content: JSON.stringify(doc.blocks),
    }),
  });
  if (!res.ok) throw new Error(`Failed to save document: ${res.status}`);
  return res.json();
}

export async function createNewDocument(id: string, title: string): Promise<DocumentRecord> {
  const res = await fetchWithTimeout(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, title, content: '[]' }),
  });
  if (!res.ok) throw new Error(`Failed to create document: ${res.status}`);
  return res.json();
}

export async function deleteDocumentById(id: string): Promise<void> {
  const res = await fetchWithTimeout(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to delete document: ${res.status}`);
}

export interface VersionListItem {
  id: number;
  version_number: number;
  title: string;
  created_at: string;
}

export interface VersionRecord {
  id: number;
  document_id: string;
  version_number: number;
  title: string;
  content: string;
  created_at: string;
}

export async function fetchVersions(docId: string): Promise<VersionListItem[]> {
  const res = await fetchWithTimeout(`${BASE}/${encodeURIComponent(docId)}/versions`);
  if (!res.ok) throw new Error(`Failed to list versions: ${res.status}`);
  return res.json();
}

export async function fetchVersion(docId: string, versionNumber: number): Promise<VersionRecord> {
  const res = await fetchWithTimeout(`${BASE}/${encodeURIComponent(docId)}/versions/${versionNumber}`);
  if (!res.ok) throw new Error(`Failed to load version: ${res.status}`);
  return res.json();
}

export async function restoreVersion(docId: string, versionNumber: number): Promise<DocumentRecord> {
  const res = await fetchWithTimeout(`${BASE}/${encodeURIComponent(docId)}/versions/${versionNumber}/restore`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Failed to restore version: ${res.status}`);
  return res.json();
}

export async function duplicateDocument(sourceId: string, newId: string, newTitle: string): Promise<DocumentRecord> {
  const source = await fetchDocument(sourceId);
  const res = await fetchWithTimeout(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: newId, title: newTitle, content: source.content }),
  });
  if (!res.ok) throw new Error(`Failed to duplicate document: ${res.status}`);
  return res.json();
}
