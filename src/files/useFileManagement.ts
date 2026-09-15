import { useState, useCallback, useEffect, useRef } from 'react';
import type { MarkdownFile, FileState, FileOperations } from '../types/file';
import type { ToastMessage } from '../components/Toast';
import { StorageProvider } from '../storage/StorageProvider';
import { getFromStorage, setToStorage } from '../utils/storageHelpers';
import { STORAGE_KEYS } from '../config/constants';
import { stripMarkdown } from '../utils/markdownParser';
import { sanitizeFileContent } from '../utils/htmlSanitizer';
import { toUserError } from '../utils/securityErrors';
import { ensureMarkdownFileName } from '../utils/fileValidation';
import { exportToMarkdownFile } from '../utils/exportHelpers';
import {
  setCachedPreview,
  removeCachedPreview,
  hydrateFilesWithCachedPreviews,
} from '../utils/previewCache';

// Workspace key generator to cleanly isolate data across Local Vault and Cloud Storage
function getWorkspaceKey(storageProvider: StorageProvider | null): string {
  if (!storageProvider || !storageProvider.isAuthenticated) {
    return 'local_vault';
  }
  const target = (storageProvider as any).getTargetFolder?.();
  const folderPart = target?.id ? `_${target.id}` : '';
  return `${storageProvider.type}${folderPart}`;
}

function getPinnedIds(workspaceKey: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(`mandrak_pinned_${workspaceKey}`) || '[]');
  } catch {
    return [];
  }
}

function savePinnedIds(workspaceKey: string, ids: string[]): void {
  try {
    localStorage.setItem(`mandrak_pinned_${workspaceKey}`, JSON.stringify(ids));
  } catch {}
}

function getStoredFolders(workspaceKey: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(`mandrak_folders_${workspaceKey}`) || '[]');
  } catch {
    return [];
  }
}

function saveStoredFolders(workspaceKey: string, folders: string[]): void {
  try {
    localStorage.setItem(`mandrak_folders_${workspaceKey}`, JSON.stringify(folders));
  } catch {}
}

export function useFileManagement(storageProvider: StorageProvider | null): FileState & FileOperations & {
  customFolders: string[];
  toasts: ToastMessage[];
  dismissToast: (id: string) => void;
  setSearchQuery: (query: string) => void;
  updateFileContent: (content: string) => void;
  createDraft: (name: string, content: string, path?: string) => void;
  createFile: (name: string, content: string, path?: string) => Promise<void>;
  createFolder: (folderPath: string) => void;
  duplicateFile: (fileId: string) => Promise<void>;
  togglePinFile: (fileId: string) => void;
  moveFile: (fileId: string, destinationFolderPath: string) => Promise<void>;
  moveFolder: (sourceFolderPath: string, destinationFolderPath: string) => Promise<void>;
  closeFile: () => void;
} {
  const workspaceKey = getWorkspaceKey(storageProvider);
  const workspaceKeyRef = useRef(workspaceKey);
  workspaceKeyRef.current = workspaceKey;

  const [currentFile, setCurrentFile] = useState<MarkdownFile | null>(null);
  const [recentFiles, setRecentFiles] = useState<MarkdownFile[]>([]);
  const [customFolders, setCustomFolders] = useState<string[]>(() => getStoredFolders(workspaceKey));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((toast: ToastMessage) => {
    setToasts((prev) => {
      const filtered = prev.filter((t) => t.id !== toast.id);
      return [...filtered, toast];
    });
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Helper to stream file previews asynchronously in non-blocking background batches
  const streamPreviewsInBackground = useCallback(
    (
      filesToStream: MarkdownFile[],
      provider: StorageProvider,
      targetWorkspaceKey: string,
      isCancelled: () => boolean
    ) => {
      const concurrency = provider.type === 'local' ? 4 : 2;
      const queue = [...filesToStream];

      const processNext = async () => {
        while (queue.length > 0) {
          if (isCancelled()) return;
          const file = queue.shift();
          if (!file) break;

          try {
            const rawContent = await provider.readFile(file.id);
            if (isCancelled()) return;

            const preview = stripMarkdown(rawContent);
            const modifiedMs =
              file.modifiedAt instanceof Date
                ? file.modifiedAt.getTime()
                : new Date(file.modifiedAt || 0).getTime();

            // Cache in localStorage
            setCachedPreview(targetWorkspaceKey, file.id, preview, modifiedMs, file.size);

            // Update UI state
            setRecentFiles((prev) =>
              prev.map((f) => (f.id === file.id ? { ...f, preview } : f))
            );
          } catch {
            // Ignore preview read errors gracefully
          }

          // Small yield to maintain 60 FPS
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
      };

      for (let i = 0; i < concurrency; i++) {
        processNext();
      }
    },
    []
  );

  // Helper to load local vault files
  const loadLocalVaultFiles = useCallback(() => {
    const key = 'local_vault';
    const stored = getFromStorage<MarkdownFile[]>(`mandrak_recent_${key}`, []) || [];
    const legacy = stored.length > 0 ? stored : getFromStorage<MarkdownFile[]>(STORAGE_KEYS.RECENT_FILES, []) || [];
    const pinnedIds = getPinnedIds(key);

    const normalized = (legacy || []).map((file) => ({
      ...file,
      provider: 'local' as const,
      isPinned: pinnedIds.includes(file.id),
      modifiedAt: file.modifiedAt instanceof Date ? file.modifiedAt : new Date(file.modifiedAt || Date.now()),
      createdAt: file.createdAt instanceof Date ? file.createdAt : new Date(file.createdAt || Date.now()),
      preview: file.preview || (file.content ? stripMarkdown(file.content) : undefined),
    }));

    const hydrated = hydrateFilesWithCachedPreviews(key, normalized);
    setRecentFiles(hydrated);
    setCustomFolders(getStoredFolders(key));
  }, []);

  // Whenever workspace / storageProvider changes, completely switch isolated state & purge stale cache
  useEffect(() => {
    setCurrentFile(null);
    setSearchQuery('');
    setError(null);
    setRecentFiles([]); // Immediately clear so stale IDs from previous sessions never flash

    const currentKey = getWorkspaceKey(storageProvider);
    setCustomFolders(getStoredFolders(currentKey));

    if (!storageProvider || !storageProvider.isAuthenticated) {
      loadLocalVaultFiles();
      return;
    }

    let cancelled = false;

    const loadProviderFiles = async () => {
      setIsLoading(true);
      try {
        const files = await storageProvider.listFiles();
        if (cancelled) return;
        const pinnedIds = getPinnedIds(currentKey);
        
        const mappedFiles: MarkdownFile[] = files.map((file) => ({
          id: file.id,
          name: file.name,
          content: file.content || '',
          path: file.path || file.name,
          provider: file.provider,
          modifiedAt: file.modifiedAt instanceof Date ? file.modifiedAt : new Date(file.modifiedAt || Date.now()),
          createdAt: file.modifiedAt instanceof Date ? file.modifiedAt : new Date(file.modifiedAt || Date.now()),
          size: file.size,
          isDirty: false,
          isPinned: pinnedIds.includes(file.id),
          preview: file.content ? stripMarkdown(file.content) : undefined,
        }));

        // 1. Instantly hydrate from preview cache (0ms)
        const hydratedFiles = hydrateFilesWithCachedPreviews(currentKey, mappedFiles);
        setRecentFiles(hydratedFiles);

        // 2. Identify files that still need background preview streaming
        const needsStreaming = hydratedFiles.filter((f) => !f.preview && f.size > 0);
        if (needsStreaming.length > 0) {
          streamPreviewsInBackground(needsStreaming, storageProvider, currentKey, () => cancelled);
        }
      } catch (err) {
        if (!cancelled) {
          setError(toUserError(err, 'Failed to load files'));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadProviderFiles();
    return () => {
      cancelled = true;
    };
  }, [storageProvider, loadLocalVaultFiles, streamPreviewsInBackground]);

  const saveToRecentFiles = useCallback((file: MarkdownFile) => {
    const key = workspaceKeyRef.current;
    const safeFile = {
      ...file,
      preview: file.preview || stripMarkdown(file.content),
      modifiedAt: file.modifiedAt instanceof Date ? file.modifiedAt : new Date(file.modifiedAt || Date.now()),
      createdAt: file.createdAt instanceof Date ? file.createdAt : new Date(file.createdAt || Date.now()),
    };
    
    setRecentFiles((prev) => {
      const updated = [safeFile, ...prev.filter((f) => f.id !== file.id)].slice(0, 30);
      if (key === 'local_vault') {
        setToStorage(STORAGE_KEYS.RECENT_FILES, updated);
        setToStorage(`mandrak_recent_${key}`, updated);
      }
      return updated;
    });
  }, []);

  const createDraft = useCallback((name: string, content: string, path?: string) => {
    const safeName = ensureMarkdownFileName(name);
    const cleanDir = path ? path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') : '';
    const fullPath = cleanDir ? `${cleanDir}/${safeName}` : safeName;
    const preview = stripMarkdown(content);
    const draftFile: MarkdownFile = {
      id: `draft_${Date.now()}`,
      name: safeName,
      content,
      preview,
      path: fullPath,
      provider: 'local',
      modifiedAt: new Date(),
      createdAt: new Date(),
      size: content.length,
      isDirty: false,
      isPinned: false,
    };
    const key = workspaceKeyRef.current;
    setCachedPreview(key, draftFile.id, preview, draftFile.modifiedAt.getTime(), draftFile.size);
    setCurrentFile(draftFile);
    saveToRecentFiles(draftFile);
  }, [saveToRecentFiles]);

  const openFile = useCallback(async (fileId: string) => {
    if (!storageProvider) {
      const existingDraft = recentFiles.find((f) => f.id === fileId);
      if (existingDraft) {
        setCurrentFile(existingDraft);
        return;
      }
      setError('No storage provider selected');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const rawContent = await storageProvider.readFile(fileId);
      const content = sanitizeFileContent(rawContent);
      const preview = stripMarkdown(content);
      const key = workspaceKeyRef.current;
      const existing = recentFiles.find((f) => f.id === fileId);

      let markdownFile: MarkdownFile;
      if (existing) {
        markdownFile = {
          ...existing,
          content,
          preview,
          isDirty: false,
          size: content.length,
        };
      } else {
        const files = await storageProvider.listFiles();
        const fileData = files.find((f) => f.id === fileId);
        if (!fileData) {
          throw new Error('File not found');
        }
        markdownFile = {
          id: fileData.id,
          name: fileData.name,
          content,
          preview,
          path: fileData.path,
          provider: fileData.provider,
          modifiedAt: fileData.modifiedAt,
          createdAt: fileData.modifiedAt,
          size: content.length,
          isDirty: false,
        };
      }

      const modMs = markdownFile.modifiedAt instanceof Date ? markdownFile.modifiedAt.getTime() : new Date(markdownFile.modifiedAt || 0).getTime();
      setCachedPreview(key, markdownFile.id, preview, modMs, markdownFile.size);

      setCurrentFile(markdownFile);
      saveToRecentFiles(markdownFile);
    } catch (err) {
      setError(toUserError(err, 'Failed to open file'));
    } finally {
      setIsLoading(false);
    }
  }, [storageProvider, recentFiles, saveToRecentFiles]);

  const saveFile = useCallback(async () => {
    if (!currentFile) {
      setError('No file to save');
      return;
    }

    const key = workspaceKeyRef.current;
    const preview = stripMarkdown(currentFile.content);

    if (!storageProvider) {
      exportToMarkdownFile(currentFile.content, currentFile.name);
      const updated = { ...currentFile, preview, isDirty: false, modifiedAt: new Date(), size: currentFile.content.length };
      setCachedPreview(key, updated.id, preview, updated.modifiedAt.getTime(), updated.size);
      setCurrentFile(updated);
      saveToRecentFiles(updated);
      showToast({
        id: `save-draft-${currentFile.id}-${Date.now()}`,
        type: 'success',
        message: `Saved & downloaded "${currentFile.name}"`,
        duration: 2200,
      });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await storageProvider.writeFile(currentFile.id, currentFile.content);
      
      const updatedFile = {
        ...currentFile,
        preview,
        isDirty: false,
        modifiedAt: new Date(),
        size: currentFile.content.length,
      };
      
      setCachedPreview(key, updatedFile.id, preview, updatedFile.modifiedAt.getTime(), updatedFile.size);
      setCurrentFile(updatedFile);
      saveToRecentFiles(updatedFile);
      showToast({
        id: `save-${currentFile.id}-${Date.now()}`,
        type: 'success',
        message: `Saved "${currentFile.name}"`,
        duration: 2200,
      });
    } catch (err) {
      const errMsg = toUserError(err, 'Failed to save file');
      setError(errMsg);
      showToast({
        id: `save-err-${currentFile.id}-${Date.now()}`,
        type: 'error',
        message: `Failed to save "${currentFile.name}": ${errMsg}`,
        duration: 4000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentFile, storageProvider, saveToRecentFiles, showToast]);

  const createFile = useCallback(async (name: string, content: string, path?: string) => {
    if (!storageProvider) {
      createDraft(name, content, path);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const newFile = await storageProvider.createFile(name, content, path);
      const preview = stripMarkdown(content);
      const key = workspaceKeyRef.current;
      
      const markdownFile: MarkdownFile = {
        id: newFile.id,
        name: newFile.name,
        content: newFile.content,
        preview,
        path: newFile.path || path || newFile.name,
        provider: newFile.provider,
        modifiedAt: newFile.modifiedAt,
        createdAt: new Date(),
        size: content.length,
        isDirty: false,
        isPinned: false,
      };

      const modMs = markdownFile.modifiedAt instanceof Date ? markdownFile.modifiedAt.getTime() : new Date(markdownFile.modifiedAt || 0).getTime();
      setCachedPreview(key, markdownFile.id, preview, modMs, markdownFile.size);

      setCurrentFile(markdownFile);
      saveToRecentFiles(markdownFile);
    } catch (err) {
      setError(toUserError(err, 'Failed to create file'));
    } finally {
      setIsLoading(false);
    }
  }, [storageProvider, createDraft, saveToRecentFiles]);

  const duplicateFile = useCallback(async (fileId: string) => {
    const target = recentFiles.find((f) => f.id === fileId);
    if (!target) return;

    let baseName = target.name.replace(/\.md$/i, '');
    let copyName = `${baseName}-copy.md`;
    let copyIndex = 2;
    while (recentFiles.some((f) => f.name.toLowerCase() === copyName.toLowerCase())) {
      copyName = `${baseName}-copy-${copyIndex}.md`;
      copyIndex++;
    }

    await createFile(copyName, target.content, target.path);
  }, [recentFiles, createFile]);

  const togglePinFile = useCallback((fileId: string) => {
    const currentKey = workspaceKeyRef.current;
    const currentPinned = getPinnedIds(currentKey);
    let updatedPinned: string[];
    if (currentPinned.includes(fileId)) {
      updatedPinned = currentPinned.filter((id) => id !== fileId);
    } else {
      updatedPinned = [...currentPinned, fileId];
    }
    savePinnedIds(currentKey, updatedPinned);

    setRecentFiles((prev) =>
      prev.map((file) => ({
        ...file,
        isPinned: updatedPinned.includes(file.id),
      }))
    );

    if (currentFile?.id === fileId) {
      setCurrentFile((prev) => (prev ? { ...prev, isPinned: updatedPinned.includes(fileId) } : null));
    }
  }, [currentFile]);

  const moveFile = useCallback(async (fileId: string, destinationFolderPath: string) => {
    const target = recentFiles.find((f) => f.id === fileId);
    if (!target) return;

    const cleanDest = destinationFolderPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim();
    const newPath = cleanDest ? `${cleanDest}/${target.name}` : target.name;
    if (target.path === newPath) return;

    const previousPath = target.path;
    const destName = cleanDest ? (cleanDest.split('/').pop() || cleanDest) : 'Root Vault';
    const toastId = `move-${fileId}-${Date.now()}`;

    // 1. Optimistic UI update immediately
    setRecentFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, path: newPath, isMoving: true } : f))
    );
    if (currentFile?.id === fileId) {
      setCurrentFile((prev) => (prev ? { ...prev, path: newPath, isMoving: true } : null));
    }

    showToast({
      id: toastId,
      type: 'loading',
      message: `Moving "${target.name}" into "${destName}"...`,
    });

    try {
      if (storageProvider?.moveFile) {
        await storageProvider.moveFile(fileId, cleanDest);
      }

      // Success: clear isMoving and persist
      const key = workspaceKeyRef.current;
      setRecentFiles((prev) => {
        const updated = prev.map((f) => (f.id === fileId ? { ...f, path: newPath, isMoving: false } : f));
        if (key === 'local_vault') {
          setToStorage(STORAGE_KEYS.RECENT_FILES, updated);
          setToStorage(`mandrak_recent_${key}`, updated);
        }
        return updated;
      });

      if (currentFile?.id === fileId) {
        setCurrentFile((prev) => (prev ? { ...prev, path: newPath, isMoving: false } : null));
      }

      showToast({
        id: toastId,
        type: 'success',
        message: `Moved "${target.name}" into "${destName}"`,
        duration: 3200,
      });
    } catch (err) {
      // Rollback on failure
      setRecentFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, path: previousPath, isMoving: false } : f))
      );
      if (currentFile?.id === fileId) {
        setCurrentFile((prev) => (prev ? { ...prev, path: previousPath, isMoving: false } : null));
      }
      showToast({
        id: toastId,
        type: 'error',
        message: `Failed to move "${target.name}": ${toUserError(err, 'Move failed')}`,
        duration: 4500,
      });
    }
  }, [recentFiles, storageProvider, currentFile, showToast]);

  const moveFolder = useCallback(async (sourceFolderPath: string, destinationFolderPath: string) => {
    const cleanSrc = sourceFolderPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim();
    const cleanDest = destinationFolderPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim();
    if (!cleanSrc) return;

    if (cleanDest === cleanSrc || cleanDest.startsWith(`${cleanSrc}/`)) {
      return;
    }

    const folderName = cleanSrc.split('/').pop()!;
    const newFolderPath = cleanDest ? `${cleanDest}/${folderName}` : folderName;
    if (newFolderPath === cleanSrc) return;

    const key = workspaceKeyRef.current;
    const destName = cleanDest ? (cleanDest.split('/').pop() || cleanDest) : 'Root Vault';
    const toastId = `move-folder-${Date.now()}`;

    showToast({
      id: toastId,
      type: 'loading',
      message: `Moving folder "${folderName}" into "${destName}"...`,
    });

    try {
      // 1. Update files
      setRecentFiles((prev) => {
        const updated = prev.map((file) => {
          const filePath = file.path.replace(/\\/g, '/');
          if (filePath.startsWith(`${cleanSrc}/`)) {
            const suffix = filePath.slice(cleanSrc.length);
            return { ...file, path: `${newFolderPath}${suffix}` };
          }
          return file;
        });
        if (key === 'local_vault') {
          setToStorage(STORAGE_KEYS.RECENT_FILES, updated);
          setToStorage(`mandrak_recent_${key}`, updated);
        }
        return updated;
      });

      // 2. Update customFolders
      setCustomFolders((prev) => {
        const updated = prev
          .map((f) => {
            if (f === cleanSrc) return newFolderPath;
            if (f.startsWith(`${cleanSrc}/`)) {
              return `${newFolderPath}${f.slice(cleanSrc.length)}`;
            }
            return f;
          })
          .filter((f, idx, arr) => arr.indexOf(f) === idx);

        if (!updated.includes(newFolderPath)) {
          updated.push(newFolderPath);
        }
        saveStoredFolders(key, updated);
        return updated;
      });

      if (currentFile && currentFile.path.startsWith(`${cleanSrc}/`)) {
        const suffix = currentFile.path.slice(cleanSrc.length);
        setCurrentFile((prev) => (prev ? { ...prev, path: `${newFolderPath}${suffix}` } : null));
      }

      showToast({
        id: toastId,
        type: 'success',
        message: `Moved folder "${folderName}" into "${destName}"`,
        duration: 3200,
      });
    } catch (err) {
      showToast({
        id: toastId,
        type: 'error',
        message: `Failed to move folder: ${toUserError(err, 'Move failed')}`,
        duration: 4500,
      });
    }
  }, [currentFile, showToast]);

  const deleteFile = useCallback(async (fileId: string) => {
    setIsLoading(true);
    setError(null);
    const key = workspaceKeyRef.current;

    try {
      if (storageProvider) {
        await storageProvider.deleteFile(fileId);
      }
      
      removeCachedPreview(key, fileId);

      if (currentFile?.id === fileId) {
        setCurrentFile(null);
      }

      setRecentFiles((prev) => {
        const updated = prev.filter((f) => f.id !== fileId);
        if (key === 'local_vault') {
          setToStorage(STORAGE_KEYS.RECENT_FILES, updated);
          setToStorage(`mandrak_recent_${key}`, updated);
        }
        return updated;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file');
    } finally {
      setIsLoading(false);
    }
  }, [storageProvider, currentFile]);

  const renameFile = useCallback(async (_fileId: string, _newName: string) => {
    setError('Rename functionality not yet implemented');
  }, []);

  const closeFile = useCallback(() => {
    setCurrentFile(null);
  }, []);

  const updateFileContent = useCallback((content: string) => {
    if (currentFile) {
      const preview = stripMarkdown(content);
      const updated: MarkdownFile = {
        ...currentFile,
        content,
        preview,
        isDirty: true,
        size: content.length,
      };
      setCurrentFile(updated);
      setRecentFiles((prev) =>
        prev.map((f) =>
          f.id === currentFile.id ? { ...f, preview, isDirty: true, size: content.length } : f
        )
      );
    }
  }, [currentFile]);

  const filteredFiles = recentFiles.filter((file) => {
    const query = searchQuery.toLowerCase();
    const name = file.name.toLowerCase();
    const content = file.preview
      ? file.preview.toLowerCase()
      : stripMarkdown(file.content).toLowerCase();
    return name.includes(query) || content.includes(query);
  });

  const createFolder = useCallback((folderPath: string) => {
    const cleanPath = folderPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim();
    if (!cleanPath) return;
    const currentKey = workspaceKeyRef.current;
    setCustomFolders((prev) => {
      if (prev.includes(cleanPath)) return prev;
      const updated = [...prev, cleanPath];
      saveStoredFolders(currentKey, updated);
      return updated;
    });
  }, []);

  return {
    currentFile,
    recentFiles: filteredFiles,
    customFolders,
    toasts,
    dismissToast,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    openFile,
    saveFile,
    createFile,
    createFolder,
    duplicateFile,
    togglePinFile,
    moveFile,
    moveFolder,
    deleteFile,
    renameFile,
    updateFileContent,
    createDraft,
    closeFile,
  };
}