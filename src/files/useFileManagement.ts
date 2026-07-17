import { useState, useCallback, useEffect } from 'react';
import type { MarkdownFile, FileState, FileOperations } from '../types/file';
import { StorageProvider } from '../storage/StorageProvider';
import { getFromStorage, setToStorage } from '../utils/storageHelpers';
import { STORAGE_KEYS } from '../config/constants';
import { stripMarkdown } from '../utils/markdownParser';

export function useFileManagement(storageProvider: StorageProvider | null): FileState & FileOperations & {
  setSearchQuery: (query: string) => void;
  updateFileContent: (content: string) => void;
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
      setRecentFiles([]);
      setCurrentFile(null);
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
            modifiedAt: file.modifiedAt,
            createdAt: file.modifiedAt,
            size: file.size,
            isDirty: false,
          }))
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load files');
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
    setRecentFiles(stored);
  }, []);

  const saveToRecentFiles = useCallback((file: MarkdownFile) => {
    const updated = [file, ...recentFiles.filter(f => f.id !== file.id)].slice(0, 10);
    setRecentFiles(updated);
    setToStorage(STORAGE_KEYS.RECENT_FILES, updated);
  }, [recentFiles]);

  const openFile = useCallback(async (fileId: string) => {
    if (!storageProvider) {
      setError('No storage provider selected');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const content = await storageProvider.readFile(fileId);
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
      setError(err instanceof Error ? err.message : 'Failed to open file');
    } finally {
      setIsLoading(false);
    }
  }, [storageProvider, recentFiles, saveToRecentFiles]);

  const saveFile = useCallback(async () => {
    if (!currentFile || !storageProvider) {
      setError('No file to save');
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
      setError(err instanceof Error ? err.message : 'Failed to save file');
    } finally {
      setIsLoading(false);
    }
  }, [currentFile, storageProvider, saveToRecentFiles]);

  const createFile = useCallback(async (name: string, content: string) => {
    if (!storageProvider) {
      setError('No storage provider selected');
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
      setError(err instanceof Error ? err.message : 'Failed to create file');
    } finally {
      setIsLoading(false);
    }
  }, [storageProvider, saveToRecentFiles]);

  const deleteFile = useCallback(async (fileId: string) => {
    if (!storageProvider) {
      setError('No storage provider selected');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await storageProvider.deleteFile(fileId);
      
      if (currentFile?.id === fileId) {
        setCurrentFile(null);
      }

      setRecentFiles(prev => prev.filter(f => f.id !== fileId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file');
    } finally {
      setIsLoading(false);
    }
  }, [storageProvider, currentFile]);

  const renameFile = useCallback(async (_fileId: string, _newName: string) => {
    // This would need to be implemented per storage provider
    // For now, we'll update the local state
    setError('Rename functionality not yet implemented');
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
    updateFileContent
  };
}