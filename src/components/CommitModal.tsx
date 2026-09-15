import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { GitHubIcon } from './GitHubIcon';

interface CommitModalProps {
  isOpen: boolean;
  fileName: string;
  filePath: string;
  repoName: string;
  branchName: string;
  isNewFile?: boolean;
  onConfirm: (commitMessage: string) => Promise<void>;
  onCancel: () => void;
}

export function CommitModal({
  isOpen,
  fileName,
  filePath,
  repoName,
  branchName,
  isNewFile = false,
  onConfirm,
  onCancel,
}: CommitModalProps) {
  const defaultMessage = isNewFile ? `Create ${fileName} via Mandrak` : `Update ${fileName} via Mandrak`;
  const [commitMessage, setCommitMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCommitMessage('');
      setError(null);
      setIsSubmitting(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, fileName]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const finalMessage = commitMessage.trim() || defaultMessage;
      await onConfirm(finalMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to commit changes');
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="Commit Changes to GitHub">
      <form onSubmit={handleSubmit} className="commit-modal-form">
        <div className="commit-modal-target-card">
          <div className="commit-modal-repo-badge">
            <GitHubIcon size={16} />
            <span>{repoName}</span>
            <span className="commit-modal-branch-pill">🌳 {branchName}</span>
          </div>
          <div className="commit-modal-file-info">
            <span className="commit-modal-file-label">Target File:</span>
            <code className="commit-modal-file-path">{filePath || `/${fileName}`}</code>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="commit-modal-input-group">
          <label htmlFor="commit-message-input">Commit Message (Optional)</label>
          <input
            id="commit-message-input"
            ref={inputRef}
            type="text"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={defaultMessage}
            className="commit-message-input"
            disabled={isSubmitting}
            autoComplete="off"
          />
          <span className="commit-modal-help-text">
            Leave blank and press Enter to use: <em>&ldquo;{defaultMessage}&rdquo;</em>
          </span>
        </div>

        <div className="commit-modal-actions">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Committing...' : 'Commit & Push 🚀'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
