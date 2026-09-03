# Mandrak • Drag & Drop Tree Organization & Mobile File Reorganization Roadmap

## Executive Summary
This document defines the architecture and implementation roadmap for native **Drag & Drop Organization**, **Mobile File Reorganization ("Move to Folder...")**, and **Cloud Synchronization Feedback** in the Mandrak Left Pane Tree Explorer. Users can organize markdown files and folders via desktop drag & drop or mobile modal selection within the same storage boundary with real-time visual feedback, optimistic updates, progress toasts, and unified iconography.

---

## 🎯 Core User Stories
1. **Move File to Folder (Desktop)**: Drag any note card or compact row onto a folder row to move the file into that folder.
2. **Move File to Root (Desktop)**: Drag a note onto the top **Root Vault Header** (`📁 Root Vault`) to move it out of a folder back to the root level (`/`).
3. **Move Folder to Folder (Subfolder Nesting)**: Drag a folder onto another folder to nest it as a subfolder. All nested notes and children retain their relative paths.
4. **Move Folder to Root**: Drag a subfolder onto the **Root Vault Header** to promote it to a top-level directory.
5. **Move to Folder on Mobile & Touch Devices**: On mobile touchscreens (where HTML5 pointer drag is unsupported), tap the **"Move to Folder"** action (`↗️`) on any note to open a clean destination picker sheet/modal and select the target folder.
6. **Unified & Consistent Iconography**: All "Create Note" actions use the identical **Note with Plus** (`📄+`) icon across top headers, root banners, and folder rows. All "Create Folder" actions use the identical **Folder with Plus** (`📁+`) icon.
7. **Real-time Progress & Status Toast**: Immediately see the item moved with a subtle `Moving... 🔄` badge, accompanied by a floating progress toast (`Moving "note.md" to "Projects"...`) and success confirmation.

---

## 📱 Mobile vs Desktop Reorganization Strategy

### The Mobile Constraint
- Standard HTML5 Drag & Drop (`draggable="true"`, `onDragStart`, `onDrop`) relies on mouse-pointer events. On mobile browsers (iOS Safari, Android Chrome), touch gestures are interpreted by the operating system as viewport scrolling (`pan-y`), preventing desktop drag events from firing.
- In addition, dragging small cards on mobile screens frequently causes accidental drops or conflicts with vertical scrolling.

### The Solution: Universal "Move to Folder" Action
- In addition to desktop drag & drop, every note card and compact row provides a dedicated **"Move to Folder..."** button.
- Tapping this button opens a modal/sheet presenting all available folders in the active workspace (including `📁 Root Vault (/)`).
- Tapping a destination folder instantly executes the move with optimistic UI updates and toast feedback.

---

## 🛡️ Guardrails & Reliability Rules
1. **Same-Storage Boundary**: Drag and Drop / Move operations only execute within the active storage workspace (Local Vault ↔ Local Vault, Google Drive ↔ Google Drive). Cross-provider movement is strictly prevented.
2. **Cycle & Self-Nesting Prevention**:
   - A folder cannot be dropped into itself.
   - A parent folder cannot be dropped into any of its own child subfolders (e.g. `Projects` cannot be dropped into `Projects/Client-A/Docs`).
3. **No-Op Detection**: Dropping or moving a file/folder into its current parent folder does nothing and avoids redundant network/storage operations.
4. **Automatic Rollback on Network Failure**: If a cloud move fails (e.g. timeout or offline), the optimistic UI instantly rolls back the file to its original directory and notifies the user with an actionable error toast.
5. **Drive Alphanumeric ID Sanitization**:
   - Any raw Google Drive ID hash (e.g. `1aB2c3D4e5...`) is strictly sanitized and resolved to human-readable folder names before rendering.
   - Stale cache is purged upon provider switch to eliminate the "random ID flash".

---

## 🎨 Visual Feedback & UX
- **Unified Action Icons**:
  - New Note: `<svg ... d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />`
  - New Folder: `<svg ... d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />`
  - Move Note: `<svg ... d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />`
- **Optimistic Movement**: Item moves immediately in the UI upon drop or selection without waiting for cloud network latency.
- **Moving Indicator**: The moving item displays a subtle pulsing spinner badge (`Moving...`).
- **Drop Target Glow**: Folders and Root Vault header highlight with `.drop-target-active` (indigo glow, subtle scaling, and accent border).
- **Floating Status Toast**:
  - ⏳ *`Moving "roadmap.md" into "Projects"...`*
  - ✅ *`Moved "roadmap.md" into "Projects"`* (auto-dismisses after 3s).
  - ❌ *`Failed to move "roadmap.md": [error]`* (with rollback).

---

## 🏗️ Technical Architecture

### 1. Drag Payload Format
```ts
interface DragPayload {
  type: 'file' | 'folder';
  id: string;
  name: string;
  path: string;
  sourceProvider: string;
}
```

### 2. State & Operation Flow in `useFileManagement.ts`
1. `moveFile(fileId, destinationFolderPath)`:
   - Records previous path for rollback.
   - Optimistically updates `recentFiles` in memory with `isMoving: true` and new path.
   - Shows progress toast notification.
   - Awaits `storageProvider.moveFile(fileId, destinationFolderPath)`.
   - On success: clears `isMoving` flag, shows success toast, and persists to cache.
   - On failure: rolls back `recentFiles` to previous path, clears `isMoving`, and shows error toast.

---

## 📋 Implementation Checklist
- [x] Create and update Roadmap documentation in `Roadmap/draganddrop.md`
- [x] Implement full pagination and ID sanitization in `GoogleDriveProvider.ts`
- [x] Add stale-cache purge on provider switch in `useFileManagement.ts`
- [x] Implement optimistic UI updates with automatic rollback in `useFileManagement.ts`
- [x] Create sleek `ToastNotification` component and integrate with moving actions
- [x] Unify "Create Note" and "Create Folder" icons across header, root banner, and folder rows
- [x] Implement "Move to Folder..." modal & mobile quick actions in `FileBrowser.tsx`, `App.tsx`, and `App.css`
- [x] Verify clean compilation with `npm run build`
