# Task 018: Font Size and Font Family

## Priority
P2 — Extended Formatting

## Description

Add font size and font family support to the document editor.

### Requirements
- Add `fontSize` and `fontFamily` properties to `TextStyle` interface
- Implement toolbar dropdown controls for font size (preset sizes like 8, 10, 12, 14, 18, 24, 36, 48)
- Implement toolbar dropdown for font family (web-safe fonts: Arial, Times New Roman, Courier New, Georgia, Verdana, etc.)
- Renderer should apply font-size and font-family CSS to styled spans
- Formatting operations should work the same as bold/italic (apply to selection or current position)
- Add unit tests for model and renderer changes
- Add e2e tests for toolbar interaction

## Dependencies
None
