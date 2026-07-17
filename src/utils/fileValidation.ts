import { SUPPORTED_FILE_EXTENSIONS } from '../config/constants';

const MAX_FILENAME_LENGTH = 255;
const INVALID_CHARS = /[<>:"/\\|?*\x00-\x1F]/;
const RESERVED_NAMES = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;
const PATH_TRAVERSAL = /\.\.|[/\\]/;

export function isMarkdownFile(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  return SUPPORTED_FILE_EXTENSIONS.some(ext => lowerName.endsWith(ext));
}

export function validateFileSize(size: number, maxSize: number): boolean {
  return size <= maxSize;
}

export function validateFileName(fileName: string): { valid: boolean; error?: string } {
  const name = fileName.trim();

  if (name.length === 0) {
    return { valid: false, error: 'File name cannot be empty' };
  }

  if (name.length > MAX_FILENAME_LENGTH) {
    return {
      valid: false,
      error: `File name must be less than ${MAX_FILENAME_LENGTH} characters`,
    };
  }

  if (PATH_TRAVERSAL.test(name)) {
    return { valid: false, error: 'File name contains invalid path characters' };
  }

  if (INVALID_CHARS.test(name)) {
    return { valid: false, error: 'File name contains invalid characters' };
  }

  const baseName = name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name;
  if (RESERVED_NAMES.test(baseName) || RESERVED_NAMES.test(name)) {
    return { valid: false, error: 'File name is reserved by the system' };
  }

  if (name.startsWith('.') || name.endsWith('.')) {
    return { valid: false, error: 'File name cannot start or end with a dot' };
  }

  return { valid: true };
}

export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\.\./g, '')
    .replace(/^\.+/, '')
    .trim()
    .substring(0, MAX_FILENAME_LENGTH);
}

/** Ensure the file name ends with a markdown extension (.md by default). */
export function ensureMarkdownFileName(fileName: string): string {
  const sanitized = sanitizeFileName(fileName.trim() || 'untitled');
  if (isMarkdownFile(sanitized)) {
    return sanitized;
  }

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
