import { useState, useMemo, useCallback, useRef } from 'react';
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
  removeWikilinkFromContent,
} from './graphParser';
import { extractLocalSubgraph } from './centrality';
import { NetworkCanvas } from './NetworkCanvas';
import { NetworkControls } from './NetworkControls';

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
  orphansOnly: false,
  showGhostNotes: true,
  showTagConnections: false,
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

  // Shift + Drag: Connect Source Node -> Target Node with a standard [[Wikilink]]
  const handleConnectNodes = useCallback(
    async (sourceNode: GraphNode, targetNode: GraphNode) => {
      const sourceFile = files.find((f) => f.id === sourceNode.id);
      if (!sourceFile) return;

      const targetTitle = targetNode.name;
      const updatedContent = addWikilinkToContent(sourceFile.content || '', targetTitle);

      if (updatedContent === sourceFile.content) {
        setActionFeedback(`"${sourceNode.name}" is already linked to "${targetNode.name}"`);
        setTimeout(() => setActionFeedback(null), 2500);
        return;
      }

      if (onUpdateFileContent) {
        await onUpdateFileContent(sourceFile.id, updatedContent);
        setActionFeedback(`✨ Linked "${sourceNode.name}" ➔ "${targetNode.name}"`);
        setTimeout(() => setActionFeedback(null), 3000);
      }
    },
    [files, onUpdateFileContent]
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
  }, [selectedEdge, files, rawGraph.nodes, onUpdateFileContent]);

  const handleSelectEdge = useCallback(
    (edge: GraphEdge | null, coords: { x: number; y: number } | null) => {
      setSelectedEdge(edge);
      setSelectedEdgeCoords(coords);
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
            <span className="network-badge-counter">
              {filteredGraph.nodes.length} nodes · {filteredGraph.edges.length} edges
            </span>
          </div>

          {/* Quick Search */}
          <div className="network-search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="14" height="14">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search or highlight nodes..."
              value={filters.searchQuery}
              onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
            />
            {filters.searchQuery && (
              <button
                type="button"
                className="network-search-clear"
                onClick={() => setFilters({ ...filters, searchQuery: '' })}
              >
                ✕
              </button>
            )}
          </div>

          {/* Shift + Drag Hint Pill */}
          <div className="network-gesture-hint" title="Hold Shift and drag from one note to another to create a wikilink">
            <span>💡</span>
            <span>Hold <strong>Shift + Drag</strong> to connect notes</span>
          </div>
        </div>

        <div className="network-top-right">
          {/* Active Action Feedback Banner */}
          {actionFeedback && (
            <div className="network-feedback-pill">
              {actionFeedback}
            </div>
          )}

          {/* Active Sizing Pill */}
          <div className="network-indicator-pill" title="Metric used to size nodes">
            <span className="pill-dot"></span>
            <span>
              Sized by{' '}
              <strong style={{ textTransform: 'capitalize' }}>
                {filters.sizingMode === 'betweenness' ? 'Betweenness Centrality' : filters.sizingMode}
              </strong>
            </span>
          </div>

          {currentFile && (
            <button
              type="button"
              className={`network-ego-btn ${filters.localGraphMode ? 'active' : ''}`}
              onClick={() => setFilters({ ...filters, localGraphMode: !filters.localGraphMode })}
              title="Toggle local graph centered on currently open note"
            >
              <span>🎯</span>
              <span>{filters.localGraphMode ? 'Local Graph (Active)' : 'Focus Note'}</span>
            </button>
          )}

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
          totalNodes={stats.totalNotes}
          totalEdges={stats.totalLinks}
          orphanCount={stats.orphanCount}
          bridgeNoteCount={stats.bridgeNoteCount}
        />

        {/* Floating Edge Action Card (Click Edge to Unlink) */}
        {selectedEdge && selectedEdgeCoords && selectedEdgeDetails && (
          <div
            className="network-edge-action-card"
            style={{
              left: Math.min(window.innerWidth - 290, Math.max(16, selectedEdgeCoords.x - 120)),
              top: Math.min(window.innerHeight - 130, Math.max(70, selectedEdgeCoords.y - 45)),
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
                }}
              >
                ✕
              </button>
            </div>
            <div className="network-edge-card-actions">
              <span className="network-edge-badge">
                {selectedEdge.type === 'tag' ? '#tag link' : '[[wikilink]]'}
              </span>
              <button
                type="button"
                className="network-edge-unlink-btn"
                onClick={handleDeleteSelectedEdge}
                title="Remove this connection from the markdown file"
              >
                🗑️ Remove Link
              </button>
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
