import { useState, useCallback, useEffect } from 'react';
import type { MarkdownFile, FileState, FileOperations } from '../types/file';
import { StorageProvider } from '../storage/StorageProvider';
import { getFromStorage, setToStorage } from '../utils/storageHelpers';
import { STORAGE_KEYS } from '../config/constants';
import { stripMarkdown } from '../utils/markdownParser';
import { sanitizeFileContent } from '../utils/htmlSanitizer';
import { toUserError } from '../utils/securityErrors';
import { ensureMarkdownFileName } from '../utils/fileValidation';
import { exportToMarkdownFile } from '../utils/exportHelpers';

export function useFileManagement(storageProvider: StorageProvider | null): FileState & FileOperations & {
  setSearchQuery: (query: string) => void;
  updateFileContent: (content: string) => void;
  createDraft: (name: string, content: string) => void;
  closeFile: () => void;
} {
  const [currentFile, setCurrentFile] = useState<MarkdownFile | null>(null);
  const [recentFiles, setRecentFiles] = useState<MarkdownFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadRecentFiles();
  }, []);

  useEffect(() => {
    if (!storageProvider?.isAuthenticated) {
      return;
    }

    let cancelled = false;

    const loadProviderFiles = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const files = await storageProvider.listFiles();
        if (cancelled) return;
        setRecentFiles(
          files.map((file) => ({
            id: file.id,
            name: file.name,
            content: file.content || '',
            path: file.path,
            provider: file.provider,
            modifiedAt: file.modifiedAt instanceof Date ? file.modifiedAt : new Date(file.modifiedAt || Date.now()),
            createdAt: file.modifiedAt instanceof Date ? file.modifiedAt : new Date(file.modifiedAt || Date.now()),
            size: file.size,
            isDirty: false,
          }))
        );
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
  }, [storageProvider]);

  const loadRecentFiles = useCallback(() => {
    const stored = getFromStorage<MarkdownFile[]>(STORAGE_KEYS.RECENT_FILES, []);
    const normalized = (stored || []).map((file) => ({
      ...file,
      modifiedAt: file.modifiedAt instanceof Date ? file.modifiedAt : new Date(file.modifiedAt || Date.now()),
      createdAt: file.createdAt instanceof Date ? file.createdAt : new Date(file.createdAt || Date.now()),
    }));
    setRecentFiles(normalized);
  }, []);

  const saveToRecentFiles = useCallback((file: MarkdownFile) => {
    const safeFile = {
      ...file,
      modifiedAt: file.modifiedAt instanceof Date ? file.modifiedAt : new Date(file.modifiedAt || Date.now()),
      createdAt: file.createdAt instanceof Date ? file.createdAt : new Date(file.createdAt || Date.now()),
    };
    const updated = [safeFile, ...recentFiles.filter(f => f.id !== file.id)].slice(0, 15);
    setRecentFiles(updated);
    setToStorage(STORAGE_KEYS.RECENT_FILES, updated);
  }, [recentFiles]);

  const createDraft = useCallback((name: string, content: string) => {
    const safeName = ensureMarkdownFileName(name);
    const draftFile: MarkdownFile = {
      id: `draft_${Date.now()}`,
      name: safeName,
      content,
      path: safeName,
      provider: 'local',
      modifiedAt: new Date(),
      createdAt: new Date(),
      size: content.length,
      isDirty: false,
    };
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
      const existing = recentFiles.find((f) => f.id === fileId);

      let markdownFile: MarkdownFile;
      if (existing) {
        markdownFile = {
          ...existing,
          content,
          isDirty: false,
          size: content.length
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
          path: fileData.path,
          provider: fileData.provider,
          modifiedAt: fileData.modifiedAt,
          createdAt: fileData.modifiedAt,
          size: content.length,
          isDirty: false,
        };
      }

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

    if (!storageProvider) {
      exportToMarkdownFile(currentFile.content, currentFile.name);
      const updated = { ...currentFile, isDirty: false, modifiedAt: new Date() };
      setCurrentFile(updated);
      saveToRecentFiles(updated);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await storageProvider.writeFile(currentFile.id, currentFile.content);
      
      const updatedFile = {
        ...currentFile,
        isDirty: false,
        modifiedAt: new Date(),
        size: currentFile.content.length
      };
      
      setCurrentFile(updatedFile);
      saveToRecentFiles(updatedFile);
    } catch (err) {
      setError(toUserError(err, 'Failed to save file'));
    } finally {
      setIsLoading(false);
    }
  }, [currentFile, storageProvider, saveToRecentFiles]);

  const createFile = useCallback(async (name: string, content: string) => {
    if (!storageProvider) {
      createDraft(name, content);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const newFile = await storageProvider.createFile(name, content);
      
      const markdownFile: MarkdownFile = {
        id: newFile.id,
        name: newFile.name,
        content: newFile.content,
        path: newFile.path,
        provider: newFile.provider,
        modifiedAt: newFile.modifiedAt,
        createdAt: new Date(),
        size: content.length,
        isDirty: false
      };

      setCurrentFile(markdownFile);
      saveToRecentFiles(markdownFile);
    } catch (err) {
      setError(toUserError(err, 'Failed to create file'));
    } finally {
      setIsLoading(false);
    }
  }, [storageProvider, createDraft, saveToRecentFiles]);

  const deleteFile = useCallback(async (fileId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      if (storageProvider) {
        await storageProvider.deleteFile(fileId);
      }
      
      if (currentFile?.id === fileId) {
        setCurrentFile(null);
      }

      setRecentFiles((prev) => {
        const updated = prev.filter((f) => f.id !== fileId);
        setToStorage(STORAGE_KEYS.RECENT_FILES, updated);
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
      setCurrentFile({
        ...currentFile,
        content,
        isDirty: true
      });
    }
  }, [currentFile]);

  const filteredFiles = recentFiles.filter(file => {
    const query = searchQuery.toLowerCase();
    const name = file.name.toLowerCase();
    const content = stripMarkdown(file.content).toLowerCase();
    return name.includes(query) || content.includes(query);
  });

  return {
    currentFile,
    recentFiles: filteredFiles,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    openFile,
    saveFile,
    createFile,
    deleteFile,
    renameFile,
    updateFileContent,
    createDraft,
    closeFile
  };
}