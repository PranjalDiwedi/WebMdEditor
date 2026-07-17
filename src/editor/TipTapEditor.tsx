import { EditorContent } from '@tiptap/react';
import { useEditor } from './useEditor';
import { EditorToolbar } from './EditorToolbar';

interface TipTapEditorProps {
  content: string;
  onContentChange: (content: string) => void;
  onSave?: () => void;
  isDirty?: boolean;
  isSaving?: boolean;
}

export function TipTapEditor({
  content,
  onContentChange,
  onSave,
  isDirty = false,
  isSaving = false,
}: TipTapEditorProps) {
  const editor = useEditor(content, onContentChange);

  if (!editor) {
    return <div className="editor-loading">Loading editor...</div>;
  }

  return (
    <div className="tiptap-editor-shell">
      {onSave && (
        <EditorToolbar
          editor={editor}
          onSave={onSave}
          isDirty={isDirty}
          isSaving={isSaving}
        />
      )}
      <EditorContent
        editor={editor}
        className="tiptap-editor-content"
      />
    </div>
  );
}
