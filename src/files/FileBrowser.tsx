import type { MarkdownFile } from '../types/file';
import { formatFileSize } from '../utils/fileValidation';
import { stripMarkdown } from '../utils/markdownParser';

interface FileBrowserProps {
  files: MarkdownFile[];
  currentFile: MarkdownFile | null;
  onFileSelect: (fileId: string) => void;
  onCreateFile: () => void;
  onDeleteFile?: (fileId: string, fileName: string, e: React.MouseEvent) => void;
  onToggleSidebar?: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

function formatRelativeTime(dateInput: Date | string | number | undefined | null): string {
  if (!dateInput) return 'Recently';
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return 'Recently';

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 0 || diffInSeconds < 60) return 'Just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays}d ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function FileBrowser({
  files,
  currentFile,
  onFileSelect,
  onCreateFile,
  onDeleteFile,
  onToggleSidebar,
  searchQuery,
  onSearchChange
}: FileBrowserProps) {
  return (
    <div className="file-browser">
      <div className="sidebar-header">
        <div className="sidebar-title-group">
          <span>Notes</span>
          <span className="sidebar-count-badge">{files.length}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button
            className="btn-new-file"
            onClick={onCreateFile}
            title="Create new note (⌘N)"
            aria-label="Create new note"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            <span>New</span>
          </button>
          {onToggleSidebar && (
            <button
              type="button"
              className="sidebar-toggle-btn"
              onClick={onToggleSidebar}
              title="Collapse sidebar (⌘B)"
              aria-label="Collapse sidebar"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="search-container">
        <div className="search-input-wrapper">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery ? (
            <button
              className="search-clear-btn"
              onClick={() => onSearchChange('')}
              title="Clear search"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="14" height="14">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <span className="search-shortcut-badge">⌘K</span>
          )}
        </div>
      </div>

      <div className="file-list">
        {files.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📝</div>
            <p>{searchQuery ? 'No matching notes found' : 'No markdown notes yet'}</p>
            <button onClick={onCreateFile} className="btn-new-file">
              Create your first note
            </button>
          </div>
        ) : (
          files.map((file) => {
            const isActive = currentFile?.id === file.id;
            const previewText = stripMarkdown(file.content) || 'Empty note...';
            return (
              <div
                key={file.id}
                className={`file-item-card ${isActive ? 'active' : ''}`}
                onClick={() => onFileSelect(file.id)}
              >
                <div className="file-card-header">
                  <span className="file-card-title">{file.name}</span>
                  <span className="file-card-time">{formatRelativeTime(file.modifiedAt)}</span>
                </div>
                <div className="file-card-preview">{previewText}</div>
                <div className="file-card-footer">
                  <span className="file-card-size">{formatFileSize(file.size)}</span>
                  <div className="file-card-footer-right">
                    {file.isDirty && (
                      <span className="unsaved-dot" title="Unsaved changes" />
                    )}
                    {onDeleteFile && (
                      <button
                        type="button"
                        className="file-card-delete-btn"
                        title={`Delete "${file.name}"`}
                        aria-label={`Delete ${file.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteFile(file.id, file.name, e);
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="13" height="13">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}