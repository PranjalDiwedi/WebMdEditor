import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';

export interface GraphNode extends SimulationNodeDatum {
  id: string;
  name: string;
  path: string;
  fileId?: string;
  folder: string;
  tags: string[];
  size: number; // word count or character count
  snippet: string;
  betweenness: number; // Normalized 0..1
  rawBetweenness: number;
  inDegree: number; // Backlinks count
  outDegree: number; // Forward links count
  isGhost?: boolean; // Note linked but doesn't exist yet
  isPinned?: boolean;
  isActive?: boolean;
  isNeighbor?: boolean;
  isDimmed?: boolean;
  isHighlighted?: boolean;
}

export interface GraphEdge extends SimulationLinkDatum<GraphNode> {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  type: 'wikilink' | 'markdown' | 'tag' | 'folder';
  label?: string;
  relation?: string; // Semantic relation name (e.g., "depends_on", "is_a", "alternative_to")
  isHighlighted?: boolean;
  isDimmed?: boolean;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  tags: string[];
  folders: string[];
  relations: string[]; // List of all unique relationship types found in the vault
  maxBetweenness: number;
  maxInDegree: number;
}

export type NodeSizingMode = 'betweenness' | 'inDegree' | 'size' | 'uniform';
export type NodeColoringMode = 'folder' | 'tag' | 'centrality';

export interface GraphFilterOptions {
  searchQuery: string;
  selectedFolders: string[];
  selectedTags: string[];
  selectedRelations: string[];
  orphansOnly: boolean;
  showGhostNotes: boolean;
  showTagConnections: boolean;
  showEdgeLabels: boolean;
  localGraphMode: boolean;
  localDepth: number; // 1, 2, or 3 hops
  sizingMode: NodeSizingMode;
  coloringMode: NodeColoringMode;
}

export interface PhysicsConfig {
  repulsion: number; // Node charge repulsion (-100 to -1000)
  linkDistance: number; // Distance between connected nodes (30 to 200)
  collisionRadius: number; // Minimum collision buffer between nodes (10 to 50)
  gravity: number; // Center force pulling nodes to center (0.01 to 0.3)
}
