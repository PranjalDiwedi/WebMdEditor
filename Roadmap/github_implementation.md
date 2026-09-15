# GitHub Storage Provider — Implementation Plan & Specification (v3)

**Target:** Zero-Friction 1-Click GitHub Storage Provider with Interactive Repository Picker & Seamless In-Memory Auth  
**Stack:** React 19, TypeScript, GitHub REST API v3 / Git Trees API, TipTap Markdown Editor, Vanilla CSS  

---

## 🎯 Core Architectural Principles

1. **1-Click OAuth Verification & Fallback Token Option**
   - Direct 1-Click popup verification (like Google Drive GIS).
   - If configured with `VITE_GITHUB_CLIENT_ID`, opens the GitHub OAuth popup (`https://github.com/login/oauth/authorize`).
   - On approval, the popup passes the authenticated session to Mandrak via `postMessage`.
   - Direct token fallback with immediate active validation and 1-click token generator shortcut.

2. **Visual Interactive Repository Picker (`GitHubRepoPicker.tsx`)**
   - Automatically queries `GET /user/repos?sort=updated&per_page=100` to list all personal and organization repositories.
   - Live search/filtering by repo name and organization.
   - Filter tabs: `All`, `Public`, `Private`.
   - Shows owner avatar, repo name, 🔒 Private / 🌐 Public badge, stars, and relative updated time.
   - Interactive branch selector (defaults to repository default branch `main`/`master`).
   - 1-click selection with zero repository name typing.

3. **In-Memory Session Security**
   - Tokens and session credentials exist solely in volatile browser memory inside `GitHubProvider`.
   - Disconnecting or closing the tab immediately wipes all credentials.

4. **Prompt-on-Save Commit Message Workflow**
   - Every manual save (`⌘S` / `Ctrl+S` or toolbar Save button) opens `CommitModal.tsx`.
   - Allows optional custom commit message, or defaults to `Update <filename> via Mandrak` on `Enter`.

5. **Fast 1-Query Tree Exploration & Concurrency Safety**
   - Uses Git Trees API (`GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1`) to load markdown files across all subdirectories in a single request.
   - Tracks blob SHAs to prevent overwrite conflicts (`409 Conflict`).

---

## 🧩 File Architecture

```
src/
├── config/
│   └── constants.ts                   # GitHub OAuth client configurations
├── storage/
│   ├── StorageProvider.ts             # Abstract provider with commit message support
│   ├── GitHubProvider.ts              # GitHub REST API, repository list & Git Trees engine
│   ├── GitHubConnectModal.tsx         # 1-click OAuth popup & token verification dialog
│   ├── GitHubRepoPicker.tsx           # Visual interactive repository selection modal
│   └── ProviderSelector.tsx           # Landing page cards & compact header indicator
├── components/
│   ├── GitHubIcon.tsx                 # Crisp SVG GitHub icon
│   └── CommitModal.tsx                # Commit message prompt dialog on save
├── files/
│   └── useFileManagement.ts           # Workspace isolation & file operations with commit messages
└── App.tsx                            # Flow orchestration & OAuth popup postMessage listener
```
