# Task 016: Loading States and Error Handling UI

## Priority
P2 (UX Polish)

## Description
Add proper loading states, toast notifications, and error feedback throughout the application. Currently several operations fail silently (duplicate, delete) and there are no loading indicators when fetching documents.

## Requirements

### Toast Notification System
- Lightweight toast/notification component for user feedback
- Support success, error, and info variants
- Auto-dismiss after a few seconds
- Positioned at bottom-right of viewport

### Loading States
- Loading spinner/indicator when fetching document list
- Loading indicator when opening a document in editor
- Disabled state on buttons during async operations

### Error Feedback
- Show error toast when duplicate fails (currently silent)
- Show error toast when delete fails (currently silent)
- Improve save status to show "Saving..." during save
- Style save errors more prominently (red text)

### Acceptance Criteria
- [ ] Toast notification component with success/error/info variants
- [ ] Document list shows loading state while fetching
- [ ] Editor shows loading state while fetching document
- [ ] Duplicate failure shows error toast
- [ ] Delete failure shows error toast
- [ ] Save status shows "Saving..." while in progress
- [ ] Save error styled in red
- [ ] Unit tests for toast component
- [ ] E2e test for loading states visibility
