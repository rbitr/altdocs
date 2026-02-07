/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ShortcutsPanel, SHORTCUT_DATA } from '../src/client/shortcuts-panel.js';

describe('ShortcutsPanel', () => {
  let panel: ShortcutsPanel;

  beforeEach(() => {
    panel = new ShortcutsPanel();
  });

  afterEach(() => {
    panel.hide();
  });

  it('starts hidden', () => {
    expect(panel.visible).toBe(false);
  });

  it('show() makes it visible', () => {
    panel.show();
    expect(panel.visible).toBe(true);
    expect(document.body.contains(panel.getOverlay())).toBe(true);
  });

  it('hide() makes it hidden', () => {
    panel.show();
    panel.hide();
    expect(panel.visible).toBe(false);
    expect(document.body.contains(panel.getOverlay())).toBe(false);
  });

  it('toggle() switches visibility', () => {
    panel.toggle();
    expect(panel.visible).toBe(true);
    panel.toggle();
    expect(panel.visible).toBe(false);
  });

  it('show() when already visible does nothing', () => {
    panel.show();
    panel.show();
    expect(panel.visible).toBe(true);
  });

  it('hide() when already hidden does nothing', () => {
    panel.hide();
    expect(panel.visible).toBe(false);
  });

  it('renders the panel title', () => {
    panel.show();
    const h2 = panel.getOverlay().querySelector('h2');
    expect(h2?.textContent).toBe('Keyboard Shortcuts');
  });

  it('renders all shortcut categories', () => {
    panel.show();
    const h3Elements = panel.getOverlay().querySelectorAll('h3');
    const categoryNames = Array.from(h3Elements).map(el => el.textContent);
    expect(categoryNames).toEqual(SHORTCUT_DATA.map(c => c.name));
  });

  it('renders shortcut descriptions in table rows', () => {
    panel.show();
    const descCells = panel.getOverlay().querySelectorAll('.shortcut-desc');
    const totalShortcuts = SHORTCUT_DATA.reduce((sum, cat) => sum + cat.shortcuts.length, 0);
    expect(descCells.length).toBe(totalShortcuts);
  });

  it('renders kbd elements for keys', () => {
    panel.show();
    const kbdElements = panel.getOverlay().querySelectorAll('kbd');
    expect(kbdElements.length).toBeGreaterThan(0);
    // First shortcut should be Ctrl+B — two kbd elements
    const firstRow = panel.getOverlay().querySelector('.shortcuts-table tr');
    const kbds = firstRow?.querySelectorAll('kbd');
    expect(kbds?.length).toBe(2); // Ctrl and B
    expect(kbds?.[0].textContent).toBe('Ctrl');
    expect(kbds?.[1].textContent).toBe('B');
  });

  it('has a close button', () => {
    panel.show();
    const closeBtn = panel.getOverlay().querySelector('.shortcuts-close-btn');
    expect(closeBtn).toBeTruthy();
  });

  it('close button hides the panel', () => {
    panel.show();
    const closeBtn = panel.getOverlay().querySelector('.shortcuts-close-btn') as HTMLButtonElement;
    closeBtn.click();
    expect(panel.visible).toBe(false);
  });

  it('clicking the overlay backdrop hides the panel', () => {
    panel.show();
    const overlay = panel.getOverlay();
    // Simulate click on the overlay itself (not the panel)
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(panel.visible).toBe(false);
  });

  it('clicking inside the panel does not hide it', () => {
    panel.show();
    const panelDiv = panel.getOverlay().querySelector('.shortcuts-panel') as HTMLElement;
    panelDiv.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(panel.visible).toBe(true);
  });

  it('Escape key hides the panel', () => {
    panel.show();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(panel.visible).toBe(false);
  });

  it('Escape key does nothing when panel is hidden', () => {
    // Should not throw
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(panel.visible).toBe(false);
  });

  it('panel has role="dialog"', () => {
    panel.show();
    const dialog = panel.getOverlay().querySelector('.shortcuts-panel');
    expect(dialog?.getAttribute('role')).toBe('dialog');
  });

  it('panel has aria-label', () => {
    panel.show();
    const dialog = panel.getOverlay().querySelector('.shortcuts-panel');
    expect(dialog?.getAttribute('aria-label')).toBe('Keyboard Shortcuts');
  });
});

describe('SHORTCUT_DATA', () => {
  it('has at least 4 categories', () => {
    expect(SHORTCUT_DATA.length).toBeGreaterThanOrEqual(4);
  });

  it('every category has a name and at least one shortcut', () => {
    for (const cat of SHORTCUT_DATA) {
      expect(cat.name.length).toBeGreaterThan(0);
      expect(cat.shortcuts.length).toBeGreaterThan(0);
    }
  });

  it('every shortcut has keys and description', () => {
    for (const cat of SHORTCUT_DATA) {
      for (const shortcut of cat.shortcuts) {
        expect(shortcut.keys.length).toBeGreaterThan(0);
        expect(shortcut.description.length).toBeGreaterThan(0);
      }
    }
  });

  it('includes common shortcuts like Ctrl+B, Ctrl+Z, Arrow Keys', () => {
    const allKeys = SHORTCUT_DATA.flatMap(c => c.shortcuts.map(s => s.keys));
    expect(allKeys).toContain('Ctrl+B');
    expect(allKeys).toContain('Ctrl+Z');
    expect(allKeys).toContain('Arrow Keys');
  });
});
