import type { GraphNode, GraphEdge } from '../types/graph';

/**
 * Computes Betweenness Centrality using Brandes' Algorithm (O(V * E)).
 * For every node, betweenness measures how often it acts as a bridge along the
 * shortest path between all other pairs of nodes in the graph.
 */
export function calculateCentralityMetrics(
  nodes: GraphNode[],
  edges: GraphEdge[]
): { maxBetweenness: number; maxInDegree: number } {
  const n = nodes.length;
  if (n === 0) return { maxBetweenness: 0, maxInDegree: 0 };

  // Map nodeId to array index for O(1) lookups
  const idToIndex = new Map<string, number>();
  nodes.forEach((node, i) => {
    idToIndex.set(node.id, i);
    node.rawBetweenness = 0;
    node.betweenness = 0;
  });

  // Build undirected adjacency list for structural bridging
  const adj: number[][] = Array.from({ length: n }, () => []);

  for (const edge of edges) {
    const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source;
    const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target;

    const u = idToIndex.get(sourceId);
    const v = idToIndex.get(targetId);

    if (u !== undefined && v !== undefined && u !== v) {
      if (!adj[u].includes(v)) adj[u].push(v);
      if (!adj[v].includes(u)) adj[v].push(u);
    }
  }

  // Brandes' Algorithm for unweighted graphs
  const betweenness = new Float64Array(n);

  for (let s = 0; s < n; s++) {
    const stack: number[] = [];
    const predecessors: number[][] = Array.from({ length: n }, () => []);
    const sigma = new Float64Array(n); // number of shortest paths from s
    const dist = new Int32Array(n); // distance from s
    dist.fill(-1);

    sigma[s] = 1;
    dist[s] = 0;

    const queue: number[] = [s];
    let head = 0;

    // Breadth-First Search
    while (head < queue.length) {
      const v = queue[head++];
      stack.push(v);

      const d_v = dist[v];
      const neighbors = adj[v];

      for (let i = 0; i < neighbors.length; i++) {
        const w = neighbors[i];

        // w found for the first time?
        if (dist[w] < 0) {
          dist[w] = d_v + 1;
          queue.push(w);
        }

        // shortest path to w via v?
        if (dist[w] === d_v + 1) {
          sigma[w] += sigma[v];
          predecessors[w].push(v);
        }
      }
    }

    // Accumulation: Back-propagation of dependencies
    const delta = new Float64Array(n);
    while (stack.length > 0) {
      const w = stack.pop()!;
      const preds = predecessors[w];
      const factor = (1 + delta[w]) / sigma[w];

      for (let i = 0; i < preds.length; i++) {
        const v = preds[i];
        delta[v] += sigma[v] * factor;
      }

      if (w !== s) {
        betweenness[w] += delta[w];
      }
    }
  }

  // Since graph is undirected, each path is counted twice
  let maxBetweenness = 0;
  for (let i = 0; i < n; i++) {
    betweenness[i] /= 2;
    nodes[i].rawBetweenness = betweenness[i];
    if (betweenness[i] > maxBetweenness) {
      maxBetweenness = betweenness[i];
    }
  }

  // Normalize scores to [0.0, 1.0]
  let maxInDegree = 0;
  for (let i = 0; i < n; i++) {
    nodes[i].betweenness = maxBetweenness > 0 ? betweenness[i] / maxBetweenness : 0;
    if (nodes[i].inDegree > maxInDegree) {
      maxInDegree = nodes[i].inDegree;
    }
  }

  return { maxBetweenness, maxInDegree };
}

/**
 * Extracts the ego-graph (neighborhood subgraph) centered at a target active node up to `depth` hops.
 */
export function extractLocalSubgraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  activeNodeId: string,
  depth: number = 1
): { localNodes: GraphNode[]; localEdges: GraphEdge[] } {
  if (!activeNodeId) return { localNodes: nodes, localEdges: edges };

  const idToNode = new Map<string, GraphNode>();
  nodes.forEach((n) => idToNode.set(n.id, n));

  const visitedNodeIds = new Set<string>([activeNodeId]);
  let currentLayer = new Set<string>([activeNodeId]);

  for (let d = 0; d < depth; d++) {
    const nextLayer = new Set<string>();

    for (const edge of edges) {
      const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source;
      const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target;

      if (currentLayer.has(sourceId) && !visitedNodeIds.has(targetId)) {
        visitedNodeIds.add(targetId);
        nextLayer.add(targetId);
      }
      if (currentLayer.has(targetId) && !visitedNodeIds.has(sourceId)) {
        visitedNodeIds.add(sourceId);
        nextLayer.add(sourceId);
      }
    }

    currentLayer = nextLayer;
    if (currentLayer.size === 0) break;
  }

  const localNodes = nodes.filter((n) => visitedNodeIds.has(n.id));
  const localEdges = edges.filter((e) => {
    const sourceId = typeof e.source === 'object' ? e.source.id : e.source;
    const targetId = typeof e.target === 'object' ? e.target.id : e.target;
    return visitedNodeIds.has(sourceId) && visitedNodeIds.has(targetId);
  });

  return { localNodes, localEdges };
}
