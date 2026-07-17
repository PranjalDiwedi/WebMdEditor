import { useEditor as useTipTapEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { sanitizeHTML, sanitizeMarkdown, isContentSafe } from '../utils/htmlSanitizer';
import { useEffect } from 'react';

export function useEditor(content: string, onUpdate: (content: string) => void) {
  // Convert markdown to HTML for TipTap with sanitization
  const convertMarkdownToHtml = (markdown: string): string => {
    try {
      // First check if content is safe
      if (!isContentSafe(markdown)) {
        console.warn('Content contains potentially dangerous patterns');
        // Return a safe default or empty content
        return '<p>Content contains potentially dangerous elements and has been blocked.</p>';
      }
      
      const html = sanitizeMarkdown(markdown);
      return html;
    } catch (error) {
      console.error('Error converting markdown to HTML:', error);
      return '<p>Error rendering content. Please try again.</p>';
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
    ],
    content: convertMarkdownToHtml(content),
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
      },
    },
    onUpdate: ({ editor }) => {
      try {
        // Get HTML from editor and sanitize it
        const html = editor.getHTML();
        const sanitizedHtml = sanitizeHTML(html);
        onUpdate(sanitizedHtml);
      } catch (error) {
        console.error('Error updating editor content:', error);
        onUpdate('<p>Error saving content</p>');
      }
    },
  });

  // Update editor content when external content changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      try {
        const htmlContent = convertMarkdownToHtml(content);
        editor.commands.setContent(htmlContent, { emitUpdate: false });
      } catch (error) {
        console.error('Error setting editor content:', error);
        editor.commands.setContent('<p>Error loading content</p>', { emitUpdate: false });
      }
    }
  }, [content, editor]);

  return editor;
}