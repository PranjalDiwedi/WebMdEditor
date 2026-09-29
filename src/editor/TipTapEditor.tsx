import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { EditorContent, type Editor } from '@tiptap/react';
import { useEditor, type WikilinkQueryState } from './useEditor';
import { EditorToolbar } from './EditorToolbar';
import { sanitizeMarkdown } from '../utils/htmlSanitizer';
import { WikilinkAutocomplete } from './WikilinkAutocomplete';
import { useAI } from '../ai/useAI';
import { renderMermaidDiagrams, renderMathEquations } from '../preview/lazyEngines';
import type { MarkdownFile } from '../types/file';

export type ViewMode = 'edit' | 'split' | 'preview' | 'network';

interface TipTapEditorProps {
  content: string;
  onContentChange: (content: string) => void;
  onSave?: () => void;
  onInit?: (initialMarkdown: string) => void;
  onEditorReady?: (editor: Editor) => void;
  isDirty?: boolean;
  isSaving?: boolean;
  viewMode?: ViewMode;
  vaultFiles?: MarkdownFile[];
  currentFileId?: string;
  onOpenFileByName?: (name: string) => void;
}

export function TipTapEditor({
  content,
  onContentChange,
  onSave,
  onInit,
  onEditorReady,
  isDirty = false,
  isSaving = false,
  viewMode = 'edit',
  vaultFiles = [],
  currentFileId,
  onOpenFileByName,
}: TipTapEditorProps) {
  const editorRef = useRef<any>(null);
  const [wikilinkQuery, setWikilinkQuery] = useState<WikilinkQueryState | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Parse relation prefix and note query from wikilink query (e.g. "depends_on:React" -> prefix: "depends_on", note: "React")
  const { relationPrefix, noteQuery } = useMemo(() => {
    if (!wikilinkQuery) return { relationPrefix: '', noteQuery: '' };
    const raw = wikilinkQuery.query;
    const colonIdx = raw.indexOf(':');
    if (colonIdx !== -1) {
      return {
        relationPrefix: raw.substring(0, colonIdx).trim(),
        noteQuery: raw.substring(colonIdx + 1).trim(),
      };
    }
    return { relationPrefix: '', noteQuery: raw.trim() };
  }, [wikilinkQuery]);

  // Filter matching files in vault based on noteQuery
  const matchingFiles = useMemo(() => {
    if (!wikilinkQuery || !wikilinkQuery.isOpen) return [];
    const q = noteQuery.toLowerCase();
    return vaultFiles
      .filter((f) => f.id !== currentFileId)
      .filter((f) => {
        if (!q) return true;
        const cleanName = f.name.replace(/\.md$/i, '').toLowerCase();
        const path = (f.path || '').toLowerCase();
        return cleanName.includes(q) || path.includes(q);
      })
      .slice(0, 8); // Top 8 results for ultra-fast rendering
  }, [wikilinkQuery, noteQuery, vaultFiles, currentFileId]);

  const hasExactMatch = useMemo(() => {
    if (!wikilinkQuery) return false;
    const q = noteQuery.toLowerCase();
    return matchingFiles.some(
      (f) => f.name.replace(/\.md$/i, '').toLowerCase() === q
    );
  }, [wikilinkQuery, noteQuery, matchingFiles]);

  const totalOptions = matchingFiles.length + (noteQuery && !hasExactMatch ? 1 : 0);

  const handleWikilinkQueryChange = useCallback((state: WikilinkQueryState | null) => {
    setWikilinkQuery(state);
    setSelectedIndex(0);
  }, []);

  const handleInsertWikilink = useCallback(
    (targetName: string, editorInstance?: any) => {
      const ed = editorInstance || editorRef.current;
      if (!wikilinkQuery || !ed) return;
      const clean = targetName.replace(/\.md$/i, '').trim();
      const insertText = relationPrefix
        ? `[[${relationPrefix}:${clean}]] `
        : `[[${clean}]] `;

      ed.chain()
        .focus()
        .insertContentAt(
          { from: wikilinkQuery.range.from, to: wikilinkQuery.range.to },
          insertText
        )
        .run();

      setWikilinkQuery(null);
    },
    [wikilinkQuery, relationPrefix]
  );

  const handleSelectRelationPrefix = useCallback(
    (prefix: string) => {
      const ed = editorRef.current;
      if (!wikilinkQuery || !ed) return;
      const targetQuery = noteQuery ? `${prefix}:${noteQuery}` : `${prefix}:`;
      const insertText = `[[${targetQuery}`;
      ed.chain()
        .focus()
        .insertContentAt(
          { from: wikilinkQuery.range.from, to: wikilinkQuery.range.to },
          insertText
        )
        .run();
    },
    [wikilinkQuery, noteQuery]
  );

  const handleKeyDownInterceptor = useCallback(
    (event: KeyboardEvent) => {
      if (!wikilinkQuery || !wikilinkQuery.isOpen || totalOptions === 0) {
        return false;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % totalOptions);
        return true;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + totalOptions) % totalOptions);
        return true;
      }

      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        if (selectedIndex < matchingFiles.length) {
          handleInsertWikilink(matchingFiles[selectedIndex].name);
        } else if (noteQuery) {
          handleInsertWikilink(noteQuery);
        }
        return true;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        setWikilinkQuery(null);
        return true;
      }

      return false;
    },
    [wikilinkQuery, totalOptions, selectedIndex, matchingFiles, noteQuery, handleInsertWikilink]
  );

  const { setIsInlineMenuOpen } = useAI();

  const handleOpenAI = useCallback(() => {
    setIsInlineMenuOpen(true);
  }, [setIsInlineMenuOpen]);

  const editor = useEditor(
    content,
    onContentChange,
    onSave,
    onInit,
    handleWikilinkQueryChange,
    handleKeyDownInterceptor,
    handleOpenAI
  );
  editorRef.current = editor;

  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // Compute document statistics
  const stats = useMemo(() => {
    const trimmed = content.trim();
    const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
    const chars = content.length;
    const readingTime = Math.max(1, Math.ceil(words / 200));
    return { words, chars, readingTime };
  }, [content]);

  // Compute rendered HTML for preview and split modes
  const renderedHTML = useMemo(() => {
    if (viewMode === 'edit') return '';
    return sanitizeMarkdown(content);
  }, [content, viewMode]);

  // Handle clicking wikilinks & 1-click code copying in Preview Pane
  const handlePreviewClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // 1. Check if copy button was clicked
      const copyBtn = (e.target as HTMLElement).closest('.code-block-copy-btn') as HTMLElement | null;
      if (copyBtn) {
        e.preventDefault();
        e.stopPropagation();
        const encodedTarget = copyBtn.getAttribute('data-copy-target');
        const codeText = encodedTarget
          ? decodeURIComponent(encodedTarget)
          : copyBtn.closest('.code-block-card')?.querySelector('pre code')?.textContent || '';

        if (codeText) {
          navigator.clipboard.writeText(codeText).then(() => {
            copyBtn.classList.add('copied');
            const textSpan = copyBtn.querySelector('.copy-text');
            const iconSpan = copyBtn.querySelector('.copy-icon');
            if (textSpan) textSpan.textContent = 'Copied!';
            if (iconSpan) iconSpan.textContent = '✓';

            setTimeout(() => {
              copyBtn.classList.remove('copied');
              if (textSpan) textSpan.textContent = 'Copy';
              if (iconSpan) iconSpan.textContent = '📋';
            }, 2000);
          });
        }
        return;
      }

      // 2. Check if a wikilink preview was clicked
      const target = (e.target as HTMLElement).closest('.wikilink-preview') as HTMLElement | null;
      if (target && onOpenFileByName) {
        const targetNote = target.getAttribute('data-target');
        if (targetNote) {
          onOpenFileByName(targetNote);
        }
      }
    },
    [onOpenFileByName]
  );

  // Lazy render Mermaid diagrams and Math equations when preview HTML changes
  useEffect(() => {
    if (viewMode === 'edit' || !renderedHTML) return;

    const timer = setTimeout(() => {
      const previewEl = document.querySelector('.markdown-rendered') as HTMLElement | null;
      if (previewEl) {
        const isDark = document.body.classList.contains('dark-theme');
        renderMermaidDiagrams(previewEl, isDark);
        renderMathEquations(previewEl);
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [renderedHTML, viewMode]);

  if (!editor) {
    return <div className="loading-container"><div className="loading-spinner"></div><p>Loading editor...</p></div>;
  }

  return (
    <div className="workspace-container">
      {/* Show toolbar in edit and split modes */}
      {viewMode !== 'preview' && onSave && (
        <EditorToolbar
          editor={editor}
          onSave={onSave}
          isDirty={isDirty}
          isSaving={isSaving}
        />
      )}

      {/* Main Panes Wrapper based on active view mode */}
      <div className={`editor-panes-wrapper mode-${viewMode}`}>
        {/* Left / Main Editor Pane (rendered in edit & split modes) */}
        {viewMode !== 'preview' && (
          <div className="editor-pane" id="editor-scroll-pane" data-scroll-container="editor">
            <div className="tiptap-editor-shell">
              <EditorContent
                editor={editor}
                className="tiptap-editor-content"
              />
              {/* Floating Inline Wikilink Autocomplete Dropdown */}
              {wikilinkQuery && wikilinkQuery.isOpen && (
                <WikilinkAutocomplete
                  isOpen={wikilinkQuery.isOpen}
                  query={wikilinkQuery.query}
                  relationPrefix={relationPrefix}
                  noteQuery={noteQuery}
                  coords={wikilinkQuery.coords}
                  matchingFiles={matchingFiles}
                  selectedIndex={selectedIndex}
                  onSelectFile={(file) => handleInsertWikilink(file.name, editor)}
                  onCreateGhostLink={(name) => handleInsertWikilink(name, editor)}
                  onSelectRelationPrefix={handleSelectRelationPrefix}
                  onClose={() => setWikilinkQuery(null)}
                />
              )}
            </div>
          </div>
        )}

        {/* Right / Full Rendered Preview Pane (rendered in split & preview modes) */}
        {viewMode !== 'edit' && (
          <div className="preview-pane" id="preview-scroll-pane" data-scroll-container="preview">
            <div className="preview-document-container">
              <div
                className="markdown-rendered"
                onClick={handlePreviewClick}
                dangerouslySetInnerHTML={{ __html: renderedHTML || '<p class="empty-preview">Nothing to preview yet. Start typing to see your rendered markdown.</p>' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Document Insights Status Bar */}
      <footer className="editor-status-bar">
        <div className="status-bar-left">
          <span className="status-item">
            <strong>{stats.words.toLocaleString()}</strong> {stats.words === 1 ? 'word' : 'words'}
          </span>
          <span className="status-item">
            <strong>{stats.chars.toLocaleString()}</strong> characters
          </span>
          <span className="status-item">
            {stats.readingTime} min read
          </span>
        </div>

        <div className="status-bar-right">
          <span className="status-item">
            {isSaving ? (
              'Syncing...'
            ) : isDirty ? (
              <span style={{ color: 'var(--warning)' }}>● Unsaved changes</span>
            ) : (
              <span style={{ color: 'var(--success)' }}>✓ Saved</span>
            )}
          </span>
          <span className="status-item" style={{ textTransform: 'capitalize' }}>
            {viewMode} Mode
          </span>
        </div>
      </footer>
    </div>
  );
}

