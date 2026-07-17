import type { MarkdownFile } from '../types/file';
import { formatFileSize } from '../utils/fileValidation';
import { stripMarkdown } from '../utils/markdownParser';

interface FileBrowserProps {
  files: MarkdownFile[];
  currentFile: MarkdownFile | null;
  onFileSelect: (fileId: string) => void;
  onCreateFile: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function FileBrowser({ 
  files, 
  currentFile, 
  onFileSelect, 
  onCreateFile,
  searchQuery,
  onSearchChange
}: FileBrowserProps) {
  return (
    <div className="file-browser">
      <div className="file-browser-header">
        <h2>Files</h2>
        <button 
          className="create-file-button"
          onClick={onCreateFile}
          title="Create new file"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="file-list">
        {files.length === 0 ? (
          <div className="empty-state">
            <p>No markdown files found</p>
            <button onClick={onCreateFile} className="create-first-file">
              Create your first file
            </button>
          </div>
        ) : (
          files.map((file) => (
            <div
              key={file.id}
              className={`file-item ${currentFile?.id === file.id ? 'active' : ''}`}
              onClick={() => onFileSelect(file.id)}
            >
              <div className="file-icon">📄</div>
              <div className="file-info">
                <div className="file-name">{file.name}</div>
                <div className="file-preview">
                  {stripMarkdown(file.content) || 'Empty file'}
                </div>
                <div className="file-meta">
                  <span className="file-size">{formatFileSize(file.size)}</span>
                  <span className="file-date">
                    {file.modifiedAt.toLocaleDateString()}
                  </span>
                </div>
              </div>
              {file.isDirty && (
                <div className="dirty-indicator" title="Unsaved changes">
                  ●
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}