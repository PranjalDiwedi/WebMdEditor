import { marked } from 'marked';

export async function parseMarkdown(markdown: string): Promise<string> {
  const result = await marked(markdown);
  return result as string;
}

export function normalizeMarkdown(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

export function stripMarkdown(markdown: string): string {
  // Remove markdown syntax for preview text
  return markdown
    .replace(/#{1,6}\s+/g, '') // Headers
    .replace(/\*\*/g, '') // Bold
    .replace(/\*/g, '') // Italic
    .replace(/`{1,3}/g, '') // Code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1') // Images
    .replace(/^\s*[-*+]\s+/gm, '') // Lists
    .replace(/^\s*\d+\.\s+/gm, '') // Numbered lists
    .replace(/\n+/g, ' ') // Multiple newlines to single space
    .trim()
    .substring(0, 200); // Limit preview length
}

export function getWordCount(markdown: string): number {
  const text = stripMarkdown(markdown);
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

export function getCharacterCount(markdown: string): number {
  return markdown.length;
}

export function getLineCount(markdown: string): number {
  return markdown.split('\n').length;
}