import { describe, it, expect } from 'vitest';
import { validateContent } from '../src/shared/validation.js';

describe('validateContent', () => {
  describe('valid content', () => {
    it('accepts an empty array', () => {
      expect(validateContent('[]')).toBeNull();
    });

    it('accepts a single paragraph block', () => {
      const content = JSON.stringify([{
        id: 'b1', type: 'paragraph', alignment: 'left',
        runs: [{ text: 'Hello', style: {} }],
      }]);
      expect(validateContent(content)).toBeNull();
    });

    it('accepts multiple blocks of different types', () => {
      const content = JSON.stringify([
        { id: 'b1', type: 'heading1', alignment: 'center', runs: [{ text: 'Title', style: { bold: true } }] },
        { id: 'b2', type: 'paragraph', alignment: 'left', runs: [{ text: 'Body', style: {} }] },
        { id: 'b3', type: 'bullet-list-item', alignment: 'left', runs: [{ text: 'Item', style: {} }] },
        { id: 'b4', type: 'numbered-list-item', alignment: 'right', runs: [{ text: 'Num', style: {} }] },
        { id: 'b5', type: 'blockquote', alignment: 'left', runs: [{ text: 'Quote', style: {} }] },
        { id: 'b6', type: 'code-block', alignment: 'left', runs: [{ text: 'code', style: { code: true } }] },
        { id: 'b7', type: 'horizontal-rule', alignment: 'left', runs: [{ text: '', style: {} }] },
        { id: 'b8', type: 'heading2', alignment: 'left', runs: [{ text: 'H2', style: {} }] },
        { id: 'b9', type: 'heading3', alignment: 'left', runs: [{ text: 'H3', style: {} }] },
      ]);
      expect(validateContent(content)).toBeNull();
    });

    it('accepts runs with all valid style properties', () => {
      const content = JSON.stringify([{
        id: 'b1', type: 'paragraph', alignment: 'left',
        runs: [{ text: 'Styled', style: {
          bold: true, italic: true, underline: true, strikethrough: false,
          code: false, fontSize: 16, fontFamily: 'Arial',
          color: '#ff0000', backgroundColor: '#00ff00',
        }}],
      }]);
      expect(validateContent(content)).toBeNull();
    });

    it('accepts multiple runs in a block', () => {
      const content = JSON.stringify([{
        id: 'b1', type: 'paragraph', alignment: 'left',
        runs: [
          { text: 'Hello ', style: {} },
          { text: 'world', style: { bold: true } },
        ],
      }]);
      expect(validateContent(content)).toBeNull();
    });

    it('accepts empty text in runs', () => {
      const content = JSON.stringify([{
        id: 'b1', type: 'paragraph', alignment: 'left',
        runs: [{ text: '', style: {} }],
      }]);
      expect(validateContent(content)).toBeNull();
    });
  });

  describe('invalid JSON', () => {
    it('rejects non-JSON strings', () => {
      expect(validateContent('not json')).toBe('Content is not valid JSON');
    });

    it('rejects malformed JSON', () => {
      expect(validateContent('{')).toBe('Content is not valid JSON');
    });

    it('rejects JSON that is not an array', () => {
      expect(validateContent('{}')).toBe('Content must be a JSON array');
    });

    it('rejects JSON string', () => {
      expect(validateContent('"hello"')).toBe('Content must be a JSON array');
    });

    it('rejects JSON number', () => {
      expect(validateContent('42')).toBe('Content must be a JSON array');
    });

    it('rejects JSON null', () => {
      expect(validateContent('null')).toBe('Content must be a JSON array');
    });
  });

  describe('invalid blocks', () => {
    it('rejects non-object blocks', () => {
      expect(validateContent('["not a block"]')).toBe('Block 0: must be an object');
    });

    it('rejects null blocks', () => {
      expect(validateContent('[null]')).toBe('Block 0: must be an object');
    });

    it('rejects blocks without id', () => {
      const content = JSON.stringify([{ type: 'paragraph', alignment: 'left', runs: [{ text: '', style: {} }] }]);
      expect(validateContent(content)).toBe("Block 0: 'id' must be a non-empty string");
    });

    it('rejects blocks with empty id', () => {
      const content = JSON.stringify([{ id: '', type: 'paragraph', alignment: 'left', runs: [{ text: '', style: {} }] }]);
      expect(validateContent(content)).toBe("Block 0: 'id' must be a non-empty string");
    });

    it('rejects blocks with numeric id', () => {
      const content = JSON.stringify([{ id: 123, type: 'paragraph', alignment: 'left', runs: [{ text: '', style: {} }] }]);
      expect(validateContent(content)).toBe("Block 0: 'id' must be a non-empty string");
    });

    it('rejects blocks with invalid type', () => {
      const content = JSON.stringify([{ id: 'b1', type: 'invalid', alignment: 'left', runs: [{ text: '', style: {} }] }]);
      expect(validateContent(content)).toContain("Block 0: 'type' must be one of:");
    });

    it('rejects blocks with missing type', () => {
      const content = JSON.stringify([{ id: 'b1', alignment: 'left', runs: [{ text: '', style: {} }] }]);
      expect(validateContent(content)).toContain("Block 0: 'type' must be one of:");
    });

    it('rejects blocks with invalid alignment', () => {
      const content = JSON.stringify([{ id: 'b1', type: 'paragraph', alignment: 'justify', runs: [{ text: '', style: {} }] }]);
      expect(validateContent(content)).toBe("Block 0: 'alignment' must be one of: left, center, right");
    });

    it('rejects blocks with missing alignment', () => {
      const content = JSON.stringify([{ id: 'b1', type: 'paragraph', runs: [{ text: '', style: {} }] }]);
      expect(validateContent(content)).toBe("Block 0: 'alignment' must be one of: left, center, right");
    });

    it('rejects blocks with non-array runs', () => {
      const content = JSON.stringify([{ id: 'b1', type: 'paragraph', alignment: 'left', runs: 'not array' }]);
      expect(validateContent(content)).toBe("Block 0: 'runs' must be an array");
    });

    it('rejects blocks with empty runs array', () => {
      const content = JSON.stringify([{ id: 'b1', type: 'paragraph', alignment: 'left', runs: [] }]);
      expect(validateContent(content)).toBe("Block 0: 'runs' must have at least one element");
    });

    it('reports errors on the correct block index', () => {
      const content = JSON.stringify([
        { id: 'b1', type: 'paragraph', alignment: 'left', runs: [{ text: '', style: {} }] },
        { id: 'b2', type: 'invalid', alignment: 'left', runs: [{ text: '', style: {} }] },
      ]);
      expect(validateContent(content)).toContain('Block 1:');
    });
  });

  describe('invalid runs', () => {
    it('rejects non-object runs', () => {
      const content = JSON.stringify([{ id: 'b1', type: 'paragraph', alignment: 'left', runs: ['not a run'] }]);
      expect(validateContent(content)).toBe('Block 0, run 0: must be an object');
    });

    it('rejects runs without text', () => {
      const content = JSON.stringify([{ id: 'b1', type: 'paragraph', alignment: 'left', runs: [{ style: {} }] }]);
      expect(validateContent(content)).toBe("Block 0, run 0: 'text' must be a string");
    });

    it('rejects runs with numeric text', () => {
      const content = JSON.stringify([{ id: 'b1', type: 'paragraph', alignment: 'left', runs: [{ text: 42, style: {} }] }]);
      expect(validateContent(content)).toBe("Block 0, run 0: 'text' must be a string");
    });

    it('rejects runs without style', () => {
      const content = JSON.stringify([{ id: 'b1', type: 'paragraph', alignment: 'left', runs: [{ text: 'hi' }] }]);
      expect(validateContent(content)).toBe("Block 0, run 0: 'style' must be an object");
    });

    it('rejects runs with array style', () => {
      const content = JSON.stringify([{ id: 'b1', type: 'paragraph', alignment: 'left', runs: [{ text: 'hi', style: [] }] }]);
      expect(validateContent(content)).toBe("Block 0, run 0: 'style' must be an object");
    });

    it('rejects unknown style keys', () => {
      const content = JSON.stringify([{ id: 'b1', type: 'paragraph', alignment: 'left', runs: [{ text: 'hi', style: { badKey: true } }] }]);
      expect(validateContent(content)).toBe("Block 0, run 0: unknown style key 'badKey'");
    });
  });

  describe('invalid style values', () => {
    it('rejects non-boolean bold', () => {
      const content = JSON.stringify([{ id: 'b1', type: 'paragraph', alignment: 'left', runs: [{ text: 'hi', style: { bold: 'yes' } }] }]);
      expect(validateContent(content)).toBe('Block 0, run 0: style.bold must be a boolean');
    });

    it('rejects non-boolean italic', () => {
      const content = JSON.stringify([{ id: 'b1', type: 'paragraph', alignment: 'left', runs: [{ text: 'hi', style: { italic: 1 } }] }]);
      expect(validateContent(content)).toBe('Block 0, run 0: style.italic must be a boolean');
    });

    it('rejects non-boolean underline', () => {
      const content = JSON.stringify([{ id: 'b1', type: 'paragraph', alignment: 'left', runs: [{ text: 'hi', style: { underline: 'true' } }] }]);
      expect(validateContent(content)).toBe('Block 0, run 0: style.underline must be a boolean');
    });

    it('rejects non-boolean strikethrough', () => {
      const content = JSON.stringify([{ id: 'b1', type: 'paragraph', alignment: 'left', runs: [{ text: 'hi', style: { strikethrough: 0 } }] }]);
      expect(validateContent(content)).toBe('Block 0, run 0: style.strikethrough must be a boolean');
    });

    it('rejects non-boolean code', () => {
      const content = JSON.stringify([{ id: 'b1', type: 'paragraph', alignment: 'left', runs: [{ text: 'hi', style: { code: 'yes' } }] }]);
      expect(validateContent(content)).toBe('Block 0, run 0: style.code must be a boolean');
    });

    it('rejects non-number fontSize', () => {
      const content = JSON.stringify([{ id: 'b1', type: 'paragraph', alignment: 'left', runs: [{ text: 'hi', style: { fontSize: '16px' } }] }]);
      expect(validateContent(content)).toBe('Block 0, run 0: style.fontSize must be a positive number');
    });

    it('rejects zero fontSize', () => {
      const content = JSON.stringify([{ id: 'b1', type: 'paragraph', alignment: 'left', runs: [{ text: 'hi', style: { fontSize: 0 } }] }]);
      expect(validateContent(content)).toBe('Block 0, run 0: style.fontSize must be a positive number');
    });

    it('rejects negative fontSize', () => {
      const content = JSON.stringify([{ id: 'b1', type: 'paragraph', alignment: 'left', runs: [{ text: 'hi', style: { fontSize: -12 } }] }]);
      expect(validateContent(content)).toBe('Block 0, run 0: style.fontSize must be a positive number');
    });

    it('rejects non-string fontFamily', () => {
      const content = JSON.stringify([{ id: 'b1', type: 'paragraph', alignment: 'left', runs: [{ text: 'hi', style: { fontFamily: 42 } }] }]);
      expect(validateContent(content)).toBe('Block 0, run 0: style.fontFamily must be a string');
    });

    it('rejects non-string color', () => {
      const content = JSON.stringify([{ id: 'b1', type: 'paragraph', alignment: 'left', runs: [{ text: 'hi', style: { color: 255 } }] }]);
      expect(validateContent(content)).toBe('Block 0, run 0: style.color must be a string');
    });

    it('rejects non-string backgroundColor', () => {
      const content = JSON.stringify([{ id: 'b1', type: 'paragraph', alignment: 'left', runs: [{ text: 'hi', style: { backgroundColor: true } }] }]);
      expect(validateContent(content)).toBe('Block 0, run 0: style.backgroundColor must be a string');
    });
  });
});
