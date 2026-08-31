# Web MD Editor — Modern UI/UX Architecture & Overhaul Plan (v2)

**Version:** 2.0.0  
**Target:** Local-First Markdown Editor with Multi-Cloud Sync  
**Stack:** React 19, TipTap (MIT), Marked (MIT), DOMPurify (MIT), TypeScript, Vanilla CSS (Design Tokens)

---

## 📸 Visual Design Mockups

### 1. Main Editor Workspace (Dark Mode)
![Main Editor Workspace](/Users/pranjaldiwedi/Documents/coding/WebMdEditor/Roadmap/assets/web_md_editor_redesign_1788200802465.jpg)

---

### 2. Full 3-Pane Desktop Layout (Sidebar + Editor + Live Preview)
![3-Pane Desktop Layout](/Users/pranjaldiwedi/Documents/coding/WebMdEditor/Roadmap/assets/web_md_three_pane_layout_1788201171646.jpg)

---

### 3. Split-View & Live Preview Mode (Synchronized Scroll)
![Split View & Live Preview](/Users/pranjaldiwedi/Documents/coding/WebMdEditor/Roadmap/assets/web_md_preview_split_mode_1788201070167.jpg)

---

### 4. Landing & Storage Onboarding Screen
![Landing & Storage Screen](/Users/pranjaldiwedi/Documents/coding/WebMdEditor/Roadmap/assets/web_md_landing_page_1788200880523.jpg)

---

## 🎯 Architectural Goals & Core Principles

1. **100% Free & Open-Source**: Zero paid subscriptions or third-party paid components. Powered strictly by existing open-source libraries:
   - **TipTap** (`@tiptap/react`, `@tiptap/starter-kit`, `tiptap-markdown`) — MIT License
   - **Marked** (`marked`) & **DOMPurify** (`dompurify`) — MIT License
   - **React 19 & Vite** — MIT License
2. **Account-Less & Local-First**: No mandatory login barrier. Start writing in 0ms with local folder persistence or optional Google Drive sync.
3. **Reading & Writing Ergonomics**: Centered reading columns (max-width 840px), high-fidelity typography (*Inter* + *JetBrains Mono*), and 3 flexible view modes (Edit, Split, Preview).
4. **Desktop-Grade Polish**: Frosted glassmorphism (`backdrop-filter: blur(16px)`), micro-animations, glowing active states, and custom segmented pill toolbars.

---

## 🧩 Detailed Feature Specifications

### 1. Top Navigation Bar (Header)
- **Brand Mark:** `✦ Web MD` with subtle gradient typography and version badge.
- **Storage Status Pill:** Displays active storage directory (e.g., `● Local: /Notes ▾` or `🟢 Google Drive ▾`) with 1-click source switcher.
- **View Mode Segmented Switcher:** Direct pill controls for `[ ✍️ Edit | 📑 Split | 👁️ Preview ]` (or keyboard toggle `⌘P` / `Ctrl+P`).
- **Instant Theme Switcher:** 1-click **Sun ☀️ / Moon 🌙 Toggle** in the top bar.
- **Action Buttons:** New Note button, Export dropdown (Markdown, HTML, Print), and Settings gear.
- **Clean Structure:** Resolves the legacy nested `<header>` tag issue in `MainLayout.tsx`.

---

### 2. Left Sidebar (File Explorer & Note Rails)
- **Search Bar:** Integrated magnifying glass SVG icon, `⌘K` keyboard badge, and instant clear (`✕`) button.
- **Card-Style Note Items:**
  - Note Title with bold hierarchy and active glow indicator.
  - 2-line clean preview snippet with stripped markdown formatting.
  - Relative formatted timestamp (*"Just now"*, *"2m ago"*, *"Yesterday"*).
  - Unsaved indicator badge with glowing pulse animation.
- **Sidebar Actions:**
  - Fast **"New Note"** button in header.
  - 3-dots hover action menu on note items for **Rename**, **Duplicate**, and **Delete**.
- **Collapsible Rails:** Sidebar collapses smoothly into an icon rail with quick buttons (New Note, Search, Storage, Settings) rather than an empty bar.

---

### 3. Tri-Mode Editor & Live Preview Engine
- **✍️ Mode 1: Edit Mode**
  - Full-featured writing environment with floating/sticky segmented formatting toolbar.
  - Centered 840px reading canvas with comfortable padding.
- **📑 Mode 2: Split View (Side-by-Side)**
  - Left column: Markdown editor with line numbers and syntax styling.
  - Right column: Real-time HTML rendered preview powered by `marked` and `DOMPurify` with 0ms lag.
  - Synchronized scroll behavior between editor and preview panes.
- **👁️ Mode 3: Reader / Full Preview Mode**
  - Distraction-free, read-only rendered view.
  - No blinking cursor or toolbar—perfect for reading, reviewing, and presentation.

---

### 4. Floating & Segmented Formatting Toolbar
- **Crisp SVG Vector Icons (replacing raw text buttons):**
  - **Text Styling:** Bold, Italic, Strikethrough, Inline Code
  - **Headings:** H1, H2, H3 segmented pill buttons
  - **Lists:** Bullet List, Numbered List, Task Checklist
  - **Inserts:** Blockquote, Code Block, Table, Link, Horizontal Divider
  - **History Controls:** Undo (`⌘Z`) and Redo (`⌘⇧Z`)
- **Live Save Pill:** Animated cloud syncing spinner with a green checkmark when saved.

---

### 5. Markdown Canvas & Typography Overhaul
- **Typography Pairing:**
  - UI & Prose: *Inter* (Google Fonts) with optimal line height (1.75) and letter spacing.
  - Code & Monospace: *JetBrains Mono* (Google Fonts) for code blocks and inline code.
- **Stylized Prose Elements:**
  - **Blockquotes:** Soft tinted card background with a colored left vertical border.
  - **Code Blocks:** macOS dark card wrapper with title bar, language badge, and 1-click **"Copy Code"** button.
  - **Tables:** Styled header rows, zebra striping, subtle borders, and rounded corners.
  - **Task Lists:** Interactive clickable checkboxes with strike-through styling on complete.

---

### 6. Landing & Storage Onboarding Screen
- **Hero Header:** Bold headline *"Write in Markdown. Save Anywhere."* with gradient text badge.
- **Interactive Storage Cards:**
  - **Local Storage Card:** Glowing folder icon, *"Open Local Folder"* button, direct browser file system access.
  - **Google Drive Card:** Authentic Google Drive brand icon, *"Connect Google Drive"* button.
- **Quick-Start Starter Templates:** 1-Click chips for *Meeting Notes*, *Project Roadmap*, *Daily Journal*, and *Blank Note*.
- **Drag & Drop Dropzone:** Directly drop `.md` files onto the browser window to start editing instantly.
- **Bottom Feature Strip:** Highlights *0ms Latency*, *100% Client-Side Privacy*, *Multi-Cloud Sync*, and *Full GFM Support*.

---

### 7. Template Preview & Creation Modal
- Instant live preview of selected templates before creating the note.
- Custom naming with automatic `.md` extension safety validation.

---

### 8. Document Insights Status Bar (Footer)
- **Live Word Count** & **Character Count**
- **Estimated Reading Time** (*"2 min read"*)
- **Cursor Position** (*"Ln 12, Col 4"*)
- **Cloud Sync Status Indicator**

---

## 📂 Codebase File Modification Plan

| File | Purpose & Changes |
| :--- | :--- |
| [index.html](file:///Users/pranjaldiwedi/Documents/coding/WebMdEditor/index.html) | Import Google Fonts (*Inter* + *JetBrains Mono*), update meta tags. |
| [src/index.css](file:///Users/pranjaldiwedi/Documents/coding/WebMdEditor/src/index.css) | Global reset, typography tokens, scrollbar styling. |
| [src/App.css](file:///Users/pranjaldiwedi/Documents/coding/WebMdEditor/src/App.css) | Complete design token overhaul, dark/light themes, glassmorphism, 3-mode split layout, card styles, toolbar pill clusters, code block cards. |
| [src/layout/MainLayout.tsx](file:///Users/pranjaldiwedi/Documents/coding/WebMdEditor/src/layout/MainLayout.tsx) | Fix nested `<header>`, implement collapsible icon rail, handle split-view layouts. |
| [src/editor/EditorToolbar.tsx](file:///Users/pranjaldiwedi/Documents/coding/WebMdEditor/src/editor/EditorToolbar.tsx) | Replace text buttons with clean SVG vector icons, add Undo/Redo, pill groupings. |
| [src/editor/TipTapEditor.tsx](file:///Users/pranjaldiwedi/Documents/coding/WebMdEditor/src/editor/TipTapEditor.tsx) | Integrate 3 view modes (Edit / Split / Preview), live `marked` HTML preview pane, and bottom document stats bar. |
| [src/files/FileBrowser.tsx](file:///Users/pranjaldiwedi/Documents/coding/WebMdEditor/src/files/FileBrowser.tsx) | Modern note cards with relative timestamps, `⌘K` search bar, and hover actions. |
| [src/storage/ProviderSelector.tsx](file:///Users/pranjaldiwedi/Documents/coding/WebMdEditor/src/storage/ProviderSelector.tsx) | Landing page overhaul with glassmorphism cards, drag & drop zone, and starter template chips. |
| [src/App.tsx](file:///Users/pranjaldiwedi/Documents/coding/WebMdEditor/src/App.tsx) | Top bar view mode switcher, instant theme toggle, template selector modal, and drag-to-open handlers. |

---

## 🛠️ Step-by-Step Execution Sequence

1. **Milestone 1: Foundations & Design Tokens**
   - Configure typography (*Inter* + *JetBrains Mono*) in `index.html`.
   - Rebuild `src/App.css` and `src/index.css` with dark/light themes, glassmorphism variables, and clean layout rules.
2. **Milestone 2: Navigation, Layout & Instant Theme Toggle**
   - Fix nested header tags in `MainLayout.tsx`.
   - Add the top bar brand badge, instant theme toggle, and collapsible sidebar icon rail.
3. **Milestone 3: Enhanced Sidebar & Note Cards**
   - Upgrade `FileBrowser.tsx` with `⌘K` search input, relative date formatting, active accent pill cards, and hover actions.
4. **Milestone 4: Modern Toolbar & SVG Icons**
   - Rewrite `EditorToolbar.tsx` with clean SVG icons, Undo/Redo controls, and segmented pill groups.
5. **Milestone 5: Tri-Mode Engine (Edit, Split, Preview) & Status Bar**
   - Implement Split View and Reader Preview in `TipTapEditor.tsx` using `marked` and `DOMPurify`.
   - Add the bottom status bar with word count, character count, and reading time.
6. **Milestone 6: Landing Page, Dropzone & Template Modal**
   - Overhaul `ProviderSelector.tsx` into an interactive hero onboarding screen.
   - Implement Drag & Drop file opening and Template Preview on New Note.
7. **Milestone 7: Verification & Build Validation**
   - Run type checks (`tsc --noEmit`), linter (`npm run lint`), and production build test (`npm run build`).
