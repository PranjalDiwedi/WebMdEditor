import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

/**
 * Checks if a string is a valid HTTP/HTTPS URL
 */
function isValidUrl(str: string): boolean {
  try {
    const trimmed = str.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return false;
    }
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Converts HTML <table> string to GitHub Flavored Markdown table
 */
function htmlTableToMarkdown(tableHtml: string): string | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(tableHtml, 'text/html');
    const table = doc.querySelector('table');
    if (!table) return null;

    const rows = Array.from(table.querySelectorAll('tr'));
    if (rows.length === 0) return null;

    const matrix: string[][] = [];
    let maxCols = 0;

    rows.forEach((row) => {
      const cells = Array.from(row.querySelectorAll('th, td')).map((cell) =>
        (cell.textContent || '').trim().replace(/\|/g, '\\|')
      );
      if (cells.length > 0) {
        matrix.push(cells);
        if (cells.length > maxCols) {
          maxCols = cells.length;
        }
      }
    });

    if (matrix.length === 0 || maxCols === 0) return null;

    // Normalize all rows to have maxCols columns
    const normalizedMatrix = matrix.map((row) => {
      while (row.length < maxCols) {
        row.push('');
      }
      return row;
    });

    // Build GFM table
    const headerRow = normalizedMatrix[0];
    const dividerRow = headerRow.map(() => ':---');
    const bodyRows = normalizedMatrix.slice(1);

    let md = `| ${headerRow.join(' | ')} |\n| ${dividerRow.join(' | ')} |\n`;
    bodyRows.forEach((row) => {
      md += `| ${row.join(' | ')} |\n`;
    });

    return md;
  } catch {
    return null;
  }
}

/**
 * Converts Tab-Separated Values (TSV) from Excel/Google Sheets to GFM table
 */
function tsvToMarkdown(tsvText: string): string | null {
  const lines = tsvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 1) return null;

  // Check if text has tabs
  const hasTabs = lines.some((l) => l.includes('\t'));
  if (!hasTabs) return null;

  const matrix = lines.map((l) =>
    l.split('\t').map((c) => c.trim().replace(/\|/g, '\\|'))
  );

  const maxCols = Math.max(...matrix.map((r) => r.length));
  if (maxCols < 2 && matrix.length < 2) return null; // Single cell with tab is not a table

  const normalizedMatrix = matrix.map((row) => {
    while (row.length < maxCols) {
      row.push('');
    }
    return row;
  });

  const headerRow = normalizedMatrix[0];
  const dividerRow = headerRow.map(() => ':---');
  const bodyRows = normalizedMatrix.slice(1);

  let md = `| ${headerRow.join(' | ')} |\n| ${dividerRow.join(' | ')} |\n`;
  bodyRows.forEach((row) => {
    md += `| ${row.join(' | ')} |\n`;
  });

  return md;
}

/**
 * Smart Paste TipTap Extension:
 * 1. Converts copied tables from Excel/Google Sheets/HTML to GFM markdown tables.
 * 2. Auto-links selected text when pasting a URL: [Selected Text](https://url.com).
 */
export const SmartPasteExtension = Extension.create({
  name: 'smartPaste',

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        key: new PluginKey('smartPastePlugin'),
        props: {
          handlePaste(view, event) {
            const clipboardData = event.clipboardData;
            if (!clipboardData) return false;

            const textPlain = clipboardData.getData('text/plain') || '';
            const textHtml = clipboardData.getData('text/html') || '';
            const { state } = view;
            const { from, to, empty } = state.selection;

            // 1. Smart URL Auto-Link: When text is selected and clipboard is a valid URL
            if (!empty && from !== to && isValidUrl(textPlain.trim())) {
              const selectedText = state.doc.textBetween(from, to, ' ').trim();
              if (selectedText.length > 0) {
                event.preventDefault();
                const cleanUrl = textPlain.trim();
                const mdLink = `[${selectedText}](${cleanUrl})`;

                editor
                  .chain()
                  .focus()
                  .insertContentAt({ from, to }, mdLink)
                  .run();
                return true;
              }
            }

            // 2. Spreadsheet HTML Table conversion to Markdown
            if (textHtml && (textHtml.includes('<table') || textHtml.includes('<tr'))) {
              const mdTable = htmlTableToMarkdown(textHtml);
              if (mdTable) {
                event.preventDefault();
                editor
                  .chain()
                  .focus()
                  .insertContent(mdTable)
                  .run();
                return true;
              }
            }

            // 3. Spreadsheet TSV (Plain text tabs) conversion to Markdown
            if (textPlain && textPlain.includes('\t') && textPlain.includes('\n')) {
              const mdTable = tsvToMarkdown(textPlain);
              if (mdTable) {
                event.preventDefault();
                editor
                  .chain()
                  .focus()
                  .insertContent(mdTable)
                  .run();
                return true;
              }
            }

            return false;
          },
        },
      }),
    ];
  },
});
