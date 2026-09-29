# Mandrak — Bring-Your-Own-Key (BYOK) LLM Integration Plan

**Target:** Fast, 100% Client-Side AI Assistance with Ephemeral In-Memory Key Management  
**Stack:** Pure `fetch` SSE streaming, React 19, TipTap Integration, Zero Bundled Heavy SDKs  
**Status:** ✅ Completed (with Document Editor + Knowledge Graph AI Modes)  

---

## 1. 🛡️ Security Philosophy: Ephemeral In-Memory Storage

Mandrak follows a strict privacy-first, zero-trust model for third-party LLM keys (OpenAI, Gemini, Anthropic, Groq):

1. **In-Memory by Default**:
   - API keys are stored solely in React runtime state / memory references.
   - Keys are **never persisted to disk**, `localStorage`, or external servers.
   - Closing the browser tab or reloading immediately wipes keys from RAM with zero trace.
2. **Optional Tab-Session Storage**:
   - Users can choose *"Remember for this tab"* using `sessionStorage`.
   - Survives accidental `F5` / page reloads within the same tab, but is permanently purged when the tab is closed.
3. **Localhost Ollama Support**:
   - Native support for local Ollama instances (`http://localhost:11434`) for 100% offline, private, keyless AI.

---

## 2. 🔄 Refresh Protection & Guard

### Browser `beforeunload` Guard
To prevent accidental loss of in-memory keys while writing, Mandrak attaches a safety guard when an AI session is active.

### In-App Visual Status
- Top bar displays a 34×34px action button with a green `🟢` status dot when connected.
- Smart 2-step trigger:
  - When disconnected: Opens `AIConnectModal` directly.
  - When connected: Opens `AIInlineToolbar` palette (`⌘J`).

---

## 3. ⚡ Zero-SDK Architecture & Models

Supported Providers & Default Models:
- **Google Gemini**: `gemini-3.8-flash` (Recommended), `gemini-3.8-pro`, `gemini-2.5-flash`, `gemini-1.5-flash`, plus custom model ID support with automatic model upgrade.
- **Groq**: `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `mixtral-8x7b-32768`.
- **OpenAI**: `gpt-4o-mini`, `gpt-4o`.
- **Anthropic Claude**: `claude-3-5-haiku-20241022`, `claude-3-5-sonnet-20241022`.
- **Ollama (Local)**: `llama3.2`, `mistral`, `qwen2.5`, or custom local models.

---

## 4. ✍️ Context-Aware AI Modes

### A. Document Editor Mode (`viewMode !== 'network'`)
- Trigger: `⌘J` / `Ctrl+J` anywhere or selecting text in the editor.
- **⚡ Fix Grammar & Flow**: Polish text and formatting.
- **📋 Summarize into Bullets**: Extract core takeaways.
- **📊 Convert to Markdown Table**: Turn lists/data into clean GFM tables.
- **📝 Continue Writing**: Seamlessly continue from previous thoughts.
- **💡 Simplify & Clarify**: Make complex ideas easy to read.
- **✅ Extract Action Items**: Generate markdown task checklists (`- [ ]`).
- Output Action: **`✓ Accept & Insert (Tab)`** directly into TipTap canvas or **`📋 Copy`**.

### B. Knowledge Graph Mode (`viewMode === 'network'`)
- Trigger: `⌘J` or clicking the top-bar AI button while viewing the network graph.
- Automatically compiles topological vault context (note titles, folders, existing `[[wiki-links]]`, and tags).
- **🕸️ Find Missing Links**: Recommends bidirectional `[[wiki-links]]` between conceptually related notes.
- **🧠 Synthesize Clusters**: Summarizes the major overarching themes and central hubs across the vault.
- **💡 Brainstorm Gaps**: Identifies blind spots and suggests 4-6 specific new note ideas to research.
- **📑 Generate MOC (Index)**: Drafts a comprehensive Map of Content index note.
- **Output Actions**: **`✨ Create Note`** (auto-creates a note in the vault and opens it) or **`📋 Copy Output`**.
