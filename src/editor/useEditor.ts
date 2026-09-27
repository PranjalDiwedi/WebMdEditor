import { useEditor as useTipTapEditor } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { Markdown } from 'tiptap-markdown';
import { sanitizeFileContent } from '../utils/htmlSanitizer';
import { normalizeMarkdown } from '../utils/markdownParser';
import { useEffect, useRef } from 'react';

/**
 * Custom TipTap extension for universal markdown shortcuts (Headings, Strikethrough, Code blocks, Lists, Links, and Direct Save).
 */
const createMarkdownShortcutsExtension = (getOnSave: () => (() => void) | undefined) =>
  Extension.create({
    name: 'markdownShortcuts',
    addKeyboardShortcuts() {
      return {
        // Direct Save (Mod-S)
        'Mod-s': () => {
          const onSave = getOnSave();
          if (onSave) {
            onSave();
          }
          return true;
        },
        'Mod-S': () => {
          const onSave = getOnSave();
          if (onSave) {
            onSave();
          }
          return true;
        },

        // Insert / Edit Link (Mod-K)
        'Mod-k': () => {
          const previousUrl = this.editor.getAttributes('link').href;
          const url = window.prompt('Enter URL:', previousUrl);
          if (url === null) return true;
          if (url === '') {
            this.editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return true;
          }
          this.editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
          return true;
        },

        // Headings (Mod-Alt-1..3 or Mod-1..3)
        'Mod-Alt-1': () => this.editor.chain().focus().toggleHeading({ level: 1 }).run(),
        'Mod-Alt-2': () => this.editor.chain().focus().toggleHeading({ level: 2 }).run(),
        'Mod-Alt-3': () => this.editor.chain().focus().toggleHeading({ level: 3 }).run(),
        'Mod-Alt-0': () => this.editor.chain().focus().setParagraph().run(),
        'Mod-1': () => this.editor.chain().focus().toggleHeading({ level: 1 }).run(),
        'Mod-2': () => this.editor.chain().focus().toggleHeading({ level: 2 }).run(),
        'Mod-3': () => this.editor.chain().focus().toggleHeading({ level: 3 }).run(),
        'Mod-0': () => this.editor.chain().focus().setParagraph().run(),

        // Strikethrough (Mod-Shift-X or Mod-Alt-S)
        'Mod-Shift-x': () => this.editor.chain().focus().toggleStrike().run(),
        'Mod-Shift-X': () => this.editor.chain().focus().toggleStrike().run(),
        'Mod-Alt-s': () => this.editor.chain().focus().toggleStrike().run(),

        // Code Block (Mod-Alt-C or Mod-Shift-C)
        'Mod-Alt-c': () => this.editor.chain().focus().toggleCodeBlock().run(),
        'Mod-Shift-c': () => this.editor.chain().focus().toggleCodeBlock().run(),
        'Mod-Shift-C': () => this.editor.chain().focus().toggleCodeBlock().run(),

        // Bullet List (Mod-Shift-8 or Mod-Alt-U)
        'Mod-Shift-8': () => this.editor.chain().focus().toggleBulletList().run(),
        'Mod-Alt-u': () => this.editor.chain().focus().toggleBulletList().run(),

        // Numbered List (Mod-Shift-7 or Mod-Alt-O)
        'Mod-Shift-7': () => this.editor.chain().focus().toggleOrderedList().run(),
        'Mod-Alt-o': () => this.editor.chain().focus().toggleOrderedList().run(),

        // Blockquote (Mod-Shift-. or Mod-Alt-Q)
        'Mod-Shift-.': () => this.editor.chain().focus().toggleBlockquote().run(),
        'Mod-Alt-q': () => this.editor.chain().focus().toggleBlockquote().run(),

        // Horizontal Rule (Mod-Shift-H or Mod-Shift--)
        'Mod-Shift-h': () => this.editor.chain().focus().setHorizontalRule().run(),
        'Mod-Shift-H': () => this.editor.chain().focus().setHorizontalRule().run(),
        'Mod-Shift--': () => this.editor.chain().focus().setHorizontalRule().run(),
      };
    },
  });

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

export interface WikilinkQueryState {
  isOpen: boolean;
  query: string;
  range: { from: number; to: number };
  coords: { x: number; y: number };
}

export function useEditor(
  content: string,
  onUpdate: (content: string) => void,
  onSave?: () => void,
  onInit?: (initialMarkdown: string) => void,
  onWikilinkQueryChange?: (state: WikilinkQueryState | null) => void,
  onKeyDownInterceptor?: (event: KeyboardEvent) => boolean
) {
  const isUpdatingFromExternal = useRef(false);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const onInitRef = useRef(onInit);
  onInitRef.current = onInit;
  const onWikilinkQueryChangeRef = useRef(onWikilinkQueryChange);
  onWikilinkQueryChangeRef.current = onWikilinkQueryChange;
  const onKeyDownInterceptorRef = useRef(onKeyDownInterceptor);
  onKeyDownInterceptorRef.current = onKeyDownInterceptor;

  const detectWikilinkQuery = (ed: any) => {
    if (!onWikilinkQueryChangeRef.current) return;
    try {
      const { selection, doc } = ed.state;
      const { from } = selection;
      if (!selection.empty) {
        onWikilinkQueryChangeRef.current(null);
        return;
      }
      const textBefore = doc.textBetween(Math.max(0, from - 60), from, '\n', '\0');
      const match = textBefore.match(/\[\[([^\]\r\n]*)$/);
      if (match) {
        const query = match[1];
        const range = { from: from - match[0].length, to: from };
        const coords = ed.view.coordsAtPos(from);
        onWikilinkQueryChangeRef.current({
          isOpen: true,
          query,
          range,
          coords: { x: coords.left, y: coords.bottom + 4 },
        });
      } else {
        onWikilinkQueryChangeRef.current(null);
      }
    } catch {
      onWikilinkQueryChangeRef.current(null);
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
      Markdown.configure({
        html: true,
        tightLists: true,
        bulletListMarker: '-',
        transformPastedText: true,
        transformCopiedText: true,
      }),
      createMarkdownShortcutsExtension(() => onSaveRef.current),
    ],
    content: sanitizeFileContent(content),
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
      },
      handleKeyDown: (_view, event) => {
        if (onKeyDownInterceptorRef.current) {
          const handled = onKeyDownInterceptorRef.current(event);
          if (handled) return true;
        }
        return false;
      },
    },
    onCreate: ({ editor }) => {
      try {
        const initialMarkdown = extractMarkdown(editor);
        if (initialMarkdown) {
          onInitRef.current?.(initialMarkdown);
        }
      } catch {}
    },
    onSelectionUpdate: ({ editor }) => {
      detectWikilinkQuery(editor);
    },
    onUpdate: ({ editor }) => {
      if (isUpdatingFromExternal.current) return;
      try {
        const markdown = extractMarkdown(editor);
        onUpdate(markdown);
        detectWikilinkQuery(editor);
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
    if (normalizeMarkdown(content) !== normalizeMarkdown(currentMarkdown)) {
      isUpdatingFromExternal.current = true;
      try {
        const safeContent = sanitizeFileContent(content);
        (editor.commands as any).setContent(safeContent, {
          contentType: 'markdown',
          emitUpdate: false,
        });
        const newMarkdown = extractMarkdown(editor);
        if (newMarkdown) {
          onInitRef.current?.(newMarkdown);
        }
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