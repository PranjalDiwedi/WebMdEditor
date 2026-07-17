import { useCallback, useEffect, useState } from 'react';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
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
    <Modal isOpen={isOpen} onClose={onCancel} title="Choose a Google Drive folder">
      <div className="drive-folder-picker">
        <p className="drive-folder-picker-hint">
          Pick a folder to browse markdown files inside it (including subfolders),
          or search your entire Drive.
        </p>

        {error && <div className="error-message">{error}</div>}

        <button
          type="button"
          className="drive-folder-option"
          onClick={() => onSelect(null, 'All Google Drive')}
        >
          <span className="drive-folder-option-icon">🌐</span>
          <span>
            <strong>All Google Drive</strong>
            <small>Search markdown files everywhere in your Drive</small>
          </span>
        </button>

        <div className="drive-folder-browser">
          <div className="drive-breadcrumbs">
            {breadcrumbs.map((crumb, index) => (
              <span key={crumb.id}>
                {index > 0 && <span className="drive-breadcrumb-sep">/</span>}
                <button
                  type="button"
                  className="drive-breadcrumb"
                  onClick={() => navigateTo(index)}
                >
                  {crumb.name}
                </button>
              </span>
            ))}
          </div>

          {isLoading ? (
            <div className="drive-folder-loading">Loading folders...</div>
          ) : folders.length === 0 ? (
            <div className="drive-folder-empty">No subfolders here</div>
          ) : (
            <ul className="drive-folder-list">
              {folders.map((folder) => (
                <li key={folder.id}>
                  <button
                    type="button"
                    className="drive-folder-item"
                    onClick={() => openFolder(folder)}
                  >
                    <span>📁</span>
                    {folder.name}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="drive-folder-actions">
            <Button
              onClick={() => onSelect(currentFolderId, currentFolderName)}
            >
              Use &quot;{currentFolderName}&quot;
            </Button>
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
