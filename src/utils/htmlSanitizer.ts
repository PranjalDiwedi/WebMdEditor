import DOMPurify from 'dompurify';
import { marked } from 'marked';

const purifyConfig = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'blockquote', 'a', 'hr',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'span'
  ],
  ALLOWED_ATTR: ['href', 'title', 'class', 'target', 'rel', 'data-target', 'data-relation'],
  ALLOW_DATA_ATTR: true,
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'onfocus', 'onblur'],
  ADD_ATTR: ['target', 'rel'],
};

/**
 * Transforms [[wikilinks]] and [[relation:Target]] into preview spans
 */
export function transformWikilinksToHtml(markdown: string): string {
  if (!markdown) return '';

  // 1. Typed links with alias: [[relation:Target|Alias]]
  let transformed = markdown.replace(
    /\[\[(?!https?:\/\/)([a-zA-Z0-9_\-]+):([^\]|\r\n]+)\|([^\]\r\n]+)\]\]/g,
    (_match, relation, target, alias) => {
      const cleanRel = relation.trim();
      const cleanTarget = target.trim();
      const cleanAlias = alias.trim();
      const badgeClass = `relation-badge badge-${cleanRel.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      return `<span class="wikilink-preview typed-link" data-relation="${cleanRel}" data-target="${cleanTarget}"><span class="${badgeClass}">${cleanRel}</span> <span class="wikilink-name">${cleanAlias}</span></span>`;
    }
  );

  // 2. Typed links without alias: [[relation:Target]]
  transformed = transformed.replace(
    /\[\[(?!https?:\/\/)([a-zA-Z0-9_\-]+):([^\]|\r\n]+)\]\]/g,
    (_match, relation, target) => {
      const cleanRel = relation.trim();
      const cleanTarget = target.trim();
      const badgeClass = `relation-badge badge-${cleanRel.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      return `<span class="wikilink-preview typed-link" data-relation="${cleanRel}" data-target="${cleanTarget}"><span class="${badgeClass}">${cleanRel}</span> <span class="wikilink-name">${cleanTarget}</span></span>`;
    }
  );

  // 3. Standard wikilinks with alias: [[Target|Alias]]
  transformed = transformed.replace(
    /\[\[([^\]|\r\n]+)\|([^\]\r\n]+)\]\]/g,
    (_match, target, alias) => {
      const cleanTarget = target.trim();
      const cleanAlias = alias.trim();
      return `<span class="wikilink-preview" data-target="${cleanTarget}"><span class="wikilink-name">${cleanAlias}</span></span>`;
    }
  );

  // 4. Standard wikilinks without alias: [[Target]]
  transformed = transformed.replace(
    /\[\[([^\]\r\n]+)\]\]/g,
    (_match, target) => {
      const cleanTarget = target.trim();
      return `<span class="wikilink-preview" data-target="${cleanTarget}"><span class="wikilink-name">${cleanTarget}</span></span>`;
    }
  );

  return transformed;
}

/**
 * Sanitizes HTML content to prevent XSS attacks
 */
export function sanitizeHTML(html: string): string {
  try {
    const clean = String(DOMPurify.sanitize(html, purifyConfig));
    // Ensure external links open safely
    return clean.replace(
      /<a\b([^>]*\btarget=(["'])_blank\2[^>]*)>/gi,
      (match) => {
        if (/\brel=/i.test(match)) {
          return match.replace(/\brel=(["'])[^"']*\1/i, 'rel="noopener noreferrer"');
        }
        return match.replace(/>$/, ' rel="noopener noreferrer">');
      }
    );
  } catch (error) {
    console.error('HTML sanitization failed:', error);
    return '';
  }
}

/**
 * Converts markdown to HTML and sanitizes the result
 */
export function sanitizeMarkdown(markdown: string): string {
  try {
    const preprocessed = transformWikilinksToHtml(markdown);
    const html = marked.parse(preprocessed) as string;
    return sanitizeHTML(html);
  } catch (error) {
    console.error('Markdown sanitization failed:', error);
    return '';
  }
}

/**
 * Sanitizes a URL to prevent XSS through href attributes.
 * Only http, https, mailto, and relative URLs are allowed (no data:).
 */
export function sanitizeURL(url: string): string {
  try {
    if (!url) return '';

    const trimmed = url.trim();
    if (/^(javascript|vbscript|data):/i.test(trimmed)) {
      return '';
    }

    const urlObj = new URL(trimmed, window.location.origin);

    if (
      urlObj.protocol !== 'http:' &&
      urlObj.protocol !== 'https:' &&
      urlObj.protocol !== 'mailto:'
    ) {
      return '';
    }

    return trimmed;
  } catch (error) {
    console.error('URL sanitization failed:', error);
    return '';
  }
}

export function sanitizeLinks(html: string): string {
  return sanitizeHTML(html);
}

/**
 * Validates if content contains potentially dangerous patterns
 */
export function isContentSafe(content: string): boolean {
  if (!content) return true;
  const dangerousPatterns = [
    /<script[\s\S]*?>/i,
    /javascript:\s*/i,
    /<iframe[\s\S]*?>/i,
    /<object[\s\S]*?>/i,
    /<embed[\s\S]*?>/i,
    /data:text\/html/i,
    /vbscript:/i,
    /expression\s*\(/i
  ];

  return !dangerousPatterns.some(pattern => pattern.test(content));
}

/**
 * Sanitize file content before loading into the editor.
 * If content looks like HTML, sanitize as HTML; otherwise treat as markdown source.
 */
export function sanitizeFileContent(content: string): string {
  if (!content) return '';

  // Clean null bytes and dangerous executable script tags from raw source
  let sanitized = content
    .replace(/\u0000/g, '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');

  const looksLikeFullHtmlDoc = /^\s*<!DOCTYPE|^\s*<html\b/i.test(sanitized);
  if (looksLikeFullHtmlDoc) {
    sanitized = sanitizeHTML(sanitized);
  }

  return sanitized;
}

export function sanitizeUserInput(input: string): string {
  try {
    let sanitized = input.replace(/<[^>]*>/g, '');
    sanitized = sanitized.replace(/[<>:"/\\|?*\x00-\x1F]/g, '');
    return sanitized.trim();
  } catch (error) {
    console.error('User input sanitization failed:', error);
    return '';
  }
}
