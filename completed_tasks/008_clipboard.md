# Task 008: Cut, Copy, Paste

**Priority**: P0
**Depends on**: 005

## Description

Implement clipboard operations for plain text (rich text paste can come later).

## Requirements

1. Handle Ctrl/Cmd+C to copy selected text to clipboard.
2. Handle Ctrl/Cmd+X to cut selected text (copy + delete).
3. Handle Ctrl/Cmd+V to paste text from clipboard at cursor position.
4. For paste: start with plain text only (strip formatting).
5. Handle multi-line paste (split into multiple blocks at newlines).
6. Write tests for clipboard operations.

## Done When

- Copy puts selected text on the clipboard.
- Cut removes selected text and puts it on clipboard.
- Paste inserts text at cursor, splitting blocks on newlines.
- Tests verify clipboard behavior.
