import { useCallback, useEffect, useState } from 'react';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { GoogleDriveIcon } from '../components/GoogleDriveIcon';
import type { GoogleDriveProvider } from './GoogleDriveProvider';

interface DriveFolderPickerProps {
  provider: GoogleDriveProvider;
  isOpen: boolean;
  onSelect: (folderId: string | null, folderName: string) => void;
  onCancel: () => void;
}

interface FolderEntry {
  id: string;
  name: string;
}

export function DriveFolderPicker({
  provider,
  isOpen,
  onSelect,
  onCancel,
}: DriveFolderPickerProps) {
  const [currentFolderId, setCurrentFolderId] = useState('root');
  const [breadcrumbs, setBreadcrumbs] = useState<FolderEntry[]>([
    { id: 'root', name: 'My Drive' },
  ]);
  const [folders, setFolders] = useState<FolderEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFolders = useCallback(async (parentId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await provider.listChildFolders(parentId);
      setFolders(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load folders');
    } finally {
      setIsLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    if (isOpen) {
      setCurrentFolderId('root');
      setBreadcrumbs([{ id: 'root', name: 'My Drive' }]);
      loadFolders('root');
    }
  }, [isOpen, loadFolders]);

  const openFolder = (folder: FolderEntry) => {
    setCurrentFolderId(folder.id);
    setBreadcrumbs((prev) => [...prev, folder]);
    loadFolders(folder.id);
  };

  const navigateTo = (index: number) => {
    const crumb = breadcrumbs[index];
    setCurrentFolderId(crumb.id);
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
    loadFolders(crumb.id);
  };

  const currentFolderName =
    breadcrumbs[breadcrumbs.length - 1]?.name || 'My Drive';

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="Choose Google Drive Folder">
      <div className="drive-picker-container">
        <p className="drive-picker-subtitle">
          Select a folder to browse and edit your markdown notes, or search your entire Drive.
        </p>

        {error && <div className="error-message">{error}</div>}

        {/* Option 1: Entire Drive */}
        <button
          type="button"
          className="drive-root-option"
          onClick={() => onSelect(null, 'All Google Drive')}
        >
          <div className="drive-root-icon-wrapper" style={{ background: 'rgba(66, 133, 244, 0.12)' }}>
            <GoogleDriveIcon size={20} />
          </div>
          <div className="drive-root-text">
            <strong>All Google Drive</strong>
            <span>Search & browse markdown files across your entire Drive</span>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16" style={{ color: 'var(--text-muted)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <div className="drive-browser-card">
          {/* Breadcrumb Bar */}
          <div className="drive-breadcrumb-bar">
            {breadcrumbs.map((crumb, index) => (
              <span key={crumb.id} className="drive-crumb-item">
                {index > 0 && <span className="drive-crumb-sep">/</span>}
                <button
                  type="button"
                  className={`drive-crumb-btn ${index === breadcrumbs.length - 1 ? 'active' : ''}`}
                  onClick={() => navigateTo(index)}
                >
                  {index === 0 ? '📁 My Drive' : crumb.name}
                </button>
              </span>
            ))}
          </div>

          {/* Folder List */}
          <div className="drive-list-wrapper">
            {isLoading ? (
              <div className="drive-loading-state">
                <div className="loading-spinner" style={{ width: '24px', height: '24px' }}></div>
                <span>Loading folders...</span>
              </div>
            ) : folders.length === 0 ? (
              <div className="drive-empty-state">
                <span>📂</span>
                <p>No subfolders in this folder</p>
              </div>
            ) : (
              <div className="drive-folders-grid">
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    className="drive-folder-pill"
                    onClick={() => openFolder(folder)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <span className="drive-folder-name">{folder.name}</span>
                    <svg className="drive-arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="14" height="14">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="drive-modal-footer">
            <Button
              variant="secondary"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              onClick={() => onSelect(currentFolderId, currentFolderName)}
            >
              Select &quot;{currentFolderName}&quot;
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

