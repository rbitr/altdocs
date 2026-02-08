import type { Document } from '../shared/model.js';
import { resolvePosition } from './cursor-renderer.js';
import type { RemoteUser } from './collaboration.js';

/**
 * A single remote cursor overlay: a colored caret line with a name label.
 */
interface CursorOverlay {
  userId: string;
  caretEl: HTMLElement;
  labelEl: HTMLElement;
}

/**
 * Manages rendering of remote users' cursor positions in the editor.
 *
 * Cursor overlays are absolutely-positioned elements inside a container
 * that sits on top of the editor. Each remote user gets a thin colored
 * vertical line (caret) and a small name label above it.
 */
export class RemoteCursorRenderer {
  private editorContainer: HTMLElement;
  private overlayContainer: HTMLElement;
  private overlays: Map<string, CursorOverlay> = new Map();
  private currentDoc: Document | null = null;
  private currentUsers: RemoteUser[] = [];

  constructor(editorContainer: HTMLElement) {
    this.editorContainer = editorContainer;

    // Create overlay container positioned relative to the editor
    this.overlayContainer = document.createElement('div');
    this.overlayContainer.className = 'remote-cursors-container';
    this.overlayContainer.setAttribute('aria-hidden', 'true');

    // Insert overlay container as sibling after editor (both inside same parent)
    if (editorContainer.parentElement) {
      editorContainer.parentElement.style.position = 'relative';
      editorContainer.parentElement.appendChild(this.overlayContainer);
    }
  }

  /**
   * Update the remote cursor display with new user data.
   * Call this whenever remote users change or the document re-renders.
   */
  update(users: RemoteUser[], doc: Document): void {
    this.currentDoc = doc;
    this.currentUsers = users;

    // Track which users we've seen this update
    const activeUserIds = new Set<string>();

    for (const user of users) {
      activeUserIds.add(user.userId);

      if (user.cursor) {
        this.renderCursor(user);
      } else {
        // User has no cursor — remove overlay if it exists
        this.removeOverlay(user.userId);
      }
    }

    // Remove overlays for users no longer present
    for (const [userId] of this.overlays) {
      if (!activeUserIds.has(userId)) {
        this.removeOverlay(userId);
      }
    }
  }

  /**
   * Refresh cursor positions (e.g., after a local edit shifts content).
   * Reuses the last known user data.
   */
  refresh(doc: Document): void {
    this.currentDoc = doc;
    for (const user of this.currentUsers) {
      if (user.cursor) {
        this.renderCursor(user);
      }
    }
  }

  /** Remove all overlays and the container */
  destroy(): void {
    this.overlays.clear();
    this.overlayContainer.remove();
  }

  private renderCursor(user: RemoteUser): void {
    if (!user.cursor || !this.currentDoc) return;

    // First check that the position can be resolved in the DOM
    const resolved = resolvePosition(this.editorContainer, this.currentDoc, user.cursor);
    if (!resolved) {
      this.removeOverlay(user.userId);
      return;
    }

    let overlay = this.overlays.get(user.userId);
    if (!overlay) {
      overlay = this.createOverlay(user);
      this.overlays.set(user.userId, overlay);
    }

    // Update color and label in case they changed
    overlay.caretEl.style.backgroundColor = user.color;
    overlay.labelEl.style.backgroundColor = user.color;
    overlay.labelEl.textContent = user.displayName;

    // Compute pixel position
    const rect = this.getCursorRect(resolved);
    if (rect) {
      const containerRect = this.editorContainer.getBoundingClientRect();
      const left = rect.left - containerRect.left;
      const top = rect.top - containerRect.top;

      overlay.caretEl.style.left = `${left}px`;
      overlay.caretEl.style.top = `${top}px`;
      overlay.caretEl.style.height = `${rect.height}px`;

      overlay.labelEl.style.left = `${left}px`;
      overlay.labelEl.style.top = `${top - 18}px`;
    }

    overlay.caretEl.style.display = '';
    overlay.labelEl.style.display = '';
  }

  private getCursorRect(resolved: { node: Node; offset: number }): { left: number; top: number; height: number } | null {
    try {
      const range = document.createRange();
      range.setStart(resolved.node, resolved.offset);
      range.collapse(true);

      if (typeof range.getBoundingClientRect !== 'function') return null;

      const rect = range.getBoundingClientRect();

      if (rect.height > 0) {
        return { left: rect.left, top: rect.top, height: rect.height };
      }

      // Collapsed range returned zero height — try parent element
      const parentEl = resolved.node instanceof HTMLElement
        ? resolved.node
        : resolved.node.parentElement;
      if (parentEl) {
        const parentRect = parentEl.getBoundingClientRect();
        if (parentRect.height > 0) {
          return { left: rect.left || parentRect.left, top: parentRect.top, height: parentRect.height };
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  private createOverlay(user: RemoteUser): CursorOverlay {
    const caretEl = document.createElement('div');
    caretEl.className = 'remote-cursor-caret';
    caretEl.dataset.userId = user.userId;
    caretEl.style.backgroundColor = user.color;

    const labelEl = document.createElement('div');
    labelEl.className = 'remote-cursor-label';
    labelEl.dataset.userId = user.userId;
    labelEl.style.backgroundColor = user.color;
    labelEl.textContent = user.displayName;

    this.overlayContainer.appendChild(caretEl);
    this.overlayContainer.appendChild(labelEl);

    return { userId: user.userId, caretEl, labelEl };
  }

  private removeOverlay(userId: string): void {
    const overlay = this.overlays.get(userId);
    if (overlay) {
      overlay.caretEl.remove();
      overlay.labelEl.remove();
      this.overlays.delete(userId);
    }
  }
}
