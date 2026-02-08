// ============================================================
// Document Model Types
// ============================================================

export type BlockType =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bullet-list-item'
  | 'numbered-list-item'
  | 'blockquote'
  | 'code-block'
  | 'horizontal-rule'
  | 'image'
  | 'table';

export type Alignment = 'left' | 'center' | 'right';

export interface TextStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  backgroundColor?: string;
}

export interface TextRun {
  text: string;
  style: TextStyle;
}

export interface TableCell {
  runs: TextRun[];
}

export type LineSpacing = 1.0 | 1.15 | 1.5 | 2.0;

export const VALID_LINE_SPACINGS: readonly number[] = [1.0, 1.15, 1.5, 2.0];

export interface Block {
  id: string;
  type: BlockType;
  alignment: Alignment;
  indentLevel?: number;
  lineSpacing?: LineSpacing;
  imageUrl?: string;
  tableData?: TableCell[][];
  runs: TextRun[];
}

export const MAX_INDENT_LEVEL = 8;

export interface Document {
  id: string;
  title: string;
  blocks: Block[];
}

// ============================================================
// Position Types
// ============================================================

/** A position within a document: block index + character offset within that block's text */
export interface Position {
  blockIndex: number;
  offset: number;
}

/** A range within a document (start is inclusive, end is exclusive) */
export interface Range {
  start: Position;
  end: Position;
}

// ============================================================
// Operation Types
// ============================================================

export interface InsertTextOp {
  type: 'insert_text';
  position: Position;
  text: string;
}

export interface DeleteTextOp {
  type: 'delete_text';
  range: Range;
}

export interface ApplyFormattingOp {
  type: 'apply_formatting';
  range: Range;
  style: Partial<TextStyle>;
}

export interface RemoveFormattingOp {
  type: 'remove_formatting';
  range: Range;
  style: Partial<TextStyle>;
}

export interface SplitBlockOp {
  type: 'split_block';
  position: Position;
}

export interface MergeBlockOp {
  type: 'merge_block';
  blockIndex: number; // merge this block with the previous one
}

export interface ChangeBlockTypeOp {
  type: 'change_block_type';
  blockIndex: number;
  newType: BlockType;
}

export interface ChangeBlockAlignmentOp {
  type: 'change_block_alignment';
  blockIndex: number;
  newAlignment: Alignment;
}

export interface InsertBlockOp {
  type: 'insert_block';
  afterBlockIndex: number;
  blockType: BlockType;
}

export interface SetIndentOp {
  type: 'set_indent';
  blockIndex: number;
  indentLevel: number;
}

export interface SetImageOp {
  type: 'set_image';
  blockIndex: number;
  imageUrl: string;
}

export interface SetLineSpacingOp {
  type: 'set_line_spacing';
  blockIndex: number;
  lineSpacing: LineSpacing;
}

export interface DeleteBlockOp {
  type: 'delete_block';
  blockIndex: number;
}

export interface SetTableDataOp {
  type: 'set_table_data';
  blockIndex: number;
  tableData: TableCell[][];
}

export type Operation =
  | InsertTextOp
  | DeleteTextOp
  | ApplyFormattingOp
  | RemoveFormattingOp
  | SplitBlockOp
  | MergeBlockOp
  | ChangeBlockTypeOp
  | ChangeBlockAlignmentOp
  | InsertBlockOp
  | SetIndentOp
  | SetImageOp
  | SetLineSpacingOp
  | DeleteBlockOp
  | SetTableDataOp;

// ============================================================
// Helper Functions
// ============================================================

/** Get the indent level of a block (defaults to 0 for blocks without it) */
export function getIndentLevel(block: Block): number {
  return block.indentLevel ?? 0;
}

/** Get the total text length of a block (sum of all run text lengths) */
export function blockTextLength(block: Block): number {
  return block.runs.reduce((sum, run) => sum + run.text.length, 0);
}

/** Get the plain text content of a block */
export function blockToPlainText(block: Block): string {
  return block.runs.map((r) => r.text).join('');
}

/** Find the offset of the previous word boundary (for Ctrl+Backspace) */
export function findWordBoundaryLeft(text: string, offset: number): number {
  if (offset <= 0) return 0;
  let i = offset - 1;
  // Skip whitespace/punctuation backwards
  while (i > 0 && /[\s\W]/.test(text[i])) i--;
  // Skip word characters backwards
  while (i > 0 && /\w/.test(text[i - 1])) i--;
  return i;
}

/** Find the offset of the next word boundary (for Ctrl+Delete) */
export function findWordBoundaryRight(text: string, offset: number): number {
  const len = text.length;
  if (offset >= len) return len;
  let i = offset;
  // Skip word characters forwards
  while (i < len && /\w/.test(text[i])) i++;
  // Skip whitespace/punctuation forwards
  while (i < len && /[\s\W]/.test(text[i])) i++;
  return i;
}

/** Check if two TextStyle objects are equal */
export function stylesEqual(a: TextStyle, b: TextStyle): boolean {
  return (
    !!a.bold === !!b.bold &&
    !!a.italic === !!b.italic &&
    !!a.underline === !!b.underline &&
    !!a.strikethrough === !!b.strikethrough &&
    !!a.code === !!b.code &&
    (a.fontSize || undefined) === (b.fontSize || undefined) &&
    (a.fontFamily || undefined) === (b.fontFamily || undefined) &&
    (a.color || undefined) === (b.color || undefined) &&
    (a.backgroundColor || undefined) === (b.backgroundColor || undefined)
  );
}

/** Merge a partial style into an existing style */
function applyStyleDelta(base: TextStyle, delta: Partial<TextStyle>): TextStyle {
  return {
    bold: delta.bold !== undefined ? delta.bold : base.bold,
    italic: delta.italic !== undefined ? delta.italic : base.italic,
    underline: delta.underline !== undefined ? delta.underline : base.underline,
    strikethrough:
      delta.strikethrough !== undefined ? delta.strikethrough : base.strikethrough,
    code: delta.code !== undefined ? delta.code : base.code,
    fontSize: delta.fontSize !== undefined ? delta.fontSize : base.fontSize,
    fontFamily: delta.fontFamily !== undefined ? delta.fontFamily : base.fontFamily,
    color: delta.color !== undefined ? delta.color : base.color,
    backgroundColor: delta.backgroundColor !== undefined ? delta.backgroundColor : base.backgroundColor,
  };
}

/** Remove style flags specified in delta from the base style */
function removeStyleDelta(base: TextStyle, delta: Partial<TextStyle>): TextStyle {
  return {
    bold: delta.bold !== undefined ? false : base.bold,
    italic: delta.italic !== undefined ? false : base.italic,
    underline: delta.underline !== undefined ? false : base.underline,
    strikethrough: delta.strikethrough !== undefined ? false : base.strikethrough,
    code: delta.code !== undefined ? false : base.code,
    fontSize: delta.fontSize !== undefined ? undefined : base.fontSize,
    fontFamily: delta.fontFamily !== undefined ? undefined : base.fontFamily,
    color: delta.color !== undefined ? undefined : base.color,
    backgroundColor: delta.backgroundColor !== undefined ? undefined : base.backgroundColor,
  };
}

/** Normalize runs: merge adjacent runs with same style, remove empty runs */
export function normalizeRuns(runs: TextRun[]): TextRun[] {
  const result: TextRun[] = [];
  for (const run of runs) {
    if (run.text.length === 0) continue;
    const last = result[result.length - 1];
    if (last && stylesEqual(last.style, run.style)) {
      last.text += run.text;
    } else {
      result.push({ text: run.text, style: { ...run.style } });
    }
  }
  return result;
}

/**
 * Split a block's runs at a character offset.
 * Returns [runsBefore, runsAfter].
 */
function splitRunsAt(runs: TextRun[], offset: number): [TextRun[], TextRun[]] {
  let remaining = offset;
  const before: TextRun[] = [];
  const after: TextRun[] = [];
  let splitDone = false;

  for (const run of runs) {
    if (splitDone) {
      after.push({ text: run.text, style: { ...run.style } });
    } else if (remaining >= run.text.length) {
      before.push({ text: run.text, style: { ...run.style } });
      remaining -= run.text.length;
    } else {
      // Split within this run
      if (remaining > 0) {
        before.push({ text: run.text.slice(0, remaining), style: { ...run.style } });
      }
      if (remaining < run.text.length) {
        after.push({ text: run.text.slice(remaining), style: { ...run.style } });
      }
      splitDone = true;
    }
  }

  return [before, after];
}

/**
 * Get the style at a given offset within runs.
 * If offset is between runs or at start, returns the style of the run at or after that position.
 */
function styleAtOffset(runs: TextRun[], offset: number): TextStyle {
  let pos = 0;
  for (const run of runs) {
    if (offset <= pos + run.text.length) {
      return { ...run.style };
    }
    pos += run.text.length;
  }
  // Offset at end — return last run's style or empty
  if (runs.length > 0) {
    return { ...runs[runs.length - 1].style };
  }
  return {};
}

// ============================================================
// Deep clone helper
// ============================================================

function cloneCell(cell: TableCell): TableCell {
  return { runs: cell.runs.map((r) => ({ text: r.text, style: { ...r.style } })) };
}

function cloneTableData(tableData: TableCell[][]): TableCell[][] {
  return tableData.map((row) => row.map(cloneCell));
}

function cloneBlock(block: Block): Block {
  const clone: Block = {
    id: block.id,
    type: block.type,
    alignment: block.alignment,
    indentLevel: block.indentLevel ?? 0,
    runs: block.runs.map((r) => ({ text: r.text, style: { ...r.style } })),
  };
  if (block.imageUrl !== undefined) {
    clone.imageUrl = block.imageUrl;
  }
  if (block.lineSpacing !== undefined) {
    clone.lineSpacing = block.lineSpacing;
  }
  if (block.tableData !== undefined) {
    clone.tableData = cloneTableData(block.tableData);
  }
  return clone;
}

function cloneDoc(doc: Document): Document {
  return {
    id: doc.id,
    title: doc.title,
    blocks: doc.blocks.map(cloneBlock),
  };
}

// ============================================================
// Apply Operation
// ============================================================

let blockIdCounter = 0;

export function generateBlockId(): string {
  return `block_${++blockIdCounter}_${Date.now()}`;
}

export function resetBlockIdCounter(): void {
  blockIdCounter = 0;
}

export function applyOperation(doc: Document, op: Operation): Document {
  const result = cloneDoc(doc);

  switch (op.type) {
    case 'insert_text':
      return applyInsertText(result, op);
    case 'delete_text':
      return applyDeleteText(result, op);
    case 'apply_formatting':
      return applyFormatting(result, op);
    case 'remove_formatting':
      return applyRemoveFormatting(result, op);
    case 'split_block':
      return applySplitBlock(result, op);
    case 'merge_block':
      return applyMergeBlock(result, op);
    case 'change_block_type':
      return applyChangeBlockType(result, op);
    case 'change_block_alignment':
      return applyChangeBlockAlignment(result, op);
    case 'insert_block':
      return applyInsertBlock(result, op);
    case 'set_indent':
      return applySetIndent(result, op);
    case 'set_image':
      return applySetImage(result, op);
    case 'set_line_spacing':
      return applySetLineSpacing(result, op);
    case 'delete_block':
      return applyDeleteBlock(result, op);
    case 'set_table_data':
      return applySetTableData(result, op);
  }
}

function applyInsertText(doc: Document, op: InsertTextOp): Document {
  const block = doc.blocks[op.position.blockIndex];
  if (!block) return doc;

  const [before, after] = splitRunsAt(block.runs, op.position.offset);
  const insertStyle = styleAtOffset(block.runs, op.position.offset);
  const insertRun: TextRun = { text: op.text, style: insertStyle };
  block.runs = normalizeRuns([...before, insertRun, ...after]);

  // Ensure block always has at least one run
  if (block.runs.length === 0) {
    block.runs = [{ text: '', style: {} }];
  }

  return doc;
}

function applyDeleteText(doc: Document, op: DeleteTextOp): Document {
  const { start, end } = op.range;

  if (start.blockIndex === end.blockIndex) {
    // Single-block deletion
    const block = doc.blocks[start.blockIndex];
    if (!block) return doc;

    const [beforeStart] = splitRunsAt(block.runs, start.offset);
    const [, afterEnd] = splitRunsAt(block.runs, end.offset);
    block.runs = normalizeRuns([...beforeStart, ...afterEnd]);

    if (block.runs.length === 0) {
      block.runs = [{ text: '', style: {} }];
    }
  } else {
    // Multi-block deletion
    const startBlock = doc.blocks[start.blockIndex];
    const endBlock = doc.blocks[end.blockIndex];
    if (!startBlock || !endBlock) return doc;

    // Keep content before start.offset in the start block
    const [beforeStart] = splitRunsAt(startBlock.runs, start.offset);
    // Keep content after end.offset in the end block
    const [, afterEnd] = splitRunsAt(endBlock.runs, end.offset);

    // Merge remaining content into start block
    startBlock.runs = normalizeRuns([...beforeStart, ...afterEnd]);
    if (startBlock.runs.length === 0) {
      startBlock.runs = [{ text: '', style: {} }];
    }

    // Remove blocks between start and end (inclusive of end block)
    doc.blocks.splice(start.blockIndex + 1, end.blockIndex - start.blockIndex);
  }

  return doc;
}

function applyFormattingToRange(
  runs: TextRun[],
  startOffset: number,
  endOffset: number,
  transform: (style: TextStyle) => TextStyle
): TextRun[] {
  const result: TextRun[] = [];
  let pos = 0;

  for (const run of runs) {
    const runStart = pos;
    const runEnd = pos + run.text.length;
    pos = runEnd;

    if (runEnd <= startOffset || runStart >= endOffset) {
      // Entirely outside the range
      result.push({ text: run.text, style: { ...run.style } });
    } else if (runStart >= startOffset && runEnd <= endOffset) {
      // Entirely inside the range
      result.push({ text: run.text, style: transform({ ...run.style }) });
    } else {
      // Partially overlapping — need to split
      if (runStart < startOffset) {
        result.push({
          text: run.text.slice(0, startOffset - runStart),
          style: { ...run.style },
        });
      }
      const overlapStart = Math.max(0, startOffset - runStart);
      const overlapEnd = Math.min(run.text.length, endOffset - runStart);
      result.push({
        text: run.text.slice(overlapStart, overlapEnd),
        style: transform({ ...run.style }),
      });
      if (runEnd > endOffset) {
        result.push({
          text: run.text.slice(endOffset - runStart),
          style: { ...run.style },
        });
      }
    }
  }

  return normalizeRuns(result);
}

function applyFormatting(doc: Document, op: ApplyFormattingOp): Document {
  const { start, end } = op.range;

  if (start.blockIndex === end.blockIndex) {
    const block = doc.blocks[start.blockIndex];
    if (!block) return doc;
    block.runs = applyFormattingToRange(
      block.runs,
      start.offset,
      end.offset,
      (style) => applyStyleDelta(style, op.style)
    );
  } else {
    // Multi-block formatting
    for (let bi = start.blockIndex; bi <= end.blockIndex; bi++) {
      const block = doc.blocks[bi];
      if (!block) continue;

      const rangeStart = bi === start.blockIndex ? start.offset : 0;
      const rangeEnd = bi === end.blockIndex ? end.offset : blockTextLength(block);

      block.runs = applyFormattingToRange(block.runs, rangeStart, rangeEnd, (style) =>
        applyStyleDelta(style, op.style)
      );
    }
  }

  return doc;
}

function applyRemoveFormatting(doc: Document, op: RemoveFormattingOp): Document {
  const { start, end } = op.range;

  if (start.blockIndex === end.blockIndex) {
    const block = doc.blocks[start.blockIndex];
    if (!block) return doc;
    block.runs = applyFormattingToRange(
      block.runs,
      start.offset,
      end.offset,
      (style) => removeStyleDelta(style, op.style)
    );
  } else {
    for (let bi = start.blockIndex; bi <= end.blockIndex; bi++) {
      const block = doc.blocks[bi];
      if (!block) continue;

      const rangeStart = bi === start.blockIndex ? start.offset : 0;
      const rangeEnd = bi === end.blockIndex ? end.offset : blockTextLength(block);

      block.runs = applyFormattingToRange(block.runs, rangeStart, rangeEnd, (style) =>
        removeStyleDelta(style, op.style)
      );
    }
  }

  return doc;
}

function applySplitBlock(doc: Document, op: SplitBlockOp): Document {
  const block = doc.blocks[op.position.blockIndex];
  if (!block) return doc;

  const [beforeRuns, afterRuns] = splitRunsAt(block.runs, op.position.offset);

  // The current block keeps the content before the split
  block.runs = normalizeRuns(beforeRuns);
  if (block.runs.length === 0) {
    block.runs = [{ text: '', style: {} }];
  }

  // Create a new block with content after the split
  const newBlock: Block = {
    id: generateBlockId(),
    type: 'paragraph',
    alignment: block.alignment,
    indentLevel: block.indentLevel,
    lineSpacing: block.lineSpacing,
    runs: normalizeRuns(afterRuns),
  };
  if (newBlock.runs.length === 0) {
    newBlock.runs = [{ text: '', style: {} }];
  }

  // Insert the new block after the current one
  doc.blocks.splice(op.position.blockIndex + 1, 0, newBlock);

  return doc;
}

function applyMergeBlock(doc: Document, op: MergeBlockOp): Document {
  if (op.blockIndex <= 0 || op.blockIndex >= doc.blocks.length) return doc;

  const prevBlock = doc.blocks[op.blockIndex - 1];
  const currBlock = doc.blocks[op.blockIndex];

  // Merge current block's runs into previous block
  prevBlock.runs = normalizeRuns([...prevBlock.runs, ...currBlock.runs]);
  if (prevBlock.runs.length === 0) {
    prevBlock.runs = [{ text: '', style: {} }];
  }

  // Remove the current block
  doc.blocks.splice(op.blockIndex, 1);

  return doc;
}

function applyChangeBlockType(doc: Document, op: ChangeBlockTypeOp): Document {
  const block = doc.blocks[op.blockIndex];
  if (!block) return doc;
  block.type = op.newType;
  return doc;
}

function applyChangeBlockAlignment(doc: Document, op: ChangeBlockAlignmentOp): Document {
  const block = doc.blocks[op.blockIndex];
  if (!block) return doc;
  block.alignment = op.newAlignment;
  return doc;
}

function applyInsertBlock(doc: Document, op: InsertBlockOp): Document {
  const insertAt = Math.max(0, Math.min(op.afterBlockIndex + 1, doc.blocks.length));
  const newBlock: Block = {
    id: generateBlockId(),
    type: op.blockType,
    alignment: 'left',
    indentLevel: 0,
    runs: [{ text: '', style: {} }],
  };
  if (op.blockType === 'table') {
    newBlock.tableData = createDefaultTableData();
  }
  doc.blocks.splice(insertAt, 0, newBlock);
  return doc;
}

/** Create a default 2x2 table */
function createDefaultTableData(): TableCell[][] {
  return [
    [{ runs: [{ text: '', style: {} }] }, { runs: [{ text: '', style: {} }] }],
    [{ runs: [{ text: '', style: {} }] }, { runs: [{ text: '', style: {} }] }],
  ];
}

/** Create a table with specified dimensions */
export function createTableData(rows: number, cols: number): TableCell[][] {
  const data: TableCell[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: TableCell[] = [];
    for (let c = 0; c < cols; c++) {
      row.push({ runs: [{ text: '', style: {} }] });
    }
    data.push(row);
  }
  return data;
}

function applySetIndent(doc: Document, op: SetIndentOp): Document {
  const block = doc.blocks[op.blockIndex];
  if (!block) return doc;
  block.indentLevel = Math.max(0, Math.min(op.indentLevel, MAX_INDENT_LEVEL));
  return doc;
}

function applySetImage(doc: Document, op: SetImageOp): Document {
  const block = doc.blocks[op.blockIndex];
  if (!block) return doc;
  block.imageUrl = op.imageUrl;
  return doc;
}

function applySetLineSpacing(doc: Document, op: SetLineSpacingOp): Document {
  const block = doc.blocks[op.blockIndex];
  if (!block) return doc;
  block.lineSpacing = op.lineSpacing;
  return doc;
}

function applyDeleteBlock(doc: Document, op: DeleteBlockOp): Document {
  if (op.blockIndex < 0 || op.blockIndex >= doc.blocks.length) return doc;
  if (doc.blocks.length <= 1) {
    // Can't delete the last block — convert to empty paragraph
    doc.blocks[0] = {
      id: doc.blocks[0].id,
      type: 'paragraph',
      alignment: 'left',
      runs: [{ text: '', style: {} }],
    };
    return doc;
  }
  doc.blocks.splice(op.blockIndex, 1);
  return doc;
}

function applySetTableData(doc: Document, op: SetTableDataOp): Document {
  const block = doc.blocks[op.blockIndex];
  if (!block) return doc;
  block.tableData = cloneTableData(op.tableData);
  return doc;
}

// ============================================================
// Text Extraction
// ============================================================

/** Extract plain text from a range within the document */
export function getTextInRange(doc: Document, range: Range): string {
  const { start, end } = range;

  if (start.blockIndex === end.blockIndex) {
    // Single block
    const text = blockToPlainText(doc.blocks[start.blockIndex]);
    return text.slice(start.offset, end.offset);
  }

  // Multi-block: first block (from offset to end) + middle blocks + last block (from start to offset)
  const parts: string[] = [];

  // First block: from start.offset to end
  const firstText = blockToPlainText(doc.blocks[start.blockIndex]);
  parts.push(firstText.slice(start.offset));

  // Middle blocks: full text
  for (let i = start.blockIndex + 1; i < end.blockIndex; i++) {
    parts.push(blockToPlainText(doc.blocks[i]));
  }

  // Last block: from start to end.offset
  const lastText = blockToPlainText(doc.blocks[end.blockIndex]);
  parts.push(lastText.slice(0, end.offset));

  return parts.join('\n');
}

// ============================================================
// Factory Functions
// ============================================================

export function createEmptyDocument(id: string, title: string): Document {
  return {
    id,
    title,
    blocks: [
      {
        id: generateBlockId(),
        type: 'paragraph',
        alignment: 'left',
        indentLevel: 0,
        runs: [{ text: '', style: {} }],
      },
    ],
  };
}

export function createBlock(
  type: BlockType = 'paragraph',
  text: string = '',
  style: TextStyle = {},
  alignment: Alignment = 'left'
): Block {
  return {
    id: generateBlockId(),
    type,
    alignment,
    indentLevel: 0,
    runs: [{ text, style }],
  };
}
