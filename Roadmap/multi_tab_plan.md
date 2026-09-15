# Multi-Tab Markdown Workspace — Implementation & Architectural Plan

**Version:** 1.0.0  
**Target:** Local-First Multi-File Markdown Workspace  
**Status:** Approved for Implementation (Phase 1)

---

## 🎯 Vision & Goals

Transform WebMdEditor into a true **multi-file tabbed workspace** (similar to Obsidian, VS Code, and Typora). Users can open multiple files at once, jump rapidly between documents, manage independent unsaved drafts, view file paths on hover via clean native tooltips, and navigate using standard keyboard shortcuts.

---

## 🏗️ Architecture & Component Breakdown

```
+-----------------------------------------------------------------------------------------+
| [✦ Web MD]  [● Local: /Notes ▾]           [ ✍️ Edit | 📑 Split | 👁️ Preview ]  [☀️] [💾] [⚙️]  |
+-------------------+---------------------------------------------------------------------+
| 📂 SIDEBAR        | [ 📝 index.md ✕ ] [ 🎯 roadmap.md ● ✕ ] [ 📔 journal.md ✕ ] [ + ]  ▾ |  <- EditorTabs Bar
|                   +---------------------------------------------------------------------+
| 🔍 Search notes   |                                                                     |
| 📁 Work           |   # Active Document Content                                         |
|   📄 roadmap.md   |   > Multi-tab editing architecture and implementation...            |
| 📁 Personal       |                                                                     |
|   📄 journal.md   |                                                                     |
+-------------------+---------------------------------------------------------------------+
```

---

## 🚀 Feature Specifications

### 1. Tab Bar Engine (`src/editor/EditorTabs.tsx`)
- **Visual Design**: Sleek glassmorphism strip above the editor canvas with bottom divider.
- **Active State**: Glowing accent indicator and contrast background for the active note.
- **Unsaved Indicator**: Pulsing amber dot (`●`) for files with dirty in-memory edits.
- **Close Button**: Fast hover `✕` button on each tab + **middle-click to close**.
- **New Note Shortcut**: Quick `+` button on the tab strip to instantly create a new note tab.
- **Tab Actions Menu**: 3-dot or right-click options for *"Close"*, *"Close Other Tabs"*, *"Close All Tabs"*.

### 2. Native Path Tooltips & Smart Duplicate Disambiguation
- **Native Tooltip (`title` attribute)**:
  - Format: `[Path]/[Filename] • [Status]`
  - Example: `Work/Projects/architecture.md • Unsaved changes`
  - Zero performance overhead, clean and accessible across all browsers and operating systems.
- **Smart Duplicate Name Labeling**:
  - If two open tabs have identical names (e.g. `guide.md` in `/docs` and `guide.md` in `/archive`), automatically display the parent folder name in small muted text beside the title:
    - Tab 1: `guide.md · docs`
    - Tab 2: `guide.md · archive`

### 3. State & Session Persistence (`src/files/useFileManagement.ts`)
- **State Model**:
  - `openTabs: MarkdownFile[]` (all active open documents with in-memory draft content)
  - `activeTabId: string | null` (currently focused tab ID)
  - `currentFile`: Derived as `openTabs.find(f => f.id === activeTabId) || null`
- **Tab Actions**:
  - `openFile(fileId)`: Switches to tab if already open; otherwise loads and appends to `openTabs`.
  - `closeTab(fileId)`: Removes from `openTabs` and smoothly activates adjacent tab.
  - `closeOtherTabs(fileId)`: Closes all tabs except `fileId`.
  - `closeAllTabs()`: Clears all tabs to reveal empty state.
  - `setActiveTab(fileId)`: Sets active tab.
  - `updateFileContent(content)`: Marks active file dirty and updates memory buffer.
- **Session Memory**:
  - Persists open tab IDs and active tab in `localStorage` under `mandrak_tabs_${workspaceKey}` to restore exact working session on page refresh or storage switch.

### 4. Desktop-Grade Keyboard Shortcuts
- **`⌘W` / `Ctrl+W`**: Close current tab (intercepted to prevent browser tab closing).
- **`Ctrl+Tab` / `Ctrl+Shift+Tab`**: Cycle forward and backward through open tabs.
- **`⌥⌘←` / `⌥⌘→`** (Mac) or **`Ctrl+PageUp` / `Ctrl+PageDown`**: Switch to previous / next tab.
- **`⌘1` – `⌘9`** / **`Ctrl+1..9`**: Jump directly to tab 1 through 9.

---

## 📅 Roadmap Phases

- **Phase 1 (Active)**: Core Multi-Tab Workspace, Native Path Tooltips, Dirty State Management, Session Persistence, and Keyboard Navigation.
- **Phase 2 (Future)**: Side-by-Side Dual-Editor Split Panes (Open two files simultaneously).
- **Phase 3 (Future)**: Drag & Drop Tab Reordering and Pinned Tabs.
