import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import {
  createDocument,
  getDocument,
  listDocuments,
  updateDocument,
  deleteDocument,
  createVersion,
  listVersions,
  getVersion,
  deleteVersions,
  createUser,
  getUser,
  updateUser,
  createSession,
  getSessionWithUser,
  deleteExpiredSessions,
  resetStore,
  useMemoryDb,
} from '../src/server/db.js';

describe('Document Store', () => {
  beforeAll(() => {
    useMemoryDb();
  });

  beforeEach(() => {
    resetStore();
  });

  it('creates and retrieves a document', () => {
    const record = createDocument('doc1', 'Test Doc', '[]');
    expect(record.id).toBe('doc1');
    expect(record.title).toBe('Test Doc');
    expect(record.content).toBe('[]');
    expect(record.created_at).toBeTruthy();
    expect(record.updated_at).toBeTruthy();

    const fetched = getDocument('doc1');
    expect(fetched).toEqual(record);
  });

  it('returns undefined for non-existent document', () => {
    expect(getDocument('nonexistent')).toBeUndefined();
  });

  it('lists documents sorted by updated_at descending', () => {
    // Use fake timers to guarantee different timestamps
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    createDocument('a', 'First', '[]');
    vi.setSystemTime(new Date('2024-01-02T00:00:00Z'));
    createDocument('b', 'Second', '[]');
    vi.useRealTimers();

    const list = listDocuments();
    expect(list.length).toBe(2);
    // Most recently created should be first
    expect(list[0].id).toBe('b');
    expect(list[1].id).toBe('a');
    // List items have id, title, updated_at but not content
    expect(list[0].title).toBe('Second');
    expect(list[0].updated_at).toBeTruthy();
    expect((list[0] as any).content).toBeUndefined();
  });

  it('updates a document', () => {
    createDocument('doc1', 'Original', '[]');
    const updated = updateDocument('doc1', 'Updated Title', '[{"type":"block"}]');
    expect(updated).toBeTruthy();
    expect(updated!.title).toBe('Updated Title');
    expect(updated!.content).toBe('[{"type":"block"}]');
    expect(updated!.id).toBe('doc1');
  });

  it('returns undefined when updating non-existent document', () => {
    expect(updateDocument('nope', 'Title', '[]')).toBeUndefined();
  });

  it('deletes a document', () => {
    createDocument('doc1', 'To Delete', '[]');
    expect(deleteDocument('doc1')).toBe(true);
    expect(getDocument('doc1')).toBeUndefined();
    expect(listDocuments().length).toBe(0);
  });

  it('returns false when deleting non-existent document', () => {
    expect(deleteDocument('nope')).toBe(false);
  });

  it('stores JSON content correctly', () => {
    const blocks = JSON.stringify([
      { id: 'b1', type: 'paragraph', alignment: 'left', runs: [{ text: 'Hello', style: {} }] },
    ]);
    createDocument('doc1', 'Test', blocks);
    const fetched = getDocument('doc1');
    expect(fetched!.content).toBe(blocks);
    const parsed = JSON.parse(fetched!.content);
    expect(parsed[0].runs[0].text).toBe('Hello');
  });
});

describe('Version History', () => {
  beforeAll(() => {
    useMemoryDb();
  });

  beforeEach(() => {
    resetStore();
  });

  it('creates a version with auto-incrementing version number', () => {
    createDocument('doc1', 'Test', '[]');
    const v1 = createVersion('doc1', 'Test', '[1]');
    expect(v1.document_id).toBe('doc1');
    expect(v1.version_number).toBe(1);
    expect(v1.title).toBe('Test');
    expect(v1.content).toBe('[1]');
    expect(v1.created_at).toBeTruthy();

    const v2 = createVersion('doc1', 'Test v2', '[2]');
    expect(v2.version_number).toBe(2);
    expect(v2.title).toBe('Test v2');
  });

  it('lists versions in descending order', () => {
    createDocument('doc1', 'Test', '[]');
    createVersion('doc1', 'v1', '[1]');
    createVersion('doc1', 'v2', '[2]');
    createVersion('doc1', 'v3', '[3]');

    const versions = listVersions('doc1');
    expect(versions.length).toBe(3);
    expect(versions[0].version_number).toBe(3);
    expect(versions[1].version_number).toBe(2);
    expect(versions[2].version_number).toBe(1);
    // List items do not include content
    expect((versions[0] as any).content).toBeUndefined();
  });

  it('returns empty array for document with no versions', () => {
    createDocument('doc1', 'Test', '[]');
    expect(listVersions('doc1')).toEqual([]);
  });

  it('gets a specific version by number', () => {
    createDocument('doc1', 'Test', '[]');
    createVersion('doc1', 'v1', '[1]');
    createVersion('doc1', 'v2', '[2]');

    const v = getVersion('doc1', 2);
    expect(v).toBeTruthy();
    expect(v!.version_number).toBe(2);
    expect(v!.title).toBe('v2');
    expect(v!.content).toBe('[2]');
  });

  it('returns undefined for non-existent version', () => {
    createDocument('doc1', 'Test', '[]');
    expect(getVersion('doc1', 99)).toBeUndefined();
  });

  it('updateDocument auto-creates a version', () => {
    createDocument('doc1', 'Test', '[]');
    updateDocument('doc1', 'Updated', '[1]');

    const versions = listVersions('doc1');
    expect(versions.length).toBe(1);
    expect(versions[0].version_number).toBe(1);
    expect(versions[0].title).toBe('Updated');
  });

  it('deleting a document also deletes its versions', () => {
    createDocument('doc1', 'Test', '[]');
    createVersion('doc1', 'v1', '[1]');
    createVersion('doc1', 'v2', '[2]');

    deleteDocument('doc1');
    expect(listVersions('doc1')).toEqual([]);
  });

  it('deleteVersions removes all versions for a document', () => {
    createDocument('doc1', 'Test', '[]');
    createVersion('doc1', 'v1', '[1]');
    createVersion('doc1', 'v2', '[2]');

    deleteVersions('doc1');
    expect(listVersions('doc1')).toEqual([]);
    // Document itself still exists
    expect(getDocument('doc1')).toBeTruthy();
  });

  it('prunes versions beyond 50', () => {
    createDocument('doc1', 'Test', '[]');
    for (let i = 1; i <= 55; i++) {
      createVersion('doc1', `v${i}`, `[${i}]`);
    }

    const versions = listVersions('doc1');
    expect(versions.length).toBe(50);
    // Oldest versions should be pruned — newest should remain
    expect(versions[0].version_number).toBe(55);
    expect(versions[versions.length - 1].version_number).toBe(6);
  });

  it('versions are independent across documents', () => {
    createDocument('doc1', 'Doc 1', '[]');
    createDocument('doc2', 'Doc 2', '[]');
    createVersion('doc1', 'v1', '[1]');
    createVersion('doc2', 'v1', '[a]');
    createVersion('doc1', 'v2', '[2]');

    expect(listVersions('doc1').length).toBe(2);
    expect(listVersions('doc2').length).toBe(1);
  });
});

describe('User Store', () => {
  beforeAll(() => {
    useMemoryDb();
  });

  beforeEach(() => {
    resetStore();
  });

  it('creates a user with auto-generated fields', () => {
    const user = createUser();
    expect(user.id).toMatch(/^user_/);
    expect(user.display_name).toBeTruthy();
    expect(user.display_name).toMatch(/^Anonymous /);
    expect(user.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(user.created_at).toBeTruthy();
    expect(user.updated_at).toBeTruthy();
  });

  it('creates a user with custom display name and color', () => {
    const user = createUser('Alice', '#ff0000');
    expect(user.display_name).toBe('Alice');
    expect(user.color).toBe('#ff0000');
  });

  it('retrieves a user by ID', () => {
    const user = createUser('Bob', '#00ff00');
    const fetched = getUser(user.id);
    expect(fetched).toEqual(user);
  });

  it('returns undefined for non-existent user', () => {
    expect(getUser('nonexistent')).toBeUndefined();
  });

  it('updates a user display name', () => {
    const user = createUser('Charlie');
    const updated = updateUser(user.id, 'Chuck');
    expect(updated).toBeTruthy();
    expect(updated!.display_name).toBe('Chuck');
    expect(updated!.color).toBe(user.color);
    expect(updated!.id).toBe(user.id);

    const fetched = getUser(user.id);
    expect(fetched!.display_name).toBe('Chuck');
  });

  it('returns undefined when updating non-existent user', () => {
    expect(updateUser('nonexistent', 'Name')).toBeUndefined();
  });

  it('each user gets a unique ID', () => {
    const user1 = createUser();
    const user2 = createUser();
    expect(user1.id).not.toBe(user2.id);
  });
});

describe('Session Store', () => {
  beforeAll(() => {
    useMemoryDb();
  });

  beforeEach(() => {
    resetStore();
  });

  it('creates a session for a user', () => {
    const user = createUser('Test User');
    const session = createSession(user.id);
    expect(session.token).toBeTruthy();
    expect(session.token.length).toBe(64); // 32 bytes hex
    expect(session.user_id).toBe(user.id);
    expect(session.created_at).toBeTruthy();
    expect(session.expires_at).toBeTruthy();
    // Expires in the future
    expect(new Date(session.expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  it('retrieves session with user info', () => {
    const user = createUser('Session User', '#123456');
    const session = createSession(user.id);
    const result = getSessionWithUser(session.token);
    expect(result).toBeTruthy();
    expect(result!.token).toBe(session.token);
    expect(result!.user_id).toBe(user.id);
    expect(result!.display_name).toBe('Session User');
    expect(result!.color).toBe('#123456');
  });

  it('returns undefined for non-existent token', () => {
    expect(getSessionWithUser('badtoken')).toBeUndefined();
  });

  it('returns undefined for expired session', () => {
    const user = createUser('Expired User');
    // Create session with fake time in the past
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2020-01-01T00:00:00Z'));
    const session = createSession(user.id);
    vi.useRealTimers();

    // Session should be expired now
    expect(getSessionWithUser(session.token)).toBeUndefined();
  });

  it('deletes expired sessions', () => {
    const user = createUser('Cleanup User');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2020-01-01T00:00:00Z'));
    createSession(user.id);
    createSession(user.id);
    vi.useRealTimers();

    const deleted = deleteExpiredSessions();
    expect(deleted).toBe(2);
  });

  it('each session gets a unique token', () => {
    const user = createUser();
    const s1 = createSession(user.id);
    const s2 = createSession(user.id);
    expect(s1.token).not.toBe(s2.token);
  });
});
