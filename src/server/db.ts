import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface DocumentRecord {
  id: string;
  title: string;
  content: string; // JSON-serialized Document.blocks
  created_at: string;
  updated_at: string;
}

export interface DocumentListItem {
  id: string;
  title: string;
  updated_at: string;
}

const DATA_DIR = path.resolve(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'documents.json');

// In-memory store, synced to disk
let store: Map<string, DocumentRecord> = new Map();

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadFromDisk(): void {
  ensureDataDir();
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const records: DocumentRecord[] = JSON.parse(raw);
    store = new Map(records.map((r) => [r.id, r]));
  }
}

function saveToDisk(): void {
  ensureDataDir();
  const records = Array.from(store.values());
  fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2), 'utf-8');
}

// Load on startup
loadFromDisk();

export function getDocument(id: string): DocumentRecord | undefined {
  return store.get(id);
}

export function listDocuments(): DocumentListItem[] {
  return Array.from(store.values())
    .map((r) => ({ id: r.id, title: r.title, updated_at: r.updated_at }))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function createDocument(id: string, title: string, content: string): DocumentRecord {
  const now = new Date().toISOString();
  const record: DocumentRecord = { id, title, content, created_at: now, updated_at: now };
  store.set(id, record);
  saveToDisk();
  return record;
}

export function updateDocument(
  id: string,
  title: string,
  content: string
): DocumentRecord | undefined {
  const existing = store.get(id);
  if (!existing) return undefined;
  existing.title = title;
  existing.content = content;
  existing.updated_at = new Date().toISOString();
  saveToDisk();
  return existing;
}

export function deleteDocument(id: string): boolean {
  const existed = store.delete(id);
  if (existed) saveToDisk();
  return existed;
}

/** Reset store — for testing only */
export function resetStore(): void {
  store = new Map();
}
