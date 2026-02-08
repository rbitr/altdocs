export interface ShortcutEntry {
  keys: string;
  description: string;
}

export interface ShortcutCategory {
  name: string;
  shortcuts: ShortcutEntry[];
}

export const SHORTCUT_DATA: ShortcutCategory[] = [
  {
    name: 'Text Formatting',
    shortcuts: [
      { keys: 'Ctrl+B', description: 'Bold' },
      { keys: 'Ctrl+I', description: 'Italic' },
      { keys: 'Ctrl+U', description: 'Underline' },
      { keys: 'Ctrl+D', description: 'Strikethrough' },
      { keys: 'Ctrl+`', description: 'Inline Code' },
    ],
  },
  {
    name: 'Editing',
    shortcuts: [
      { keys: 'Ctrl+Z', description: 'Undo' },
      { keys: 'Ctrl+Y', description: 'Redo' },
      { keys: 'Ctrl+Shift+Z', description: 'Redo' },
      { keys: 'Ctrl+A', description: 'Select All' },
      { keys: 'Ctrl+C', description: 'Copy' },
      { keys: 'Ctrl+X', description: 'Cut' },
      { keys: 'Ctrl+V', description: 'Paste' },
      { keys: 'Ctrl+Backspace', description: 'Delete previous word' },
      { keys: 'Ctrl+Delete', description: 'Delete next word' },
      { keys: 'Tab', description: 'Indent block' },
      { keys: 'Shift+Tab', description: 'Outdent block' },
      { keys: 'Ctrl+F', description: 'Find' },
      { keys: 'Ctrl+H', description: 'Find & Replace' },
    ],
  },
  {
    name: 'Navigation',
    shortcuts: [
      { keys: 'Arrow Keys', description: 'Move cursor' },
      { keys: 'Shift+Arrow Keys', description: 'Extend selection' },
      { keys: 'Home', description: 'Move to line start' },
      { keys: 'End', description: 'Move to line end' },
      { keys: 'Ctrl+Home', description: 'Move to document start' },
      { keys: 'Ctrl+End', description: 'Move to document end' },
    ],
  },
  {
    name: 'Other',
    shortcuts: [
      { keys: 'Enter', description: 'New paragraph / split block' },
      { keys: 'Backspace', description: 'Delete before cursor / merge blocks' },
      { keys: 'Delete', description: 'Delete after cursor' },
      { keys: 'Ctrl+/', description: 'Toggle this shortcuts panel' },
    ],
  },
];

export class ShortcutsPanel {
  private overlay: HTMLElement;
  private panel: HTMLElement;
  private _visible = false;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'shortcuts-overlay';
    this.overlay.style.display = 'none';
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });

    this.panel = document.createElement('div');
    this.panel.className = 'shortcuts-panel';
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-label', 'Keyboard Shortcuts');

    this.buildPanel();
    this.overlay.appendChild(this.panel);

    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  private buildPanel(): void {
    const header = document.createElement('div');
    header.className = 'shortcuts-header';

    const title = document.createElement('h2');
    title.textContent = 'Keyboard Shortcuts';
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'shortcuts-close-btn';
    closeBtn.textContent = '\u00d7';
    closeBtn.title = 'Close (Escape)';
    closeBtn.addEventListener('click', () => this.hide());
    header.appendChild(closeBtn);

    this.panel.appendChild(header);

    const body = document.createElement('div');
    body.className = 'shortcuts-body';

    for (const category of SHORTCUT_DATA) {
      const section = document.createElement('div');
      section.className = 'shortcuts-category';

      const catTitle = document.createElement('h3');
      catTitle.textContent = category.name;
      section.appendChild(catTitle);

      const table = document.createElement('table');
      table.className = 'shortcuts-table';

      for (const shortcut of category.shortcuts) {
        const row = document.createElement('tr');

        const descCell = document.createElement('td');
        descCell.className = 'shortcut-desc';
        descCell.textContent = shortcut.description;
        row.appendChild(descCell);

        const keysCell = document.createElement('td');
        keysCell.className = 'shortcut-keys';

        // Render each key part as a <kbd> element
        const parts = shortcut.keys.split('+');
        for (let i = 0; i < parts.length; i++) {
          if (i > 0) {
            keysCell.appendChild(document.createTextNode(' + '));
          }
          const kbd = document.createElement('kbd');
          kbd.textContent = parts[i];
          keysCell.appendChild(kbd);
        }

        row.appendChild(keysCell);
        table.appendChild(row);
      }

      section.appendChild(table);
      body.appendChild(section);
    }

    this.panel.appendChild(body);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.hide();
    }
  }

  show(): void {
    if (this._visible) return;
    this._visible = true;
    document.body.appendChild(this.overlay);
    this.overlay.style.display = '';
    document.addEventListener('keydown', this.handleKeyDown, true);
  }

  hide(): void {
    if (!this._visible) return;
    this._visible = false;
    this.overlay.style.display = 'none';
    if (this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    document.removeEventListener('keydown', this.handleKeyDown, true);
  }

  toggle(): void {
    if (this._visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  get visible(): boolean {
    return this._visible;
  }

  getOverlay(): HTMLElement {
    return this.overlay;
  }
}
