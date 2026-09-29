import { useEffect, useRef } from 'react';
import type { MarkdownFile } from '../types/file';

const SUGGESTED_RELATIONS = [
  'depends_on',
  'is_a',
  'related_to',
  'alternative_to',
  'inspired_by',
  'blocks',
];

interface WikilinkAutocompleteProps {
  isOpen: boolean;
  query: string;
  relationPrefix?: string;
  noteQuery?: string;
  coords: { x: number; y: number };
  matchingFiles: MarkdownFile[];
  selectedIndex: number;
  onSelectFile: (file: MarkdownFile) => void;
  onCreateGhostLink?: (targetName: string) => void;
  onSelectRelationPrefix?: (prefix: string) => void;
  onClose: () => void;
}

export function WikilinkAutocomplete({
  isOpen,
  query,
  relationPrefix = '',
  noteQuery = '',
  coords,
  matchingFiles,
  selectedIndex,
  onSelectFile,
  onCreateGhostLink,
  onSelectRelationPrefix,
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
  const menuWidth = 330;
  const menuHeight = 300;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const left = Math.max(12, Math.min(coords.x, viewportWidth - menuWidth - 16));
  const top =
    coords.y + menuHeight > viewportHeight
      ? Math.max(12, coords.y - menuHeight - 24)
      : coords.y;

  const activeQuery = noteQuery || query;
  const hasExactMatch = matchingFiles.some(
    (f) => f.name.replace(/\.md$/i, '').toLowerCase() === activeQuery.toLowerCase().trim()
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
          <span>{relationPrefix ? 'Link with relation' : 'Link to note'}</span>
        </div>
        {relationPrefix && (
          <span className={`relation-badge badge-${relationPrefix.toLowerCase().replace(/[^a-z0-9]/g, '_')}`}>
            {relationPrefix}
          </span>
        )}
        {!relationPrefix && query && <span className="wikilink-query-badge">"{query}"</span>}
      </div>

      {/* Quick Relationship Type Selection Bar when prefix is not yet typed */}
      {!relationPrefix && (
        <div className="wikilink-relation-bar">
          <span className="wikilink-relation-label">Rel:</span>
          <div className="wikilink-relation-chips">
            {SUGGESTED_RELATIONS.map((rel) => (
              <button
                key={rel}
                type="button"
                className="wikilink-rel-chip"
                onClick={() => onSelectRelationPrefix?.(rel)}
                title={`Insert typed link [[${rel}:...]]`}
              >
                +{rel}
              </button>
            ))}
          </div>
        </div>
      )}

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
        {activeQuery.trim() && !hasExactMatch && (
          <div
            data-index={matchingFiles.length}
            className={`wikilink-autocomplete-item create-ghost-item ${
              selectedIndex === matchingFiles.length ? 'selected' : ''
            }`}
            onClick={() => onCreateGhostLink?.(activeQuery.trim())}
          >
            <span className="wikilink-item-icon">✨</span>
            <div className="wikilink-item-info">
              <span className="wikilink-item-name">
                Link to new note: <strong>"{activeQuery.trim()}"</strong>
              </span>
              <span className="wikilink-item-folder">Create reference</span>
            </div>
            {selectedIndex === matchingFiles.length && (
              <span className="wikilink-item-enter-hint">↵</span>
            )}
          </div>
        )}

        {matchingFiles.length === 0 && !activeQuery.trim() && (
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
