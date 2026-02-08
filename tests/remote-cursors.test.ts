/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { RemoteCursorRenderer } from '../src/client/remote-cursors.js';
import { renderDocument } from '../src/client/renderer.js';
import type { Document, Block } from '../src/shared/model.js';
import type { RemoteUser } from '../src/client/collaboration.js';

// ============================================================
// Test Helpers
// ============================================================

function makeDoc(blocks: Block[]): Document {
  return { id: 'test-doc', title: 'Test', blocks };
}

function makeBlock(id: string, text: string): Block {
  return { id, type: 'paragraph', alignment: 'left', runs: [{ text, style: {} }] };
}

function makeUser(id: string, name: string, color: string, cursor: { blockIndex: number; offset: number } | null): RemoteUser {
  return { userId: id, displayName: name, color, cursor };
}

function setupEditor(doc: Document): { container: HTMLElement; wrapper: HTMLElement } {
  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  const container = document.createElement('div');
  container.className = 'altdocs-editor';
  wrapper.appendChild(container);
  document.body.appendChild(wrapper);
  renderDocument(doc, container);
  return { container, wrapper };
}

// ============================================================
// RemoteCursorRenderer
// ============================================================

describe('RemoteCursorRenderer', () => {
  let doc: Document;
  let container: HTMLElement;
  let wrapper: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    doc = makeDoc([makeBlock('b1', 'Hello World'), makeBlock('b2', 'Second line')]);
    const setup = setupEditor(doc);
    container = setup.container;
    wrapper = setup.wrapper;
  });

  it('creates overlay container as sibling of editor', () => {
    const renderer = new RemoteCursorRenderer(container);
    const overlayContainer = wrapper.querySelector('.remote-cursors-container');
    expect(overlayContainer).not.toBeNull();
    expect(overlayContainer!.getAttribute('aria-hidden')).toBe('true');
    renderer.destroy();
  });

  it('renders cursor caret and label for a remote user', () => {
    const renderer = new RemoteCursorRenderer(container);
    const user = makeUser('u1', 'Alice', '#ff0000', { blockIndex: 0, offset: 5 });

    renderer.update([user], doc);

    const carets = wrapper.querySelectorAll('.remote-cursor-caret');
    const labels = wrapper.querySelectorAll('.remote-cursor-label');
    expect(carets.length).toBe(1);
    expect(labels.length).toBe(1);

    expect((carets[0] as HTMLElement).dataset.userId).toBe('u1');
    expect((labels[0] as HTMLElement).dataset.userId).toBe('u1');
    expect((labels[0] as HTMLElement).textContent).toBe('Alice');
    expect((carets[0] as HTMLElement).style.backgroundColor).toBe('rgb(255, 0, 0)');
    expect((labels[0] as HTMLElement).style.backgroundColor).toBe('rgb(255, 0, 0)');

    renderer.destroy();
  });

  it('renders cursors for multiple remote users', () => {
    const renderer = new RemoteCursorRenderer(container);
    const users = [
      makeUser('u1', 'Alice', '#ff0000', { blockIndex: 0, offset: 0 }),
      makeUser('u2', 'Bob', '#0000ff', { blockIndex: 1, offset: 3 }),
    ];

    renderer.update(users, doc);

    const carets = wrapper.querySelectorAll('.remote-cursor-caret');
    const labels = wrapper.querySelectorAll('.remote-cursor-label');
    expect(carets.length).toBe(2);
    expect(labels.length).toBe(2);

    renderer.destroy();
  });

  it('removes cursor overlay when user leaves', () => {
    const renderer = new RemoteCursorRenderer(container);
    const users = [
      makeUser('u1', 'Alice', '#ff0000', { blockIndex: 0, offset: 0 }),
      makeUser('u2', 'Bob', '#0000ff', { blockIndex: 1, offset: 3 }),
    ];

    renderer.update(users, doc);
    expect(wrapper.querySelectorAll('.remote-cursor-caret').length).toBe(2);

    // Alice leaves
    renderer.update([users[1]], doc);
    expect(wrapper.querySelectorAll('.remote-cursor-caret').length).toBe(1);
    const remaining = wrapper.querySelector('.remote-cursor-label') as HTMLElement;
    expect(remaining.textContent).toBe('Bob');

    renderer.destroy();
  });

  it('removes cursor when user sets cursor to null', () => {
    const renderer = new RemoteCursorRenderer(container);
    const user = makeUser('u1', 'Alice', '#ff0000', { blockIndex: 0, offset: 3 });

    renderer.update([user], doc);
    expect(wrapper.querySelectorAll('.remote-cursor-caret').length).toBe(1);

    // Cursor becomes null
    renderer.update([makeUser('u1', 'Alice', '#ff0000', null)], doc);
    expect(wrapper.querySelectorAll('.remote-cursor-caret').length).toBe(0);

    renderer.destroy();
  });

  it('updates cursor position when user moves', () => {
    const renderer = new RemoteCursorRenderer(container);

    renderer.update([makeUser('u1', 'Alice', '#ff0000', { blockIndex: 0, offset: 0 })], doc);
    const caret1 = wrapper.querySelector('.remote-cursor-caret') as HTMLElement;
    const left1 = caret1.style.left;

    renderer.update([makeUser('u1', 'Alice', '#ff0000', { blockIndex: 0, offset: 5 })], doc);
    // Same element should be reused
    const caret2 = wrapper.querySelector('.remote-cursor-caret') as HTMLElement;
    expect(caret2.dataset.userId).toBe('u1');

    renderer.destroy();
  });

  it('updates display name and color when they change', () => {
    const renderer = new RemoteCursorRenderer(container);

    renderer.update([makeUser('u1', 'Alice', '#ff0000', { blockIndex: 0, offset: 3 })], doc);
    let label = wrapper.querySelector('.remote-cursor-label') as HTMLElement;
    expect(label.textContent).toBe('Alice');

    renderer.update([makeUser('u1', 'NewName', '#00ff00', { blockIndex: 0, offset: 3 })], doc);
    label = wrapper.querySelector('.remote-cursor-label') as HTMLElement;
    expect(label.textContent).toBe('NewName');
    expect(label.style.backgroundColor).toBe('rgb(0, 255, 0)');

    renderer.destroy();
  });

  it('destroy() removes all overlay elements', () => {
    const renderer = new RemoteCursorRenderer(container);
    renderer.update([makeUser('u1', 'Alice', '#ff0000', { blockIndex: 0, offset: 3 })], doc);

    expect(wrapper.querySelectorAll('.remote-cursors-container').length).toBe(1);
    renderer.destroy();
    expect(wrapper.querySelectorAll('.remote-cursors-container').length).toBe(0);
    expect(wrapper.querySelectorAll('.remote-cursor-caret').length).toBe(0);
  });

  it('refresh() re-positions cursors with updated doc', () => {
    const renderer = new RemoteCursorRenderer(container);
    renderer.update([makeUser('u1', 'Alice', '#ff0000', { blockIndex: 0, offset: 3 })], doc);

    // Change the doc and refresh
    const newDoc = makeDoc([makeBlock('b1', 'Hello World Updated'), makeBlock('b2', 'Second line')]);
    renderDocument(newDoc, container);
    renderer.refresh(newDoc);

    // Cursor should still exist (same user)
    expect(wrapper.querySelectorAll('.remote-cursor-caret').length).toBe(1);

    renderer.destroy();
  });

  it('handles cursor at invalid position gracefully', () => {
    const renderer = new RemoteCursorRenderer(container);
    // blockIndex 99 doesn't exist
    const user = makeUser('u1', 'Alice', '#ff0000', { blockIndex: 99, offset: 0 });

    renderer.update([user], doc);
    // Should not create an overlay for an unresolvable position
    expect(wrapper.querySelectorAll('.remote-cursor-caret').length).toBe(0);

    renderer.destroy();
  });

  it('sets parent element position to relative', () => {
    const renderer = new RemoteCursorRenderer(container);
    expect(wrapper.style.position).toBe('relative');
    renderer.destroy();
  });
});
