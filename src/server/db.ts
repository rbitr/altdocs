import Database from 'better-sqlite3';
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

export interface VersionRecord {
  id: number;
  document_id: string;
  version_number: number;
  title: string;
  content: string;
  created_at: string;
}

export interface VersionListItem {
  id: number;
  version_number: number;
  title: string;
  created_at: string;
}

const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'altdocs.db');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

let db: Database.Database;

function initDb(): Database.Database {
  ensureDataDir();
  const database = new Database(DB_PATH);
  database.pragma('journal_mode = WAL');
  database.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  database.exec(`
    CREATE TABLE IF NOT EXISTS document_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      UNIQUE(document_id, version_number)
    )
  `);
  return database;
}

db = initDb();

export function getDocument(id: string): DocumentRecord | undefined {
  const row = db.prepare('SELECT id, title, content, created_at, updated_at FROM documents WHERE id = ?').get(id) as DocumentRecord | undefined;
  return row;
}

export function listDocuments(): DocumentListItem[] {
  const rows = db.prepare('SELECT id, title, updated_at FROM documents ORDER BY updated_at DESC').all() as DocumentListItem[];
  return rows;
}

export function createDocument(id: string, title: string, content: string): DocumentRecord {
  const now = new Date().toISOString();
  db.prepare('INSERT INTO documents (id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(id, title, content, now, now);
  return { id, title, content, created_at: now, updated_at: now };
}

const MAX_VERSIONS_PER_DOC = 50;

export function updateDocument(
  id: string,
  title: string,
  content: string
): DocumentRecord | undefined {
  const existing = db.prepare('SELECT created_at, title, content FROM documents WHERE id = ?').get(id) as { created_at: string; title: string; content: string } | undefined;
  if (!existing) return undefined;
  const now = new Date().toISOString();
  db.prepare('UPDATE documents SET title = ?, content = ?, updated_at = ? WHERE id = ?').run(title, content, now, id);
  // Only create a version if something actually changed
  if (title !== existing.title || content !== existing.content) {
    createVersion(id, title, content);
  }
  return { id, title, content, created_at: existing.created_at, updated_at: now };
}

export function createVersion(documentId: string, title: string, content: string): VersionRecord {
  const now = new Date().toISOString();
  const lastVersion = db.prepare(
    'SELECT version_number FROM document_versions WHERE document_id = ? ORDER BY version_number DESC LIMIT 1'
  ).get(documentId) as { version_number: number } | undefined;
  const versionNumber = lastVersion ? lastVersion.version_number + 1 : 1;

  const result = db.prepare(
    'INSERT INTO document_versions (document_id, version_number, title, content, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(documentId, versionNumber, title, content, now);

  // Prune old versions beyond the limit
  const count = db.prepare(
    'SELECT COUNT(*) as cnt FROM document_versions WHERE document_id = ?'
  ).get(documentId) as { cnt: number };
  if (count.cnt > MAX_VERSIONS_PER_DOC) {
    db.prepare(
      `DELETE FROM document_versions WHERE document_id = ? AND id NOT IN (
        SELECT id FROM document_versions WHERE document_id = ? ORDER BY version_number DESC LIMIT ?
      )`
    ).run(documentId, documentId, MAX_VERSIONS_PER_DOC);
  }

  return {
    id: result.lastInsertRowid as number,
    document_id: documentId,
    version_number: versionNumber,
    title,
    content,
    created_at: now,
  };
}

export function listVersions(documentId: string): VersionListItem[] {
  return db.prepare(
    'SELECT id, version_number, title, created_at FROM document_versions WHERE document_id = ? ORDER BY version_number DESC'
  ).all(documentId) as VersionListItem[];
}

export function getVersion(documentId: string, versionNumber: number): VersionRecord | undefined {
  return db.prepare(
    'SELECT id, document_id, version_number, title, content, created_at FROM document_versions WHERE document_id = ? AND version_number = ?'
  ).get(documentId, versionNumber) as VersionRecord | undefined;
}

export function deleteVersions(documentId: string): void {
  db.prepare('DELETE FROM document_versions WHERE document_id = ?').run(documentId);
}

export function deleteDocument(id: string): boolean {
  deleteVersions(id);
  const result = db.prepare('DELETE FROM documents WHERE id = ?').run(id);
  return result.changes > 0;
}

/** Reset store — for testing only. Deletes all rows. */
export function resetStore(): void {
  db.prepare('DELETE FROM document_versions').run();
  db.prepare('DELETE FROM documents').run();
}

/** Switch to an in-memory database — for testing only. */
export function useMemoryDb(): void {
  db = new Database(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS document_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      UNIQUE(document_id, version_number)
    )
  `);
}

/** Close the database connection. */
export function closeDb(): void {
  db.close();
}
