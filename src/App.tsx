import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { MarkdownFile } from './types/file';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SignOut } from './auth/SignOut';
import { useAuth } from './auth/useAuth';
import { ProviderSelector } from './storage/ProviderSelector';
import { StorageProvider } from './storage/StorageProvider';
import { GoogleDriveProvider } from './storage/GoogleDriveProvider';
import { GitHubProvider } from './storage/GitHubProvider';
import type { GitHubRepositoryItem } from './storage/GitHubProvider';
import { DriveFolderPicker } from './storage/DriveFolderPicker';
import { GitHubConnectModal } from './storage/GitHubConnectModal';
import { GitHubRepoPicker } from './storage/GitHubRepoPicker';
import { CommitModal } from './components/CommitModal';
import { FileBrowser } from './files/FileBrowser';
import { useFileManagement } from './files/useFileManagement';
import { TipTapEditor } from './editor/TipTapEditor';
import { EditorTabs } from './editor/EditorTabs';
import type { ViewMode } from './editor/TipTapEditor';
import { NetworkView } from './graph/NetworkView';
import { MainLayout } from './layout/MainLayout';
import { Modal } from './components/Modal';
import { Button } from './components/Button';
import { SettingsModal } from './components/SettingsModal';
import { ToastContainer } from './components/Toast';
import { MandrakLogo } from './components/MandrakLogo';
import { preloadGoogleScripts } from './utils/googleScripts';
import { OAUTH_CONFIGS } from './config/constants';
import { exportToMarkdownFile, exportToHTMLFile, printContent } from './utils/exportHelpers';
import { ensureMarkdownFileName, validateFileName } from './utils/fileValidation';
import { modSymbol, focusSearchInput } from './utils/keyboard';
import './App.css';

const NOTE_TEMPLATES = [
  {
    id: 'blank',
    name: '⚡ Blank Note',
    defaultTitle: 'untitled.md',
    content: `# Untitled Note\n\nStart writing your markdown here...\n`,
  },
  {
    id: 'meeting',
    name: '📝 Meeting Notes',
    defaultTitle: 'meeting-notes.md',
    content: `# 📝 Meeting Notes\n\n**Date:** ${new Date().toLocaleDateString()}  \n**Participants:**  \n- [ ] \n\n---\n\n## 🎯 Objectives\n1. \n\n## 💬 Discussion\n- \n\n## ⚡ Action Items\n- [ ] **Task 1**\n`,
  },
  {
    id: 'roadmap',
    name: '🎯 Project Roadmap',
    defaultTitle: 'project-roadmap.md',
    content: `# 🎯 Project Roadmap\n\n> High-level strategy & milestones.\n\n---\n\n## 🚀 Milestones\n- [x] Initial design\n- [ ] Implementation\n- [ ] Testing & Launch\n`,
  },
  {
    id: 'journal',
    name: '📔 Daily Journal',
    defaultTitle: 'daily-journal.md',
    content: `# 📔 Daily Journal — ${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}\n\n### ☀️ Morning Intentions\n1. \n\n### 💡 Notes\n- \n\n### 🌙 Evening Reflection\n- \n`,
  },
];

function App() {
  const { user, isAuthenticated, isLoading: authLoading, error: authError, signOut } = useAuth();
  const [storageProvider, setStorageProvider] = useState<StorageProvider | null>(null);
  const [pendingDriveProvider, setPendingDriveProvider] = useState<GoogleDriveProvider | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('blank');
  const [createNameError, setCreateNameError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<{ id: string; name: string } | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('webmd_theme') as 'light' | 'dark') || 'dark';
  });

  const [showGitHubModal, setShowGitHubModal] = useState(false);
  const [pendingGitHubProvider, setPendingGitHubProvider] = useState<GitHubProvider | null>(null);
  const [showGitHubRepoPicker, setShowGitHubRepoPicker] = useState(false);
  const [showCommitModal, setShowCommitModal] = useState(false);
  const [createFolderPath, setCreateFolderPath] = useState<string | undefined>(undefined);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [parentFolderPath, setParentFolderPath] = useState<string | undefined>(undefined);
  const [createFolderError, setCreateFolderError] = useState<string | null>(null);

  const {
    currentFile,
    openTabs,
    activeTabId,
    recentFiles,
    customFolders,
    toasts,
    dismissToast,
    isLoading: fileLoading,
    error: fileError,
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
    updateFileContent,
    createDraft,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    setActiveTab,
    reorderTabs,
    syncSavedContent,
    updateFileById,
  } = useFileManagement(storageProvider);

  const [tabToCloseWithWarning, setTabToCloseWithWarning] = useState<MarkdownFile | null>(null);

  const handleRequestCloseTab = useCallback((tabId: string) => {
    const targetTab = openTabs.find((t) => t.id === tabId);
    if (targetTab && targetTab.isDirty) {
      setTabToCloseWithWarning(targetTab);
    } else {
      closeTab(tabId);
    }
  }, [openTabs, closeTab]);

  const handleConfirmSaveAndClose = useCallback(async () => {
    if (tabToCloseWithWarning) {
      if (activeTabId === tabToCloseWithWarning.id) {
        await saveFile();
      }
      closeTab(tabToCloseWithWarning.id);
      setTabToCloseWithWarning(null);
    }
  }, [tabToCloseWithWarning, activeTabId, saveFile, closeTab]);

  const handleConfirmDiscardAndClose = useCallback(() => {
    if (tabToCloseWithWarning) {
      closeTab(tabToCloseWithWarning.id);
      setTabToCloseWithWarning(null);
    }
  }, [tabToCloseWithWarning, closeTab]);

  const [fileToMove, setFileToMove] = useState<MarkdownFile | null>(null);

  const availableFolders = useMemo(() => {
    const folders = new Set<string>();
    for (const folder of customFolders) {
      const clean = folder.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
      if (clean) folders.add(clean);
    }
    for (const file of recentFiles) {
      const rawPath = file.path && file.path !== '/' && file.path !== '.' ? file.path : '';
      const cleanPath = rawPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
      const parts = cleanPath ? cleanPath.split('/') : [];
      const folderParts = parts.length > 0 && parts[parts.length - 1].toLowerCase() === file.name.toLowerCase()
        ? parts.slice(0, -1)
        : parts;
      if (folderParts.length > 0) {
        folders.add(folderParts.join('/'));
      }
    }
    return Array.from(folders).sort();
  }, [customFolders, recentFiles]);

  const currentFileFolder = useMemo(() => {
    if (!fileToMove) return '';
    const rawPath = fileToMove.path && fileToMove.path !== '/' && fileToMove.path !== '.' ? fileToMove.path : '';
    const cleanPath = rawPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const parts = cleanPath ? cleanPath.split('/') : [];
    const folderParts = parts.length > 0 && parts[parts.length - 1].toLowerCase() === fileToMove.name.toLowerCase()
      ? parts.slice(0, -1)
      : parts;
    return folderParts.join('/');
  }, [fileToMove]);

  // Preload Google Identity Services and Google Drive API for smooth popups across Firefox & Chrome
  useEffect(() => {
    preloadGoogleScripts(OAUTH_CONFIGS.google.apiKey || undefined);
  }, []);

  // Handle OAuth popup window callbacks (e.g. GitHub / Dropbox / OneDrive)
  const hasPostedOAuthCallbackRef = useRef(false);
  useEffect(() => {
    if (window.opener && window.location.pathname.includes('/auth/callback')) {
      if (hasPostedOAuthCallbackRef.current) return;
      hasPostedOAuthCallbackRef.current = true;

      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const token = params.get('token') || params.get('access_token');
      const error = params.get('error_description') || params.get('error');
      try {
        window.opener.postMessage(
          { type: 'GITHUB_OAUTH_CALLBACK', code, token, error },
          window.location.origin
        );
      } catch {}
      window.close();
    }
  }, []);

  // Handle theme changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('webmd_theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const toggleSidebar = useCallback(() => {
    if (window.innerWidth <= 768) {
      setMobileMenuOpen((prev) => !prev);
    } else {
      setSidebarCollapsed((prev) => !prev);
    }
  }, []);

  const handleOpenFile = useCallback((fileId: string) => {
    openFile(fileId);
    setMobileMenuOpen(false);
  }, [openFile]);

  const handleGoHome = useCallback(() => {
    closeAllTabs();
    setStorageProvider(null);
    setMobileMenuOpen(false);
  }, [closeAllTabs]);

  const handleProviderSelected = useCallback((provider: StorageProvider | null) => {
    setStorageProvider(provider);
    if (provider && window.innerWidth <= 768) {
      setMobileMenuOpen(true);
    }
  }, []);

  const handleDriveAuthenticated = useCallback((provider: GoogleDriveProvider) => {
    setPendingDriveProvider(provider);
  }, []);

  const handleDriveFolderSelected = useCallback(
    (folderId: string | null, folderName: string) => {
      if (!pendingDriveProvider) return;
      pendingDriveProvider.setTargetFolder(folderId, folderName);
      setStorageProvider(pendingDriveProvider);
      setPendingDriveProvider(null);
      if (window.innerWidth <= 768) {
        setMobileMenuOpen(true);
      }
    },
    [pendingDriveProvider]
  );

  const handleDriveFolderCancel = useCallback(() => {
    pendingDriveProvider?.disconnect();
    setPendingDriveProvider(null);
  }, [pendingDriveProvider]);

  const handleOpenCreateModal = useCallback((folderPath?: string) => {
    setCreateFolderPath(folderPath);
    setNewFileName('');
    setCreateNameError(null);
    setSelectedTemplateId('blank');
    setShowCreateModal(true);
    setMobileMenuOpen(false);
  }, []);

  const handleCreateFile = useCallback(async () => {
    if (!newFileName.trim() || isCreatingNote) return;

    const validation = validateFileName(newFileName.trim());
    if (!validation.valid) {
      setCreateNameError(validation.error || 'Invalid file name');
      return;
    }

    const safeName = ensureMarkdownFileName(newFileName.trim());
    const finalValidation = validateFileName(safeName);
    if (!finalValidation.valid) {
      setCreateNameError(finalValidation.error || 'Invalid file name');
      return;
    }

    const selectedTmpl = NOTE_TEMPLATES.find((t) => t.id === selectedTemplateId);
    const initialContent = selectedTmpl ? selectedTmpl.content : '';

    setCreateNameError(null);
    setIsCreatingNote(true);

    try {
      await createFile(safeName, initialContent, createFolderPath);
      setShowCreateModal(false);
      setNewFileName('');
      setCreateFolderPath(undefined);
    } catch (err) {
      setCreateNameError(err instanceof Error ? err.message : 'Failed to create note');
    } finally {
      setIsCreatingNote(false);
    }
  }, [newFileName, selectedTemplateId, isCreatingNote, createFile, createFolderPath]);

  const handleOpenCreateFolderModal = useCallback((parentPath?: string) => {
    setParentFolderPath(parentPath);
    setNewFolderName('');
    setCreateFolderError(null);
    setShowCreateFolderModal(true);
    setMobileMenuOpen(false);
  }, []);

  const handleCreateFolderSubmit = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newFolderName.trim().replace(/^[\\/]+|[\\/]+$/g, '');
    if (!trimmed) {
      setCreateFolderError('Please enter a folder name');
      return;
    }
    if (/[<>:"|?*]/.test(trimmed)) {
      setCreateFolderError('Folder name cannot contain invalid characters (<>:"|?*)');
      return;
    }
    const fullPath = parentFolderPath ? `${parentFolderPath}/${trimmed}` : trimmed;
    createFolder(fullPath);
    setShowCreateFolderModal(false);
    setNewFolderName('');
    setParentFolderPath(undefined);
    setCreateFolderError(null);
  }, [newFolderName, parentFolderPath, createFolder]);

  const handleCreateFromTemplateDirect = useCallback((fileName: string, content: string) => {
    if (storageProvider) {
      createFile(ensureMarkdownFileName(fileName), content);
    } else {
      createDraft(fileName, content);
    }
  }, [storageProvider, createFile, createDraft]);

  const handleGitHubAuthenticated = useCallback((provider: GitHubProvider) => {
    setPendingGitHubProvider(provider);
    setShowGitHubModal(false);
    setShowGitHubRepoPicker(true);
  }, []);

  const handleGitHubRepoSelected = useCallback(
    (repo: GitHubRepositoryItem, branch: string) => {
      if (!pendingGitHubProvider) return;
      pendingGitHubProvider.selectRepository(repo, branch);
      setStorageProvider(pendingGitHubProvider);
      setPendingGitHubProvider(null);
      setShowGitHubRepoPicker(false);
      if (window.innerWidth <= 768) {
        setMobileMenuOpen(true);
      }
    },
    [pendingGitHubProvider]
  );

  const handleGitHubBackToAuth = useCallback(() => {
    setShowGitHubRepoPicker(false);
    setShowGitHubModal(true);
  }, []);

  const handleGitHubCancel = useCallback(() => {
    pendingGitHubProvider?.disconnect();
    setPendingGitHubProvider(null);
    setShowGitHubRepoPicker(false);
  }, [pendingGitHubProvider]);

  const handleSaveFile = useCallback(async () => {
    if (storageProvider?.type === 'github') {
      if (currentFile) {
        setShowCommitModal(true);
      }
    } else {
      await saveFile();
    }
  }, [storageProvider, currentFile, saveFile]);

  const handleConfirmCommit = useCallback(async (commitMessage: string) => {
    await saveFile(commitMessage);
    setShowCommitModal(false);
  }, [saveFile]);

  const handleExportMarkdown = useCallback(() => {
    if (currentFile) {
      exportToMarkdownFile(currentFile.content, currentFile.name);
      setShowExportMenu(false);
    }
  }, [currentFile]);

  const handleExportHTML = useCallback(() => {
    if (currentFile) {
      exportToHTMLFile(currentFile.content, currentFile.name);
      setShowExportMenu(false);
    }
  }, [currentFile]);

  const handlePrint = useCallback(() => {
    if (currentFile) {
      printContent(currentFile.content);
      setShowExportMenu(false);
    }
  }, [currentFile]);

  // Global Keyboard Shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      const target = e.target as HTMLElement | null;
      const isInsideEditor = target ? target.closest('.tiptap-editor-content') !== null || target.isContentEditable : false;
      const isInsideInput = target ? target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' : false;

      if (isMod) {
        // 1. Save Note: Mod+S
        if (key === 's') {
          e.preventDefault();
          if (currentFile) {
            handleSaveFile();
          }
          return;
        }

        // 2. Close Active Tab: Mod+W
        if (key === 'w') {
          e.preventDefault();
          if (currentFile) {
            handleRequestCloseTab(currentFile.id);
          }
          return;
        }

        // 3. Cycle View Mode: Mod+P
        if (key === 'p') {
          e.preventDefault();
          setViewMode((prev) => (prev === 'edit' ? 'split' : prev === 'split' ? 'preview' : 'edit'));
          return;
        }

        // 4. Create New Note: Mod+N
        if (key === 'n' && !e.shiftKey) {
          e.preventDefault();
          handleOpenCreateModal();
          return;
        }

        // 5. Toggle Sidebar: Mod+\ (or Mod+B when not in editor/input)
        if (e.key === '\\' || (!isInsideEditor && !isInsideInput && key === 'b')) {
          e.preventDefault();
          toggleSidebar();
          return;
        }

        // 6. Search Focus: Mod+K (when not inside editor)
        if (key === 'k') {
          if (!isInsideEditor) {
            e.preventDefault();
            if (sidebarCollapsed) {
              setSidebarCollapsed(false);
            }
            if (!mobileMenuOpen) {
              setMobileMenuOpen(true);
            }
            setTimeout(() => {
              focusSearchInput();
            }, 50);
            return;
          }
        }

        // 7. Switch Tab via Mod+Alt+1..9
        if (e.altKey && !isInsideEditor && !isInsideInput) {
          const num = parseInt(key, 10);
          if (!isNaN(num) && num >= 1 && num <= 9) {
            const targetTab = openTabs[num - 1];
            if (targetTab) {
              e.preventDefault();
              setActiveTab(targetTab.id);
              return;
            }
          }
        }
      }

      // 8. Cycle Tabs with Ctrl+Tab or Ctrl+Shift+Tab
      if (e.key === 'Tab' && e.ctrlKey) {
        e.preventDefault();
        if (openTabs.length > 1) {
          const currentIndex = openTabs.findIndex((t) => t.id === activeTabId);
          if (currentIndex !== -1) {
            const nextIndex = e.shiftKey
              ? (currentIndex - 1 + openTabs.length) % openTabs.length
              : (currentIndex + 1) % openTabs.length;
            setActiveTab(openTabs[nextIndex].id);
          }
        }
        return;
      }

      // 9. Switch Previous / Next Tab with Alt+Mod+ArrowLeft / ArrowRight or Ctrl+PageUp / PageDown
      if (
        (isMod && e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) ||
        (e.ctrlKey && (e.key === 'PageUp' || e.key === 'PageDown'))
      ) {
        e.preventDefault();
        if (openTabs.length > 1) {
          const isPrev = e.key === 'ArrowLeft' || e.key === 'PageUp';
          const currentIndex = openTabs.findIndex((t) => t.id === activeTabId);
          if (currentIndex !== -1) {
            const nextIndex = isPrev
              ? (currentIndex - 1 + openTabs.length) % openTabs.length
              : (currentIndex + 1) % openTabs.length;
            setActiveTab(openTabs[nextIndex].id);
          }
        }
        return;
      }

      // 6. Escape Key Handler
      if (e.key === 'Escape') {
        if (showCreateModal) {
          if (!isCreatingNote) {
            setShowCreateModal(false);
            setCreateNameError(null);
            setCreateFolderPath(undefined);
          }
        } else if (showCreateFolderModal) {
          setShowCreateFolderModal(false);
          setCreateFolderError(null);
          setParentFolderPath(undefined);
        } else if (showSettings) {
          setShowSettings(false);
        } else if (fileToDelete) {
          setFileToDelete(null);
        } else if (fileToMove) {
          setFileToMove(null);
        } else if (mobileMenuOpen) {
          setMobileMenuOpen(false);
        } else if (showExportMenu) {
          setShowExportMenu(false);
        }
      }
    },
    [
      currentFile,
      openTabs,
      activeTabId,
      setActiveTab,
      handleRequestCloseTab,
      handleSaveFile,
      handleOpenCreateModal,
      toggleSidebar,
      sidebarCollapsed,
      mobileMenuOpen,
      showCreateModal,
      isCreatingNote,
      showCreateFolderModal,
      showSettings,
      fileToDelete,
      fileToMove,
      showExportMenu,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (authLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading workspace...</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="app">
        <MainLayout
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={toggleSidebar}
          mobileMenuOpen={mobileMenuOpen}
          onMobileMenuToggle={toggleSidebar}
          onCloseMobileMenu={() => setMobileMenuOpen(false)}
          header={
            <header className="app-header">
              <div className="header-left">
                {(storageProvider || recentFiles.length > 0) && (
                  <button
                    type="button"
                    className={`sidebar-header-toggle-btn ${mobileMenuOpen ? 'active' : ''}`}
                    onClick={toggleSidebar}
                    title={mobileMenuOpen ? 'Close Notes Sidebar' : `Toggle Notes Sidebar (${modSymbol}\\)`}
                    aria-label="Toggle Notes Sidebar"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18">
                      {mobileMenuOpen ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      )}
                    </svg>
                  </button>
                )}

                <button
                  type="button"
                  className="brand-badge"
                  onClick={handleGoHome}
                  title="Go to Homepage"
                  aria-label="Mandrak Homepage"
                >
                  <MandrakLogo size={22} animated={true} />
                  <span className="brand-text">Mandrak</span>
                  {/* <span className="brand-pill">v2.0</span> */}
                </button>

                {storageProvider && (
                  <ProviderSelector
                    onProviderSelected={handleProviderSelected}
                    currentProvider={storageProvider}
                    variant="compact"
                  />
                )}
              </div>

              {/* View Mode Switcher in Header (when a file or vault is active) */}
              {(currentFile || recentFiles.length > 0) && (
                <div className="header-center">
                  <div className="view-mode-switcher">
                    <button
                      type="button"
                      className={`view-mode-btn ${viewMode === 'edit' ? 'active' : ''}`}
                      onClick={() => setViewMode('edit')}
                      title="Edit Mode"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      className={`view-mode-btn ${viewMode === 'split' ? 'active' : ''}`}
                      onClick={() => setViewMode('split')}
                      title={`Split View (${modSymbol}P)`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 4H5a2 2 0 00-2 2v12a2 2 0 002 2h4m6-16h4a2 2 0 012 2v12a2 2 0 01-2 2h-4m-3-16v16" />
                      </svg>
                      <span>Split</span>
                    </button>
                    <button
                      type="button"
                      className={`view-mode-btn ${viewMode === 'preview' ? 'active' : ''}`}
                      onClick={() => setViewMode('preview')}
                      title="Reader Preview"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span>Preview</span>
                    </button>
                    <button
                      type="button"
                      className={`view-mode-btn ${viewMode === 'network' ? 'active' : ''}`}
                      onClick={() => setViewMode('network')}
                      title="Knowledge Network Graph (Betweenness Centrality)"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="6" cy="6" r="2.5" strokeWidth={2} />
                        <circle cx="18" cy="6" r="2.5" strokeWidth={2} />
                        <circle cx="12" cy="18" r="2.5" strokeWidth={2} />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.5 6h7M7.5 8.5l3 7M16.5 8.5l-3 7" />
                      </svg>
                      <span>Network</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="header-right">
                {/* 1-Click Sun/Moon Theme Switcher */}
                <button
                  type="button"
                  className="icon-btn"
                  onClick={toggleTheme}
                  title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
                  aria-label="Toggle theme"
                >
                  {theme === 'light' ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  )}
                </button>

                {/* Export Dropdown */}
                {currentFile && (
                  <div className="export-menu">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => setShowExportMenu(!showExportMenu)}
                      title="Export Note"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </button>
                    {showExportMenu && (
                      <div className="export-dropdown">
                        <div className="export-dropdown-item" onClick={handleExportMarkdown}>
                          <span>📄</span> Export as Markdown
                        </div>
                        <div className="export-dropdown-item" onClick={handleExportHTML}>
                          <span>🌐</span> Export as HTML
                        </div>
                        <div className="export-dropdown-item" onClick={handlePrint}>
                          <span>🖨️</span> Print / PDF
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Settings Gear */}
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setShowSettings(true)}
                  title="Settings & Shortcuts"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>

                {isAuthenticated && user && (
                  <SignOut onSignOut={signOut} user={user} />
                )}
              </div>
            </header>
          }
          sidebar={
            storageProvider || recentFiles.length > 0 ? (
              <FileBrowser
                files={recentFiles}
                currentFile={currentFile}
                onFileSelect={handleOpenFile}
                onCreateFile={handleOpenCreateModal}
                onCreateFolder={handleOpenCreateFolderModal}
                onDuplicateFile={duplicateFile}
                onTogglePin={togglePinFile}
                onMoveFile={moveFile}
                onMoveFolder={moveFolder}
                onOpenMoveModal={setFileToMove}
                onDeleteFile={(fileId, fileName) => setFileToDelete({ id: fileId, name: fileName })}
                onToggleSidebar={toggleSidebar}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                storageName={storageProvider ? storageProvider.name : recentFiles.length > 0 ? 'Local Vault' : 'Notes'}
                customFolders={customFolders}
                isLoading={fileLoading}
              />
            ) : (
              <div className="empty-state">
                <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
                  <button
                    type="button"
                    className="sidebar-toggle-btn"
                    onClick={toggleSidebar}
                    title={`Collapse sidebar (${modSymbol}\\)`}
                    aria-label="Collapse sidebar"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                    </svg>
                  </button>
                </div>
                <div className="empty-state-icon">📂</div>
                <p>Pick a storage source to browse notes</p>
              </div>
            )
          }
        >
          <div className="editor-section">
            {authError && (
              <div className="error-message">
                {authError}
              </div>
            )}

            {fileLoading && viewMode !== 'network' && (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading note...</p>
              </div>
            )}

            {fileError && (
              <div className="error-message">
                {fileError}
              </div>
            )}

            {/* Multi-Tab Workspace Strip */}
            {openTabs.length > 0 && (
              <EditorTabs
                tabs={openTabs}
                activeTabId={activeTabId}
                onSelectTab={setActiveTab}
                onCloseTab={handleRequestCloseTab}
                onCloseOtherTabs={closeOtherTabs}
                onCloseAllTabs={closeAllTabs}
                onNewTab={() => handleOpenCreateModal()}
                onReorderTabs={reorderTabs}
              />
            )}

            {/* Network View Mode */}
            {viewMode === 'network' ? (
              <div className="editor-container network-mode-container">
                <NetworkView
                  files={recentFiles}
                  currentFile={currentFile}
                  theme={theme}
                  onOpenFile={(fileId) => {
                    openFile(fileId);
                    setViewMode('edit');
                  }}
                  onUpdateFileContent={updateFileById}
                  onCreateDraft={(name, content, path) => {
                    createDraft(name, content, path);
                    setViewMode('edit');
                  }}
                  onExitView={() => setViewMode('edit')}
                />
              </div>
            ) : (
              <>
                {/* Landing Hero Screen when no storage is connected and no note/tabs are open */}
                {!storageProvider && openTabs.length === 0 && (
                  <ProviderSelector
                    onProviderSelected={handleProviderSelected}
                    onDriveAuthenticated={handleDriveAuthenticated}
                    onRequestGitHub={() => setShowGitHubModal(true)}
                    onSelectTemplate={handleCreateFromTemplateDirect}
                    currentProvider={null}
                    variant="full"
                  />
                )}

                {/* Empty State when storage is connected but no tabs are open */}
                {storageProvider && openTabs.length === 0 && (
                  <div className="empty-state" style={{ height: '100%', justifyContent: 'center' }}>
                    <div className="empty-state-icon">📝</div>
                    <h2>No Note Selected</h2>
                    <p>Pick a note from the sidebar or start writing a new one</p>
                    <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                      <button
                        type="button"
                        className="btn-browse-notes"
                        onClick={toggleSidebar}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          padding: '0.55rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          transition: 'all 0.18s ease'
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                        <span>Browse Notes</span>
                      </button>
                      <button
                        type="button"
                        className="btn-new-file"
                        onClick={() => setShowCreateModal(true)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                        <span>Create New Note</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Active Editor Canvas */}
                {currentFile && (
                  <div className="editor-container">
                    <TipTapEditor
                      key={currentFile.id}
                      content={currentFile.content}
                      onContentChange={updateFileContent}
                      onSave={handleSaveFile}
                      onInit={(initialMd) => syncSavedContent(currentFile.id, initialMd)}
                      isDirty={currentFile.isDirty}
                      isSaving={fileLoading}
                      viewMode={viewMode}
                      vaultFiles={recentFiles}
                      currentFileId={currentFile.id}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </MainLayout>

        {/* Create Note Modal with Template Preview */}
        <Modal
          isOpen={showCreateModal}
          onClose={() => {
            if (!isCreatingNote) {
              setShowCreateModal(false);
              setCreateNameError(null);
              setCreateFolderPath(undefined);
            }
          }}
          title={createFolderPath ? `Create Note in "${createFolderPath}"` : "Create New Note"}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateFile();
            }}
            className="create-file-modal"
          >
            {createFolderPath && (
              <div style={{ padding: '0.4rem 0.65rem', background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>📁</span>
                <span>Destination folder: <strong>{createFolderPath}</strong></span>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Template
              </label>
              <div className="theme-selector" style={{ flexWrap: 'wrap' }}>
                {NOTE_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    type="button"
                    disabled={isCreatingNote}
                    className={`theme-option ${selectedTemplateId === tmpl.id ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedTemplateId(tmpl.id);
                      if (!newFileName || NOTE_TEMPLATES.some((t) => t.defaultTitle === newFileName)) {
                        setNewFileName(tmpl.defaultTitle);
                      }
                    }}
                  >
                    {tmpl.name}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Note Title
              </label>
              <input
                type="text"
                disabled={isCreatingNote}
                className="file-name-input"
                placeholder="e.g. project-roadmap.md"
                value={newFileName}
                onChange={(e) => {
                  setNewFileName(e.target.value);
                  setCreateNameError(null);
                }}
                autoFocus
              />
              {createNameError && (
                <div className="error-message">{createNameError}</div>
              )}
            </div>

            <div className="modal-actions">
              <Button
                variant="secondary"
                type="button"
                disabled={isCreatingNote}
                onClick={() => {
                  if (!isCreatingNote) {
                    setShowCreateModal(false);
                    setCreateNameError(null);
                  }
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!newFileName.trim() || isCreatingNote}
              >
                {isCreatingNote ? (
                  <span className="btn-loading-dots">
                    Creating<span className="dot dot-1">.</span><span className="dot dot-2">.</span><span className="dot dot-3">.</span>
                  </span>
                ) : (
                  'Create Note'
                )}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Delete Note Confirmation Modal */}
        <Modal
          isOpen={!!fileToDelete}
          onClose={() => setFileToDelete(null)}
          title="Delete Note"
        >
          <div className="delete-modal-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Are you sure you want to permanently delete <strong style={{ color: 'var(--text-primary)' }}>&ldquo;{fileToDelete?.name}&rdquo;</strong>?
            </p>
            <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)', margin: 0 }}>
              This will remove the file from your workspace. This action cannot be undone.
            </p>
            <div className="modal-actions">
              <Button
                variant="secondary"
                onClick={() => setFileToDelete(null)}
              >
                Cancel
              </Button>
              <button
                type="button"
                className="btn-danger"
                onClick={async () => {
                  if (fileToDelete) {
                    await deleteFile(fileToDelete.id);
                    setFileToDelete(null);
                  }
                }}
              >
                Delete Note
              </button>
            </div>
          </div>
        </Modal>

        {pendingDriveProvider && (
          <DriveFolderPicker
            provider={pendingDriveProvider}
            isOpen
            onSelect={handleDriveFolderSelected}
            onCancel={handleDriveFolderCancel}
          />
        )}

        {/* Create Folder Modal */}
        <Modal
          isOpen={showCreateFolderModal}
          onClose={() => {
            setShowCreateFolderModal(false);
            setCreateFolderError(null);
            setParentFolderPath(undefined);
          }}
          title={parentFolderPath ? `Create Subfolder in "${parentFolderPath}"` : "Create New Folder in Root"}
        >
          <form onSubmit={handleCreateFolderSubmit} className="create-file-modal">
            {parentFolderPath && (
              <div style={{ padding: '0.4rem 0.65rem', background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>📁</span>
                <span>Parent folder: <strong>{parentFolderPath}</strong></span>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Folder Name
              </label>
              <input
                type="text"
                className="file-name-input"
                placeholder="e.g. Projects, Journal, Work"
                value={newFolderName}
                onChange={(e) => {
                  setNewFolderName(e.target.value);
                  setCreateFolderError(null);
                }}
                autoFocus
              />
              {createFolderError && (
                <div className="error-message">{createFolderError}</div>
              )}
            </div>

            <div className="modal-actions" style={{ marginTop: '0.5rem' }}>
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  setShowCreateFolderModal(false);
                  setCreateFolderError(null);
                  setParentFolderPath(undefined);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={!newFolderName.trim()}
              >
                Create Folder
              </Button>
            </div>
          </form>
        </Modal>

        {/* Move Note to Folder Modal */}
        <Modal
          isOpen={!!fileToMove}
          onClose={() => setFileToMove(null)}
          title="Move Note to Folder"
        >
          {fileToMove && (
            <div className="move-modal-content">
              <div className="move-modal-note-info">
                <span className="move-note-icon">📄</span>
                <span className="move-note-name">{fileToMove.name}</span>
              </div>
              <div className="move-modal-current-path">
                <span>Current Location: </span>
                <strong>{currentFileFolder ? `📁 ${currentFileFolder}` : '📁 Root Vault (/)'}</strong>
              </div>

              <div className="move-modal-section-title">Select Destination:</div>
              <div className="move-modal-folder-list">
                {/* Option 1: Root Vault */}
                <button
                  type="button"
                  className={`move-folder-option ${currentFileFolder === '' ? 'disabled current' : ''}`}
                  disabled={currentFileFolder === ''}
                  onClick={() => {
                    moveFile(fileToMove.id, '');
                    setFileToMove(null);
                  }}
                >
                  <div className="move-folder-option-left">
                    <span className="move-folder-icon">📁</span>
                    <span className="move-folder-label">{storageProvider ? storageProvider.name : 'Root Vault'} (/)</span>
                  </div>
                  {currentFileFolder === '' && <span className="move-current-badge">Current</span>}
                </button>

                {/* Option 2: Custom / Subfolders */}
                {availableFolders.map((folder: string) => {
                  const isCurrent = currentFileFolder === folder;
                  return (
                    <button
                      key={folder}
                      type="button"
                      className={`move-folder-option ${isCurrent ? 'disabled current' : ''}`}
                      disabled={isCurrent}
                      onClick={() => {
                        moveFile(fileToMove.id, folder);
                        setFileToMove(null);
                      }}
                    >
                      <div className="move-folder-option-left">
                        <span className="move-folder-icon">📂</span>
                        <span className="move-folder-label">{folder}</span>
                      </div>
                      {isCurrent && <span className="move-current-badge">Current</span>}
                    </button>
                  );
                })}
              </div>

              <div className="modal-actions" style={{ marginTop: '1.25rem' }}>
                <Button variant="ghost" onClick={() => setFileToMove(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* Unsaved Changes Tab Close Warning Modal */}
        <Modal
          isOpen={!!tabToCloseWithWarning}
          onClose={() => setTabToCloseWithWarning(null)}
          title="Unsaved Changes"
        >
          <div className="unsaved-modal-content">
            <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
              Do you want to save the changes you made to <strong>{tabToCloseWithWarning?.name}</strong> before closing?
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '0.35rem' }}>
              Your changes will be lost if you don't save them.
            </p>
            <div className="modal-actions" style={{ marginTop: '1.25rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <Button
                variant="secondary"
                onClick={() => setTabToCloseWithWarning(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmDiscardAndClose}
              >
                Don't Save
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmSaveAndClose}
              >
                Save & Close
              </Button>
            </div>
          </div>
        </Modal>

        {/* GitHub Connect Modal */}
        <GitHubConnectModal
          isOpen={showGitHubModal}
          onAuthenticated={handleGitHubAuthenticated}
          onCancel={() => setShowGitHubModal(false)}
        />

        {/* GitHub Visual Repository Picker Modal */}
        {pendingGitHubProvider && (
          <GitHubRepoPicker
            provider={pendingGitHubProvider}
            isOpen={showGitHubRepoPicker}
            onSelect={handleGitHubRepoSelected}
            onCancel={handleGitHubCancel}
            onBackToAuth={handleGitHubBackToAuth}
          />
        )}

        {/* GitHub Commit Modal */}
        {storageProvider?.type === 'github' && currentFile && (
          <CommitModal
            isOpen={showCommitModal}
            fileName={currentFile.name}
            filePath={currentFile.path}
            repoName={
              (storageProvider as GitHubProvider).getRepoInfo
                ? `${(storageProvider as GitHubProvider).getRepoInfo().owner}/${(storageProvider as GitHubProvider).getRepoInfo().repo}`
                : storageProvider.name
            }
            branchName={
              (storageProvider as GitHubProvider).getRepoInfo
                ? (storageProvider as GitHubProvider).getRepoInfo().branch
                : 'main'
            }
            onConfirm={handleConfirmCommit}
            onCancel={() => setShowCommitModal(false)}
          />
        )}

        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          theme={theme}
          onThemeChange={setTheme}
        />

        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    </ErrorBoundary>
  );
}

export default App;