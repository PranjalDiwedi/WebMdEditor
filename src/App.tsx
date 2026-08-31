import { useState, useCallback, useEffect } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SignOut } from './auth/SignOut';
import { useAuth } from './auth/useAuth';
import { ProviderSelector } from './storage/ProviderSelector';
import { StorageProvider } from './storage/StorageProvider';
import { GoogleDriveProvider } from './storage/GoogleDriveProvider';
import { DriveFolderPicker } from './storage/DriveFolderPicker';
import { FileBrowser } from './files/FileBrowser';
import { useFileManagement } from './files/useFileManagement';
import { TipTapEditor } from './editor/TipTapEditor';
import type { ViewMode } from './editor/TipTapEditor';
import { MainLayout } from './layout/MainLayout';
import { Modal } from './components/Modal';
import { Button } from './components/Button';
import { SettingsModal } from './components/SettingsModal';
import { exportToMarkdownFile, exportToHTMLFile, printContent } from './utils/exportHelpers';
import { ensureMarkdownFileName, validateFileName } from './utils/fileValidation';
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
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('webmd_theme') as 'light' | 'dark') || 'dark';
  });

  const {
    currentFile,
    recentFiles,
    isLoading: fileLoading,
    error: fileError,
    searchQuery,
    setSearchQuery,
    openFile,
    saveFile,
    createFile,
    updateFileContent,
    createDraft
  } = useFileManagement(storageProvider);

  // Handle theme changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('webmd_theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const handleProviderSelected = useCallback((provider: StorageProvider | null) => {
    setStorageProvider(provider);
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
    },
    [pendingDriveProvider]
  );

  const handleDriveFolderCancel = useCallback(() => {
    pendingDriveProvider?.disconnect();
    setPendingDriveProvider(null);
  }, [pendingDriveProvider]);

  const handleCreateFile = useCallback(async () => {
    if (!newFileName.trim()) return;

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
    await createFile(safeName, initialContent);
    setShowCreateModal(false);
    setNewFileName('');
  }, [newFileName, selectedTemplateId, createFile]);

  const handleCreateFromTemplateDirect = useCallback((fileName: string, content: string) => {
    if (storageProvider) {
      createFile(ensureMarkdownFileName(fileName), content);
    } else {
      createDraft(fileName, content);
    }
  }, [storageProvider, createFile, createDraft]);

  const handleSaveFile = useCallback(async () => {
    await saveFile();
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
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey) {
      if (e.key === 's') {
        e.preventDefault();
        if (currentFile) {
          handleSaveFile();
        }
      } else if (e.key === 'p') {
        e.preventDefault();
        setViewMode((prev) => (prev === 'edit' ? 'split' : prev === 'split' ? 'preview' : 'edit'));
      } else if (e.key === 'n' && !e.shiftKey) {
        e.preventDefault();
        if (storageProvider) {
          setShowCreateModal(true);
        }
      }
    }
  }, [currentFile, storageProvider, handleSaveFile]);

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
          header={
            <header className="app-header">
              <div className="header-left">
                <div className="brand-badge" onClick={() => setStorageProvider(null)}>
                  <span className="brand-icon">✦</span>
                  <span>Web MD</span>
                  <span className="brand-pill">v2.0</span>
                </div>

                {storageProvider && (
                  <ProviderSelector
                    onProviderSelected={handleProviderSelected}
                    currentProvider={storageProvider}
                    variant="compact"
                  />
                )}
              </div>

              {/* View Mode Switcher in Header (when a file is open) */}
              {currentFile && (
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
                      title="Split View (⌘P)"
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
                onFileSelect={openFile}
                onCreateFile={() => setShowCreateModal(true)}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              />
            ) : (
              <div className="empty-state">
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

            {fileLoading && (
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

            {/* Landing Hero Screen when no storage is connected and no note is open */}
            {!storageProvider && !currentFile && (
              <ProviderSelector
                onProviderSelected={handleProviderSelected}
                onDriveAuthenticated={handleDriveAuthenticated}
                onSelectTemplate={handleCreateFromTemplateDirect}
                currentProvider={null}
                variant="full"
              />
            )}

            {/* Empty State when storage is connected but no note is selected */}
            {storageProvider && !currentFile && (
              <div className="empty-state" style={{ height: '100%', justifyContent: 'center' }}>
                <div className="empty-state-icon">📝</div>
                <h2>No Note Selected</h2>
                <p>Pick a note from the sidebar or start writing a new one</p>
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
            )}

            {/* Active Editor Canvas with 3 View Modes */}
            {currentFile && (
              <div className="editor-container">
                <div className="editor-topbar">
                  <div className="doc-title-group">
                    <svg className="doc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="doc-title">{currentFile.name}</span>
                    {currentFile.isDirty && (
                      <span className="doc-unsaved-badge">Unsaved</span>
                    )}
                  </div>
                </div>

                <TipTapEditor
                  content={currentFile.content}
                  onContentChange={updateFileContent}
                  onSave={handleSaveFile}
                  isDirty={currentFile.isDirty}
                  isSaving={fileLoading}
                  viewMode={viewMode}
                />
              </div>
            )}
          </div>
        </MainLayout>

        {/* Create Note Modal with Template Preview */}
        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Create New Note"
        >
          <div className="create-file-modal">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Template
              </label>
              <div className="theme-selector" style={{ flexWrap: 'wrap' }}>
                {NOTE_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    type="button"
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
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateNameError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateFile}
                disabled={!newFileName.trim()}
              >
                Create Note
              </Button>
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

        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          theme={theme}
          onThemeChange={setTheme}
        />
      </div>
    </ErrorBoundary>
  );
}

export default App;