import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { MarkdownFile } from '../types/file';

export interface CommandAction {
  id: string;
  title: string;
  subtitle?: string;
  category: 'action' | 'navigation' | 'snippet' | 'theme';
  icon: string;
  shortcut?: string;
  keywords?: string[];
  run: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  files: MarkdownFile[];
  currentFileId?: string;
  onOpenFile: (file: MarkdownFile) => void;
  onNewNote: () => void;
  onToggleTheme: () => void;
  isDarkMode: boolean;
  onToggleZenMode: () => void;
  isZenMode: boolean;
  onCycleViewMode: () => void;
  currentViewMode: string;
  onCopyRichText: () => void;
  onTriggerAI: () => void;
  onOpenStorageSelector: () => void;
  onInsertCodeSnippet?: (snippetText: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  files,
  currentFileId,
  onOpenFile,
  onNewNote,
  onToggleTheme,
  isDarkMode,
  onToggleZenMode,
  isZenMode,
  onCycleViewMode,
  currentViewMode,
  onCopyRichText,
  onTriggerAI,
  onOpenStorageSelector,
  onInsertCodeSnippet,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input automatically when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Code snippets registry
  const codeSnippets = useMemo(
    () => [
      {
        id: 'snippet-ts-fn',
        title: 'TypeScript Async Function',
        subtitle: 'Async function with typed params, return type and try-catch',
        snippet: '```typescript\nexport async function fetchData<T>(url: string): Promise<T> {\n  try {\n    const res = await fetch(url);\n    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);\n    return (await res.json()) as T;\n  } catch (error) {\n    console.error("Fetch failed:", error);\n    throw error;\n  }\n}\n```\n',
      },
      {
        id: 'snippet-react-comp',
        title: 'React Functional Component',
        subtitle: 'TypeScript React component with props interface',
        snippet: '```tsx\nimport React from \'react\';\n\ninterface MyComponentProps {\n  title: string;\n  isActive?: boolean;\n}\n\nexport const MyComponent: React.FC<MyComponentProps> = ({\n  title,\n  isActive = false,\n}) => {\n  return (\n    <div className={`my-component ${isActive ? \'active\' : \'\'}`}>\n      <h3>{title}</h3>\n    </div>\n  );\n};\n```\n',
      },
      {
        id: 'snippet-sql-table',
        title: 'SQL Table Schema',
        subtitle: 'CREATE TABLE with primary key, timestamps, and indexes',
        snippet: '```sql\nCREATE TABLE IF NOT EXISTS users (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  email VARCHAR(255) UNIQUE NOT NULL,\n  full_name VARCHAR(100) NOT NULL,\n  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,\n  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP\n);\n\nCREATE INDEX idx_users_email ON users(email);\n```\n',
      },
      {
        id: 'snippet-python-script',
        title: 'Python CLI Script Boilerplate',
        subtitle: 'Main block, argparse arguments, and error handling',
        snippet: '```python\nimport sys\nimport argparse\n\ndef main():\n    parser = argparse.ArgumentParser(description="Mandrak CLI Helper")\n    parser.add_argument("--input", "-i", type=str, help="Input file path", required=True)\n    args = parser.parse_args()\n    \n    print(f"Processing: {args.input}")\n\nif __name__ == "__main__":\n    main()\n```\n',
      },
      {
        id: 'snippet-gfm-table',
        title: 'Markdown Pipe Table',
        subtitle: 'Formatted 3-column table boilerplate',
        snippet: '| Feature | Status | Shortcut |\n| :--- | :---: | :--- |\n| **Command Palette** | Ready | `⌘K` |\n| **Smart Paste** | Ready | `⌘V` |\n| **Zen Mode** | Ready | `⌘⇧F` |\n',
      },
    ],
    []
  );

  // All available action commands
  const actionCommands: CommandAction[] = useMemo(() => {
    const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    const mod = isMac ? '⌘' : 'Ctrl+';
    const shift = isMac ? '⇧' : 'Shift+';

    const actions: CommandAction[] = [
      {
        id: 'action-new-note',
        title: 'New Note',
        subtitle: 'Create a new markdown note',
        category: 'action',
        icon: '📝',
        shortcut: `${mod}N`,
        keywords: ['create', 'new', 'add', 'file', 'document'],
        run: () => {
          onClose();
          onNewNote();
        },
      },
      {
        id: 'action-toggle-theme',
        title: `Switch to ${isDarkMode ? 'Light' : 'Dark'} Theme`,
        subtitle: `Currently in ${isDarkMode ? 'Dark' : 'Light'} mode`,
        category: 'theme',
        icon: isDarkMode ? '☀️' : '🌙',
        shortcut: `${mod}T`,
        keywords: ['theme', 'dark', 'light', 'mode', 'color', 'sun', 'moon'],
        run: () => {
          onClose();
          onToggleTheme();
        },
      },
      {
        id: 'action-toggle-zen',
        title: isZenMode ? 'Exit Focus / Zen Mode' : 'Enter Focus / Zen Mode',
        subtitle: 'Distraction-free, full-screen writing canvas',
        category: 'action',
        icon: '🧘',
        shortcut: `${mod}${shift}F`,
        keywords: ['zen', 'focus', 'distraction', 'fullscreen', 'hide'],
        run: () => {
          onClose();
          onToggleZenMode();
        },
      },
      {
        id: 'action-cycle-view',
        title: 'Cycle View Mode',
        subtitle: `Current: ${currentViewMode.toUpperCase()} (Edit ➔ Split ➔ Preview ➔ Network)`,
        category: 'action',
        icon: '📑',
        shortcut: `${mod}P`,
        keywords: ['view', 'split', 'preview', 'edit', 'network', 'cycle', 'layout'],
        run: () => {
          onClose();
          onCycleViewMode();
        },
      },
      {
        id: 'action-copy-rich',
        title: 'Copy Note as Rich Text',
        subtitle: 'Copy formatted HTML to clipboard for Gmail, Slack, Docs',
        category: 'action',
        icon: '📋',
        shortcut: `${mod}${shift}C`,
        keywords: ['copy', 'rich', 'text', 'html', 'slack', 'gmail', 'docs', 'export'],
        run: () => {
          onClose();
          onCopyRichText();
        },
      },
      {
        id: 'action-trigger-ai',
        title: 'AI Assistant',
        subtitle: 'Generate, summarize, or refine text with AI',
        category: 'action',
        icon: '✨',
        shortcut: `${mod}J`,
        keywords: ['ai', 'assistant', 'prompt', 'gemini', 'gpt', 'generate', 'summarize'],
        run: () => {
          onClose();
          onTriggerAI();
        },
      },
      {
        id: 'action-switch-storage',
        title: 'Switch Storage Provider',
        subtitle: 'Connect Google Drive, Dropbox, OneDrive, or Local Folder',
        category: 'navigation',
        icon: '☁️',
        keywords: ['storage', 'provider', 'google', 'drive', 'dropbox', 'onedrive', 'local', 'folder', 'github'],
        run: () => {
          onClose();
          onOpenStorageSelector();
        },
      },
    ];

    // Add Code Snippets
    if (onInsertCodeSnippet) {
      codeSnippets.forEach((s) => {
        actions.push({
          id: s.id,
          title: `Insert: ${s.title}`,
          subtitle: s.subtitle,
          category: 'snippet',
          icon: '💻',
          keywords: ['snippet', 'code', 'template', s.title.toLowerCase()],
          run: () => {
            onClose();
            onInsertCodeSnippet(s.snippet);
          },
        });
      });
    }

    return actions;
  }, [
    isDarkMode,
    isZenMode,
    currentViewMode,
    onClose,
    onNewNote,
    onToggleTheme,
    onToggleZenMode,
    onCycleViewMode,
    onCopyRichText,
    onTriggerAI,
    onOpenStorageSelector,
    onInsertCodeSnippet,
    codeSnippets,
  ]);

  // Fuzzy search filter for files and actions
  const results = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    // Mode 1: If query starts with '>', only show action commands
    if (cleanQuery.startsWith('>')) {
      const commandQuery = cleanQuery.substring(1).trim();
      if (!commandQuery) return actionCommands;
      return actionCommands.filter(
        (cmd) =>
          cmd.title.toLowerCase().includes(commandQuery) ||
          (cmd.subtitle && cmd.subtitle.toLowerCase().includes(commandQuery)) ||
          cmd.keywords?.some((k) => k.includes(commandQuery))
      );
    }

    // Mode 2: Empty query - show recent/all notes first, then common actions
    if (!cleanQuery) {
      const fileItems = files
        .filter((f) => f.id !== currentFileId)
        .slice(0, 6)
        .map((f) => ({
          id: `file-${f.id}`,
          title: f.name.replace(/\.md$/i, ''),
          subtitle: f.path || 'Note',
          category: 'file' as const,
          icon: '📄',
          file: f,
          run: () => {
            onClose();
            onOpenFile(f);
          },
        }));

      return [...fileItems, ...actionCommands.slice(0, 4)];
    }

    // Mode 3: Search matching notes
    const matchedFiles = files
      .filter((f) => {
        const name = f.name.replace(/\.md$/i, '').toLowerCase();
        const path = (f.path || '').toLowerCase();
        return name.includes(cleanQuery) || path.includes(cleanQuery);
      })
      .slice(0, 8)
      .map((f) => ({
        id: `file-${f.id}`,
        title: f.name.replace(/\.md$/i, ''),
        subtitle: f.path || 'Note',
        category: 'file' as const,
        icon: '📄',
        file: f,
        run: () => {
          onClose();
          onOpenFile(f);
        },
      }));

    // Search matching actions
    const matchedActions = actionCommands.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(cleanQuery) ||
        (cmd.subtitle && cmd.subtitle.toLowerCase().includes(cleanQuery)) ||
        cmd.keywords?.some((k) => k.includes(cleanQuery))
    );

    return [...matchedFiles, ...matchedActions];
  }, [query, files, currentFileId, actionCommands, onClose, onOpenFile]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('.palette-item.active') as HTMLElement | null;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (results.length ? (prev + 1) % results.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (results.length ? (prev - 1 + results.length) % results.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[selectedIndex]) {
          results[selectedIndex].run();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [results, selectedIndex, onClose]
  );

  if (!isOpen) return null;

  return (
    <div className="command-palette-backdrop" onClick={onClose}>
      <div
        className="command-palette-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="command-palette-header">
          <span className="palette-search-icon">🔍</span>
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder="Search notes or type > for commands..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="palette-esc-badge" onClick={onClose}>ESC</kbd>
        </div>

        <div className="command-palette-body" ref={listRef}>
          {results.length === 0 ? (
            <div className="palette-empty-state">
              <p>No matching notes or commands found.</p>
              <span>Try typing <code>&gt;</code> to browse all available actions</span>
            </div>
          ) : (
            <div className="palette-results-list">
              {results.map((item, idx) => {
                const isActive = idx === selectedIndex;
                const isFile = 'file' in item;
                return (
                  <div
                    key={item.id}
                    className={`palette-item ${isActive ? 'active' : ''} type-${item.category}`}
                    onClick={() => item.run()}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <span className="palette-item-icon">{item.icon}</span>
                    <div className="palette-item-info">
                      <div className="palette-item-title">{item.title}</div>
                      {item.subtitle && (
                        <div className="palette-item-subtitle">{item.subtitle}</div>
                      )}
                    </div>
                    {isFile ? (
                      <span className="palette-item-badge">Note</span>
                    ) : (
                      'shortcut' in item && item.shortcut && (
                        <kbd className="palette-item-shortcut">{item.shortcut}</kbd>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <footer className="command-palette-footer">
          <div className="palette-hints">
            <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
            <span><kbd>↵</kbd> Select</span>
            <span><kbd>&gt;</kbd> Commands</span>
            <span><kbd>ESC</kbd> Dismiss</span>
          </div>
          <span className="palette-brand-tag">✦ Mandrak Spotlight</span>
        </footer>
      </div>
    </div>
  );
};
