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
  owner_id?: string | null;
  permission?: string;
  created_at: string;
  updated_at: string;
}

export interface UserInfo {
  id: string;
  display_name: string;
  color: string;
}

export interface SessionResponse {
  token: string;
  user: UserInfo;
}

export interface ShareRecord {
  id: string;
  document_id: string;
  token: string;
  permission: 'view' | 'edit';
  created_by: string | null;
  created_at: string;
}

export interface SharedDocumentResponse {
  document: DocumentRecord;
  permission: 'view' | 'edit';
  share_token: string;
}

const BASE = '/api/documents';
const AUTH_BASE = '/api/auth';
const TIMEOUT_MS = 3000;
const TOKEN_KEY = 'altdocs_session_token';
const SHARE_TOKEN_KEY = 'altdocs_share_token';

// ── Token management ────────────────────────────────

let cachedToken: string | null = null;

export function getStoredToken(): string | null {
  if (cachedToken) return cachedToken;
  cachedToken = localStorage.getItem(TOKEN_KEY);
  return cachedToken;
}

export function setStoredToken(token: string): void {
  cachedToken = token;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  cachedToken = null;
  localStorage.removeItem(TOKEN_KEY);
}

// ── Share token management ──────────────────────────

let currentShareToken: string | null = null;

export function setShareToken(token: string | null): void {
  currentShareToken = token;
  if (token) {
    sessionStorage.setItem(SHARE_TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(SHARE_TOKEN_KEY);
  }
}

export function getShareToken(): string | null {
  return currentShareToken;
}

export function clearShareToken(): void {
  currentShareToken = null;
  sessionStorage.removeItem(SHARE_TOKEN_KEY);
}

// ── Fetch helpers ───────────────────────────────────

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (currentShareToken) {
    headers['X-Share-Token'] = currentShareToken;
  }
  return headers;
}

function fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  // Merge auth headers with any provided headers
  const headers = { ...authHeaders(), ...(options?.headers as Record<string, string> || {}) };
  return fetch(url, { ...options, headers, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// ── Auth API ────────────────────────────────────────

export async function createSession(): Promise<SessionResponse> {
  const res = await fetchWithTimeout(`${AUTH_BASE}/session`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Failed to create session: ${res.status}`);
  const data: SessionResponse = await res.json();
  setStoredToken(data.token);
  return data;
}

export async function getMe(): Promise<UserInfo> {
  const res = await fetchWithTimeout(`${AUTH_BASE}/me`);
  if (!res.ok) {
    if (res.status === 401) {
      clearStoredToken();
    }
    throw new Error(`Failed to get user: ${res.status}`);
  }
  return res.json();
}

export async function updateMe(displayName: string): Promise<UserInfo> {
  const res = await fetchWithTimeout(`${AUTH_BASE}/me`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ display_name: displayName }),
  });
  if (!res.ok) throw new Error(`Failed to update user: ${res.status}`);
  return res.json();
}

/** Ensure a session exists. Returns user info. Creates a new session if needed. */
export async function ensureSession(): Promise<UserInfo> {
  const token = getStoredToken();
  if (token) {
    try {
      return await getMe();
    } catch {
      // Token invalid or expired — create new session
    }
  }
  const session = await createSession();
  return session.user;
}

// ── Document API ────────────────────────────────────

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

// ── Sharing API ─────────────────────────────────────

export async function createShareLink(docId: string, permission: 'view' | 'edit'): Promise<ShareRecord> {
  const res = await fetchWithTimeout(`${BASE}/${encodeURIComponent(docId)}/shares`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ permission }),
  });
  if (!res.ok) throw new Error(`Failed to create share: ${res.status}`);
  return res.json();
}

export async function fetchShares(docId: string): Promise<ShareRecord[]> {
  const res = await fetchWithTimeout(`${BASE}/${encodeURIComponent(docId)}/shares`);
  if (!res.ok) throw new Error(`Failed to list shares: ${res.status}`);
  return res.json();
}

export async function deleteShareLink(docId: string, shareId: string): Promise<void> {
  const res = await fetchWithTimeout(`${BASE}/${encodeURIComponent(docId)}/shares/${encodeURIComponent(shareId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to delete share: ${res.status}`);
}

export async function fetchSharedDocument(token: string): Promise<SharedDocumentResponse> {
  const res = await fetchWithTimeout(`/api/shared/${encodeURIComponent(token)}`);
  if (!res.ok) throw new Error(`Failed to load shared document: ${res.status}`);
  return res.json();
}
