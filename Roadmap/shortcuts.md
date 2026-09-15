# Mandrak • Universal Markdown & System Keyboard Shortcuts Roadmap

## Executive Summary
This document defines the architecture and implementation roadmap for **Universal Markdown & System Keyboard Shortcuts** in Mandrak. It establishes a unified, platform-aware keyboard shortcut system that operates reliably across **macOS** (`⌘`), **Windows** (`Ctrl`), and **Linux** (`Ctrl`), completely eliminating browser event collisions, fixing search focus, supporting in-editor rich markdown formatting, and providing real-time feedback.

---

## 🎯 Core User Stories & Capabilities

### 1. Global & Application Shortcuts
1. **Save Active Note (`⌘S` / `Ctrl+S`)**:
   - Save the active note immediately from anywhere (editor, toolbar, sidebar, or preview).
   - Prevents the native browser *"Save Webpage as HTML"* dialog.
   - Triggers an instant success toast notification (`Saved "note-name.md"`).
2. **Create New Note (`⌘N` / `Ctrl+N`)**:
   - Opens the **"Create New Note"** modal from anywhere in the application.
   - Prevents browser new window opening.
   - Works regardless of whether Google Drive, Local File System, or In-Memory Vault is connected.
   - Automatically initializes template selection, clears errors, and auto-focuses the title input.
3. **Cycle View Modes (`⌘P` / `Ctrl+P`)**:
   - Cycles through the 3 view modes: **Edit Mode** ➔ **Split Mode** ➔ **Preview Mode** ➔ **Edit Mode**.
   - Prevents the native browser Print dialog.
4. **Quick Search Focus (`⌘K` / `Ctrl+K`)**:
   - When outside of editor text selection, focuses and selects all text in the sidebar search input.
   - If the left sidebar is currently collapsed, expands the sidebar before focusing search.
   - If on mobile, opens the mobile drawer before focusing search.
5. **Toggle Sidebar (`⌘\` / `Ctrl+\` & `⌘B` / `Ctrl+B` outside editor)**:
   - Toggles the left navigation sidebar collapse state on desktop and closes/opens drawer on mobile.
   - Uses `⌘\` / `Ctrl+\` (Obsidian/VS Code standard) to avoid collisions with in-editor **Bold text** (`⌘B` / `Ctrl+B`).
6. **Modal & Search Dismissal (`Escape`)**:
   - In Search input: Clears current search filter query or blurs the input.
   - In Modals / Menus: Closes the active modal, export menu, user profile menu, or mobile drawer.
7. **Form Submission (`Enter`)**:
   - Pressing `Enter` inside "Create Note" or "Create Folder" inputs immediately validates and submits the form without requiring mouse clicks.

---

### 2. Universal Markdown In-Editor Shortcuts
When the cursor or selection is inside the markdown editor, the following standard shortcuts operate seamlessly:

| Feature | macOS Shortcut | Windows / Linux Shortcut | Description |
| :--- | :--- | :--- | :--- |
| **Save Note** | `⌘S` | `Ctrl+S` | Direct save with status confirmation |
| **Insert Link** | `⌘K` | `Ctrl+K` | Prompts URL dialog for selected text |
| **Bold** | `⌘B` | `Ctrl+B` | Toggles `**bold**` formatting |
| **Italic** | `⌘I` | `Ctrl+I` | Toggles `*italic*` formatting |
| **Strikethrough** | `⌘⇧X` / `⌘⌥S` | `Ctrl+Shift+X` / `Ctrl+Alt+S` | Toggles `~~strikethrough~~` formatting |
| **Inline Code** | `⌘E` | `Ctrl+E` | Toggles `` `inline code` `` formatting |
| **Heading 1** | `⌘⌥1` / `⌘1` | `Ctrl+Alt+1` / `Ctrl+1` | Toggles `# Heading 1` |
| **Heading 2** | `⌘⌥2` / `⌘2` | `Ctrl+Alt+2` / `Ctrl+2` | Toggles `## Heading 2` |
| **Heading 3** | `⌘⌥3` / `⌘3` | `Ctrl+Alt+3` / `Ctrl+3` | Toggles `### Heading 3` |
| **Paragraph / Normal Text**| `⌘⌥0` / `⌘0` | `Ctrl+Alt+0` / `Ctrl+0` | Resets block to standard body paragraph |
| **Bullet List** | `⌘⇧8` / `⌘⌥U` | `Ctrl+Shift+8` / `Ctrl+Alt+U` | Toggles `- ` unordered list |
| **Numbered List** | `⌘⇧7` / `Ctrl+Shift+7` | `Ctrl+Shift+7` / `Ctrl+Alt+O` | Toggles `1. ` ordered list |
| **Blockquote** | `⌘⇧.` / `⌘⌥Q` | `Ctrl+Shift+.` / `Ctrl+Alt+Q` | Toggles `> ` blockquote |
| **Code Block** | `⌘⌥C` / `⌘⇧C` | `Ctrl+Alt+C` / `Ctrl+Shift+C` | Toggles ```` ``` ```` code block |
| **Horizontal Divider** | `⌘⇧H` / `⌘⇧-` | `Ctrl+Shift+H` / `Ctrl+Shift+-` | Inserts `---` divider line |
| **Indent List** | `Tab` | `Tab` | Sinks list item into sub-list |
| **Outdent List** | `Shift+Tab` | `Shift+Tab` | Lifts sub-list item up |
| **Undo** | `⌘Z` | `Ctrl+Z` | Reverts last editing action |
| **Redo** | `⌘⇧Z` | `Ctrl+Shift+Z` / `Ctrl+Y` | Re-applies reverted editing action |

---

## 🏗️ Technical Architecture & Keymap Routing

### 1. Platform Detection Helper (`src/utils/keyboard.ts`)
```ts
export const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const modKey = isMac ? '⌘' : 'Ctrl';
export const altKey = isMac ? '⌥' : 'Alt';
export const shiftKey = isMac ? '⇧' : 'Shift';
```

### 2. TipTap In-Editor Keymap Extension (`src/editor/useEditor.ts`)
Custom TipTap extension using `@tiptap/core` Extension API:
- `Mod-k`: Prompt for link URL on selected range and execute `.setLink()`.
- `Mod-s`: Execute `onSave` callback to write file contents without latency.
- `Mod-Alt-1` .. `Mod-Alt-3`, `Mod-1` .. `Mod-3`: Heading block toggle.
- `Mod-Shift-x`, `Mod-Alt-s`: Strikethrough toggle.
- `Mod-Alt-c`: Code block toggle.
- `Mod-Shift-.`, `Mod-Alt-q`: Blockquote toggle.
- `Mod-Shift-h`: Horizontal rule insertion.

### 3. Global Window Keydown Dispatcher (`src/App.tsx`)
Listens at the window level with target discrimination:
- Check `target.closest('.tiptap-editor-content')` to let in-editor shortcuts (`Mod-B`, `Mod-K`, etc.) take precedence when editing text.
- Fall through to application-wide actions (`Mod-N`, `Mod-P`, `Mod-S`, `Mod-\`, `Escape`) with standard `e.preventDefault()`.

---

## 🎨 UI & In-App Discovery
1. **Interactive Search Badge**: Displays dynamic `⌘K` or `Ctrl+K` in the sidebar search input. Clicking it focuses the search box.
2. **Platform-Aware Tooltips**: All toolbar and header icon tooltips render with the correct platform symbols (`⌘` or `Ctrl`).
3. **Categorized Settings Modal**: Cleanly separates *General Navigation Shortcuts* from *Universal Markdown Editor Shortcuts*.
4. **Strikethrough Toolbar Icon**: Added `~~S~~` button to the editor formatting bar.
