# Network Graph View & Knowledge Architecture Plan (v1.2)

**Version:** 1.2.0  
**Target:** Interactive 2D Network Graph with Betweenness Centrality, 2-Way Obsidian Interoperability, Interactive Linking & Topology Editing  
**Stack:** React 19, TypeScript, `d3-force` (BSD-3-Clause), HTML5 Canvas 2D, Vanilla CSS (Design Tokens)  
**License:** 100% Free & MIT / Permissive Open Source (Zero commercial lock-in, Zero paid dependencies)

---

## 🎯 Architectural Goals & Vision

1. **Transform Mandrak into a Second Brain**: Move beyond linear folder trees into an associative knowledge network where ideas connect bidirectionally.
2. **Structural Graph Analytics (Betweenness Centrality)**:
   - Identify "Bridge Notes" and "Maps of Content" (MOCs) that bridge disparate clusters of thought using Brandes' algorithm.
   - Distinguish high-degree silo notes from true interdisciplinary connectors.
3. **100% Obsidian & Markdown Interoperability**:
   - Two-way compatibility with standard Wikilinks (`[[Note Name]]`, `[[Note|Alias]]`, `[[Folder/Note]]`), standard Markdown links `[text](file.md)`, and `#hashtags`.
   - Open any Obsidian vault folder directly in Mandrak to see the exact connection topology, and vice versa.
4. **Interactive Topology Editing (Canvas-to-File Synchronization)**:
   - Visually create Wikilinks by dragging between nodes (`Shift + Drag`).
   - Visually sever connections (`Click Edge ➔ 🗑️ Remove Link`) with instant markdown synchronization.
5. **Desktop-Grade Performance & Aesthetics**:
   - 60 FPS HTML5 Canvas engine handling thousands of nodes and links with Retina high-DPI scaling.
   - Dynamic viewport auto-centering with centroid-aware bounds fitting.
   - Zero-jitter rendering: Hovering and selecting nodes never triggers unwanted physics repulsion.

---

## 🧩 Comprehensive Feature Specifications

### 1. Link & Metadata Parsing Engine (`src/graph/graphParser.ts`)
- **Wikilink Extraction:**
  - `[[Note Name]]` $\rightarrow$ resolves to `Note Name.md`
  - `[[Note Name|Custom Display Text]]` $\rightarrow$ extracts target and display alias
  - `[[Folder/Subfolder/Note Name]]` $\rightarrow$ resolves relative and absolute folder paths
  - `[[Note Name#Header Section]]` $\rightarrow$ strips header anchor and targets file
- **Standard Markdown Link Extraction:**
  - `[Anchor Text](filename.md)` and `[Anchor Text](./path/to/file.md)`
- **Hashtag & Frontmatter Extraction:**
  - Inline `#tags` (e.g. `#architecture`, `#todo`, `#react/state`)
  - YAML Frontmatter `tags: [tag1, tag2]` or list syntax
- **Ghost Note Detection:**
  - Identifies links pointing to notes that don't yet exist in the vault.
  - Rendered with dashed boundaries; double-clicking opens 1-click note creation draft.
- **Inline Wikilink Autocomplete Dropdown (`[[` Trigger):**
  - Typing `[[` anywhere in the editor opens an instant, floating autocomplete suggestion popup at the cursor.
  - Filters vault notes in real time (< 0.2ms) with full keyboard navigation (`↑`, `↓`, `Enter`, `Tab`, `Esc`).
  - Supports quick creation of ghost note references if the target note is not yet created.
- **In-Place Position Persistence:**
  - Node coordinates $(x, y, vx, vy, fx, fy)$ are preserved across file edits, tab switches, and vault updates so layout geometry never explodes or rearranges violently.
- **Bidirectional Note Content Modifiers:**
  - `addWikilinkToContent(content, targetNote)`: Smartly appends `[[Target]]` under existing `## Related Notes` / `## Links` sections or at file end.
  - `removeWikilinkFromContent(content, targetNote)`: Cleanly strips inline wikilinks, bulleted links (`- [[Target]]`), or markdown links, and cleans up empty sections.

---

### 2. Graph Algorithms & Centrality Engine (`src/graph/centrality.ts`)
- **Brandes' Algorithm for Betweenness Centrality:**
  - Computes exact betweenness scores for all nodes in $O(V \cdot E)$ time ($<10\text{ms}$ for thousands of notes).
  - Normalizes scores to $[0.0, 1.0]$ for dynamic sizing and visual rank badges.
- **Degree Centrality:**
  - In-Degree (Backlinks count — how many notes reference this file).
  - Out-Degree (Citations count — how many notes this file references).
- **Ego-Graph / Local Neighborhood Filter:**
  - Extracts 1-hop, 2-hop, or 3-hop subgraphs centered on the currently active note.

---

### 3. High-Performance Canvas Renderer (`src/graph/NetworkCanvas.tsx`)
- **HTML5 Canvas 2D Engine:**
  - Retina / High-DPI support (`devicePixelRatio`).
  - Pre-paint synchronous layout measurement (`useLayoutEffect`) and `ResizeObserver` tracking.
  - Centroid-aware center calculations (`getGraphCentroid`) ensuring the graph starts exactly in the center of the viewport $(W / 2, H / 2)$.
- **Smooth Mouse & Trackpad Navigation:**
  - Canvas Pan: Click and drag empty space.
  - Canvas Zoom: Mouse wheel and trackpad pinch centered at cursor.
  - Center-anchored floating zoom buttons (`+`, `−`, and `🎯 Fit & Recenter View`).
- **Interactive Shift + Drag Wikilink Creator:**
  - Hold `Shift` and drag from any note to another to display an elastic laser cord with target snap ring and confirmation badge.
  - Releasing over the target automatically writes the Wikilink into the markdown file.
- **Interactive Edge Selection & Deletion:**
  - Clicking any edge highlights it in rose glow and opens an interactive card to delete/unlink the connection.
- **Node Selection & Hover Highlighting:**
  - Single click selects/deselects a node and illuminates its immediate 1-hop neighborhood.
  - Clicking empty space or re-clicking the node deselects it.
  - Double-click navigates to the note in the editor (or creates a draft for ghost notes).
- **Visual Node Encodings:**
  - **Size By:** Betweenness Centrality (Bridge Notes), In-Degree (Backlink Popularity), File Size, or Uniform.
  - **Color By:** Folder hierarchy, Primary `#tag`, or Centrality Heatmap.
  - **Halo & Glow Effects:** Glowing accent rings around active note, selected note, and top bridge notes.
- **Visual Edge Encodings:**
  - Solid directional links for explicit Wikilinks / Markdown links.
  - Subtle directional arrows indicating citation direction.
  - Dashed lines for shared tag connections.
  - Focus dimming: Dim unselected nodes and edges to 15% opacity when searching or selecting.

---

### 4. Interactive Overlay & Controls Drawer (`src/graph/NetworkControls.tsx` & `src/graph/NetworkView.tsx`)
- **Search & Highlight Bar:** Instant search highlighting matching node names and tags.
- **Dynamic Action Feedback Toast:** Floating pill banner displaying instant confirmations (e.g. *"✨ Linked Note A ➔ Note B"* or *"🗑️ Unlinked Note A ➔ Note B"*).
- **Filter Controls:**
  - **Orphan Filter:** Isolate notes with 0 connections (unlinked thoughts).
  - **Ghost Notes Toggle:** Show/hide uncreated referenced notes.
  - **Tag Connections Toggle:** Render shared `#tag` links.
  - **Folder & Tag Multi-Select Filters:** Restrict graph to specific folders or tags.
  - **Local Graph Mode:** Toggle ego-graph centered on active file with depth slider ($D=1, 2, 3$).
- **Physics Sliders:** Real-time controls for Node Repulsion (Charge), Link Distance, and Collision Radius.
- **Rich Frosted-Glass Node Preview Card (Tooltip):**
  - Note Title & Icon (`📄` or `👻`)
  - Folder path with truncation/ellipsis to prevent overflow
  - Centrality score & *"Bridge Note"* badge
  - In-degree (Backlinks) and Out-degree (Citations)
  - Tag chips & markdown text preview snippet
  - Interaction hint footer

---

### 5. View Mode Switcher Integration (`src/App.tsx`)
- Top bar view switcher pill:
  ```text
  [ ✍️ Edit | 📑 Split | 👁️ Preview | 🕸️ Network ]
  ```
- Accessible via global shortcut `⌘4` / `Ctrl+4`.
- Zero-layout-shift transition: Switching between Editor and Network View maintains file tabs and state without jarring loading flickers or canvas thrashing.

---

## 📂 Architecture & File Organization

```
src/
├── types/
│   └── graph.ts              # Data contracts: GraphNode, GraphEdge, GraphData, FilterOptions, PhysicsConfig
├── graph/
│   ├── graphParser.ts        # Wikilink/Markdown link/Tag extraction, position caching, add/remove link mutations
│   ├── centrality.ts         # Brandes' betweenness centrality algorithm & ego-subgraph extractor
│   ├── NetworkCanvas.tsx     # High-DPI Canvas 2D engine, useLayoutEffect centering, Shift+drag linking, d3-force
│   ├── NetworkView.tsx       # Main view orchestration, content signatures, edge unlinking card, tooltips
│   └── NetworkControls.tsx   # Glassmorphic floating drawer for filters, physics tuning, and vault statistics
├── editor/
│   └── TipTapEditor.tsx      # ViewMode type definitions ('edit' | 'split' | 'preview' | 'network')
├── App.tsx                   # Main workspace layout, top bar switcher, keyboard shortcuts
└── App.css                   # Glassmorphism tokens, canvas styling, zoom controls, tooltips, action cards
```

---

## 🚀 Key Milestones Completed

- [x] **v1.0 - Core Network Graph & Centrality**: High-DPI canvas renderer with Brandes' Betweenness Centrality, Wikilink parser, and `d3-force` physics.
- [x] **v1.1 - Interactive Topology Editing**: Shift + Drag interactive Wikilink connection laser beam and Click-to-Unlink edge deletion card.
- [x] **v1.2 - Stability & Viewport Polish**:
  - Pre-paint viewport sizing (`useLayoutEffect`) and dynamic centroid auto-centering.
  - Fixed HTML5 canvas `300x150` startup offset defect.
  - Separation of rendering and simulation loops to eliminate hover jitter.
  - Content-aware `filesSignature` preventing canvas resets on note switching.
  - Floating zoom controls with center-anchored zooming and smart auto-fit (`🎯`).
