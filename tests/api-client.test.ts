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
} from '../src/client/api-client.js';
import type { Document } from '../src/shared/model.js';

// ============================================================
// Mock fetch
// ============================================================

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  vi.useFakeTimers();
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
