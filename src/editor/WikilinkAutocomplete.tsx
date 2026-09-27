import { useEffect, useRef } from 'react';
import type { MarkdownFile } from '../types/file';

interface WikilinkAutocompleteProps {
  isOpen: boolean;
  query: string;
  coords: { x: number; y: number };
  matchingFiles: MarkdownFile[];
  selectedIndex: number;
  onSelectFile: (file: MarkdownFile) => void;
  onCreateGhostLink?: (query: string) => void;
  onClose: () => void;
}

export function WikilinkAutocomplete({
  isOpen,
  query,
  coords,
  matchingFiles,
  selectedIndex,
  onSelectFile,
  onCreateGhostLink,
  onClose,
}: WikilinkAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    const selectedElement = containerRef.current.querySelector(
      `[data-index="${selectedIndex}"]`
    ) as HTMLElement | null;
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex, isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Viewport bounding adjustment so the popup never clips outside the screen
  const menuWidth = 320;
  const menuHeight = 280;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const left = Math.max(12, Math.min(coords.x, viewportWidth - menuWidth - 16));
  const top =
    coords.y + menuHeight > viewportHeight
      ? Math.max(12, coords.y - menuHeight - 24)
      : coords.y;

  const hasExactMatch = matchingFiles.some(
    (f) => f.name.replace(/\.md$/i, '').toLowerCase() === query.toLowerCase().trim()
  );

  return (
    <div
      ref={containerRef}
      className="wikilink-autocomplete-card"
      style={{ left, top }}
      onMouseDown={(e) => e.preventDefault()} // Prevent editor focus loss
    >
      <div className="wikilink-autocomplete-header">
        <div className="wikilink-header-title">
          <span className="wikilink-header-icon">🔗</span>
          <span>Link to note</span>
        </div>
        {query && <span className="wikilink-query-badge">"{query}"</span>}
      </div>

      <div className="wikilink-autocomplete-list">
        {matchingFiles.map((file, idx) => {
          const isSelected = idx === selectedIndex;
          const cleanName = file.name.replace(/\.md$/i, '');
          const folder = file.path && file.path.includes('/')
            ? file.path.substring(0, file.path.lastIndexOf('/'))
            : '';

          return (
            <div
              key={file.id}
              data-index={idx}
              className={`wikilink-autocomplete-item ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectFile(file)}
            >
              <span className="wikilink-item-icon">📄</span>
              <div className="wikilink-item-info">
                <span className="wikilink-item-name">{cleanName}</span>
                {folder && <span className="wikilink-item-folder">📁 {folder}</span>}
              </div>
              {isSelected && <span className="wikilink-item-enter-hint">↵</span>}
            </div>
          );
        })}

        {/* Option to link to uncreated / ghost note if no exact match exists */}
        {query.trim() && !hasExactMatch && (
          <div
            data-index={matchingFiles.length}
            className={`wikilink-autocomplete-item create-ghost-item ${
              selectedIndex === matchingFiles.length ? 'selected' : ''
            }`}
            onClick={() => onCreateGhostLink?.(query.trim())}
          >
            <span className="wikilink-item-icon">✨</span>
            <div className="wikilink-item-info">
              <span className="wikilink-item-name">Link to new note: <strong>"{query.trim()}"</strong></span>
              <span className="wikilink-item-folder">Create reference</span>
            </div>
            {selectedIndex === matchingFiles.length && (
              <span className="wikilink-item-enter-hint">↵</span>
            )}
          </div>
        )}

        {matchingFiles.length === 0 && !query.trim() && (
          <div className="wikilink-empty-state">
            <span>Type note title to search vault...</span>
          </div>
        )}
      </div>

      <div className="wikilink-autocomplete-footer">
        <span>↑↓ Navigate</span>
        <span>↵ Insert</span>
        <span>Esc Dismiss</span>
      </div>
    </div>
  );
}
