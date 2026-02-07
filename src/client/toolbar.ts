import type { Editor } from './editor.js';
import type { BlockType, Alignment } from '../shared/model.js';
import { ShortcutsPanel } from './shortcuts-panel.js';

interface ToolbarButton {
  element: HTMLButtonElement;
  key: string;
}

export class Toolbar {
  private container: HTMLElement;
  private editor: Editor;
  private buttons: Map<string, ToolbarButton> = new Map();
  private shortcutsPanel: ShortcutsPanel;

  constructor(container: HTMLElement, editor: Editor) {
    this.container = container;
    this.editor = editor;
    this.shortcutsPanel = new ShortcutsPanel();
    this.container.className = 'altdocs-toolbar';
    this.container.setAttribute('role', 'toolbar');

    this.buildToolbar();
    this.editor.onUpdate(() => this.updateActiveStates());
    this.updateActiveStates();
  }

  private buildToolbar(): void {
    // Formatting buttons
    const formatGroup = this.createGroup();
    this.addButton(formatGroup, 'bold', 'B', 'Bold (Ctrl+B)', () => {
      this.editor.toggleFormatting({ bold: true });
      this.editor.focus();
    });
    this.addButton(formatGroup, 'italic', 'I', 'Italic (Ctrl+I)', () => {
      this.editor.toggleFormatting({ italic: true });
      this.editor.focus();
    });
    this.addButton(formatGroup, 'underline', 'U', 'Underline (Ctrl+U)', () => {
      this.editor.toggleFormatting({ underline: true });
      this.editor.focus();
    });
    this.addButton(formatGroup, 'strikethrough', 'S', 'Strikethrough (Ctrl+D)', () => {
      this.editor.toggleFormatting({ strikethrough: true });
      this.editor.focus();
    });
    this.addButton(formatGroup, 'code', '<>', 'Inline Code (Ctrl+`)', () => {
      this.editor.toggleFormatting({ code: true });
      this.editor.focus();
    });

    this.addSeparator();

    // Font controls
    const fontGroup = this.createGroup();
    this.addFontSizeSelect(fontGroup);
    this.addFontFamilySelect(fontGroup);

    this.addSeparator();

    // Block type select
    const blockGroup = this.createGroup();
    this.addBlockTypeSelect(blockGroup);

    this.addSeparator();

    // Alignment buttons
    const alignGroup = this.createGroup();
    this.addButton(alignGroup, 'align-left', '\u2261', 'Align Left', () => {
      this.editor.changeAlignment('left');
      this.editor.focus();
    });
    this.addButton(alignGroup, 'align-center', '\u2263', 'Align Center', () => {
      this.editor.changeAlignment('center');
      this.editor.focus();
    });
    this.addButton(alignGroup, 'align-right', '\u2262', 'Align Right', () => {
      this.editor.changeAlignment('right');
      this.editor.focus();
    });

    this.addSeparator();

    // Insert group
    const insertGroup = this.createGroup();
    this.addButton(insertGroup, 'horizontal-rule', '—', 'Horizontal Rule', () => {
      this.editor.insertHorizontalRule();
      this.editor.focus();
    });

    this.addSeparator();

    // Help group
    const helpGroup = this.createGroup();
    this.addButton(helpGroup, 'shortcuts', '?', 'Keyboard Shortcuts (Ctrl+/)', () => {
      this.shortcutsPanel.toggle();
    });
  }

  private createGroup(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'toolbar-group';
    this.container.appendChild(group);
    return group;
  }

  private addSeparator(): void {
    const sep = document.createElement('div');
    sep.className = 'toolbar-separator';
    this.container.appendChild(sep);
  }

  private addButton(
    parent: HTMLElement,
    key: string,
    label: string,
    title: string,
    onClick: () => void
  ): void {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toolbar-btn';
    btn.textContent = label;
    btn.title = title;
    btn.dataset.toolbarAction = key;
    // Prevent the button click from stealing focus from the editor
    btn.addEventListener('mousedown', (e) => e.preventDefault());
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      onClick();
    });

    // Apply specific styling classes for formatting buttons
    if (key === 'bold') btn.classList.add('toolbar-btn-bold');
    if (key === 'italic') btn.classList.add('toolbar-btn-italic');
    if (key === 'underline') btn.classList.add('toolbar-btn-underline');
    if (key === 'strikethrough') btn.classList.add('toolbar-btn-strikethrough');

    parent.appendChild(btn);
    this.buttons.set(key, { element: btn, key });
  }

  private addBlockTypeSelect(parent: HTMLElement): void {
    const select = document.createElement('select');
    select.className = 'toolbar-select';
    select.title = 'Block type';
    select.dataset.toolbarAction = 'block-type';

    const options: Array<{ value: BlockType; label: string }> = [
      { value: 'paragraph', label: 'Paragraph' },
      { value: 'heading1', label: 'Heading 1' },
      { value: 'heading2', label: 'Heading 2' },
      { value: 'heading3', label: 'Heading 3' },
      { value: 'bullet-list-item', label: 'Bullet List' },
      { value: 'numbered-list-item', label: 'Numbered List' },
      { value: 'blockquote', label: 'Block Quote' },
      { value: 'code-block', label: 'Code Block' },
    ];

    for (const opt of options) {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      select.appendChild(option);
    }

    select.addEventListener('mousedown', (e) => {
      // Don't prevent default on select — it needs to open the dropdown
    });

    select.addEventListener('change', () => {
      this.editor.changeBlockType(select.value as BlockType);
      this.editor.focus();
    });

    parent.appendChild(select);
  }

  private addFontSizeSelect(parent: HTMLElement): void {
    const select = document.createElement('select');
    select.className = 'toolbar-select';
    select.title = 'Font size';
    select.dataset.toolbarAction = 'font-size';

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = 'Size';
    select.appendChild(defaultOpt);

    const sizes = [8, 10, 12, 14, 18, 24, 36, 48];
    for (const size of sizes) {
      const option = document.createElement('option');
      option.value = String(size);
      option.textContent = String(size);
      select.appendChild(option);
    }

    select.addEventListener('change', () => {
      const val = select.value;
      if (val === '') {
        this.editor.applyFontSize(undefined);
      } else {
        this.editor.applyFontSize(Number(val));
      }
      this.editor.focus();
    });

    parent.appendChild(select);
  }

  private addFontFamilySelect(parent: HTMLElement): void {
    const select = document.createElement('select');
    select.className = 'toolbar-select';
    select.title = 'Font family';
    select.dataset.toolbarAction = 'font-family';

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = 'Font';
    select.appendChild(defaultOpt);

    const fonts = [
      'Arial',
      'Times New Roman',
      'Courier New',
      'Georgia',
      'Verdana',
      'Helvetica',
      'Trebuchet MS',
      'Comic Sans MS',
    ];
    for (const font of fonts) {
      const option = document.createElement('option');
      option.value = font;
      option.textContent = font;
      select.appendChild(option);
    }

    select.addEventListener('change', () => {
      const val = select.value;
      if (val === '') {
        this.editor.applyFontFamily(undefined);
      } else {
        this.editor.applyFontFamily(val);
      }
      this.editor.focus();
    });

    parent.appendChild(select);
  }

  updateActiveStates(): void {
    const formatting = this.editor.getActiveFormatting();
    const blockType = this.editor.getActiveBlockType();
    const alignment = this.editor.getActiveAlignment();

    // Update formatting buttons
    this.setActive('bold', !!formatting.bold);
    this.setActive('italic', !!formatting.italic);
    this.setActive('underline', !!formatting.underline);
    this.setActive('strikethrough', !!formatting.strikethrough);
    this.setActive('code', !!formatting.code);

    // Update alignment buttons
    this.setActive('align-left', alignment === 'left');
    this.setActive('align-center', alignment === 'center');
    this.setActive('align-right', alignment === 'right');

    // Update block type select
    const select = this.container.querySelector('[data-toolbar-action="block-type"]') as HTMLSelectElement | null;
    if (select) {
      select.value = blockType;
    }

    // Update font size select
    const fontSizeSelect = this.container.querySelector('[data-toolbar-action="font-size"]') as HTMLSelectElement | null;
    if (fontSizeSelect) {
      const activeFontSize = this.editor.getActiveFontSize();
      fontSizeSelect.value = activeFontSize ? String(activeFontSize) : '';
    }

    // Update font family select
    const fontFamilySelect = this.container.querySelector('[data-toolbar-action="font-family"]') as HTMLSelectElement | null;
    if (fontFamilySelect) {
      const activeFontFamily = this.editor.getActiveFontFamily();
      fontFamilySelect.value = activeFontFamily || '';
    }
  }

  private setActive(key: string, active: boolean): void {
    const btn = this.buttons.get(key);
    if (btn) {
      btn.element.classList.toggle('active', active);
    }
  }

  /** Toggle the keyboard shortcuts panel */
  toggleShortcutsPanel(): void {
    this.shortcutsPanel.toggle();
  }

  /** Get the toolbar container element */
  getContainer(): HTMLElement {
    return this.container;
  }
}
