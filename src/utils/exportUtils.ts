import { marked } from 'marked';
import { transformWikilinksToHtml, sanitizeHTML } from './htmlSanitizer';

/**
 * Copies markdown content as formatted Rich Text (HTML) to the system clipboard.
 * Pasting into Gmail, Slack, Google Docs, Notion, etc. will preserve rich formatting.
 */
export async function copyMarkdownAsRichText(markdown: string): Promise<boolean> {
  if (!markdown) return false;

  try {
    // 1. Transform markdown to sanitized HTML
    const preprocessed = transformWikilinksToHtml(markdown);
    const rawHtml = marked.parse(preprocessed) as string;
    const cleanHtml = sanitizeHTML(rawHtml);

    // 2. Wrap in document body wrapper for external clipboard parsers
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${cleanHtml}</body></html>`;

    // 3. Write both text/html and text/plain to system clipboard
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard && navigator.clipboard.write) {
      const htmlBlob = new Blob([fullHtml], { type: 'text/html' });
      const textBlob = new Blob([markdown], { type: 'text/plain' });

      const item = new ClipboardItem({
        'text/html': htmlBlob,
        'text/plain': textBlob,
      });

      await navigator.clipboard.write([item]);
      return true;
    }

    // Fallback: Copy plain text
    await navigator.clipboard.writeText(markdown);
    return true;
  } catch (error) {
    console.error('Failed to copy as rich text:', error);
    try {
      await navigator.clipboard.writeText(markdown);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Triggers browser print dialog for document export to PDF / Printer
 */
export function triggerPrintDocument(): void {
  window.print();
}
