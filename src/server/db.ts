import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface DocumentRecord {
  id: string;
  title: string;
  content: string; // JSON-serialized Document.blocks
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentListItem {
  id: string;
  title: string;
  owner_id: string | null;
  updated_at: string;
}

export interface ShareRecord {
  id: string;
  document_id: string;
  token: string;
  permission: 'view' | 'edit';
  created_by: string | null;
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

export interface VersionListItem {
  id: number;
  version_number: number;
  title: string;
  created_at: string;
}

export interface UserRecord {
  id: string;
  display_name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface SessionRecord {
  token: string;
  user_id: string;
  created_at: string;
  expires_at: string;
}

export interface SessionWithUser {
  token: string;
  user_id: string;
  display_name: string;
  color: string;
  expires_at: string;
}

const CURSOR_COLORS = [
  '#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4',
  '#42d4f4', '#f032e6', '#bfef45', '#fabed4', '#469990',
  '#dcbeff', '#9A6324',
];

const ANIMAL_NAMES = [
  'Fox', 'Owl', 'Bear', 'Wolf', 'Hawk', 'Deer', 'Lynx', 'Otter',
  'Crane', 'Raven', 'Heron', 'Bison', 'Eagle', 'Moose', 'Finch', 'Viper',
];

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function generateUserId(): string {
  return `user_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function randomColor(): string {
  return CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)];
}

function randomDisplayName(): string {
  const animal = ANIMAL_NAMES[Math.floor(Math.random() * ANIMAL_NAMES.length)];
  const num = Math.floor(Math.random() * 1000);
  return `Anonymous ${animal} ${num}`;
}

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

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
      owner_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  // Migrate existing documents table to add owner_id if missing
  try {
    database.exec('ALTER TABLE documents ADD COLUMN owner_id TEXT');
  } catch {
    // Column already exists — ignore
  }
  database.exec(`
    CREATE TABLE IF NOT EXISTS document_shares (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      permission TEXT NOT NULL DEFAULT 'view',
      created_by TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
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
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      color TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  database.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  return database;
}

db = initDb();

export function getDocument(id: string): DocumentRecord | undefined {
  const row = db.prepare('SELECT id, title, content, owner_id, created_at, updated_at FROM documents WHERE id = ?').get(id) as DocumentRecord | undefined;
  return row;
}

export function listDocuments(): DocumentListItem[] {
  const rows = db.prepare('SELECT id, title, owner_id, updated_at FROM documents ORDER BY updated_at DESC').all() as DocumentListItem[];
  return rows;
}

export function listDocumentsForUser(userId: string): DocumentListItem[] {
  const rows = db.prepare(`
    SELECT DISTINCT d.id, d.title, d.owner_id, d.updated_at FROM documents d
    LEFT JOIN document_shares ds ON d.id = ds.document_id
    WHERE d.owner_id IS NULL OR d.owner_id = ? OR ds.token IS NOT NULL
    ORDER BY d.updated_at DESC
  `).all(userId) as DocumentListItem[];
  return rows;
}

export function createDocument(id: string, title: string, content: string, ownerId?: string): DocumentRecord {
  const now = new Date().toISOString();
  const owner = ownerId || null;
  db.prepare('INSERT INTO documents (id, title, content, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, title, content, owner, now, now);
  return { id, title, content, owner_id: owner, created_at: now, updated_at: now };
}

const MAX_VERSIONS_PER_DOC = 50;

export function updateDocument(
  id: string,
  title: string,
  content: string
): DocumentRecord | undefined {
  const existing = db.prepare('SELECT created_at, owner_id, title, content FROM documents WHERE id = ?').get(id) as { created_at: string; owner_id: string | null; title: string; content: string } | undefined;
  if (!existing) return undefined;
  const now = new Date().toISOString();
  db.prepare('UPDATE documents SET title = ?, content = ?, updated_at = ? WHERE id = ?').run(title, content, now, id);
  // Only create a version if something actually changed
  if (title !== existing.title || content !== existing.content) {
    createVersion(id, title, content);
  }
  return { id, title, content, owner_id: existing.owner_id, created_at: existing.created_at, updated_at: now };
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
  deleteSharesByDocument(id);
  const result = db.prepare('DELETE FROM documents WHERE id = ?').run(id);
  return result.changes > 0;
}

// ── Document sharing operations ──────────────────────────────

function generateShareId(): string {
  return `share_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function generateShareToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function createShare(documentId: string, permission: 'view' | 'edit', createdBy?: string): ShareRecord {
  const now = new Date().toISOString();
  const id = generateShareId();
  const token = generateShareToken();
  const creator = createdBy || null;
  db.prepare(
    'INSERT INTO document_shares (id, document_id, token, permission, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, documentId, token, permission, creator, now);
  return { id, document_id: documentId, token, permission, created_by: creator, created_at: now };
}

export function getShareByToken(token: string): ShareRecord | undefined {
  return db.prepare(
    'SELECT id, document_id, token, permission, created_by, created_at FROM document_shares WHERE token = ?'
  ).get(token) as ShareRecord | undefined;
}

export function getShare(id: string): ShareRecord | undefined {
  return db.prepare(
    'SELECT id, document_id, token, permission, created_by, created_at FROM document_shares WHERE id = ?'
  ).get(id) as ShareRecord | undefined;
}

export function listShares(documentId: string): ShareRecord[] {
  return db.prepare(
    'SELECT id, document_id, token, permission, created_by, created_at FROM document_shares WHERE document_id = ? ORDER BY created_at DESC'
  ).all(documentId) as ShareRecord[];
}

export function deleteShare(id: string): boolean {
  const result = db.prepare('DELETE FROM document_shares WHERE id = ?').run(id);
  return result.changes > 0;
}

export function deleteSharesByDocument(documentId: string): void {
  db.prepare('DELETE FROM document_shares WHERE document_id = ?').run(documentId);
}

// ── User & Session operations ──────────────────────────────

export function createUser(displayName?: string, color?: string): UserRecord {
  const now = new Date().toISOString();
  const id = generateUserId();
  const name = displayName || randomDisplayName();
  const col = color || randomColor();
  db.prepare('INSERT INTO users (id, display_name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(id, name, col, now, now);
  return { id, display_name: name, color: col, created_at: now, updated_at: now };
}

export function getUser(id: string): UserRecord | undefined {
  return db.prepare('SELECT id, display_name, color, created_at, updated_at FROM users WHERE id = ?').get(id) as UserRecord | undefined;
}

export function updateUser(id: string, displayName: string): UserRecord | undefined {
  const existing = getUser(id);
  if (!existing) return undefined;
  const now = new Date().toISOString();
  db.prepare('UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?').run(displayName, now, id);
  return { ...existing, display_name: displayName, updated_at: now };
}

export function createSession(userId: string): SessionRecord {
  const now = new Date();
  const token = generateToken();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(token, userId, createdAt, expiresAt);
  return { token, user_id: userId, created_at: createdAt, expires_at: expiresAt };
}

export function getSessionWithUser(token: string): SessionWithUser | undefined {
  const row = db.prepare(`
    SELECT s.token, s.user_id, u.display_name, u.color, s.expires_at
    FROM sessions s JOIN users u ON s.user_id = u.id
    WHERE s.token = ?
  `).get(token) as SessionWithUser | undefined;
  if (!row) return undefined;
  // Check expiry
  if (new Date(row.expires_at) < new Date()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return undefined;
  }
  return row;
}

export function deleteExpiredSessions(): number {
  const now = new Date().toISOString();
  const result = db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
  return result.changes;
}

/** Reset store — for testing only. Deletes all rows. */
export function resetStore(): void {
  db.prepare('DELETE FROM sessions').run();
  db.prepare('DELETE FROM document_shares').run();
  db.prepare('DELETE FROM document_versions').run();
  db.prepare('DELETE FROM documents').run();
  db.prepare('DELETE FROM users').run();
}

/** Switch to an in-memory database — for testing only. */
export function useMemoryDb(): void {
  db = new Database(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      owner_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS document_shares (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      permission TEXT NOT NULL DEFAULT 'view',
      created_by TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
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
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      color TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
}

/** Close the database connection. */
export function closeDb(): void {
  db.close();
}
