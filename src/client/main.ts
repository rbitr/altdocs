import { Editor } from './editor.js';
import { Toolbar } from './toolbar.js';
import type { Document } from '../shared/model.js';

const sampleDoc: Document = {
  id: 'sample',
  title: 'Sample Document',
  blocks: [
    {
      id: 'b1',
      type: 'heading1',
      alignment: 'left',
      runs: [{ text: 'AltDocs', style: {} }],
    },
    {
      id: 'b2',
      type: 'paragraph',
      alignment: 'left',
      runs: [
        { text: 'A ', style: {} },
        { text: 'from-scratch', style: { bold: true } },
        { text: ' document editor. Start typing!', style: {} },
      ],
    },
    {
      id: 'b3',
      type: 'paragraph',
      alignment: 'left',
      runs: [{ text: '', style: {} }],
    },
  ],
};

const app = document.getElementById('app');
if (app) {
  const toolbarEl = document.createElement('div');
  app.appendChild(toolbarEl);

  const editorEl = document.createElement('div');
  editorEl.className = 'altdocs-editor';
  app.appendChild(editorEl);

  const editor = new Editor(editorEl, sampleDoc);
  const toolbar = new Toolbar(toolbarEl, editor);

  // Expose editor for debugging in browser console
  (window as any).__editor = editor;
  (window as any).__toolbar = toolbar;
}
