import DOMPurify from 'dompurify';
import { marked } from 'marked';

const purifyConfig = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'blockquote', 'a', 'hr',
    'table', 'thead', 'tbody', 'tr', 'th', 'td'
  ],
  ALLOWED_ATTR: ['href', 'title', 'class', 'target', 'rel'],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'onfocus', 'onblur'],
  ADD_ATTR: ['target', 'rel'],
};

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
    const html = marked.parse(markdown) as string;
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
