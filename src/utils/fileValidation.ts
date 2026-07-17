import { SUPPORTED_FILE_EXTENSIONS } from '../config/constants';

export function isMarkdownFile(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  return SUPPORTED_FILE_EXTENSIONS.some(ext => lowerName.endsWith(ext));
}

export function validateFileSize(size: number, maxSize: number): boolean {
  return size <= maxSize;
}

export function sanitizeFileName(fileName: string): string {
  // Remove or replace characters that are invalid in file names
  return fileName
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/^\.+/, '')
    .trim()
    .substring(0, 255);
}

/** Ensure the file name ends with a markdown extension (.md by default). */
export function ensureMarkdownFileName(fileName: string): string {
  const sanitized = sanitizeFileName(fileName.trim() || 'untitled');
  if (isMarkdownFile(sanitized)) {
    return sanitized;
  }

  // Replace a non-markdown extension (e.g. .txt, .html) with .md
  const extension = getFileExtension(sanitized);
  if (extension) {
    return `${sanitized.slice(0, -extension.length)}.md`;
  }

  return `${sanitized}.md`;
}

export function getFileExtension(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf('.');
  return lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : '';
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}