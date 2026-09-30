import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type Simulation,
} from 'd3-force';
import type {
  GraphNode,
  GraphEdge,
  GraphFilterOptions,
  PhysicsConfig,
} from '../types/graph';

interface NetworkCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  filters: GraphFilterOptions;
  physics: PhysicsConfig;
  theme: 'light' | 'dark';
  activeFileId: string | null;
  hoveredNode: GraphNode | null;
  selectedNode: GraphNode | null;
  selectedEdge: GraphEdge | null;
  onHoverNode: (node: GraphNode | null, coords: { x: number; y: number } | null) => void;
  onSelectNode: (node: GraphNode | null) => void;
  onSelectEdge: (edge: GraphEdge | null, coords: { x: number; y: number } | null) => void;
  onOpenNode: (node: GraphNode) => void;
  onCreateGhostNote: (node: GraphNode) => void;
  onConnectNodes: (sourceNode: GraphNode, targetNode: GraphNode) => void;
}

// Curated harmonic palette for folders and tags
const HARMONIC_PALETTE = [
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#3b82f6', // Blue
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#84cc16', // Lime
];

function stringToColor(str: string): string {
  if (!str || str === 'Root') return '#6366f1';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % HARMONIC_PALETTE.length;
  return HARMONIC_PALETTE[index];
}

function getCentralityColor(betweenness: number): string {
  if (betweenness > 0.7) return '#f59e0b'; // Amber / Gold
  if (betweenness > 0.4) return '#ec4899'; // Pink / Magenta
  if (betweenness > 0.15) return '#8b5cf6'; // Purple
  if (betweenness > 0.05) return '#3b82f6'; // Blue
  return '#64748b'; // Slate
}

export function getRelationColor(relation?: string, isDark: boolean = true): string {
  if (!relation) return isDark ? '#64748b' : '#94a3b8';
  const r = relation.toLowerCase();
  if (r.includes('depend') || r.includes('block') || r.includes('require')) {
    return isDark ? '#fb923c' : '#ea580c'; // Orange / Amber
  }
  if (r.includes('is_a') || r.includes('type') || r.includes('subclass') || r.includes('parent')) {
    return isDark ? '#38bdf8' : '#0284c7'; // Cyan / Sky Blue
  }
  if (r.includes('alt') || r.includes('similar') || r.includes('compare')) {
    return isDark ? '#34d399' : '#059669'; // Emerald / Teal
  }
  if (r.includes('inspire') || r.includes('author') || r.includes('source') || r.includes('ref')) {
    return isDark ? '#c084fc' : '#9333ea'; // Purple
  }
  return isDark ? '#818cf8' : '#4f46e5'; // Indigo default
}

// Helper: Distance squared from point to line segment
function distToSegmentSquared(
  p: { x: number; y: number },
  v: { x: number; y: number },
  w: { x: number; y: number }
): number {
  const l2 = (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y);
  if (l2 === 0) return (p.x - v.x) * (p.x - v.x) + (p.y - v.y) * (p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = v.x + t * (w.x - v.x);
  const projY = v.y + t * (w.y - v.y);
  return (p.x - projX) * (p.x - projX) + (p.y - projY) * (p.y - projY);
}

// Helper: Calculate centroid and bounding dimensions of active nodes
function getGraphCentroid(nodes: GraphNode[]): { cx: number; cy: number; width: number; height: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let validCount = 0;
  let sumX = 0;
  let sumY = 0;

  for (const n of nodes) {
    if (n.x !== undefined && n.y !== undefined && !isNaN(n.x) && !isNaN(n.y)) {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
      sumX += n.x;
      sumY += n.y;
      validCount++;
    }
  }

  if (validCount === 0) {
    return { cx: 0, cy: 0, width: 0, height: 0 };
  }

  return {
    cx: sumX / validCount,
    cy: sumY / validCount,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function NetworkCanvas({
  nodes,
  edges,
  filters,
  physics,
  theme,
  activeFileId,
  hoveredNode,
  selectedNode,
  selectedEdge,
  onHoverNode,
  onSelectNode,
  onSelectEdge,
  onOpenNode,
  onCreateGhostNote,
  onConnectNodes,
}: NetworkCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const simulationRef = useRef<Simulation<GraphNode, GraphEdge> | null>(null);

  // Pan & Zoom transform state: { x, y, k (scale) }
  const transformRef = useRef<{ x: number; y: number; k: number }>({ x: 0, y: 0, k: 1 });
  const hasInitializedCenterRef = useRef(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Interaction refs
  const isMouseDownRef = useRef(false);
  const isDraggingRef = useRef(false);
  const isPanningRef = useRef(false);
  const dragNodeRef = useRef<GraphNode | null>(null);
  const mouseDownPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const animationFrameIdRef = useRef<number | null>(null);

  // Shift + Drag Interactive Linking refs
  const isConnectingRef = useRef(false);
  const connectSourceNodeRef = useRef<GraphNode | null>(null);
  const connectCurrentPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const connectTargetCandidateRef = useRef<GraphNode | null>(null);

  // Helper to compute node radius based on sizing mode
  const getNodeRadius = useCallback(
    (node: GraphNode): number => {
      const base = 6;
      if (filters.sizingMode === 'uniform') return 7;
      if (filters.sizingMode === 'betweenness') {
        return base + node.betweenness * 18; // 6px to 24px
      }
      if (filters.sizingMode === 'inDegree') {
        return base + Math.min(18, node.inDegree * 3);
      }
      if (filters.sizingMode === 'size') {
        return base + Math.min(16, Math.log2(node.size + 1) * 2);
      }
      return base;
    },
    [filters.sizingMode]
  );

  // Helper to compute node color
  const getNodeColor = useCallback(
    (node: GraphNode): string => {
      if (node.isGhost) return theme === 'dark' ? '#64748b' : '#94a3b8';
      if (filters.coloringMode === 'centrality') {
        return getCentralityColor(node.betweenness);
      }
      if (filters.coloringMode === 'tag') {
        return node.tags.length > 0 ? stringToColor(node.tags[0]) : '#64748b';
      }
      return stringToColor(node.folder);
    },
    [filters.coloringMode, theme]
  );

  // Identify connected neighbor IDs for the currently selected or hovered node
  const neighborIds = useMemo(() => {
    const target = hoveredNode || selectedNode;
    if (!target) return null;

    const set = new Set<string>([target.id]);
    for (const edge of edges) {
      const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source;
      const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target;

      if (sourceId === target.id) set.add(targetId);
      if (targetId === target.id) set.add(sourceId);
    }
    return set;
  }, [hoveredNode, selectedNode, edges]);

  const hoveredEdgeRef = useRef<GraphEdge | null>(null);

  // Keep a stable ref for all rendering data so the simulation doesn't thrash on hover
  const renderStateRef = useRef({
    nodes,
    edges,
    filters,
    theme,
    activeFileId,
    hoveredNode,
    selectedNode,
    selectedEdge,
    neighborIds,
    getNodeRadius,
    getNodeColor,
  });

  useEffect(() => {
    renderStateRef.current = {
      nodes,
      edges,
      filters,
      theme,
      activeFileId,
      hoveredNode,
      selectedNode,
      selectedEdge,
      neighborIds,
      getNodeRadius,
      getNodeColor,
    };
  });

  // Pure Canvas Paint Function (never triggers physics or forced reflow)
  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = container.getBoundingClientRect();
    if (rect.width <= 10 || rect.height <= 10) return;

    const dpr = window.devicePixelRatio || 1;
    const expectedWidth = Math.round(rect.width * dpr);
    const expectedHeight = Math.round(rect.height * dpr);

    if (canvas.width !== expectedWidth || canvas.height !== expectedHeight) {
      canvas.width = expectedWidth;
      canvas.height = expectedHeight;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    }

    const {
      nodes: currentNodes,
      edges: currentEdges,
      filters: currentFilters,
      theme: currentTheme,
      activeFileId: currentActiveFileId,
      hoveredNode: currentHovered,
      selectedNode: currentSelected,
      selectedEdge: currentSelectedEdge,
      neighborIds: currentNeighbors,
      getNodeRadius: getRadius,
      getNodeColor: getColor,
    } = renderStateRef.current;

    // If center has not been initialized yet, center the graph perfectly in viewport!
    if (!hasInitializedCenterRef.current) {
      hasInitializedCenterRef.current = true;
      const { cx, cy } = getGraphCentroid(currentNodes);
      transformRef.current = {
        x: rect.width / 2 - cx * 0.85,
        y: rect.height / 2 - cy * 0.85,
        k: 0.85,
      };
      setZoomLevel(0.85);
    }

    // Reset transform completely and clear in physical pixels
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();

    // Apply High-DPI DPR scaling
    ctx.scale(dpr, dpr);

    const { x, y, k } = transformRef.current;
    ctx.translate(x, y);
    ctx.scale(k, k);

    const isDark = currentTheme === 'dark';
    const hasFocus = currentNeighbors !== null || !!currentFilters.searchQuery || currentSelectedEdge !== null;

    // 1. Draw Edges
    for (const edge of currentEdges) {
      const source = typeof edge.source === 'object' ? edge.source : null;
      const target = typeof edge.target === 'object' ? edge.target : null;
      if (!source || !target || source.x === undefined || source.y === undefined || target.x === undefined || target.y === undefined) {
        continue;
      }

      const isEdgeSelected = currentSelectedEdge?.id === edge.id;
      const isEdgeHovered = hoveredEdgeRef.current?.id === edge.id;
      const isConnectedNodeHovered = currentHovered
        ? source.id === currentHovered.id || target.id === currentHovered.id
        : false;
      const isConnectedToFocus = currentNeighbors
        ? currentNeighbors.has(source.id) && currentNeighbors.has(target.id)
        : false;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);

      if (isEdgeSelected) {
        ctx.strokeStyle = '#f43f5e'; // Rose / Coral glow for selected edge
        ctx.lineWidth = 3.2 / k;
        ctx.globalAlpha = 1.0;
        ctx.setLineDash([]);
      } else if (isEdgeHovered) {
        ctx.strokeStyle = edge.relation ? getRelationColor(edge.relation, isDark) : (isDark ? '#38bdf8' : '#0284c7');
        ctx.lineWidth = 2.8 / k;
        ctx.globalAlpha = 1.0;
        ctx.setLineDash([]);
      } else if (isConnectedNodeHovered || isConnectedToFocus) {
        ctx.strokeStyle = edge.relation ? getRelationColor(edge.relation, isDark) : (isDark ? '#60a5fa' : '#2563eb');
        ctx.lineWidth = 2.4 / k;
        ctx.globalAlpha = 0.95;
        ctx.setLineDash([]);
      } else if (hasFocus) {
        ctx.strokeStyle = isDark ? '#334155' : '#e2e8f0';
        ctx.lineWidth = 0.8 / k;
        ctx.globalAlpha = 0.12;
        ctx.setLineDash([]);
      } else if (edge.type === 'tag') {
        ctx.strokeStyle = isDark ? '#a855f7' : '#9333ea';
        ctx.lineWidth = 1 / k;
        ctx.globalAlpha = 0.35;
        ctx.setLineDash([3 / k, 3 / k]);
      } else if (edge.relation) {
        ctx.strokeStyle = getRelationColor(edge.relation, isDark);
        ctx.lineWidth = 1.6 / k;
        ctx.globalAlpha = isDark ? 0.75 : 0.85;
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = isDark ? '#475569' : '#cbd5e1';
        ctx.lineWidth = 1.2 / k;
        ctx.globalAlpha = isDark ? 0.35 : 0.55;
        ctx.setLineDash([]);
      }

      ctx.stroke();

      // Draw directional arrow on solid edges when not overly zoomed out
      if (k > 0.4 && edge.type !== 'tag') {
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 20) {
          const targetRadius = getRadius(target);
          const arrowDist = targetRadius + 6;
          const arrowX = target.x - (dx / dist) * arrowDist;
          const arrowY = target.y - (dy / dist) * arrowDist;
          const angle = Math.atan2(dy, dx);
          const arrowSize = isEdgeSelected || isEdgeHovered ? 5 / k : 4 / k;

          ctx.save();
          ctx.translate(arrowX, arrowY);
          ctx.rotate(angle);
          ctx.fillStyle = ctx.strokeStyle;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(-arrowSize * 1.8, -arrowSize * 0.9);
          ctx.lineTo(-arrowSize * 1.8, arrowSize * 0.9);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      // Draw relation pill along edge on hover, selection, focus, or when explicit setting is enabled
      const showLabelForEdge = edge.relation && (
        currentFilters.showEdgeLabels ||
        isEdgeSelected ||
        isEdgeHovered ||
        isConnectedNodeHovered ||
        isConnectedToFocus
      );

      const isDimmedEdge = hasFocus && !isConnectedToFocus && !isEdgeSelected && !isEdgeHovered && !isConnectedNodeHovered;

      if (showLabelForEdge && !isDimmedEdge && k > 0.35 && edge.relation) {
        const midX = (source.x + target.x) / 2;
        const midY = (source.y + target.y) / 2;
        const relText = edge.relation;
        const relFontSize = Math.max(8, Math.min(10, 9 / Math.sqrt(k)));

        ctx.save();
        ctx.font = `600 ${relFontSize}px Inter, -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const metrics = ctx.measureText(relText);
        const padX = 4;
        const padY = 2;
        const boxW = metrics.width + padX * 2;
        const boxH = relFontSize + padY * 2;
        const rx = midX - boxW / 2;
        const ry = midY - boxH / 2;

        ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.95)';
        ctx.strokeStyle = getRelationColor(edge.relation, isDark);
        ctx.lineWidth = isEdgeHovered || isEdgeSelected ? 1.5 : 1;

        ctx.beginPath();
        if (typeof (ctx as any).roundRect === 'function') {
          (ctx as any).roundRect(rx, ry, boxW, boxH, 3);
        } else {
          ctx.rect(rx, ry, boxW, boxH);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
        ctx.fillText(relText, midX, midY);
        ctx.restore();
      }
    }

    // 2. Draw Nodes
    for (const node of currentNodes) {
      if (node.x === undefined || node.y === undefined) continue;

      const radius = getRadius(node);
      const isFocused = currentNeighbors ? currentNeighbors.has(node.id) : true;
      const isSearchMatch = currentFilters.searchQuery
        ? node.name.toLowerCase().includes(currentFilters.searchQuery.toLowerCase()) ||
          node.tags.some((t) => t.toLowerCase().includes(currentFilters.searchQuery.toLowerCase()))
        : true;

      const isDimmed = (currentNeighbors !== null && !isFocused) || (currentFilters.searchQuery !== '' && !isSearchMatch);
      const isHovered = currentHovered?.id === node.id;
      const isSelected = currentSelected?.id === node.id;
      const isActiveFile = currentActiveFileId === node.id;
      const isTopBridge = node.betweenness > 0.6;

      ctx.save();
      ctx.globalAlpha = isDimmed ? 0.15 : 1.0;

      // Glow halo for Selected, Active, Top Bridge, or Hovered nodes
      if (!isDimmed && (isSelected || isHovered || isActiveFile || (isTopBridge && k > 0.6))) {
        const glowRadius = radius + (isHovered || isSelected || isActiveFile ? 8 : 5);
        const glowColor = isSelected
          ? 'rgba(99, 102, 241, 0.35)'
          : isActiveFile
          ? 'rgba(6, 182, 212, 0.35)'
          : isHovered
          ? 'rgba(56, 189, 248, 0.35)'
          : 'rgba(245, 158, 11, 0.28)';

        ctx.beginPath();
        ctx.arc(node.x, node.y, glowRadius, 0, 2 * Math.PI);
        ctx.fillStyle = glowColor;
        ctx.fill();
      }

      // Draw Main Node Circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);

      const nodeColor = getColor(node);
      ctx.fillStyle = nodeColor;

      if (node.isGhost) {
        ctx.fillStyle = isDark ? '#1e293b' : '#f1f5f9';
        ctx.fill();
        ctx.strokeStyle = nodeColor;
        ctx.lineWidth = 1.5 / k;
        ctx.setLineDash([3 / k, 3 / k]);
        ctx.stroke();
      } else {
        ctx.fill();
        // Inner border for crispness
        ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1 / k;
        ctx.setLineDash([]);
        ctx.stroke();
      }

      // Selected / Active / Hovered outer ring border
      if (isSelected || isHovered || isActiveFile) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 2.5 / k, 0, 2 * Math.PI);
        ctx.strokeStyle = isSelected ? '#6366f1' : isActiveFile ? '#06b6d4' : '#ffffff';
        ctx.lineWidth = 2 / k;
        ctx.stroke();
      }

      // 3. Draw Labels
      const shouldDrawLabel =
        isHovered ||
        isSelected ||
        isActiveFile ||
        (isFocused && currentNeighbors !== null) ||
        isSearchMatch && currentFilters.searchQuery !== '' ||
        (isTopBridge && k > 0.6) ||
        k > 0.9;

      if (shouldDrawLabel && !isDimmed) {
        const fontSize = Math.max(10, Math.min(13, 11 / Math.sqrt(k)));
        ctx.font = `${isHovered ? '600' : '500'} ${fontSize}px Inter, -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const labelText = node.isGhost ? `${node.name} (uncreated)` : node.name;
        const textY = node.y + radius + 4;

        // Background box behind text for readability
        ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.88)';
        const textMetrics = ctx.measureText(labelText);
        const padding = 2.5;
        ctx.fillRect(
          node.x - textMetrics.width / 2 - padding,
          textY - 1,
          textMetrics.width + padding * 2,
          fontSize + 2
        );

        ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
        ctx.fillText(labelText, node.x, textY);
      }

      ctx.restore();
    }

    // 4. Draw Interactive Connecting Laser Cord (Shift + Drag)
    if (isConnectingRef.current && connectSourceNodeRef.current) {
      const source = connectSourceNodeRef.current;
      const targetCandidate = connectTargetCandidateRef.current;
      const targetPos = targetCandidate
        ? { x: targetCandidate.x || 0, y: targetCandidate.y || 0 }
        : connectCurrentPosRef.current;

      ctx.save();

      // Elastic laser cord
      ctx.beginPath();
      ctx.moveTo(source.x || 0, source.y || 0);
      ctx.lineTo(targetPos.x, targetPos.y);
      ctx.strokeStyle = targetCandidate ? '#10b981' : '#6366f1';
      ctx.lineWidth = 3 / k;
      ctx.setLineDash([5 / k, 3 / k]);
      ctx.stroke();

      // Source pulse ring
      ctx.beginPath();
      ctx.arc(source.x || 0, source.y || 0, getRadius(source) + 6 / k, 0, 2 * Math.PI);
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2 / k;
      ctx.setLineDash([]);
      ctx.stroke();

      // Target snap ring & badge if candidate found
      if (targetCandidate) {
        const tRadius = getRadius(targetCandidate) + 7 / k;
        ctx.beginPath();
        ctx.arc(targetCandidate.x || 0, targetCandidate.y || 0, tRadius, 0, 2 * Math.PI);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2.5 / k;
        ctx.stroke();

        // Cord midpoint hint badge
        const midX = ((source.x || 0) + targetPos.x) / 2;
        const midY = ((source.y || 0) + targetPos.y) / 2;
        const badgeText = `🔗 Link to ${targetCandidate.name}`;
        ctx.font = `600 ${Math.max(10, 11 / Math.sqrt(k))}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const badgeMetrics = ctx.measureText(badgeText);
        ctx.fillStyle = isDark ? '#0f172a' : '#ffffff';
        ctx.fillRect(midX - badgeMetrics.width / 2 - 5, midY - 9, badgeMetrics.width + 10, 18);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1 / k;
        ctx.strokeRect(midX - badgeMetrics.width / 2 - 5, midY - 9, badgeMetrics.width + 10, 18);
        ctx.fillStyle = '#10b981';
        ctx.fillText(badgeText, midX, midY);
      }

      ctx.restore();
    }

    ctx.restore();
  }, []);

  // Safe animation frame trigger
  const requestRedraw = useCallback(() => {
    if (animationFrameIdRef.current) return;
    animationFrameIdRef.current = requestAnimationFrame(() => {
      animationFrameIdRef.current = null;
      drawFrame();
    });
  }, [drawFrame]);

  // Set up & run d3-force simulation smoothly in-place
  useEffect(() => {
    if (!canvasRef.current || nodes.length === 0) return;

    const hasExistingPositions = nodes.some((n) => n.x !== undefined && n.y !== undefined);

    let sim = simulationRef.current;
    if (!sim) {
      sim = forceSimulation<GraphNode, GraphEdge>(nodes)
        .force(
          'link',
          forceLink<GraphNode, GraphEdge>(edges)
            .id((d) => d.id)
            .distance(physics.linkDistance)
        )
        .force('charge', forceManyBody<GraphNode>().strength(physics.repulsion))
        .force('center', forceCenter<GraphNode>(0, 0).strength(physics.gravity))
        .force(
          'collision',
          forceCollide<GraphNode>().radius((d) => getNodeRadius(d) + physics.collisionRadius)
        )
        .alpha(hasExistingPositions ? 0.04 : 0.85)
        .alphaDecay(0.045)
        .on('tick', requestRedraw);

      simulationRef.current = sim;
    } else {
      // In-place node and edge binding without restarting simulation violently
      sim.nodes(nodes);
      const linkForce = sim.force('link') as any;
      if (linkForce) {
        linkForce.links(edges).distance(physics.linkDistance);
      }
      const chargeForce = sim.force('charge') as any;
      if (chargeForce) {
        chargeForce.strength(physics.repulsion);
      }
      const centerForce = sim.force('center') as any;
      if (centerForce) {
        centerForce.strength(physics.gravity);
      }
      const collideForce = sim.force('collision') as any;
      if (collideForce) {
        collideForce.radius((d: GraphNode) => getNodeRadius(d) + physics.collisionRadius);
      }

      if (!hasExistingPositions) {
        sim.alpha(0.85).restart();
      }
    }
  }, [nodes, edges, physics, getNodeRadius, requestRedraw]);

  // Clean up simulation on unmount
  useEffect(() => {
    return () => {
      simulationRef.current?.stop();
      simulationRef.current = null;
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, []);

  // Immediate redraw on visual state changes without restarting simulation
  useEffect(() => {
    requestRedraw();
  }, [theme, filters, hoveredNode, selectedNode, selectedEdge, activeFileId, requestRedraw]);

  // Handle Canvas Resizing (High-DPI aware and auto-center on layout changes)
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    if (rect.width <= 10 || rect.height <= 10) return;

    const dpr = window.devicePixelRatio || 1;

    const expectedWidth = Math.round(rect.width * dpr);
    const expectedHeight = Math.round(rect.height * dpr);
    if (canvas.width !== expectedWidth || canvas.height !== expectedHeight) {
      canvas.width = expectedWidth;
      canvas.height = expectedHeight;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    }

    // If transform is uninitialized, center it perfectly to container middle!
    if (!hasInitializedCenterRef.current) {
      hasInitializedCenterRef.current = true;
      const { cx, cy } = getGraphCentroid(renderStateRef.current.nodes);
      transformRef.current = {
        x: rect.width / 2 - cx * 0.85,
        y: rect.height / 2 - cy * 0.85,
        k: 0.85,
      };
      setZoomLevel(0.85);
    }

    requestRedraw();
  }, [requestRedraw]);

  useLayoutEffect(() => {
    handleResize();
  }, [handleResize, nodes]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    handleResize();
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, [handleResize]);

  // Convert Screen Mouse Coords to Virtual Graph Coords
  const getGraphCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;

    const { x, y, k } = transformRef.current;
    return {
      x: (screenX - x) / k,
      y: (screenY - y) / k,
    };
  }, []);

  // Find node under cursor
  const findNodeAt = useCallback(
    (graphX: number, graphY: number): GraphNode | null => {
      for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        if (node.x === undefined || node.y === undefined) continue;
        const dx = graphX - node.x;
        const dy = graphY - node.y;
        const radius = getNodeRadius(node) + 5;
        if (dx * dx + dy * dy <= radius * radius) {
          return node;
        }
      }
      return null;
    },
    [nodes, getNodeRadius]
  );

  // Find edge under cursor
  const findEdgeAt = useCallback(
    (graphX: number, graphY: number, threshold: number = 7): GraphEdge | null => {
      const thresholdSq = threshold * threshold;
      for (const edge of edges) {
        const source = typeof edge.source === 'object' ? edge.source : null;
        const target = typeof edge.target === 'object' ? edge.target : null;
        if (!source || !target || source.x === undefined || source.y === undefined || target.x === undefined || target.y === undefined) {
          continue;
        }
        const dSq = distToSegmentSquared(
          { x: graphX, y: graphY },
          { x: source.x, y: source.y },
          { x: target.x, y: target.y }
        );
        if (dSq <= thresholdSq) {
          return edge;
        }
      }
      return null;
    },
    [edges]
  );

  // Mouse & Touch Events
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      isMouseDownRef.current = true;
      mouseDownPosRef.current = { x: e.clientX, y: e.clientY };

      const { x: gx, y: gy } = getGraphCoords(e.clientX, e.clientY);
      const hitNode = findNodeAt(gx, gy);

      // 1. Shift + Drag Connecting mode
      if (e.shiftKey && hitNode) {
        isConnectingRef.current = true;
        connectSourceNodeRef.current = hitNode;
        connectCurrentPosRef.current = { x: gx, y: gy };
        connectTargetCandidateRef.current = null;
        requestRedraw();
        return;
      }

      // 2. Normal Node Interaction or Canvas Pan
      if (hitNode) {
        dragNodeRef.current = hitNode;
        isDraggingRef.current = false;
      } else {
        isPanningRef.current = true;
        panStartRef.current = { x: e.clientX - transformRef.current.x, y: e.clientY - transformRef.current.y };
      }
    },
    [getGraphCoords, findNodeAt, requestRedraw]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { x: gx, y: gy } = getGraphCoords(e.clientX, e.clientY);

      // Handle Shift + Drag Connecting laser beam
      if (isConnectingRef.current && connectSourceNodeRef.current) {
        connectCurrentPosRef.current = { x: gx, y: gy };
        const candidate = findNodeAt(gx, gy);
        connectTargetCandidateRef.current =
          candidate && candidate.id !== connectSourceNodeRef.current.id ? candidate : null;
        requestRedraw();
        if (canvasRef.current) canvasRef.current.style.cursor = 'crosshair';
        return;
      }

      if (isMouseDownRef.current) {
        const dx = e.clientX - mouseDownPosRef.current.x;
        const dy = e.clientY - mouseDownPosRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dragNodeRef.current) {
          if (!isDraggingRef.current && dist > 4) {
            isDraggingRef.current = true;
            dragNodeRef.current.fx = dragNodeRef.current.x;
            dragNodeRef.current.fy = dragNodeRef.current.y;
            simulationRef.current?.alphaTarget(0.15).restart();
          }

          if (isDraggingRef.current) {
            dragNodeRef.current.fx = gx;
            dragNodeRef.current.fy = gy;
            requestRedraw();
            return;
          }
        } else if (isPanningRef.current) {
          transformRef.current.x = e.clientX - panStartRef.current.x;
          transformRef.current.y = e.clientY - panStartRef.current.y;
          requestRedraw();
          return;
        }
      }

      // Hover check without shaking the simulation
      const hitNode = findNodeAt(gx, gy);
      if (hitNode) {
        if (hoveredEdgeRef.current) {
          hoveredEdgeRef.current = null;
          requestRedraw();
        }
        onHoverNode(hitNode, { x: e.clientX, y: e.clientY });
        if (canvasRef.current) canvasRef.current.style.cursor = 'pointer';
        return;
      }

      // Edge hover check
      const hitEdge = findEdgeAt(gx, gy, 8 / transformRef.current.k);
      if (hitEdge) {
        if (hoveredEdgeRef.current?.id !== hitEdge.id) {
          hoveredEdgeRef.current = hitEdge;
          requestRedraw();
        }
        onHoverNode(null, null);
        if (canvasRef.current) canvasRef.current.style.cursor = 'pointer';
        return;
      }

      if (hoveredEdgeRef.current) {
        hoveredEdgeRef.current = null;
        requestRedraw();
      }

      onHoverNode(null, null);
      if (canvasRef.current) canvasRef.current.style.cursor = e.shiftKey ? 'crosshair' : 'grab';
    },
    [getGraphCoords, findNodeAt, findEdgeAt, requestRedraw, onHoverNode]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const wasMouseDown = isMouseDownRef.current;
      isMouseDownRef.current = false;

      // Handle Shift + Drag connecting drop
      if (isConnectingRef.current) {
        const source = connectSourceNodeRef.current;
        const target = connectTargetCandidateRef.current;
        if (source && target && source.id !== target.id) {
          onConnectNodes(source, target);
        }
        isConnectingRef.current = false;
        connectSourceNodeRef.current = null;
        connectTargetCandidateRef.current = null;
        requestRedraw();
        return;
      }

      if (isDraggingRef.current && dragNodeRef.current) {
        dragNodeRef.current.fx = null;
        dragNodeRef.current.fy = null;
        isDraggingRef.current = false;
        dragNodeRef.current = null;
        simulationRef.current?.alphaTarget(0);
      } else if (wasMouseDown) {
        const { x: gx, y: gy } = getGraphCoords(e.clientX, e.clientY);
        const hitNode = findNodeAt(gx, gy);

        if (hitNode) {
          // Toggle node selection
          onSelectEdge(null, null);
          if (selectedNode?.id === hitNode.id) {
            onSelectNode(null);
          } else {
            onSelectNode(hitNode);
          }
        } else {
          // Check if edge was clicked
          const hitEdge = findEdgeAt(gx, gy, 6 / transformRef.current.k);
          if (hitEdge) {
            onSelectNode(null);
            if (selectedEdge?.id === hitEdge.id) {
              onSelectEdge(null, null);
            } else {
              onSelectEdge(hitEdge, { x: e.clientX, y: e.clientY });
            }
          } else {
            // Clicked empty background
            const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
            const dy = Math.abs(e.clientY - mouseDownPosRef.current.y);
            if (dx < 10 && dy < 10) {
              onSelectNode(null);
              onSelectEdge(null, null);
            }
          }
        }
      }

      dragNodeRef.current = null;
      isPanningRef.current = false;
    },
    [getGraphCoords, findNodeAt, findEdgeAt, selectedNode, selectedEdge, onSelectNode, onSelectEdge, onConnectNodes, requestRedraw]
  );

  // Native Double-Click Event Handler
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { x: gx, y: gy } = getGraphCoords(e.clientX, e.clientY);
      const hitNode = findNodeAt(gx, gy);
      if (hitNode) {
        if (hitNode.isGhost) {
          onCreateGhostNote(hitNode);
        } else {
          onOpenNode(hitNode);
        }
      }
    },
    [getGraphCoords, findNodeAt, onOpenNode, onCreateGhostNote]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
      const current = transformRef.current;
      const newK = Math.max(0.15, Math.min(4.0, current.k * zoomFactor));

      // Zoom centered at mouse position
      const newX = mouseX - (mouseX - current.x) * (newK / current.k);
      const newY = mouseY - (mouseY - current.y) * (newK / current.k);

      transformRef.current = { x: newX, y: newY, k: newK };
      setZoomLevel(newK);
      requestRedraw();
    },
    [requestRedraw]
  );

  // Recenter & Reset Zoom
  const handleResetZoom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const { cx, cy, width: gW, height: gH } = getGraphCentroid(renderStateRef.current.nodes);
    let targetK = 0.85;

    // If graph has a non-zero bounding box, auto-scale intelligently
    if (gW > 50 && gH > 50) {
      const pad = 120;
      const fitK = Math.min((rect.width - pad) / gW, (rect.height - pad) / gH);
      targetK = Math.max(0.35, Math.min(1.15, fitK));
    }

    transformRef.current = {
      x: rect.width / 2 - cx * targetK,
      y: rect.height / 2 - cy * targetK,
      k: targetK,
    };
    setZoomLevel(targetK);
    requestRedraw();
  }, [requestRedraw]);

  return (
    <div ref={containerRef} className="network-canvas-container">
      <canvas
        ref={canvasRef}
        className="network-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
      />

      {/* Floating Canvas Navigation Utilities & Translucent Gesture Hint */}
      <div className="network-canvas-bottom-left">
        <div
          className="network-canvas-hint-pill"
          title="Hold Shift and drag from one note to another to create a wikilink"
        >
          <span>💡</span>
          <span>Hold <strong>Shift + Drag</strong> to link notes</span>
        </div>

        <div className="network-zoom-controls">
          <button
            type="button"
            className="network-zoom-btn"
            title="Zoom In"
            onClick={() => {
              const current = transformRef.current;
              const container = containerRef.current;
              const rect = container?.getBoundingClientRect();
              const width = rect && rect.width > 0 ? rect.width : window.innerWidth;
              const height = rect && rect.height > 0 ? rect.height : window.innerHeight;
              const newK = Math.min(4.0, current.k * 1.25);
              const centerX = width / 2;
              const centerY = height / 2;
              const newX = centerX - (centerX - current.x) * (newK / current.k);
              const newY = centerY - (centerY - current.y) * (newK / current.k);
              transformRef.current = { x: newX, y: newY, k: newK };
              setZoomLevel(newK);
              requestRedraw();
            }}
          >
            +
          </button>
          <span className="network-zoom-text">{Math.round(zoomLevel * 100)}%</span>
          <button
            type="button"
            className="network-zoom-btn"
            title="Zoom Out"
            onClick={() => {
              const current = transformRef.current;
              const container = containerRef.current;
              const rect = container?.getBoundingClientRect();
              const width = rect && rect.width > 0 ? rect.width : window.innerWidth;
              const height = rect && rect.height > 0 ? rect.height : window.innerHeight;
              const newK = Math.max(0.15, current.k * 0.8);
              const centerX = width / 2;
              const centerY = height / 2;
              const newX = centerX - (centerX - current.x) * (newK / current.k);
              const newY = centerY - (centerY - current.y) * (newK / current.k);
              transformRef.current = { x: newX, y: newY, k: newK };
              setZoomLevel(newK);
              requestRedraw();
            }}
          >
            −
          </button>
          <button
            type="button"
            className="network-zoom-btn"
            title="Fit & Recenter View"
            onClick={handleResetZoom}
          >
            🎯
          </button>
        </div>
      </div>
    </div>
  );
}
