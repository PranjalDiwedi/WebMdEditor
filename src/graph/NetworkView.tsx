import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { MarkdownFile } from '../types/file';
import type {
  GraphNode,
  GraphEdge,
  GraphFilterOptions,
  PhysicsConfig,
} from '../types/graph';
import {
  buildGraphFromFiles,
  addWikilinkToContent,
  updateWikilinkRelationInContent,
  removeWikilinkFromContent,
} from './graphParser';
import { extractLocalSubgraph } from './centrality';
import { NetworkCanvas } from './NetworkCanvas';
import { NetworkControls } from './NetworkControls';

export const COMMON_RELATIONS = [
  'depends_on',
  'is_a',
  'related_to',
  'alternative_to',
  'inspired_by',
  'blocks',
];

interface NetworkViewProps {
  files: MarkdownFile[];
  currentFile: MarkdownFile | null;
  theme: 'light' | 'dark';
  onOpenFile: (fileId: string) => void;
  onUpdateFileContent?: (fileId: string, newContent: string) => Promise<void>;
  onCreateDraft?: (name: string, content: string, path?: string) => void;
  onExitView?: () => void;
}

const DEFAULT_FILTERS: GraphFilterOptions = {
  searchQuery: '',
  selectedFolders: [],
  selectedTags: [],
  selectedRelations: [],
  orphansOnly: false,
  showGhostNotes: true,
  showTagConnections: false,
  showEdgeLabels: false,
  localGraphMode: false,
  localDepth: 1,
  sizingMode: 'betweenness',
  coloringMode: 'folder',
};

const DEFAULT_PHYSICS: PhysicsConfig = {
  repulsion: -320,
  linkDistance: 85,
  collisionRadius: 16,
  gravity: 0.08,
};

export function NetworkView({
  files,
  currentFile,
  theme,
  onOpenFile,
  onUpdateFileContent,
  onCreateDraft,
  onExitView,
}: NetworkViewProps) {
  const [filters, setFilters] = useState<GraphFilterOptions>(DEFAULT_FILTERS);
  const [physics, setPhysics] = useState<PhysicsConfig>(DEFAULT_PHYSICS);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [hoverCoords, setHoverCoords] = useState<{ x: number; y: number } | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);
  const [selectedEdgeCoords, setSelectedEdgeCoords] = useState<{ x: number; y: number } | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Expandable Search state
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Keyboard shortcut: Cmd+F / Ctrl+F or '/' to focus graph search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid intercepting when typing in inputs/textareas
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsSearchExpanded(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setIsSearchExpanded(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Creating new relationship via Shift + Drag
  const [connectingEdgeData, setConnectingEdgeData] = useState<{
    sourceNode: GraphNode;
    targetNode: GraphNode;
  } | null>(null);
  const [newEdgeRelation, setNewEdgeRelation] = useState<string>('depends_on');

  // Editing existing edge relationship
  const [isEditingEdgeRelation, setIsEditingEdgeRelation] = useState(false);
  const [editingRelationValue, setEditingRelationValue] = useState<string>('');

  const previousNodesRef = useRef<GraphNode[]>([]);

  // Compute a content-aware signature of vault files so array reference churn (e.g. MRU tab reordering) doesn't re-parse graph
  const filesSignature = useMemo(() => {
    return files
      .map((f) => `${f.id}:${f.name}:${f.path || ''}:${f.modifiedAt instanceof Date ? f.modifiedAt.getTime() : f.modifiedAt}:${f.size || 0}:${f.content?.length || 0}`)
      .sort()
      .join('|');
  }, [files]);

  // Stable files list: only changes when file set, content, or modification times change
  const stableFiles = useMemo(() => {
    return files;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filesSignature]);

  // 1. Build initial graph from vault files (persisting existing coordinates across updates)
  const rawGraph = useMemo(() => {
    const result = buildGraphFromFiles(
      stableFiles,
      null,
      {
        includeTagEdges: filters.showTagConnections,
      },
      previousNodesRef.current
    );
    previousNodesRef.current = result.nodes;
    return result;
  }, [stableFiles, filters.showTagConnections]);

  const currentLocalFileId = filters.localGraphMode ? currentFile?.id : undefined;

  // 2. Apply Filters (Local graph, folders, tags, orphans, ghost notes)
  const filteredGraph = useMemo(() => {
    const hasActiveFilters =
      !filters.showGhostNotes ||
      filters.selectedFolders.length > 0 ||
      filters.selectedTags.length > 0 ||
      filters.selectedRelations.length > 0 ||
      filters.orphansOnly ||
      (filters.localGraphMode && !!currentLocalFileId);

    if (!hasActiveFilters) {
      return rawGraph;
    }

    let nodes = rawGraph.nodes;
    let edges = rawGraph.edges;

    // Filter Ghost Notes
    if (!filters.showGhostNotes) {
      nodes = nodes.filter((n) => !n.isGhost);
      const validIds = new Set(nodes.map((n) => n.id));
      edges = edges.filter((e) => {
        const s = typeof e.source === 'object' ? e.source.id : e.source;
        const t = typeof e.target === 'object' ? e.target.id : e.target;
        return validIds.has(s) && validIds.has(t);
      });
    }

    // Filter by Folder
    if (filters.selectedFolders.length > 0) {
      const folderSet = new Set(filters.selectedFolders);
      nodes = nodes.filter((n) => folderSet.has(n.folder));
      const validIds = new Set(nodes.map((n) => n.id));
      edges = edges.filter((e) => {
        const s = typeof e.source === 'object' ? e.source.id : e.source;
        const t = typeof e.target === 'object' ? e.target.id : e.target;
        return validIds.has(s) && validIds.has(t);
      });
    }

    // Filter by Tag
    if (filters.selectedTags.length > 0) {
      const tagSet = new Set(filters.selectedTags);
      nodes = nodes.filter((n) => n.tags.some((t) => tagSet.has(t)));
      const validIds = new Set(nodes.map((n) => n.id));
      edges = edges.filter((e) => {
        const s = typeof e.source === 'object' ? e.source.id : e.source;
        const t = typeof e.target === 'object' ? e.target.id : e.target;
        return validIds.has(s) && validIds.has(t);
      });
    }

    // Filter by Relation Type
    if (filters.selectedRelations.length > 0) {
      const relSet = new Set(filters.selectedRelations);
      edges = edges.filter((e) => e.relation && relSet.has(e.relation));
    }

    // Filter Orphans
    if (filters.orphansOnly) {
      nodes = nodes.filter((n) => n.inDegree === 0 && n.outDegree === 0);
      edges = [];
    }

    // Local Ego-Graph Subgraph
    if (filters.localGraphMode && currentLocalFileId) {
      const { localNodes, localEdges } = extractLocalSubgraph(
        nodes,
        edges,
        currentLocalFileId,
        filters.localDepth
      );
      nodes = localNodes;
      edges = localEdges;
    }

    return { nodes, edges };
  }, [
    rawGraph,
    filters.showGhostNotes,
    filters.selectedFolders,
    filters.selectedTags,
    filters.selectedRelations,
    filters.orphansOnly,
    filters.localGraphMode,
    filters.localDepth,
    currentLocalFileId,
  ]);

  // Statistics
  const stats = useMemo(() => {
    const orphanCount = rawGraph.nodes.filter((n) => n.inDegree === 0 && n.outDegree === 0).length;
    const bridgeNoteCount = rawGraph.nodes.filter((n) => n.betweenness > 0.4).length;
    return {
      totalNotes: rawGraph.nodes.length,
      totalLinks: rawGraph.edges.length,
      orphanCount,
      bridgeNoteCount,
    };
  }, [rawGraph]);

  const handleHoverNode = useCallback(
    (node: GraphNode | null, coords: { x: number; y: number } | null) => {
      setHoveredNode(node);
      setHoverCoords(coords);
    },
    []
  );

  const handleOpenNode = useCallback(
    (node: GraphNode) => {
      if (node.fileId) {
        setSelectedNode(null);
        setSelectedEdge(null);
        setHoveredNode(null);
        setHoverCoords(null);
        onOpenFile(node.fileId);
      }
    },
    [onOpenFile]
  );

  const handleCreateGhostNote = useCallback(
    (node: GraphNode) => {
      if (onCreateDraft) {
        onCreateDraft(node.name, `# ${node.name.replace(/\.md$/i, '')}\n\n`, node.path);
      }
    },
    [onCreateDraft]
  );

  // Shift + Drag: Prompt to Connect Source Node -> Target Node with a Typed Link
  const handleConnectNodes = useCallback(
    (sourceNode: GraphNode, targetNode: GraphNode) => {
      setConnectingEdgeData({ sourceNode, targetNode });
      setNewEdgeRelation('depends_on');
    },
    []
  );

  const handleConfirmCreateEdge = useCallback(
    async (relation?: string) => {
      if (!connectingEdgeData) return;
      const { sourceNode, targetNode } = connectingEdgeData;
      const sourceFile = files.find((f) => f.id === sourceNode.id);
      if (!sourceFile) return;

      const targetTitle = targetNode.name;
      const cleanRel = relation?.trim();
      const updatedContent = addWikilinkToContent(sourceFile.content || '', targetTitle, cleanRel);

      if (updatedContent === sourceFile.content) {
        setActionFeedback(`"${sourceNode.name}" is already linked to "${targetNode.name}"`);
        setTimeout(() => setActionFeedback(null), 2500);
        setConnectingEdgeData(null);
        return;
      }

      if (onUpdateFileContent) {
        await onUpdateFileContent(sourceFile.id, updatedContent);
        const relLabel = cleanRel ? ` [${cleanRel}]` : '';
        setActionFeedback(`✨ Linked "${sourceNode.name}" ➔ "${targetNode.name}"${relLabel}`);
        setTimeout(() => setActionFeedback(null), 3000);
      }

      setConnectingEdgeData(null);
    },
    [connectingEdgeData, files, onUpdateFileContent]
  );

  // Unlink: Remove link between source and target notes
  const handleDeleteSelectedEdge = useCallback(async () => {
    if (!selectedEdge) return;

    const sourceId = typeof selectedEdge.source === 'object' ? selectedEdge.source.id : selectedEdge.source;
    const targetName =
      typeof selectedEdge.target === 'object'
        ? selectedEdge.target.name
        : rawGraph.nodes.find((n) => n.id === selectedEdge.target)?.name || '';

    const sourceFile = files.find((f) => f.id === sourceId);
    if (!sourceFile || !targetName) return;

    const updatedContent = removeWikilinkFromContent(sourceFile.content || '', targetName);

    if (onUpdateFileContent) {
      await onUpdateFileContent(sourceFile.id, updatedContent);
      setActionFeedback(`🗑️ Unlinked "${sourceFile.name}" ➔ "${targetName}"`);
      setTimeout(() => setActionFeedback(null), 3000);
    }

    setSelectedEdge(null);
    setSelectedEdgeCoords(null);
    setIsEditingEdgeRelation(false);
  }, [selectedEdge, files, rawGraph.nodes, onUpdateFileContent]);

  // Edit relation type of existing edge
  const handleSaveEditedRelation = useCallback(
    async (newRelation: string) => {
      if (!selectedEdge) return;

      const sourceId = typeof selectedEdge.source === 'object' ? selectedEdge.source.id : selectedEdge.source;
      const targetName =
        typeof selectedEdge.target === 'object'
          ? selectedEdge.target.name
          : rawGraph.nodes.find((n) => n.id === selectedEdge.target)?.name || '';

      const sourceFile = files.find((f) => f.id === sourceId);
      if (!sourceFile || !targetName) return;

      const cleanRel = newRelation.trim();
      const updatedContent = updateWikilinkRelationInContent(sourceFile.content || '', targetName, cleanRel);

      if (onUpdateFileContent) {
        await onUpdateFileContent(sourceFile.id, updatedContent);
        const relLabel = cleanRel ? ` [${cleanRel}]` : ' (untyped)';
        setActionFeedback(`✨ Updated relationship to${relLabel}: "${sourceFile.name}" ➔ "${targetName}"`);
        setTimeout(() => setActionFeedback(null), 3000);
      }

      setIsEditingEdgeRelation(false);
      setSelectedEdge(null);
      setSelectedEdgeCoords(null);
    },
    [selectedEdge, files, rawGraph.nodes, onUpdateFileContent]
  );

  const handleSelectEdge = useCallback(
    (edge: GraphEdge | null, coords: { x: number; y: number } | null) => {
      setSelectedEdge(edge);
      setSelectedEdgeCoords(coords);
      setIsEditingEdgeRelation(false);
      setEditingRelationValue(edge?.relation || '');
    },
    []
  );

  // Selected edge names helper
  const selectedEdgeDetails = useMemo(() => {
    if (!selectedEdge) return null;
    const sourceName =
      typeof selectedEdge.source === 'object'
        ? selectedEdge.source.name
        : rawGraph.nodes.find((n) => n.id === selectedEdge.source)?.name || 'Source';
    const targetName =
      typeof selectedEdge.target === 'object'
        ? selectedEdge.target.name
        : rawGraph.nodes.find((n) => n.id === selectedEdge.target)?.name || 'Target';
    return { sourceName, targetName };
  }, [selectedEdge, rawGraph.nodes]);

  return (
    <div className="network-view-workspace">
      {/* Top Header Bar inside Network View */}
      <div className="network-top-bar">
        <div className="network-top-left">
          <div className="network-title-cluster">
            <span className="network-brand-icon">🕸️</span>
            <span className="network-brand-title">Knowledge Network</span>
          </div>
        </div>

        <div className="network-top-right">
          {/* Active Action Feedback Banner */}
          {actionFeedback && (
            <div className="network-feedback-pill">
              {actionFeedback}
            </div>
          )}

          {/* Expandable Search Button & Input */}
          <div className={`network-expandable-search ${isSearchExpanded || filters.searchQuery ? 'expanded' : ''}`}>
            {!isSearchExpanded && !filters.searchQuery ? (
              <button
                type="button"
                className="network-search-icon-btn"
                onClick={() => {
                  setIsSearchExpanded(true);
                  setTimeout(() => searchInputRef.current?.focus(), 50);
                }}
                title="Search graph nodes (Cmd+F / /)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="15" height="15">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            ) : (
              <div className="network-search-expanded-bar">
                <svg className="network-search-icon-inside" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="14" height="14">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search nodes..."
                  value={filters.searchQuery}
                  onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      if (filters.searchQuery) {
                        setFilters({ ...filters, searchQuery: '' });
                      } else {
                        setIsSearchExpanded(false);
                      }
                    }
                  }}
                  onBlur={() => {
                    if (!filters.searchQuery) {
                      setIsSearchExpanded(false);
                    }
                  }}
                  autoFocus
                />
                {filters.searchQuery ? (
                  <button
                    type="button"
                    className="network-search-clear"
                    onClick={() => {
                      setFilters({ ...filters, searchQuery: '' });
                      searchInputRef.current?.focus();
                    }}
                    title="Clear search"
                  >
                    ✕
                  </button>
                ) : (
                  <button
                    type="button"
                    className="network-search-collapse"
                    onClick={() => setIsSearchExpanded(false)}
                    title="Close search"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
          </div>

          {onExitView && (
            <button
              type="button"
              className="network-close-btn"
              onClick={onExitView}
              title="Return to Editor"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Interactive Canvas Area */}
      <div className="network-canvas-wrapper">
        <NetworkCanvas
          nodes={filteredGraph.nodes}
          edges={filteredGraph.edges}
          filters={filters}
          physics={physics}
          theme={theme}
          activeFileId={currentFile?.id || null}
          hoveredNode={hoveredNode}
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          onHoverNode={handleHoverNode}
          onSelectNode={setSelectedNode}
          onSelectEdge={handleSelectEdge}
          onOpenNode={handleOpenNode}
          onCreateGhostNote={handleCreateGhostNote}
          onConnectNodes={handleConnectNodes}
        />

        {/* Floating Controls Drawer */}
        <NetworkControls
          filters={filters}
          onFilterChange={setFilters}
          physics={physics}
          onPhysicsChange={setPhysics}
          availableFolders={rawGraph.folders}
          availableTags={rawGraph.tags}
          availableRelations={rawGraph.relations || []}
          totalNodes={stats.totalNotes}
          totalEdges={stats.totalLinks}
          orphanCount={stats.orphanCount}
          bridgeNoteCount={stats.bridgeNoteCount}
          currentFile={currentFile}
        />

        {/* Floating Edge Action Card (Click Edge to View / Edit / Unlink) */}
        {selectedEdge && selectedEdgeCoords && selectedEdgeDetails && (
          <div
            className={`network-edge-action-card ${isEditingEdgeRelation ? 'editing-mode' : ''}`}
            style={{
              left: Math.min(window.innerWidth - 320, Math.max(16, selectedEdgeCoords.x - 140)),
              top: Math.min(window.innerHeight - 240, Math.max(70, selectedEdgeCoords.y - 45)),
            }}
          >
            <div className="network-edge-card-header">
              <div className="network-edge-names">
                <span className="edge-source-name">{selectedEdgeDetails.sourceName}</span>
                <span className="edge-arrow">➔</span>
                <span className="edge-target-name">{selectedEdgeDetails.targetName}</span>
              </div>
              <button
                type="button"
                className="network-edge-close-btn"
                onClick={() => {
                  setSelectedEdge(null);
                  setSelectedEdgeCoords(null);
                  setIsEditingEdgeRelation(false);
                }}
              >
                ✕
              </button>
            </div>

            {!isEditingEdgeRelation ? (
              <div className="network-edge-card-actions">
                <span className="network-edge-badge">
                  {selectedEdge.relation
                    ? `[ ${selectedEdge.relation} ]`
                    : selectedEdge.type === 'tag'
                    ? '#tag link'
                    : '[[untyped link]]'}
                </span>
                <div className="edge-action-btns">
                  {selectedEdge.type !== 'tag' && (
                    <button
                      type="button"
                      className="network-edge-edit-btn"
                      onClick={() => {
                        setEditingRelationValue(selectedEdge.relation || '');
                        setIsEditingEdgeRelation(true);
                      }}
                      title="Edit relationship type"
                    >
                      ✏️ Edit
                    </button>
                  )}
                  <button
                    type="button"
                    className="network-edge-unlink-btn"
                    onClick={handleDeleteSelectedEdge}
                    title="Remove this connection from the markdown file"
                  >
                    🗑️ Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="network-edge-edit-section">
                <div className="network-edge-preset-chips">
                  <button
                    type="button"
                    className={`edge-rel-chip ${!editingRelationValue ? 'active' : ''}`}
                    onClick={() => setEditingRelationValue('')}
                  >
                    (untyped)
                  </button>
                  {COMMON_RELATIONS.map((rel) => (
                    <button
                      key={rel}
                      type="button"
                      className={`edge-rel-chip chip-${rel} ${editingRelationValue === rel ? 'active' : ''}`}
                      onClick={() => setEditingRelationValue(rel)}
                    >
                      {rel}
                    </button>
                  ))}
                </div>

                <div className="network-edge-custom-input-row">
                  <input
                    type="text"
                    placeholder="Custom relation..."
                    value={editingRelationValue}
                    onChange={(e) => setEditingRelationValue(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveEditedRelation(editingRelationValue);
                      } else if (e.key === 'Escape') {
                        setIsEditingEdgeRelation(false);
                      }
                    }}
                    autoFocus
                  />
                  <div className="network-edge-edit-buttons">
                    <button
                      type="button"
                      className="edge-cancel-btn"
                      onClick={() => setIsEditingEdgeRelation(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="edge-save-btn"
                      onClick={() => handleSaveEditedRelation(editingRelationValue)}
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal: Create Relationship Link on Shift + Drag Connection */}
        {connectingEdgeData && (
          <div className="network-modal-backdrop" onClick={() => setConnectingEdgeData(null)}>
            <div className="network-relation-modal" onClick={(e) => e.stopPropagation()}>
              <div className="network-modal-header">
                <div className="network-modal-title-cluster">
                  <span className="network-modal-icon">🔗</span>
                  <div className="network-modal-titles">
                    <h3>Create Note Relationship</h3>
                    <p className="network-modal-subtitle">
                      <strong>{connectingEdgeData.sourceNode.name}</strong> ➔ <strong>{connectingEdgeData.targetNode.name}</strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="network-modal-close"
                  onClick={() => setConnectingEdgeData(null)}
                >
                  ✕
                </button>
              </div>

              <div className="network-modal-body">
                <label className="network-modal-label">Choose Relationship Type:</label>
                <div className="network-relation-presets">
                  <button
                    type="button"
                    className={`preset-chip ${!newEdgeRelation ? 'active' : ''}`}
                    onClick={() => setNewEdgeRelation('')}
                  >
                    📄 (Standard Link)
                  </button>
                  {COMMON_RELATIONS.map((rel) => (
                    <button
                      key={rel}
                      type="button"
                      className={`preset-chip chip-${rel} ${newEdgeRelation === rel ? 'active' : ''}`}
                      onClick={() => setNewEdgeRelation(rel)}
                    >
                      {rel}
                    </button>
                  ))}
                </div>

                <div className="network-modal-custom-input">
                  <label className="network-modal-label">Or Custom Relation Type:</label>
                  <input
                    type="text"
                    placeholder="e.g. parent_of, authored_by, implements..."
                    value={newEdgeRelation}
                    onChange={(e) => setNewEdgeRelation(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleConfirmCreateEdge(newEdgeRelation);
                      } else if (e.key === 'Escape') {
                        setConnectingEdgeData(null);
                      }
                    }}
                    autoFocus
                  />
                </div>

                <div className="network-relation-preview-box">
                  <span className="preview-label">Generated Wikilink:</span>
                  <code>
                    {newEdgeRelation
                      ? `[[${newEdgeRelation}:${connectingEdgeData.targetNode.name.replace(/\.md$/i, '')}]]`
                      : `[[${connectingEdgeData.targetNode.name.replace(/\.md$/i, '')}]]`}
                  </code>
                </div>
              </div>

              <div className="network-modal-footer">
                <button
                  type="button"
                  className="network-btn-secondary"
                  onClick={() => setConnectingEdgeData(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="network-btn-primary"
                  onClick={() => handleConfirmCreateEdge(newEdgeRelation)}
                >
                  Create Connection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rich Frosted-Glass Node Preview Card (Tooltip) */}
        {hoveredNode && hoverCoords && !selectedEdge && (
          <div
            className="network-node-tooltip"
            style={{
              left: Math.min(window.innerWidth - 300, Math.max(16, hoverCoords.x + 14)),
              top: Math.min(window.innerHeight - 240, Math.max(70, hoverCoords.y + 14)),
            }}
          >
            <div className="network-tooltip-header">
              <div className="network-tooltip-title-row">
                <span className="network-tooltip-icon">{hoveredNode.isGhost ? '👻' : '📄'}</span>
                <span className="network-tooltip-title">{hoveredNode.name}</span>
              </div>
              <span className="network-tooltip-folder" title={hoveredNode.folder}>
                📁 {hoveredNode.folder}
              </span>
            </div>

            {/* Centrality & Graph Metrics Bar */}
            <div className="network-tooltip-metrics">
              <div className="tooltip-metric-chip" title="Betweenness Centrality: How often this note bridges different knowledge clusters">
                <span className="metric-label">Centrality:</span>
                <span className="metric-value">
                  {Math.round(hoveredNode.betweenness * 100)}%
                </span>
                {hoveredNode.betweenness > 0.5 && (
                  <span className="metric-badge-gold">Bridge Note</span>
                )}
              </div>
              <div className="tooltip-metric-chip" title="Backlinks: Notes referencing this file">
                <span className="metric-label">In:</span>
                <span className="metric-value">{hoveredNode.inDegree}</span>
              </div>
              <div className="tooltip-metric-chip" title="Citations: Notes this file references">
                <span className="metric-label">Out:</span>
                <span className="metric-value">{hoveredNode.outDegree}</span>
              </div>
            </div>

            {/* Tags */}
            {hoveredNode.tags.length > 0 && (
              <div className="network-tooltip-tags">
                {hoveredNode.tags.map((t) => (
                  <span key={t} className="network-tooltip-tag">
                    #{t}
                  </span>
                ))}
              </div>
            )}

            {/* Text Preview Snippet */}
            <div className="network-tooltip-snippet">
              {hoveredNode.snippet || 'No content preview available.'}
            </div>

            <div className="network-tooltip-action-hint">
              {hoveredNode.isGhost ? (
                <span>⚡ Double-click to create note</span>
              ) : (
                <span>🖱️ Double-click to open · ⇧ + Drag to link</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
