import { useState, useMemo, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { GitHubIcon } from '../components/GitHubIcon';
import type { GitHubProvider, GitHubRepositoryItem } from './GitHubProvider';

interface GitHubRepoPickerProps {
  provider: GitHubProvider;
  isOpen: boolean;
  onSelect: (repo: GitHubRepositoryItem, branch: string) => void;
  onCancel: () => void;
  onBackToAuth?: () => void;
}

export function GitHubRepoPicker({
  provider,
  isOpen,
  onSelect,
  onCancel,
  onBackToAuth,
}: GitHubRepoPickerProps) {
  const [repos, setRepos] = useState<GitHubRepositoryItem[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepositoryItem | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('main');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'public' | 'private'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRepos = () => {
    setIsLoading(true);
    setError(null);
    setSelectedRepo(null);
    setBranches([]);

    provider
      .listUserRepositories()
      .then((data) => {
        setRepos(data);
        if (data.length > 0) {
          setSelectedRepo(data[0]);
          setSelectedBranch(data[0].default_branch || 'main');
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to fetch repositories');
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  // Load repositories on open
  useEffect(() => {
    if (!isOpen) return;
    loadRepos();
  }, [isOpen, provider]);

  // Load branches when selectedRepo changes
  useEffect(() => {
    if (!selectedRepo) return;

    let isMounted = true;
    setIsLoadingBranches(true);
    setSelectedBranch(selectedRepo.default_branch || 'main');

    provider
      .listBranches(selectedRepo.owner.login, selectedRepo.name)
      .then((bList) => {
        if (isMounted) {
          setBranches(bList.length > 0 ? bList : [selectedRepo.default_branch || 'main']);
        }
      })
      .catch(() => {
        if (isMounted) {
          setBranches([selectedRepo.default_branch || 'main']);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingBranches(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedRepo, provider]);

  const filteredRepos = useMemo(() => {
    return repos.filter((r) => {
      // Type filter
      if (filterType === 'private' && !r.private) return false;
      if (filterType === 'public' && r.private) return false;

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        r.name.toLowerCase().includes(q) ||
        r.full_name.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q))
      );
    });
  }, [repos, filterType, searchQuery]);

  const handleConfirm = () => {
    if (!selectedRepo) return;
    onSelect(selectedRepo, selectedBranch || selectedRepo.default_branch || 'main');
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 0) {
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        if (diffHours === 0) return 'Updated just now';
        return `Updated ${diffHours}h ago`;
      }
      if (diffDays === 1) return 'Updated yesterday';
      if (diffDays < 30) return `Updated ${diffDays}d ago`;
      return `Updated ${date.toLocaleDateString()}`;
    } catch {
      return '';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="Choose GitHub Repository">
      <div className="github-repo-picker-container">
        <div className="github-picker-header-info">
          <p className="drive-picker-subtitle" style={{ margin: 0 }}>
            Select a repository to explore, edit, and commit markdown notes with live sync.
          </p>
          {onBackToAuth && (
            <button
              type="button"
              className="github-switch-account-btn"
              onClick={onBackToAuth}
              title="Change Token / Account"
            >
              Switch Account
            </button>
          )}
        </div>

        {error && (
          <div className="error-message" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <span>{error}</span>
            <button
              type="button"
              onClick={loadRepos}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#fff',
                padding: '0.25rem 0.65rem',
                borderRadius: '4px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              🔄 Retry
            </button>
          </div>
        )}

        {/* Search & Filter Controls */}
        <div className="github-picker-controls">
          <div className="github-search-input-wrapper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search repositories..."
              className="github-search-input"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                className="github-search-clear-btn"
                onClick={() => setSearchQuery('')}
              >
                ✕
              </button>
            )}
          </div>

          <div className="github-filter-tabs">
            <button
              type="button"
              className={`github-filter-tab ${filterType === 'all' ? 'active' : ''}`}
              onClick={() => setFilterType('all')}
            >
              All ({repos.length})
            </button>
            <button
              type="button"
              className={`github-filter-tab ${filterType === 'public' ? 'active' : ''}`}
              onClick={() => setFilterType('public')}
            >
              Public
            </button>
            <button
              type="button"
              className={`github-filter-tab ${filterType === 'private' ? 'active' : ''}`}
              onClick={() => setFilterType('private')}
            >
              Private
            </button>
          </div>
        </div>

        {/* Repository Grid / List */}
        <div className="github-repos-list-card">
          {isLoading ? (
            <div className="github-repos-loading">
              <div className="loading-spinner" style={{ width: '28px', height: '28px' }} />
              <span>Fetching your repositories from GitHub...</span>
            </div>
          ) : filteredRepos.length === 0 ? (
            <div className="github-repos-empty">
              <span style={{ fontSize: '1.5rem' }}>📂</span>
              <p>No repositories found {searchQuery ? `matching "${searchQuery}"` : ''}</p>
            </div>
          ) : (
            <div className="github-repos-scroll-area">
              {filteredRepos.map((repo) => {
                const isSelected = selectedRepo?.id === repo.id;
                return (
                  <div
                    key={repo.id}
                    className={`github-repo-item-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedRepo(repo)}
                  >
                    <div className="github-repo-card-top">
                      <div className="github-repo-card-title-row">
                        {repo.owner.avatar_url ? (
                          <img
                            src={repo.owner.avatar_url}
                            alt={repo.owner.login}
                            className="github-repo-avatar"
                          />
                        ) : (
                          <div className="github-repo-avatar-placeholder">
                            <GitHubIcon size={14} />
                          </div>
                        )}
                        <span className="github-repo-full-name">{repo.full_name}</span>
                      </div>

                      <div className="github-repo-badges">
                        {repo.private ? (
                          <span className="github-badge private">🔒 Private</span>
                        ) : (
                          <span className="github-badge public">🌐 Public</span>
                        )}
                      </div>
                    </div>

                    {repo.description && (
                      <p className="github-repo-description">{repo.description}</p>
                    )}

                    <div className="github-repo-meta-row">
                      <span className="github-repo-meta-time">
                        {formatRelativeTime(repo.updated_at)}
                      </span>
                      {repo.stargazers_count > 0 && (
                        <span className="github-repo-stars">
                          ⭐ {repo.stargazers_count}
                        </span>
                      )}
                      <span className="github-repo-default-branch">
                        🌿 {repo.default_branch || 'main'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Repo Configuration (Branch Selector) */}
        {selectedRepo && (
          <div className="github-picker-selection-strip">
            <div className="github-selection-info">
              <span className="github-selection-label">Selected:</span>
              <strong>{selectedRepo.full_name}</strong>
            </div>

            <div className="github-branch-selector-wrapper">
              <label htmlFor="github-branch-select">Branch:</label>
              <select
                id="github-branch-select"
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                disabled={isLoadingBranches}
                className="github-branch-select"
              >
                {branches.map((b) => (
                  <option key={b} value={b}>
                    {b} {b === selectedRepo.default_branch ? '(default)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="github-modal-footer">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedRepo || isLoading}
          >
            Open Repository &quot;{selectedRepo?.name || '...'}&quot;
          </Button>
        </div>
      </div>
    </Modal>
  );
}
