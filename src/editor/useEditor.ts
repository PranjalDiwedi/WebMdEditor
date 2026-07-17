import { useEditor as useTipTapEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { marked } from 'marked';
import { useEffect } from 'react';

export function useEditor(content: string, onUpdate: (content: string) => void) {
  // Convert markdown to HTML for TipTap
  const convertMarkdownToHtml = (markdown: string): string => {
    try {
      return marked(markdown) as string;
    } catch (error) {
      console.error('Error converting markdown to HTML:', error);
      return markdown;
    }
  };

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
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder: 'Start writing your markdown...',
      }),
    ],
    content: convertMarkdownToHtml(content),
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
      },
    },
    onUpdate: ({ editor }) => {
      // Convert HTML back to markdown for storage
      const html = editor.getHTML();
      // For now, we'll store the HTML and convert back to markdown when needed
      onUpdate(html);
    },
  });

  // Update editor content when external content changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      const htmlContent = convertMarkdownToHtml(content);
      editor.commands.setContent(htmlContent, false);
    }
  }, [content, editor]);

  return editor;
}