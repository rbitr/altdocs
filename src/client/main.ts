import { renderDocument } from './renderer.js';
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
        { text: ' document editor.', style: {} },
      ],
    },
  ],
};

const app = document.getElementById('app');
if (app) {
  const editor = document.createElement('div');
  editor.className = 'altdocs-editor';
  app.appendChild(editor);
  renderDocument(sampleDoc, editor);
}
