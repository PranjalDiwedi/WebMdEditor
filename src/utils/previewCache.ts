import type { MarkdownFile } from '../types/file';
import { getFromStorage, setToStorage } from './storageHelpers';

export interface PreviewCacheEntry {
  preview: string;
  modifiedAt: number;
  size: number;
}

const PREVIEW_CACHE_PREFIX = 'mandrak_preview_cache_';
const MAX_CACHE_ENTRIES = 500;

/**
 * Retrieve the full preview cache map for a specific workspace.
 */
export function getWorkspacePreviewCache(workspaceKey: string): Record<string, PreviewCacheEntry> {
  if (!workspaceKey) return {};
  return getFromStorage<Record<string, PreviewCacheEntry>>(`${PREVIEW_CACHE_PREFIX}${workspaceKey}`, {});
}

/**
 * Save the preview cache map for a workspace, keeping within maximum entry limits.
 */
export function saveWorkspacePreviewCache(workspaceKey: string, cache: Record<string, PreviewCacheEntry>): void {
  if (!workspaceKey) return;
  
  // Evict oldest entries if exceeding limit
  const keys = Object.keys(cache);
  if (keys.length > MAX_CACHE_ENTRIES) {
    const sorted = keys.sort((a, b) => (cache[a]?.modifiedAt || 0) - (cache[b]?.modifiedAt || 0));
    const toRemove = sorted.slice(0, keys.length - MAX_CACHE_ENTRIES);
    toRemove.forEach((k) => delete cache[k]);
  }

  setToStorage(`${PREVIEW_CACHE_PREFIX}${workspaceKey}`, cache);
}

/**
 * Get a cached preview string for a file if the modification time and size match.
 */
export function getCachedPreview(
  workspaceKey: string,
  fileId: string,
  modifiedAtMs: number,
  size: number
): string | null {
  if (!workspaceKey || !fileId) return null;
  const cache = getWorkspacePreviewCache(workspaceKey);
  const entry = cache[fileId];
  if (!entry) return null;

  // Verify freshness
  if (entry.modifiedAt === modifiedAtMs && entry.size === size) {
    return entry.preview;
  }
  return null;
}

/**
 * Save a single preview to the workspace cache.
 */
export function setCachedPreview(
  workspaceKey: string,
  fileId: string,
  preview: string,
  modifiedAtMs: number,
  size: number
): void {
  if (!workspaceKey || !fileId) return;
  const cache = getWorkspacePreviewCache(workspaceKey);
  cache[fileId] = {
    preview,
    modifiedAt: modifiedAtMs,
    size,
  };
  saveWorkspacePreviewCache(workspaceKey, cache);
}

/**
 * Batch save multiple previews to the workspace cache efficiently.
 */
export function setMultipleCachedPreviews(
  workspaceKey: string,
  entries: Array<{ fileId: string; preview: string; modifiedAtMs: number; size: number }>
): void {
  if (!workspaceKey || entries.length === 0) return;
  const cache = getWorkspacePreviewCache(workspaceKey);
  entries.forEach((e) => {
    cache[e.fileId] = {
      preview: e.preview,
      modifiedAt: e.modifiedAtMs,
      size: e.size,
    };
  });
  saveWorkspacePreviewCache(workspaceKey, cache);
}

/**
 * Remove a single file preview from cache (e.g. on delete).
 */
export function removeCachedPreview(workspaceKey: string, fileId: string): void {
  if (!workspaceKey || !fileId) return;
  const cache = getWorkspacePreviewCache(workspaceKey);
  if (cache[fileId]) {
    delete cache[fileId];
    saveWorkspacePreviewCache(workspaceKey, cache);
  }
}

/**
 * Hydrate an array of MarkdownFiles with their cached preview strings in 0ms.
 */
export function hydrateFilesWithCachedPreviews(workspaceKey: string, files: MarkdownFile[]): MarkdownFile[] {
  if (!workspaceKey || files.length === 0) return files;
  const cache = getWorkspacePreviewCache(workspaceKey);

  return files.map((file) => {
    // If file already has full content or explicit preview, preserve it
    if (file.preview) return file;

    const modifiedMs = file.modifiedAt instanceof Date ? file.modifiedAt.getTime() : new Date(file.modifiedAt || 0).getTime();
    const entry = cache[file.id];
    if (entry && entry.modifiedAt === modifiedMs && entry.size === file.size) {
      return {
        ...file,
        preview: entry.preview,
      };
    }
    return file;
  });
}
