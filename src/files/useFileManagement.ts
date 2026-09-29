import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { MarkdownFile, FileState, FileOperations } from '../types/file';
import type { ToastMessage } from '../components/Toast';
import { StorageProvider } from '../storage/StorageProvider';
import { getFromStorage, setToStorage } from '../utils/storageHelpers';
import { STORAGE_KEYS } from '../config/constants';
import { stripMarkdown, normalizeMarkdown } from '../utils/markdownParser';
import { sanitizeFileContent } from '../utils/htmlSanitizer';
import { toUserError } from '../utils/securityErrors';
import { ensureMarkdownFileName, validateFileName } from '../utils/fileValidation';
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
  if (storageProvider.type === 'github') {
    const repoInfo = (storageProvider as any).getRepoInfo?.();
    if (repoInfo?.owner && repoInfo?.repo) {
      return `github_${repoInfo.owner}_${repoInfo.repo}_${repoInfo.branch || 'main'}`;
    }
    return `github_${storageProvider.name}`;
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

interface StoredTabsData {
  openTabIds: string[];
  activeTabId: string | null;
}

function getStoredTabs(workspaceKey: string): StoredTabsData {
  try {
    const raw = localStorage.getItem(`mandrak_tabs_${workspaceKey}`);
    return raw ? JSON.parse(raw) : { openTabIds: [], activeTabId: null };
  } catch {
    return { openTabIds: [], activeTabId: null };
  }
}

function saveStoredTabs(workspaceKey: string, data: StoredTabsData): void {
  try {
    localStorage.setItem(`mandrak_tabs_${workspaceKey}`, JSON.stringify(data));
  } catch {}
}

export function useFileManagement(storageProvider: StorageProvider | null): FileState & FileOperations & {
  customFolders: string[];
  toasts: ToastMessage[];
  showToast: (toast: ToastMessage) => void;
  dismissToast: (id: string) => void;
  setSearchQuery: (query: string) => void;
  updateFileContent: (content: string) => void;
  createDraft: (name: string, content: string, path?: string) => void;
  createFile: (name: string, content: string, path?: string, commitMessage?: string) => Promise<void>;
  createFolder: (folderPath: string) => void;
  duplicateFile: (fileId: string) => Promise<void>;
  togglePinFile: (fileId: string) => void;
  moveFile: (fileId: string, destinationFolderPath: string) => Promise<void>;
  moveFolder: (sourceFolderPath: string, destinationFolderPath: string) => Promise<void>;
  closeFile: (fileId?: string) => void;
  closeTab: (fileId: string) => void;
  closeOtherTabs: (fileId: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (fileId: string) => void;
  reorderTabs: (startIndex: number, endIndex: number) => void;
  syncSavedContent: (fileId: string, normalizedContent: string) => void;
  updateFileById: (fileId: string, newContent: string) => Promise<void>;
} {
  const workspaceKey = getWorkspaceKey(storageProvider);
  const workspaceKeyRef = useRef(workspaceKey);
  workspaceKeyRef.current = workspaceKey;

  const [openTabs, setOpenTabs] = useState<MarkdownFile[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [recentFiles, setRecentFiles] = useState<MarkdownFile[]>([]);
  const [customFolders, setCustomFolders] = useState<string[]>(() => getStoredFolders(workspaceKey));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Derived current active document
  const currentFile = useMemo(() => {
    if (!activeTabId || openTabs.length === 0) return null;
    return openTabs.find((tab) => tab.id === activeTabId) || null;
  }, [openTabs, activeTabId]);

  const showToast = useCallback((toast: ToastMessage) => {
    setToasts((prev) => {
      const filtered = prev.filter((t) => t.id !== toast.id);
      return [...filtered, toast];
    });
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Helper to persist current tab session to localStorage
  const persistTabs = useCallback((tabs: MarkdownFile[], activeId: string | null) => {
    const key = workspaceKeyRef.current;
    saveStoredTabs(key, {
      openTabIds: tabs.map((t) => t.id),
      activeTabId: activeId,
    });
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

  // Helper to load local vault files and restore open tabs
  const loadLocalVaultFiles = useCallback(() => {
    const key = 'local_vault';
    const stored = getFromStorage<MarkdownFile[]>(`mandrak_recent_${key}`, []) || [];
    const legacy = stored.length > 0 ? stored : getFromStorage<MarkdownFile[]>(STORAGE_KEYS.RECENT_FILES, []) || [];
    const pinnedIds = getPinnedIds(key);

    const normalized: MarkdownFile[] = (legacy || []).map((file) => ({
      ...file,
      provider: 'local' as const,
      isPinned: pinnedIds.includes(file.id),
      savedContent: file.content || '',
      isDirty: false,
      modifiedAt: file.modifiedAt instanceof Date ? file.modifiedAt : new Date(file.modifiedAt || Date.now()),
      createdAt: file.createdAt instanceof Date ? file.createdAt : new Date(file.createdAt || Date.now()),
      preview: file.preview || (file.content ? stripMarkdown(file.content) : undefined),
    }));

    const hydrated = hydrateFilesWithCachedPreviews(key, normalized);
    setRecentFiles(hydrated);
    setCustomFolders(getStoredFolders(key));

    // Restore saved open tabs for local vault
    const tabSession = getStoredTabs(key);
    if (tabSession.openTabIds.length > 0) {
      const restoredTabs: MarkdownFile[] = [];
      for (const tabId of tabSession.openTabIds) {
        const found = hydrated.find((f) => f.id === tabId);
        if (found) {
          restoredTabs.push(found);
        }
      }
      if (restoredTabs.length > 0) {
        setOpenTabs(restoredTabs);
        const validActive =
          tabSession.activeTabId && restoredTabs.some((t) => t.id === tabSession.activeTabId)
            ? tabSession.activeTabId
            : restoredTabs[0].id;
        setActiveTabId(validActive);
      }
    }
  }, []);

  // Whenever workspace / storageProvider changes, completely switch isolated state & restore tabs
  useEffect(() => {
    setOpenTabs([]);
    setActiveTabId(null);
    setSearchQuery('');
    setError(null);
    setRecentFiles([]);

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
          savedContent: file.content || '',
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

        // 2. Restore open tabs for this cloud workspace
        const tabSession = getStoredTabs(currentKey);
        if (tabSession.openTabIds.length > 0) {
          const tabFilesToOpen = hydratedFiles.filter((f) => tabSession.openTabIds.includes(f.id));
          if (tabFilesToOpen.length > 0) {
            // Read contents for open tabs
            const loadedTabs: MarkdownFile[] = [];
            for (const file of tabFilesToOpen) {
              if (cancelled) return;
              try {
                const rawContent = await storageProvider.readFile(file.id);
                const content = sanitizeFileContent(rawContent);
                const preview = stripMarkdown(content);
                loadedTabs.push({ ...file, content, savedContent: content, preview, isDirty: false });
              } catch {
                // If reading fails, still keep skeleton
                loadedTabs.push({ ...file, isDirty: false });
              }
            }
            if (!cancelled && loadedTabs.length > 0) {
              setOpenTabs(loadedTabs);
              const validActive =
                tabSession.activeTabId && loadedTabs.some((t) => t.id === tabSession.activeTabId)
                  ? tabSession.activeTabId
                  : loadedTabs[0].id;
              setActiveTabId(validActive);
            }
          }
        }

        // 3. Identify files that still need background preview streaming
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

  const setActiveTab = useCallback((fileId: string) => {
    setActiveTabId(fileId);
    setOpenTabs((prev) => {
      persistTabs(prev, fileId);
      return prev;
    });
  }, [persistTabs]);

  const closeTab = useCallback((fileId: string) => {
    setOpenTabs((prev) => {
      const index = prev.findIndex((t) => t.id === fileId);
      if (index === -1) return prev;

      const updated = prev.filter((t) => t.id !== fileId);
      let nextActiveId = activeTabId;

      if (activeTabId === fileId) {
        if (updated.length > 0) {
          const nextIndex = Math.min(index, updated.length - 1);
          nextActiveId = updated[nextIndex].id;
        } else {
          nextActiveId = null;
        }
        setActiveTabId(nextActiveId);
      }

      persistTabs(updated, nextActiveId);
      return updated;
    });
  }, [activeTabId, persistTabs]);

  const closeOtherTabs = useCallback((fileId: string) => {
    setOpenTabs((prev) => {
      const target = prev.find((t) => t.id === fileId);
      if (!target) return prev;
      const updated = [target];
      setActiveTabId(fileId);
      persistTabs(updated, fileId);
      return updated;
    });
  }, [persistTabs]);

  const closeAllTabs = useCallback(() => {
    setOpenTabs([]);
    setActiveTabId(null);
    persistTabs([], null);
  }, [persistTabs]);

  const reorderTabs = useCallback((startIndex: number, endIndex: number) => {
    setOpenTabs((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(startIndex, 1);
      if (moved) {
        updated.splice(endIndex, 0, moved);
        persistTabs(updated, activeTabId);
      }
      return updated;
    });
  }, [activeTabId, persistTabs]);

  const createDraft = useCallback((name: string, content: string, path?: string) => {
    const safeName = ensureMarkdownFileName(name);
    const cleanDir = path ? path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') : '';
    const fullPath = cleanDir ? `${cleanDir}/${safeName}` : safeName;
    const preview = stripMarkdown(content);
    const draftFile: MarkdownFile = {
      id: `draft_${Date.now()}`,
      name: safeName,
      content,
      savedContent: content,
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

    setOpenTabs((prev) => {
      const updated = [...prev.filter((t) => t.id !== draftFile.id), draftFile];
      persistTabs(updated, draftFile.id);
      return updated;
    });
    setActiveTabId(draftFile.id);
    saveToRecentFiles(draftFile);
  }, [saveToRecentFiles, persistTabs]);

  const openFile = useCallback(async (fileId: string) => {
    // Check if already open in tabs
    const alreadyOpen = openTabs.find((t) => t.id === fileId);
    if (alreadyOpen) {
      setActiveTab(fileId);
      return;
    }

    if (!storageProvider) {
      const existingDraft = recentFiles.find((f) => f.id === fileId);
      if (existingDraft) {
        setOpenTabs((prev) => {
          const updated = [...prev, existingDraft];
          persistTabs(updated, fileId);
          return updated;
        });
        setActiveTabId(fileId);
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
          savedContent: content,
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
          savedContent: content,
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

      setOpenTabs((prev) => {
        const updated = [...prev.filter((t) => t.id !== fileId), markdownFile];
        persistTabs(updated, fileId);
        return updated;
      });
      setActiveTabId(fileId);
      saveToRecentFiles(markdownFile);
    } catch (err) {
      setError(toUserError(err, 'Failed to open file'));
    } finally {
      setIsLoading(false);
    }
  }, [openTabs, storageProvider, recentFiles, setActiveTab, saveToRecentFiles, persistTabs]);

  const saveFile = useCallback(async (commitMessage?: string) => {
    if (!currentFile) {
      setError('No file to save');
      return;
    }

    const key = workspaceKeyRef.current;
    const preview = stripMarkdown(currentFile.content);

    if (!storageProvider) {
      const updated = {
        ...currentFile,
        preview,
        savedContent: currentFile.content,
        isDirty: false,
        modifiedAt: new Date(),
        size: currentFile.content.length,
      };
      setCachedPreview(key, updated.id, preview, updated.modifiedAt.getTime(), updated.size);

      setOpenTabs((prev) =>
        prev.map((t) => (t.id === currentFile.id ? updated : t))
      );
      saveToRecentFiles(updated);
      showToast({
        id: `save-draft-${currentFile.id}-${Date.now()}`,
        type: 'success',
        message: `Saved "${currentFile.name}"`,
        duration: 2000,
      });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await storageProvider.writeFile(currentFile.id, currentFile.content, commitMessage);

      const updatedFile = {
        ...currentFile,
        preview,
        savedContent: currentFile.content,
        isDirty: false,
        modifiedAt: new Date(),
        size: currentFile.content.length,
      };

      setCachedPreview(key, updatedFile.id, preview, updatedFile.modifiedAt.getTime(), updatedFile.size);
      setOpenTabs((prev) =>
        prev.map((t) => (t.id === currentFile.id ? updatedFile : t))
      );
      saveToRecentFiles(updatedFile);
      const successMessage = storageProvider.type === 'github'
        ? `Committed "${currentFile.name}" to GitHub`
        : `Saved "${currentFile.name}"`;
      showToast({
        id: `save-${currentFile.id}-${Date.now()}`,
        type: 'success',
        message: successMessage,
        duration: 2500,
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

  const updateFileById = useCallback(
    async (fileId: string, newContent: string) => {
      const target = recentFiles.find((f) => f.id === fileId);
      if (!target) return;

      const preview = stripMarkdown(newContent);
      const key = workspaceKeyRef.current;
      const updatedFile: MarkdownFile = {
        ...target,
        content: newContent,
        savedContent: newContent,
        preview,
        modifiedAt: new Date(),
        size: newContent.length,
        isDirty: false,
      };

      if (storageProvider && storageProvider.isAuthenticated) {
        try {
          await storageProvider.writeFile(target.id, newContent);
        } catch (err) {
          console.error('Failed to auto-sync connected wikilink to storage provider:', err);
        }
      }

      setCachedPreview(key, updatedFile.id, preview, updatedFile.modifiedAt.getTime(), updatedFile.size);

      setOpenTabs((prev) =>
        prev.map((t) => (t.id === fileId ? { ...t, content: newContent, savedContent: newContent, preview, isDirty: false } : t))
      );

      saveToRecentFiles(updatedFile);
    },
    [recentFiles, storageProvider, saveToRecentFiles]
  );

  const createFile = useCallback(async (name: string, content: string, path?: string, commitMessage?: string) => {
    if (!storageProvider) {
      createDraft(name, content, path);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const newFile = await storageProvider.createFile(name, content, path, commitMessage);
      const preview = stripMarkdown(content);
      const key = workspaceKeyRef.current;

      const markdownFile: MarkdownFile = {
        id: newFile.id,
        name: newFile.name,
        content: newFile.content,
        savedContent: newFile.content,
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

      setOpenTabs((prev) => {
        const updated = [...prev, markdownFile];
        persistTabs(updated, markdownFile.id);
        return updated;
      });
      setActiveTabId(markdownFile.id);
      saveToRecentFiles(markdownFile);
    } catch (err) {
      setError(toUserError(err, 'Failed to create file'));
    } finally {
      setIsLoading(false);
    }
  }, [storageProvider, createDraft, saveToRecentFiles, persistTabs]);

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

    setOpenTabs((prev) =>
      prev.map((t) => (t.id === fileId ? { ...t, isPinned: updatedPinned.includes(fileId) } : t))
    );
  }, []);

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
    setOpenTabs((prev) =>
      prev.map((t) => (t.id === fileId ? { ...t, path: newPath, isMoving: true } : t))
    );

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

      setOpenTabs((prev) =>
        prev.map((t) => (t.id === fileId ? { ...t, path: newPath, isMoving: false } : t))
      );

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
      setOpenTabs((prev) =>
        prev.map((t) => (t.id === fileId ? { ...t, path: previousPath, isMoving: false } : t))
      );
      showToast({
        id: toastId,
        type: 'error',
        message: `Failed to move "${target.name}": ${toUserError(err, 'Move failed')}`,
        duration: 4500,
      });
    }
  }, [recentFiles, storageProvider, showToast]);

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

      // 2. Update open tabs
      setOpenTabs((prev) =>
        prev.map((file) => {
          const filePath = file.path.replace(/\\/g, '/');
          if (filePath.startsWith(`${cleanSrc}/`)) {
            const suffix = filePath.slice(cleanSrc.length);
            return { ...file, path: `${newFolderPath}${suffix}` };
          }
          return file;
        })
      );

      // 3. Update customFolders
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
  }, [showToast]);

  const deleteFile = useCallback(async (fileId: string, commitMessage?: string) => {
    setIsLoading(true);
    setError(null);
    const key = workspaceKeyRef.current;

    try {
      if (storageProvider) {
        await storageProvider.deleteFile(fileId, commitMessage);
      }

      removeCachedPreview(key, fileId);

      // Close tab if open
      closeTab(fileId);

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
  }, [storageProvider, closeTab]);

  const renameFile = useCallback(
    async (fileId: string, rawNewName: string): Promise<boolean> => {
      const cleanName = ensureMarkdownFileName(rawNewName.trim());
      const validation = validateFileName(cleanName);
      if (!validation.valid) {
        const msg = validation.error || 'Invalid file name';
        setError(msg);
        showToast({
          id: `rename-err-${Date.now()}`,
          type: 'error',
          message: msg,
        });
        return false;
      }

      setIsLoading(true);
      setError(null);
      const key = workspaceKeyRef.current;

      try {
        if (storageProvider && typeof storageProvider.renameFile === 'function') {
          await storageProvider.renameFile(fileId, cleanName);
        }

        setOpenTabs((prev) => {
          const updated = prev.map((tab) => {
            if (tab.id === fileId) {
              const oldPath = tab.path || '';
              const parts = oldPath.split('/');
              parts[parts.length - 1] = cleanName;
              const newPath = parts.join('/');
              return { ...tab, name: cleanName, path: newPath };
            }
            return tab;
          });
          persistTabs(updated, activeTabId);
          return updated;
        });

        setRecentFiles((prev) => {
          const updated = prev.map((f) => {
            if (f.id === fileId) {
              const oldPath = f.path || '';
              const parts = oldPath.split('/');
              parts[parts.length - 1] = cleanName;
              const newPath = parts.join('/');
              return { ...f, name: cleanName, path: newPath };
            }
            return f;
          });
          if (key === 'local_vault') {
            setToStorage(STORAGE_KEYS.RECENT_FILES, updated);
            setToStorage(`mandrak_recent_${key}`, updated);
          }
          return updated;
        });

        showToast({
          id: `rename-success-${Date.now()}`,
          type: 'success',
          message: `Renamed to "${cleanName}"`,
          duration: 2000,
        });
        return true;
      } catch (err) {
        const msg = toUserError(err, 'Failed to rename file');
        setError(msg);
        showToast({
          id: `rename-fail-${Date.now()}`,
          type: 'error',
          message: msg,
        });
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [storageProvider, showToast, persistTabs, activeTabId]
  );

  const closeFile = useCallback((fileId?: string) => {
    const targetId = fileId || activeTabId;
    if (targetId) {
      closeTab(targetId);
    } else {
      closeAllTabs();
    }
  }, [activeTabId, closeTab, closeAllTabs]);

  const syncSavedContent = useCallback((fileId: string, normalizedContent: string) => {
    setOpenTabs((prev) =>
      prev.map((tab) => {
        if (tab.id === fileId && !tab.isDirty) {
          return { ...tab, savedContent: normalizedContent };
        }
        return tab;
      })
    );
    setRecentFiles((prev) =>
      prev.map((f) => {
        if (f.id === fileId && !f.isDirty) {
          return { ...f, savedContent: normalizedContent };
        }
        return f;
      })
    );
  }, []);

  const updateFileContent = useCallback((content: string) => {
    if (activeTabId) {
      const preview = stripMarkdown(content);

      setOpenTabs((prev) =>
        prev.map((tab) => {
          if (tab.id !== activeTabId) return tab;
          const baseSaved = tab.savedContent !== undefined ? tab.savedContent : tab.content;
          const isDirty =
            content !== baseSaved &&
            normalizeMarkdown(content) !== normalizeMarkdown(baseSaved);
          return {
            ...tab,
            content,
            preview,
            savedContent: baseSaved,
            isDirty,
            size: content.length,
          };
        })
      );

      setRecentFiles((prev) =>
        prev.map((f) => {
          if (f.id !== activeTabId) return f;
          const baseSaved = f.savedContent !== undefined ? f.savedContent : f.content;
          const isDirty =
            content !== baseSaved &&
            normalizeMarkdown(content) !== normalizeMarkdown(baseSaved);
          return {
            ...f,
            content,
            preview,
            savedContent: baseSaved,
            isDirty,
            size: content.length,
          };
        })
      );
    }
  }, [activeTabId]);

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
    openTabs,
    activeTabId,
    recentFiles,
    customFolders,
    toasts,
    showToast,
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
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    setActiveTab,
    reorderTabs,
    syncSavedContent,
    updateFileById,
  };
}