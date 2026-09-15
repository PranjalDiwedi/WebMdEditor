import { useMemo } from 'react';
import { EditorContent } from '@tiptap/react';
import { useEditor } from './useEditor';
import { EditorToolbar } from './EditorToolbar';
import { sanitizeMarkdown } from '../utils/htmlSanitizer';

export type ViewMode = 'edit' | 'split' | 'preview';

interface TipTapEditorProps {
  content: string;
  onContentChange: (content: string) => void;
  onSave?: () => void;
  onInit?: (initialMarkdown: string) => void;
  isDirty?: boolean;
  isSaving?: boolean;
  viewMode?: ViewMode;
}

export function TipTapEditor({
  content,
  onContentChange,
  onSave,
  onInit,
  isDirty = false,
  isSaving = false,
  viewMode = 'edit',
}: TipTapEditorProps) {
  const editor = useEditor(content, onContentChange, onSave, onInit);

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

