import { useState, useMemo, useCallback } from 'react';
import { EditorContent } from '@tiptap/react';
import { useEditor, type WikilinkQueryState } from './useEditor';
import { EditorToolbar } from './EditorToolbar';
import { sanitizeMarkdown } from '../utils/htmlSanitizer';
import { WikilinkAutocomplete } from './WikilinkAutocomplete';
import type { MarkdownFile } from '../types/file';

export type ViewMode = 'edit' | 'split' | 'preview' | 'network';

interface TipTapEditorProps {
  content: string;
  onContentChange: (content: string) => void;
  onSave?: () => void;
  onInit?: (initialMarkdown: string) => void;
  isDirty?: boolean;
  isSaving?: boolean;
  viewMode?: ViewMode;
  vaultFiles?: MarkdownFile[];
  currentFileId?: string;
}

export function TipTapEditor({
  content,
  onContentChange,
  onSave,
  onInit,
  isDirty = false,
  isSaving = false,
  viewMode = 'edit',
  vaultFiles = [],
  currentFileId,
}: TipTapEditorProps) {
  const [wikilinkQuery, setWikilinkQuery] = useState<WikilinkQueryState | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filter matching files in vault based on typed wikilink query
  const matchingFiles = useMemo(() => {
    if (!wikilinkQuery || !wikilinkQuery.isOpen) return [];
    const q = wikilinkQuery.query.toLowerCase().trim();
    return vaultFiles
      .filter((f) => f.id !== currentFileId)
      .filter((f) => {
        if (!q) return true;
        const cleanName = f.name.replace(/\.md$/i, '').toLowerCase();
        const path = (f.path || '').toLowerCase();
        return cleanName.includes(q) || path.includes(q);
      })
      .slice(0, 8); // Top 8 results for ultra-fast rendering
  }, [wikilinkQuery, vaultFiles, currentFileId]);

  const hasExactMatch = useMemo(() => {
    if (!wikilinkQuery) return false;
    const q = wikilinkQuery.query.toLowerCase().trim();
    return matchingFiles.some(
      (f) => f.name.replace(/\.md$/i, '').toLowerCase() === q
    );
  }, [wikilinkQuery, matchingFiles]);

  const totalOptions = matchingFiles.length + (wikilinkQuery?.query.trim() && !hasExactMatch ? 1 : 0);

  const handleWikilinkQueryChange = useCallback((state: WikilinkQueryState | null) => {
    setWikilinkQuery(state);
    setSelectedIndex(0);
  }, []);

  const handleInsertWikilink = useCallback(
    (targetName: string, editorInstance: any) => {
      if (!wikilinkQuery || !editorInstance) return;
      const clean = targetName.replace(/\.md$/i, '').trim();
      const insertText = `[[${clean}]] `;

      editorInstance
        .chain()
        .focus()
        .insertContentAt(
          { from: wikilinkQuery.range.from, to: wikilinkQuery.range.to },
          insertText
        )
        .run();

      setWikilinkQuery(null);
    },
    [wikilinkQuery]
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
          handleInsertWikilink(matchingFiles[selectedIndex].name, editor);
        } else if (wikilinkQuery.query.trim()) {
          handleInsertWikilink(wikilinkQuery.query.trim(), editor);
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
    [wikilinkQuery, totalOptions, selectedIndex, matchingFiles, handleInsertWikilink]
  );

  const editor = useEditor(
    content,
    onContentChange,
    onSave,
    onInit,
    handleWikilinkQueryChange,
    handleKeyDownInterceptor
  );

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
          <div className="editor-pane">
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
                  coords={wikilinkQuery.coords}
                  matchingFiles={matchingFiles}
                  selectedIndex={selectedIndex}
                  onSelectFile={(file) => handleInsertWikilink(file.name, editor)}
                  onCreateGhostLink={(name) => handleInsertWikilink(name, editor)}
                  onClose={() => setWikilinkQuery(null)}
                />
              )}
            </div>
          </div>
        )}

        {/* Right / Full Rendered Preview Pane (rendered in split & preview modes) */}
        {viewMode !== 'edit' && (
          <div className="preview-pane">
            <div className="preview-document-container">
              <div
                className="markdown-rendered"
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

