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
import { MainLayout } from './layout/MainLayout';
import { Modal } from './components/Modal';
import { Button } from './components/Button';
import { SettingsModal } from './components/SettingsModal';
import { exportToMarkdownFile, exportToHTMLFile, printContent } from './utils/exportHelpers';
import { ensureMarkdownFileName } from './utils/fileValidation';
import './App.css';

function App() {
  const { user, isAuthenticated, isLoading: authLoading, error: authError, signIn, signOut } = useAuth();
  const [storageProvider, setStorageProvider] = useState<StorageProvider | null>(null);
  const [pendingDriveProvider, setPendingDriveProvider] = useState<GoogleDriveProvider | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

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
    updateFileContent
  } = useFileManagement(storageProvider);

  // Handle theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

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
    if (newFileName.trim()) {
      await createFile(ensureMarkdownFileName(newFileName.trim()), '');
      setShowCreateModal(false);
      setNewFileName('');
    }
  }, [newFileName, createFile]);

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

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      if (currentFile) {
        handleSaveFile();
      }
    }
  }, [currentFile, handleSaveFile]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (authLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
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
                <h1>Web MD Editor</h1>
              </div>
              <div className="header-right">
                {storageProvider && (
                  <ProviderSelector
                    onProviderSelected={handleProviderSelected}
                    currentProvider={storageProvider}
                    variant="compact"
                  />
                )}
                {isAuthenticated && user ? (
                  <SignOut onSignOut={signOut} user={user} />
                ) : (
                  <button
                    type="button"
                    className="sign-out-button hidden"
                    onClick={signIn}
                    disabled={authLoading}
                  >
                    Sign in with Google
                  </button>
                )}
              </div>
            </header>
          }
          sidebar={
            storageProvider ? (
              <FileBrowser
                files={recentFiles}
                currentFile={currentFile}
                onFileSelect={openFile}
                onCreateFile={() => setShowCreateModal(true)}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              />
            ) : (
              <div className="no-provider-message">
                <p>Pick a storage source to browse files</p>
              </div>
            )
          }
        >
          <div className="editor-section">
            {authError && (
              <div className="error-message auth-banner-error">
                {authError}
              </div>
            )}

            {fileLoading && (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading file...</p>
              </div>
            )}

            {fileError && (
              <div className="error-message">
                {fileError}
              </div>
            )}

            {!storageProvider && (
              <div className="storage-picker-panel">
                <ProviderSelector
                  onProviderSelected={handleProviderSelected}
                  onDriveAuthenticated={handleDriveAuthenticated}
                  currentProvider={null}
                  variant="full"
                />
              </div>
            )}

            {storageProvider && !currentFile && (
              <div className="no-file-selected">
                <div className="no-file-icon">📄</div>
                <h2>No File Selected</h2>
                <p>Select a file from the sidebar or create a new one</p>
                <Button onClick={() => setShowCreateModal(true)}>
                  Create New File
                </Button>
              </div>
            )}

            {currentFile && (
              <div className="editor-container">
                <div className="editor-header">
                  <h2>{currentFile.name}</h2>
                  <div className="file-meta">
                    <span className="file-size">
                      {currentFile.content.length} characters
                    </span>
                    {currentFile.isDirty && (
                      <span className="unsaved-indicator">Unsaved changes</span>
                    )}
                    <div className="editor-actions">
                      <div className="export-menu">
                        <button
                          className="export-button"
                          onClick={() => setShowExportMenu(!showExportMenu)}
                        >
                          <span>Export</span>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {showExportMenu && (
                          <div className="export-dropdown">
                            <div className="export-dropdown-item" onClick={handleExportMarkdown}>
                              <span className="export-dropdown-icon">📄</span>
                              Export as Markdown
                            </div>
                            <div className="export-dropdown-item" onClick={handleExportHTML}>
                              <span className="export-dropdown-icon">🌐</span>
                              Export as HTML
                            </div>
                            <div className="export-dropdown-item" onClick={handlePrint}>
                              <span className="export-dropdown-icon">🖨️</span>
                              Print
                            </div>
                          </div>
                        )}
                      </div>
                      <button
                        className="settings-button"
                        onClick={() => setShowSettings(true)}
                        title="Settings"
                      >
                        ⚙️
                      </button>
                    </div>
                  </div>
                </div>
                <TipTapEditor
                  content={currentFile.content}
                  onContentChange={updateFileContent}
                  onSave={handleSaveFile}
                  isDirty={currentFile.isDirty}
                  isSaving={fileLoading}
                />
              </div>
            )}
          </div>
        </MainLayout>

        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Create New File"
        >
          <div className="create-file-modal">
            <input
              type="text"
              className="file-name-input"
              placeholder="Enter file name (e.g., notes — .md added automatically)"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              autoFocus
            />
            <div className="modal-actions">
              <Button
                variant="secondary"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateFile}
                disabled={!newFileName.trim()}
              >
                Create
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