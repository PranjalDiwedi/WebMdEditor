import { useState } from 'react';
import type {
  GraphFilterOptions,
  PhysicsConfig,
  NodeSizingMode,
  NodeColoringMode,
} from '../types/graph';

interface NetworkControlsProps {
  filters: GraphFilterOptions;
  onFilterChange: (filters: GraphFilterOptions) => void;
  physics: PhysicsConfig;
  onPhysicsChange: (physics: PhysicsConfig) => void;
  availableFolders: string[];
  availableTags: string[];
  totalNodes: number;
  totalEdges: number;
  orphanCount: number;
  bridgeNoteCount: number;
}

export function NetworkControls({
  filters,
  onFilterChange,
  physics,
  onPhysicsChange,
  availableFolders,
  availableTags,
  totalNodes,
  totalEdges,
  orphanCount,
  bridgeNoteCount,
}: NetworkControlsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'display' | 'filters' | 'physics'>('display');

  const updateFilters = (partial: Partial<GraphFilterOptions>) => {
    onFilterChange({ ...filters, ...partial });
  };

  const updatePhysics = (partial: Partial<PhysicsConfig>) => {
    onPhysicsChange({ ...physics, ...partial });
  };

  const toggleFolder = (folder: string) => {
    const isSelected = filters.selectedFolders.includes(folder);
    const updated = isSelected
      ? filters.selectedFolders.filter((f) => f !== folder)
      : [...filters.selectedFolders, folder];
    updateFilters({ selectedFolders: updated });
  };

  const toggleTag = (tag: string) => {
    const isSelected = filters.selectedTags.includes(tag);
    const updated = isSelected
      ? filters.selectedTags.filter((t) => t !== tag)
      : [...filters.selectedTags, tag];
    updateFilters({ selectedTags: updated });
  };

  return (
    <div className={`network-controls-wrapper ${isOpen ? 'open' : ''}`}>
      {/* Toggle Button */}
      <button
        type="button"
        className="network-controls-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        title={isOpen ? 'Collapse Graph Settings' : 'Expand Graph Settings'}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
          />
        </svg>
        <span>Graph Settings</span>
        <span className="network-pill-stats">
          {totalNodes} notes · {totalEdges} links
        </span>
      </button>

      {/* Floating Settings Drawer Panel */}
      {isOpen && (
        <div className="network-controls-panel">
          {/* Tabs */}
          <div className="network-tabs-header">
            <button
              type="button"
              className={`network-tab-btn ${activeTab === 'display' ? 'active' : ''}`}
              onClick={() => setActiveTab('display')}
            >
              🎨 Display
            </button>
            <button
              type="button"
              className={`network-tab-btn ${activeTab === 'filters' ? 'active' : ''}`}
              onClick={() => setActiveTab('filters')}
            >
              🔍 Filters
            </button>
            <button
              type="button"
              className={`network-tab-btn ${activeTab === 'physics' ? 'active' : ''}`}
              onClick={() => setActiveTab('physics')}
            >
              ⚡ Physics
            </button>
          </div>

          <div className="network-panel-body">
            {/* DISPLAY TAB */}
            {activeTab === 'display' && (
              <div className="network-control-section">
                <div className="network-field-group">
                  <label className="network-field-label">
                    <span>Node Sizing Metric</span>
                    <span className="network-field-hint">
                      {filters.sizingMode === 'betweenness' ? 'Highlights bridge concepts' : ''}
                    </span>
                  </label>
                  <div className="network-segmented-options">
                    {(
                      [
                        ['betweenness', '🌉 Betweenness'],
                        ['inDegree', '📥 Backlinks'],
                        ['size', '📄 Size'],
                        ['uniform', '⚪ Equal'],
                      ] as [NodeSizingMode, string][]
                    ).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        className={`network-opt-btn ${filters.sizingMode === mode ? 'active' : ''}`}
                        onClick={() => updateFilters({ sizingMode: mode })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="network-field-group">
                  <label className="network-field-label">Node Color Theme</label>
                  <div className="network-segmented-options">
                    {(
                      [
                        ['folder', '📁 Folder'],
                        ['tag', '🏷️ Tag'],
                        ['centrality', '🔥 Centrality'],
                      ] as [NodeColoringMode, string][]
                    ).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        className={`network-opt-btn ${filters.coloringMode === mode ? 'active' : ''}`}
                        onClick={() => updateFilters({ coloringMode: mode })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="network-toggle-group">
                  <label className="network-checkbox-label">
                    <input
                      type="checkbox"
                      checked={filters.showGhostNotes}
                      onChange={(e) => updateFilters({ showGhostNotes: e.target.checked })}
                    />
                    <span>Show Ghost Notes (Uncreated Links)</span>
                  </label>
                  <label className="network-checkbox-label">
                    <input
                      type="checkbox"
                      checked={filters.showTagConnections}
                      onChange={(e) => updateFilters({ showTagConnections: e.target.checked })}
                    />
                    <span>Connect Shared Tags</span>
                  </label>
                </div>
              </div>
            )}

            {/* FILTERS TAB */}
            {activeTab === 'filters' && (
              <div className="network-control-section">
                <div className="network-field-group">
                  <label className="network-checkbox-label" style={{ fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={filters.localGraphMode}
                      onChange={(e) => updateFilters({ localGraphMode: e.target.checked })}
                    />
                    <span>🎯 Focus Active Note (Local Ego-Graph)</span>
                  </label>
                  {filters.localGraphMode && (
                    <div className="network-slider-row" style={{ marginTop: '0.4rem' }}>
                      <span className="network-slider-label">Depth Hops: {filters.localDepth}</span>
                      <input
                        type="range"
                        min="1"
                        max="3"
                        step="1"
                        value={filters.localDepth}
                        onChange={(e) => updateFilters({ localDepth: Number(e.target.value) })}
                      />
                    </div>
                  )}
                </div>

                <div className="network-field-group">
                  <label className="network-checkbox-label">
                    <input
                      type="checkbox"
                      checked={filters.orphansOnly}
                      onChange={(e) => updateFilters({ orphansOnly: e.target.checked })}
                    />
                    <span>🏝️ Orphan Notes Only ({orphanCount} unlinked)</span>
                  </label>
                </div>

                {availableFolders.length > 0 && (
                  <div className="network-field-group">
                    <label className="network-field-label">Filter by Folder</label>
                    <div className="network-chip-list">
                      {availableFolders.map((folder) => (
                        <button
                          key={folder}
                          type="button"
                          className={`network-chip ${filters.selectedFolders.includes(folder) ? 'active' : ''}`}
                          onClick={() => toggleFolder(folder)}
                        >
                          📁 {folder}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {availableTags.length > 0 && (
                  <div className="network-field-group">
                    <label className="network-field-label">Filter by Tag</label>
                    <div className="network-chip-list">
                      {availableTags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          className={`network-chip ${filters.selectedTags.includes(tag) ? 'active' : ''}`}
                          onClick={() => toggleTag(tag)}
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PHYSICS TAB */}
            {activeTab === 'physics' && (
              <div className="network-control-section">
                <div className="network-slider-row">
                  <div className="network-slider-label-row">
                    <span>Node Repulsion</span>
                    <span>{Math.abs(physics.repulsion)}</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="900"
                    step="20"
                    value={Math.abs(physics.repulsion)}
                    onChange={(e) => updatePhysics({ repulsion: -Number(e.target.value) })}
                  />
                </div>

                <div className="network-slider-row">
                  <div className="network-slider-label-row">
                    <span>Link Distance</span>
                    <span>{physics.linkDistance}px</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="220"
                    step="5"
                    value={physics.linkDistance}
                    onChange={(e) => updatePhysics({ linkDistance: Number(e.target.value) })}
                  />
                </div>

                <div className="network-slider-row">
                  <div className="network-slider-label-row">
                    <span>Center Gravity</span>
                    <span>{Math.round(physics.gravity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.01"
                    max="0.3"
                    step="0.01"
                    value={physics.gravity}
                    onChange={(e) => updatePhysics({ gravity: Number(e.target.value) })}
                  />
                </div>

                <div className="network-slider-row">
                  <div className="network-slider-label-row">
                    <span>Collision Buffer</span>
                    <span>{physics.collisionRadius}px</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="40"
                    step="2"
                    value={physics.collisionRadius}
                    onChange={(e) => updatePhysics({ collisionRadius: Number(e.target.value) })}
                  />
                </div>

                <button
                  type="button"
                  className="network-reset-physics-btn"
                  onClick={() =>
                    onPhysicsChange({
                      repulsion: -320,
                      linkDistance: 85,
                      collisionRadius: 16,
                      gravity: 0.08,
                    })
                  }
                >
                  ↺ Reset Physics to Default
                </button>
              </div>
            )}

            {/* Quick Stats Footer */}
            <div className="network-panel-footer">
              <span>🌉 {bridgeNoteCount} Bridge Notes</span>
              <span>🏝️ {orphanCount} Orphans</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
