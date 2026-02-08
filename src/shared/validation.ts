import type { BlockType, Alignment } from './model.js';

const VALID_BLOCK_TYPES: Set<string> = new Set<string>([
  'paragraph', 'heading1', 'heading2', 'heading3',
  'bullet-list-item', 'numbered-list-item',
  'blockquote', 'code-block', 'horizontal-rule', 'image',
]);

const VALID_ALIGNMENTS: Set<string> = new Set<string>(['left', 'center', 'right']);

const VALID_STYLE_KEYS: Set<string> = new Set([
  'bold', 'italic', 'underline', 'strikethrough', 'code',
  'fontSize', 'fontFamily', 'color', 'backgroundColor',
]);

/**
 * Validate that a content string is well-formed JSON conforming to Block[].
 * Returns null if valid, or a descriptive error string if invalid.
 */
export function validateContent(content: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return 'Content is not valid JSON';
  }

  if (!Array.isArray(parsed)) {
    return 'Content must be a JSON array';
  }

  for (let i = 0; i < parsed.length; i++) {
    const err = validateBlock(parsed[i], i);
    if (err) return err;
  }

  return null;
}

function validateBlock(block: unknown, index: number): string | null {
  if (!block || typeof block !== 'object') {
    return `Block ${index}: must be an object`;
  }

  const b = block as Record<string, unknown>;

  if (typeof b.id !== 'string' || b.id.length === 0) {
    return `Block ${index}: 'id' must be a non-empty string`;
  }

  if (typeof b.type !== 'string' || !VALID_BLOCK_TYPES.has(b.type)) {
    return `Block ${index}: 'type' must be one of: ${[...VALID_BLOCK_TYPES].join(', ')}`;
  }

  if (typeof b.alignment !== 'string' || !VALID_ALIGNMENTS.has(b.alignment)) {
    return `Block ${index}: 'alignment' must be one of: left, center, right`;
  }

  // indentLevel is optional (defaults to 0) but must be a non-negative integer if present
  if (b.indentLevel !== undefined) {
    if (typeof b.indentLevel !== 'number' || !Number.isInteger(b.indentLevel) || b.indentLevel < 0 || b.indentLevel > 8) {
      return `Block ${index}: 'indentLevel' must be an integer between 0 and 8`;
    }
  }

  // imageUrl is optional but must be a string if present
  if (b.imageUrl !== undefined) {
    if (typeof b.imageUrl !== 'string') {
      return `Block ${index}: 'imageUrl' must be a string`;
    }
  }

  if (!Array.isArray(b.runs)) {
    return `Block ${index}: 'runs' must be an array`;
  }

  if (b.runs.length === 0) {
    return `Block ${index}: 'runs' must have at least one element`;
  }

  for (let j = 0; j < b.runs.length; j++) {
    const err = validateRun(b.runs[j], index, j);
    if (err) return err;
  }

  return null;
}

function validateRun(run: unknown, blockIndex: number, runIndex: number): string | null {
  if (!run || typeof run !== 'object') {
    return `Block ${blockIndex}, run ${runIndex}: must be an object`;
  }

  const r = run as Record<string, unknown>;

  if (typeof r.text !== 'string') {
    return `Block ${blockIndex}, run ${runIndex}: 'text' must be a string`;
  }

  if (!r.style || typeof r.style !== 'object' || Array.isArray(r.style)) {
    return `Block ${blockIndex}, run ${runIndex}: 'style' must be an object`;
  }

  const style = r.style as Record<string, unknown>;
  for (const key of Object.keys(style)) {
    if (!VALID_STYLE_KEYS.has(key)) {
      return `Block ${blockIndex}, run ${runIndex}: unknown style key '${key}'`;
    }
  }

  // Validate style value types
  if (style.bold !== undefined && typeof style.bold !== 'boolean') {
    return `Block ${blockIndex}, run ${runIndex}: style.bold must be a boolean`;
  }
  if (style.italic !== undefined && typeof style.italic !== 'boolean') {
    return `Block ${blockIndex}, run ${runIndex}: style.italic must be a boolean`;
  }
  if (style.underline !== undefined && typeof style.underline !== 'boolean') {
    return `Block ${blockIndex}, run ${runIndex}: style.underline must be a boolean`;
  }
  if (style.strikethrough !== undefined && typeof style.strikethrough !== 'boolean') {
    return `Block ${blockIndex}, run ${runIndex}: style.strikethrough must be a boolean`;
  }
  if (style.code !== undefined && typeof style.code !== 'boolean') {
    return `Block ${blockIndex}, run ${runIndex}: style.code must be a boolean`;
  }
  if (style.fontSize !== undefined && (typeof style.fontSize !== 'number' || style.fontSize <= 0)) {
    return `Block ${blockIndex}, run ${runIndex}: style.fontSize must be a positive number`;
  }
  if (style.fontFamily !== undefined && typeof style.fontFamily !== 'string') {
    return `Block ${blockIndex}, run ${runIndex}: style.fontFamily must be a string`;
  }
  if (style.color !== undefined && typeof style.color !== 'string') {
    return `Block ${blockIndex}, run ${runIndex}: style.color must be a string`;
  }
  if (style.backgroundColor !== undefined && typeof style.backgroundColor !== 'string') {
    return `Block ${blockIndex}, run ${runIndex}: style.backgroundColor must be a string`;
  }

  return null;
}
