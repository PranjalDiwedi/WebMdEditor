import type { Editor } from '@tiptap/react';
import { modSymbol, altSymbol, shiftSymbol } from '../utils/keyboard';

interface EditorToolbarProps {
  editor: Editor | null;
  onSave?: () => void;
  isDirty?: boolean;
  isSaving?: boolean;
}

export function EditorToolbar({ editor, onSave, isDirty = false, isSaving = false }: EditorToolbarProps) {
  if (!editor) {
    return null;
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter URL:', previousUrl);

    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="editor-toolbar">
      {/* History Group */}
      <div className="toolbar-group">
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="tb-btn"
          title={`Undo (${modSymbol}Z)`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v6h6 M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="tb-btn"
          title={`Redo (${modSymbol}${shiftSymbol}Z)`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 7v6h-6 M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7" />
          </svg>
        </button>
      </div>

      {/* Formatting Group */}
      <div className="toolbar-group">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`tb-btn ${editor.isActive('bold') ? 'active' : ''}`}
          title={`Bold (${modSymbol}B)`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`tb-btn ${editor.isActive('italic') ? 'active' : ''}`}
          title={`Italic (${modSymbol}I)`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 4h-9 M14 20H5 M15 4L9 20" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`tb-btn ${editor.isActive('strike') ? 'active' : ''}`}
          title={`Strikethrough (${modSymbol}${shiftSymbol}X)`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M16 6c0-1.5-1.5-3-4-3s-4 1.5-4 3c0 2 2 3 4 3.5m4 3c.5.5 1 1.5 1 2.5 0 2-2 3.5-5 3.5s-5-1.5-5-3.5" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={`tb-btn ${editor.isActive('code') ? 'active' : ''}`}
          title={`Inline Code (${modSymbol}E)`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 18l6-6-6-6 M8 6l-6 6 6 6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={setLink}
          className={`tb-btn ${editor.isActive('link') ? 'active' : ''}`}
          title={`Insert Link (${modSymbol}K)`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </button>
      </div>

      {/* Headings Group */}
      <div className="toolbar-group">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`tb-btn tb-heading-btn ${editor.isActive('heading', { level: 1 }) ? 'active' : ''}`}
          title={`Heading 1 (${modSymbol}${altSymbol}1)`}
        >
          H1
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`tb-btn tb-heading-btn ${editor.isActive('heading', { level: 2 }) ? 'active' : ''}`}
          title={`Heading 2 (${modSymbol}${altSymbol}2)`}
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`tb-btn tb-heading-btn ${editor.isActive('heading', { level: 3 }) ? 'active' : ''}`}
          title={`Heading 3 (${modSymbol}${altSymbol}3)`}
        >
          H3
        </button>
      </div>

      {/* Lists & Blocks Group */}
      <div className="toolbar-group">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`tb-btn ${editor.isActive('bulletList') ? 'active' : ''}`}
          title={`Bullet List (${modSymbol}${shiftSymbol}8)`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`tb-btn ${editor.isActive('orderedList') ? 'active' : ''}`}
          title={`Numbered List (${modSymbol}${shiftSymbol}7)`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6h11 M10 12h11 M10 18h11 M4 6h1v4 M4 10h2 M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`tb-btn ${editor.isActive('blockquote') ? 'active' : ''}`}
          title={`Blockquote (${modSymbol}${shiftSymbol}.)`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`tb-btn ${editor.isActive('codeBlock') ? 'active' : ''}`}
          title={`Code Block (${modSymbol}${altSymbol}C)`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="tb-btn"
          title={`Horizontal Divider (${modSymbol}${shiftSymbol}H)`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
          </svg>
        </button>
      </div>

      {/* Save Action Pill */}
      {onSave && (
        <div className="toolbar-actions-right">
          <button
            type="button"
            onClick={onSave}
            className={`save-status-pill ${isDirty ? 'dirty' : 'saved'}`}
            disabled={isSaving || !isDirty}
            title={`Save Note (${modSymbol}S)`}
          >
            {isSaving ? (
              <span>Saving...</span>
            ) : isDirty ? (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="13" height="13">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                <span>Save</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="13" height="13">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span>Saved</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}