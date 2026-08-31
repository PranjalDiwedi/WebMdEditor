import { useEditor as useTipTapEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { Markdown } from 'tiptap-markdown';
import { sanitizeFileContent } from '../utils/htmlSanitizer';
import { useEffect, useRef } from 'react';

/**
 * Extracts formatted markdown string from TipTap editor instance.
 */
function extractMarkdown(editor: unknown): string {
  if (!editor || typeof editor !== 'object') return '';
  const ed = editor as {
    getMarkdown?: () => string;
    storage?: { markdown?: { getMarkdown?: () => string } };
    getHTML?: () => string;
  };

  if (typeof ed.getMarkdown === 'function') {
    return ed.getMarkdown();
  }
  if (ed.storage?.markdown && typeof ed.storage.markdown.getMarkdown === 'function') {
    return ed.storage.markdown.getMarkdown();
  }
  if (typeof ed.getHTML === 'function') {
    return ed.getHTML();
  }
  return '';
}

export function useEditor(content: string, onUpdate: (content: string) => void) {
  const isUpdatingFromExternal = useRef(false);

  const editor = useTipTapEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-500 underline cursor-pointer',
          rel: 'noopener noreferrer',
          target: '_blank',
        },
        validate: (href) => {
          // Basic URL validation
          try {
            const url = new URL(href, window.location.origin);
            return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:';
          } catch {
            return false;
          }
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder: 'Start writing your markdown...',
      }),
      Markdown.configure({
        html: true,
        tightLists: true,
        bulletListMarker: '-',
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: sanitizeFileContent(content),
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
      },
    },
    onUpdate: ({ editor }) => {
      if (isUpdatingFromExternal.current) return;
      try {
        const markdown = extractMarkdown(editor);
        onUpdate(markdown);
      } catch (error) {
        console.error('Error updating editor content:', error);
        onUpdate(editor.getText() || '');
      }
    },
  });

  // Update editor content when external content changes (e.g. file selection)
  useEffect(() => {
    if (!editor) return;

    const currentMarkdown = extractMarkdown(editor);
    if (content !== currentMarkdown) {
      isUpdatingFromExternal.current = true;
      try {
        const safeContent = sanitizeFileContent(content);
        (editor.commands as any).setContent(safeContent, {
          contentType: 'markdown',
          emitUpdate: false,
        });
      } catch (error) {
        console.error('Error setting editor content:', error);
        (editor.commands as any).setContent(content || '', {
          contentType: 'markdown',
          emitUpdate: false,
        });
      } finally {
        isUpdatingFromExternal.current = false;
      }
    }
  }, [content, editor]);

  return editor;
}