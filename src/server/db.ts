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

export function updateDocument(
  id: string,
  title: string,
  content: string
): DocumentRecord | undefined {
  const existing = db.prepare('SELECT created_at FROM documents WHERE id = ?').get(id) as { created_at: string } | undefined;
  if (!existing) return undefined;
  const now = new Date().toISOString();
  db.prepare('UPDATE documents SET title = ?, content = ?, updated_at = ? WHERE id = ?').run(title, content, now, id);
  return { id, title, content, created_at: existing.created_at, updated_at: now };
}

export function deleteDocument(id: string): boolean {
  const result = db.prepare('DELETE FROM documents WHERE id = ?').run(id);
  return result.changes > 0;
}

/** Reset store — for testing only. Deletes all rows. */
export function resetStore(): void {
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
}

/** Close the database connection. */
export function closeDb(): void {
  db.close();
}
