import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import {
  createDocument,
  getDocument,
  createUser,
  createSession,
  createShare,
  getShareByToken,
  getShare,
  listShares,
  deleteShare,
  deleteSharesByDocument,
  deleteDocument,
  resetStore,
  useMemoryDb,
} from '../src/server/db.js';

describe('Document Sharing - DB operations', () => {
  beforeAll(() => {
    useMemoryDb();
  });

  beforeEach(() => {
    resetStore();
  });

  describe('createDocument with owner_id', () => {
    it('creates a document with no owner by default', () => {
      const doc = createDocument('doc1', 'Test', '[]');
      expect(doc.owner_id).toBeNull();
    });

    it('creates a document with an owner', () => {
      const user = createUser();
      const doc = createDocument('doc1', 'Test', '[]', user.id);
      expect(doc.owner_id).toBe(user.id);
    });

    it('getDocument returns owner_id', () => {
      const user = createUser();
      createDocument('doc1', 'Test', '[]', user.id);
      const doc = getDocument('doc1');
      expect(doc?.owner_id).toBe(user.id);
    });
  });

  describe('createShare', () => {
    it('creates a view share', () => {
      createDocument('doc1', 'Test', '[]');
      const share = createShare('doc1', 'view');
      expect(share.document_id).toBe('doc1');
      expect(share.permission).toBe('view');
      expect(share.token).toHaveLength(32); // 16 bytes hex
      expect(share.id).toMatch(/^share_/);
      expect(share.created_by).toBeNull();
    });

    it('creates an edit share', () => {
      createDocument('doc1', 'Test', '[]');
      const share = createShare('doc1', 'edit', 'user123');
      expect(share.permission).toBe('edit');
      expect(share.created_by).toBe('user123');
    });

    it('creates shares with unique tokens', () => {
      createDocument('doc1', 'Test', '[]');
      const share1 = createShare('doc1', 'view');
      const share2 = createShare('doc1', 'edit');
      expect(share1.token).not.toBe(share2.token);
      expect(share1.id).not.toBe(share2.id);
    });
  });

  describe('getShareByToken', () => {
    it('returns share by token', () => {
      createDocument('doc1', 'Test', '[]');
      const created = createShare('doc1', 'view');
      const found = getShareByToken(created.token);
      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.permission).toBe('view');
    });

    it('returns undefined for non-existent token', () => {
      expect(getShareByToken('nonexistent')).toBeUndefined();
    });
  });

  describe('getShare', () => {
    it('returns share by id', () => {
      createDocument('doc1', 'Test', '[]');
      const created = createShare('doc1', 'edit');
      const found = getShare(created.id);
      expect(found).toBeDefined();
      expect(found!.token).toBe(created.token);
    });

    it('returns undefined for non-existent id', () => {
      expect(getShare('nonexistent')).toBeUndefined();
    });
  });

  describe('listShares', () => {
    it('returns empty array for document with no shares', () => {
      createDocument('doc1', 'Test', '[]');
      expect(listShares('doc1')).toEqual([]);
    });

    it('returns all shares for a document', () => {
      createDocument('doc1', 'Test', '[]');
      createShare('doc1', 'view');
      createShare('doc1', 'edit');
      const shares = listShares('doc1');
      expect(shares).toHaveLength(2);
    });

    it('does not include shares from other documents', () => {
      createDocument('doc1', 'Test', '[]');
      createDocument('doc2', 'Test 2', '[]');
      createShare('doc1', 'view');
      createShare('doc2', 'edit');
      expect(listShares('doc1')).toHaveLength(1);
      expect(listShares('doc2')).toHaveLength(1);
    });
  });

  describe('deleteShare', () => {
    it('deletes a share by id', () => {
      createDocument('doc1', 'Test', '[]');
      const share = createShare('doc1', 'view');
      expect(deleteShare(share.id)).toBe(true);
      expect(getShare(share.id)).toBeUndefined();
      expect(getShareByToken(share.token)).toBeUndefined();
    });

    it('returns false for non-existent id', () => {
      expect(deleteShare('nonexistent')).toBe(false);
    });
  });

  describe('deleteSharesByDocument', () => {
    it('deletes all shares for a document', () => {
      createDocument('doc1', 'Test', '[]');
      createShare('doc1', 'view');
      createShare('doc1', 'edit');
      deleteSharesByDocument('doc1');
      expect(listShares('doc1')).toEqual([]);
    });
  });

  describe('deleteDocument cascades shares', () => {
    it('deletes shares when document is deleted', () => {
      createDocument('doc1', 'Test', '[]');
      const share = createShare('doc1', 'view');
      deleteDocument('doc1');
      expect(getShareByToken(share.token)).toBeUndefined();
    });
  });
});
