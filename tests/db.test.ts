import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createDocument,
  getDocument,
  listDocuments,
  updateDocument,
  deleteDocument,
  resetStore,
} from '../src/server/db.js';

describe('Document Store', () => {
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
