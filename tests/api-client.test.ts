/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  fetchDocumentList,
  fetchDocument,
  saveDocument,
  createNewDocument,
  deleteDocumentById,
  duplicateDocument,
  getStoredToken,
  setStoredToken,
  clearStoredToken,
  setShareToken,
  getShareToken,
  clearShareToken,
  createSession,
  getMe,
  updateMe,
  ensureSession,
  fetchVersions,
  fetchVersion,
  restoreVersion,
  createShareLink,
  fetchShares,
  deleteShareLink,
  fetchSharedDocument,
} from '../src/client/api-client.js';
import type { Document } from '../src/shared/model.js';

// ============================================================
// Mock fetch
// ============================================================

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  vi.useFakeTimers();
  // Clear token state between tests
  clearStoredToken();
  clearShareToken();
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function okJsonResponse(data: unknown): Promise<Response> {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  } as Response);
}

function errorResponse(status: number): Promise<Response> {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ error: 'bad' }),
  } as Response);
}

// ============================================================
// fetchDocumentList
// ============================================================

describe('fetchDocumentList', () => {
  it('fetches and returns document list', async () => {
    const docs = [
      { id: '1', title: 'Doc 1', updated_at: '2025-01-01' },
      { id: '2', title: 'Doc 2', updated_at: '2025-01-02' },
    ];
    mockFetch.mockReturnValueOnce(okJsonResponse(docs));

    const result = await fetchDocumentList();
    expect(result).toEqual(docs);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/documents',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockReturnValueOnce(errorResponse(500));
    await expect(fetchDocumentList()).rejects.toThrow('Failed to list documents: 500');
  });

  it('throws on network error', async () => {
    mockFetch.mockReturnValueOnce(Promise.reject(new TypeError('Network error')));
    await expect(fetchDocumentList()).rejects.toThrow('Network error');
  });
});

// ============================================================
// fetchDocument
// ============================================================

describe('fetchDocument', () => {
  it('fetches a single document by id', async () => {
    const doc = { id: 'abc', title: 'Test', content: '[]', created_at: '', updated_at: '' };
    mockFetch.mockReturnValueOnce(okJsonResponse(doc));

    const result = await fetchDocument('abc');
    expect(result).toEqual(doc);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/documents/abc',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('encodes special characters in document id', async () => {
    const doc = { id: 'a/b', title: 'Test', content: '[]', created_at: '', updated_at: '' };
    mockFetch.mockReturnValueOnce(okJsonResponse(doc));

    await fetchDocument('a/b');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/documents/a%2Fb',
      expect.any(Object)
    );
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockReturnValueOnce(errorResponse(404));
    await expect(fetchDocument('missing')).rejects.toThrow('Failed to load document: 404');
  });
});

// ============================================================
// saveDocument
// ============================================================

describe('saveDocument', () => {
  it('sends PUT request with serialized document', async () => {
    const doc: Document = {
      id: 'doc1',
      title: 'My Doc',
      blocks: [{ id: 'b1', type: 'paragraph', alignment: 'left', runs: [{ text: 'Hi', style: {} }] }],
    };
    const saved = { id: 'doc1', title: 'My Doc', content: JSON.stringify(doc.blocks), created_at: '', updated_at: '' };
    mockFetch.mockReturnValueOnce(okJsonResponse(saved));

    const result = await saveDocument(doc);
    expect(result).toEqual(saved);

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe('/api/documents/doc1');
    const opts = callArgs[1];
    expect(opts.method).toBe('PUT');
    expect(opts.headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(opts.body);
    expect(body.title).toBe('My Doc');
    expect(body.content).toBe(JSON.stringify(doc.blocks));
  });

  it('throws on non-ok response', async () => {
    const doc: Document = { id: 'x', title: 'T', blocks: [] };
    mockFetch.mockReturnValueOnce(errorResponse(500));
    await expect(saveDocument(doc)).rejects.toThrow('Failed to save document: 500');
  });
});

// ============================================================
// createNewDocument
// ============================================================

describe('createNewDocument', () => {
  it('sends POST request with id, title, and empty content', async () => {
    const created = { id: 'new1', title: 'New', content: '[]', created_at: '', updated_at: '' };
    mockFetch.mockReturnValueOnce(okJsonResponse(created));

    const result = await createNewDocument('new1', 'New');
    expect(result).toEqual(created);

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe('/api/documents');
    const opts = callArgs[1];
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body.id).toBe('new1');
    expect(body.title).toBe('New');
    expect(body.content).toBe('[]');
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockReturnValueOnce(errorResponse(409));
    await expect(createNewDocument('dup', 'Dup')).rejects.toThrow('Failed to create document: 409');
  });
});

// ============================================================
// deleteDocumentById
// ============================================================

describe('deleteDocumentById', () => {
  it('sends DELETE request for given id', async () => {
    mockFetch.mockReturnValueOnce(Promise.resolve({ ok: true, status: 204 } as Response));

    await deleteDocumentById('del1');

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe('/api/documents/del1');
    expect(callArgs[1].method).toBe('DELETE');
  });

  it('encodes special characters in id', async () => {
    mockFetch.mockReturnValueOnce(Promise.resolve({ ok: true, status: 204 } as Response));

    await deleteDocumentById('id with spaces');
    expect(mockFetch.mock.calls[0][0]).toBe('/api/documents/id%20with%20spaces');
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockReturnValueOnce(errorResponse(404));
    await expect(deleteDocumentById('gone')).rejects.toThrow('Failed to delete document: 404');
  });
});

// ============================================================
// duplicateDocument
// ============================================================

describe('duplicateDocument', () => {
  it('fetches source then posts a copy with new id and title', async () => {
    const sourceDoc = { id: 'src1', title: 'Source', content: '[{"text":"data"}]', created_at: '', updated_at: '' };
    const created = { id: 'copy1', title: 'Copy', content: sourceDoc.content, created_at: '', updated_at: '' };

    // First call: fetchDocument (GET)
    mockFetch.mockReturnValueOnce(okJsonResponse(sourceDoc));
    // Second call: POST to create
    mockFetch.mockReturnValueOnce(okJsonResponse(created));

    const result = await duplicateDocument('src1', 'copy1', 'Copy');
    expect(result).toEqual(created);

    // Verify GET call for source
    expect(mockFetch.mock.calls[0][0]).toBe('/api/documents/src1');

    // Verify POST call for new doc
    const postArgs = mockFetch.mock.calls[1];
    expect(postArgs[0]).toBe('/api/documents');
    const opts = postArgs[1];
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body.id).toBe('copy1');
    expect(body.title).toBe('Copy');
    expect(body.content).toBe(sourceDoc.content);
  });

  it('throws if source document fetch fails', async () => {
    mockFetch.mockReturnValueOnce(errorResponse(404));
    await expect(duplicateDocument('gone', 'copy', 'Copy')).rejects.toThrow('Failed to load document: 404');
  });

  it('throws if POST to create copy fails', async () => {
    const sourceDoc = { id: 'src', title: 'S', content: '[]', created_at: '', updated_at: '' };
    mockFetch.mockReturnValueOnce(okJsonResponse(sourceDoc));
    mockFetch.mockReturnValueOnce(errorResponse(500));

    await expect(duplicateDocument('src', 'new', 'New')).rejects.toThrow('Failed to duplicate document: 500');
  });
});

// ============================================================
// Timeout behavior
// ============================================================

describe('timeout behavior', () => {
  it('passes AbortSignal to fetch', async () => {
    mockFetch.mockReturnValueOnce(okJsonResponse([]));

    await fetchDocumentList();

    const opts = mockFetch.mock.calls[0][1];
    expect(opts.signal).toBeInstanceOf(AbortSignal);
  });

  it('sets up abort timeout of 3000ms', async () => {
    // Verify that setTimeout is called with the timeout value
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    mockFetch.mockReturnValueOnce(okJsonResponse([]));

    await fetchDocumentList();

    // fetchWithTimeout should call setTimeout with TIMEOUT_MS (3000)
    const timeoutCall = setTimeoutSpy.mock.calls.find((call) => call[1] === 3000);
    expect(timeoutCall).toBeDefined();

    setTimeoutSpy.mockRestore();
  });

  it('clears timeout after successful fetch', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    mockFetch.mockReturnValueOnce(okJsonResponse([]));

    await fetchDocumentList();

    // The .finally() should call clearTimeout
    expect(clearTimeoutSpy).toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
  });
});

// ============================================================
// Token management
// ============================================================

describe('token management', () => {
  describe('getStoredToken / setStoredToken / clearStoredToken', () => {
    it('returns null when no token is stored', () => {
      expect(getStoredToken()).toBeNull();
    });

    it('stores and retrieves a token', () => {
      setStoredToken('my-token-123');
      expect(getStoredToken()).toBe('my-token-123');
    });

    it('persists token to localStorage', () => {
      setStoredToken('persist-me');
      expect(localStorage.getItem('altdocs_session_token')).toBe('persist-me');
    });

    it('reads from localStorage on first access (cache miss)', () => {
      // Directly set in localStorage to simulate a previous session
      localStorage.setItem('altdocs_session_token', 'from-storage');
      // clearStoredToken was called in beforeEach so cache is empty
      expect(getStoredToken()).toBe('from-storage');
    });

    it('clears token from cache and localStorage', () => {
      setStoredToken('doomed');
      clearStoredToken();
      expect(getStoredToken()).toBeNull();
      expect(localStorage.getItem('altdocs_session_token')).toBeNull();
    });

    it('uses cached value on subsequent calls', () => {
      setStoredToken('cached');
      // Even if localStorage is modified externally, cache wins
      localStorage.setItem('altdocs_session_token', 'different');
      expect(getStoredToken()).toBe('cached');
    });
  });

  describe('setShareToken / getShareToken / clearShareToken', () => {
    it('returns null when no share token is set', () => {
      expect(getShareToken()).toBeNull();
    });

    it('stores and retrieves a share token', () => {
      setShareToken('share-abc');
      expect(getShareToken()).toBe('share-abc');
    });

    it('persists share token to sessionStorage', () => {
      setShareToken('share-persist');
      expect(sessionStorage.getItem('altdocs_share_token')).toBe('share-persist');
    });

    it('removes from sessionStorage when set to null', () => {
      setShareToken('temp');
      setShareToken(null);
      expect(getShareToken()).toBeNull();
      expect(sessionStorage.getItem('altdocs_share_token')).toBeNull();
    });

    it('clears share token', () => {
      setShareToken('doomed');
      clearShareToken();
      expect(getShareToken()).toBeNull();
      expect(sessionStorage.getItem('altdocs_share_token')).toBeNull();
    });
  });
});

// ============================================================
// Auth headers integration
// ============================================================

describe('auth headers', () => {
  it('includes Authorization header when token is stored', async () => {
    setStoredToken('auth-token-xyz');
    mockFetch.mockReturnValueOnce(okJsonResponse([]));

    await fetchDocumentList();

    const opts = mockFetch.mock.calls[0][1];
    expect(opts.headers['Authorization']).toBe('Bearer auth-token-xyz');
  });

  it('includes X-Share-Token header when share token is set', async () => {
    setShareToken('share-token-abc');
    mockFetch.mockReturnValueOnce(okJsonResponse([]));

    await fetchDocumentList();

    const opts = mockFetch.mock.calls[0][1];
    expect(opts.headers['X-Share-Token']).toBe('share-token-abc');
  });

  it('includes both headers when both tokens are set', async () => {
    setStoredToken('auth-tok');
    setShareToken('share-tok');
    mockFetch.mockReturnValueOnce(okJsonResponse([]));

    await fetchDocumentList();

    const opts = mockFetch.mock.calls[0][1];
    expect(opts.headers['Authorization']).toBe('Bearer auth-tok');
    expect(opts.headers['X-Share-Token']).toBe('share-tok');
  });

  it('omits both headers when no tokens are set', async () => {
    mockFetch.mockReturnValueOnce(okJsonResponse([]));

    await fetchDocumentList();

    const opts = mockFetch.mock.calls[0][1];
    expect(opts.headers['Authorization']).toBeUndefined();
    expect(opts.headers['X-Share-Token']).toBeUndefined();
  });
});

// ============================================================
// createSession
// ============================================================

describe('createSession', () => {
  it('sends POST to /api/auth/session and stores token', async () => {
    const sessionData = {
      token: 'new-session-token',
      user: { id: 'u1', display_name: 'Anonymous Fox 42', color: '#ff0000' },
    };
    mockFetch.mockReturnValueOnce(okJsonResponse(sessionData));

    const result = await createSession();

    expect(result).toEqual(sessionData);
    expect(getStoredToken()).toBe('new-session-token');
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe('/api/auth/session');
    expect(callArgs[1].method).toBe('POST');
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockReturnValueOnce(errorResponse(500));
    await expect(createSession()).rejects.toThrow('Failed to create session: 500');
  });
});

// ============================================================
// getMe
// ============================================================

describe('getMe', () => {
  it('sends GET to /api/auth/me and returns user info', async () => {
    const user = { id: 'u1', display_name: 'Test User', color: '#00ff00' };
    mockFetch.mockReturnValueOnce(okJsonResponse(user));

    const result = await getMe();

    expect(result).toEqual(user);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/auth/me');
  });

  it('clears stored token on 401 response', async () => {
    setStoredToken('expired-token');
    mockFetch.mockReturnValueOnce(errorResponse(401));

    await expect(getMe()).rejects.toThrow('Failed to get user: 401');
    expect(getStoredToken()).toBeNull();
  });

  it('does not clear token on non-401 error', async () => {
    setStoredToken('valid-token');
    mockFetch.mockReturnValueOnce(errorResponse(500));

    await expect(getMe()).rejects.toThrow('Failed to get user: 500');
    expect(getStoredToken()).toBe('valid-token');
  });
});

// ============================================================
// updateMe
// ============================================================

describe('updateMe', () => {
  it('sends PUT to /api/auth/me with display_name', async () => {
    const updated = { id: 'u1', display_name: 'New Name', color: '#0000ff' };
    mockFetch.mockReturnValueOnce(okJsonResponse(updated));

    const result = await updateMe('New Name');

    expect(result).toEqual(updated);
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe('/api/auth/me');
    expect(callArgs[1].method).toBe('PUT');
    const body = JSON.parse(callArgs[1].body);
    expect(body.display_name).toBe('New Name');
  });

  it('includes Content-Type header', async () => {
    mockFetch.mockReturnValueOnce(okJsonResponse({ id: 'u1', display_name: 'X', color: '#000' }));

    await updateMe('X');

    const opts = mockFetch.mock.calls[0][1];
    expect(opts.headers['Content-Type']).toBe('application/json');
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockReturnValueOnce(errorResponse(400));
    await expect(updateMe('')).rejects.toThrow('Failed to update user: 400');
  });
});

// ============================================================
// ensureSession
// ============================================================

describe('ensureSession', () => {
  it('returns existing user if token is valid', async () => {
    setStoredToken('valid-token');
    const user = { id: 'u1', display_name: 'Existing', color: '#fff' };
    mockFetch.mockReturnValueOnce(okJsonResponse(user));

    const result = await ensureSession();

    expect(result).toEqual(user);
    // Only one call — getMe
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/auth/me');
  });

  it('creates new session if no token stored', async () => {
    const sessionData = {
      token: 'fresh-token',
      user: { id: 'u2', display_name: 'New User', color: '#abc' },
    };
    mockFetch.mockReturnValueOnce(okJsonResponse(sessionData));

    const result = await ensureSession();

    expect(result).toEqual(sessionData.user);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/auth/session');
    expect(getStoredToken()).toBe('fresh-token');
  });

  it('creates new session if existing token is invalid', async () => {
    setStoredToken('bad-token');
    // getMe fails with 401
    mockFetch.mockReturnValueOnce(errorResponse(401));
    // createSession succeeds
    const sessionData = {
      token: 'replacement-token',
      user: { id: 'u3', display_name: 'Recovered', color: '#def' },
    };
    mockFetch.mockReturnValueOnce(okJsonResponse(sessionData));

    const result = await ensureSession();

    expect(result).toEqual(sessionData.user);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(getStoredToken()).toBe('replacement-token');
  });
});

// ============================================================
// fetchVersions
// ============================================================

describe('fetchVersions', () => {
  it('fetches version list for a document', async () => {
    const versions = [
      { id: 1, version_number: 1, title: 'v1', created_at: '2025-01-01' },
      { id: 2, version_number: 2, title: 'v2', created_at: '2025-01-02' },
    ];
    mockFetch.mockReturnValueOnce(okJsonResponse(versions));

    const result = await fetchVersions('doc1');

    expect(result).toEqual(versions);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/documents/doc1/versions');
  });

  it('encodes special characters in document id', async () => {
    mockFetch.mockReturnValueOnce(okJsonResponse([]));

    await fetchVersions('doc/with/slashes');

    expect(mockFetch.mock.calls[0][0]).toBe('/api/documents/doc%2Fwith%2Fslashes/versions');
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockReturnValueOnce(errorResponse(404));
    await expect(fetchVersions('missing')).rejects.toThrow('Failed to list versions: 404');
  });
});

// ============================================================
// fetchVersion
// ============================================================

describe('fetchVersion', () => {
  it('fetches a specific version by number', async () => {
    const version = {
      id: 1,
      document_id: 'doc1',
      version_number: 3,
      title: 'Title v3',
      content: '[{"type":"paragraph"}]',
      created_at: '2025-01-03',
    };
    mockFetch.mockReturnValueOnce(okJsonResponse(version));

    const result = await fetchVersion('doc1', 3);

    expect(result).toEqual(version);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/documents/doc1/versions/3');
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockReturnValueOnce(errorResponse(404));
    await expect(fetchVersion('doc1', 99)).rejects.toThrow('Failed to load version: 404');
  });
});

// ============================================================
// restoreVersion
// ============================================================

describe('restoreVersion', () => {
  it('sends POST to restore endpoint', async () => {
    const restored = { id: 'doc1', title: 'Restored', content: '[]', created_at: '', updated_at: '' };
    mockFetch.mockReturnValueOnce(okJsonResponse(restored));

    const result = await restoreVersion('doc1', 2);

    expect(result).toEqual(restored);
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe('/api/documents/doc1/versions/2/restore');
    expect(callArgs[1].method).toBe('POST');
  });

  it('encodes special characters in document id', async () => {
    mockFetch.mockReturnValueOnce(okJsonResponse({ id: 'a b', title: '', content: '[]', created_at: '', updated_at: '' }));

    await restoreVersion('a b', 1);

    expect(mockFetch.mock.calls[0][0]).toBe('/api/documents/a%20b/versions/1/restore');
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockReturnValueOnce(errorResponse(500));
    await expect(restoreVersion('doc1', 1)).rejects.toThrow('Failed to restore version: 500');
  });
});

// ============================================================
// createShareLink
// ============================================================

describe('createShareLink', () => {
  it('sends POST with permission to shares endpoint', async () => {
    const share = {
      id: 's1',
      document_id: 'doc1',
      token: 'share-token-hex',
      permission: 'edit' as const,
      created_by: 'u1',
      created_at: '2025-01-01',
    };
    mockFetch.mockReturnValueOnce(okJsonResponse(share));

    const result = await createShareLink('doc1', 'edit');

    expect(result).toEqual(share);
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe('/api/documents/doc1/shares');
    expect(callArgs[1].method).toBe('POST');
    const body = JSON.parse(callArgs[1].body);
    expect(body.permission).toBe('edit');
  });

  it('works with view permission', async () => {
    const share = {
      id: 's2',
      document_id: 'doc1',
      token: 'view-token',
      permission: 'view' as const,
      created_by: 'u1',
      created_at: '2025-01-01',
    };
    mockFetch.mockReturnValueOnce(okJsonResponse(share));

    const result = await createShareLink('doc1', 'view');

    expect(result.permission).toBe('view');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.permission).toBe('view');
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockReturnValueOnce(errorResponse(403));
    await expect(createShareLink('doc1', 'edit')).rejects.toThrow('Failed to create share: 403');
  });
});

// ============================================================
// fetchShares
// ============================================================

describe('fetchShares', () => {
  it('fetches share list for a document', async () => {
    const shares = [
      { id: 's1', document_id: 'doc1', token: 'tok1', permission: 'edit', created_by: 'u1', created_at: '' },
      { id: 's2', document_id: 'doc1', token: 'tok2', permission: 'view', created_by: 'u1', created_at: '' },
    ];
    mockFetch.mockReturnValueOnce(okJsonResponse(shares));

    const result = await fetchShares('doc1');

    expect(result).toEqual(shares);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/documents/doc1/shares');
  });

  it('returns empty array when no shares exist', async () => {
    mockFetch.mockReturnValueOnce(okJsonResponse([]));

    const result = await fetchShares('doc1');

    expect(result).toEqual([]);
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockReturnValueOnce(errorResponse(403));
    await expect(fetchShares('doc1')).rejects.toThrow('Failed to list shares: 403');
  });
});

// ============================================================
// deleteShareLink
// ============================================================

describe('deleteShareLink', () => {
  it('sends DELETE request for a share', async () => {
    mockFetch.mockReturnValueOnce(Promise.resolve({ ok: true, status: 204 } as Response));

    await deleteShareLink('doc1', 'share-id-1');

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe('/api/documents/doc1/shares/share-id-1');
    expect(callArgs[1].method).toBe('DELETE');
  });

  it('encodes special characters in ids', async () => {
    mockFetch.mockReturnValueOnce(Promise.resolve({ ok: true, status: 204 } as Response));

    await deleteShareLink('doc/1', 'share/1');

    expect(mockFetch.mock.calls[0][0]).toBe('/api/documents/doc%2F1/shares/share%2F1');
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockReturnValueOnce(errorResponse(404));
    await expect(deleteShareLink('doc1', 'gone')).rejects.toThrow('Failed to delete share: 404');
  });
});

// ============================================================
// fetchSharedDocument
// ============================================================

describe('fetchSharedDocument', () => {
  it('fetches document via share token', async () => {
    const sharedDoc = {
      document: { id: 'doc1', title: 'Shared Doc', content: '[]', created_at: '', updated_at: '' },
      permission: 'view' as const,
      share_token: 'abc123',
    };
    mockFetch.mockReturnValueOnce(okJsonResponse(sharedDoc));

    const result = await fetchSharedDocument('abc123');

    expect(result).toEqual(sharedDoc);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/shared/abc123');
  });

  it('encodes special characters in token', async () => {
    const sharedDoc = {
      document: { id: 'd1', title: 'T', content: '[]', created_at: '', updated_at: '' },
      permission: 'edit' as const,
      share_token: 'tok/special',
    };
    mockFetch.mockReturnValueOnce(okJsonResponse(sharedDoc));

    await fetchSharedDocument('tok/special');

    expect(mockFetch.mock.calls[0][0]).toBe('/api/shared/tok%2Fspecial');
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockReturnValueOnce(errorResponse(404));
    await expect(fetchSharedDocument('invalid')).rejects.toThrow('Failed to load shared document: 404');
  });
});
