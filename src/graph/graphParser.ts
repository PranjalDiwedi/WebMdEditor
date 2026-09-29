import type { MarkdownFile } from '../types/file';
import type { GraphData, GraphNode, GraphEdge } from '../types/graph';
import { calculateCentralityMetrics } from './centrality';

/**
 * Normalizes a note name or path for reliable matching across different linking conventions.
 * E.g., "Folder/My Note.md" -> "my note", "My Note" -> "my note"
 */
export function normalizeNoteKey(nameOrPath: string): string {
  let clean = nameOrPath.trim();
  // Remove anchor links like #Section
  const hashIdx = clean.indexOf('#');
  if (hashIdx !== -1) {
    clean = clean.substring(0, hashIdx).trim();
  }
  // Strip .md or .markdown extension
  clean = clean.replace(/\.(md|markdown)$/i, '');
  // Extract basename if path
  const lastSlash = Math.max(clean.lastIndexOf('/'), clean.lastIndexOf('\\'));
  if (lastSlash !== -1) {
    clean = clean.substring(lastSlash + 1);
  }
  return clean.toLowerCase().trim();
}

/**
 * Extracts YAML frontmatter tags from markdown text.
 */
export function extractFrontmatterTags(content: string): string[] {
  const tags: string[] = [];
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!fmMatch) return tags;

  const fm = fmMatch[1];
  // Match tags: [tag1, tag2]
  const inlineTagsMatch = fm.match(/tags?:\s*\[(.*?)\]/i);
  if (inlineTagsMatch) {
    inlineTagsMatch[1]
      .split(',')
      .map((t) => t.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean)
      .forEach((t) => tags.push(t.startsWith('#') ? t.substring(1) : t));
  }

  // Match list format:
  // tags:
  //   - tag1
  //   - tag2
  const listMatch = fm.match(/tags?:\s*\n((?:\s*-\s*[^\n]+\n)+)/i);
  if (listMatch) {
    const lines = listMatch[1].split('\n');
    for (const line of lines) {
      const itemMatch = line.match(/^\s*-\s*['"]?([^'"#\s]+)['"]?/);
      if (itemMatch && itemMatch[1]) {
        tags.push(itemMatch[1]);
      }
    }
  }

  return Array.from(new Set(tags));
}

/**
 * Extracts inline #tags from markdown content.
 */
export function extractInlineTags(content: string): string[] {
  // Strip frontmatter first so it doesn't double parse
  const contentNoFm = content.replace(/^---\s*\n[\s\S]*?\n---/, '');
  // Match #tag, #tag/subtag, but ignore Markdown headers (which start with # at start of line followed by space)
  const tagRegex = /(?:^|\s)(?:#)([a-zA-Z0-9_\-/]+)(?=\s|$|[.,;:!?)"'])/g;
  const tags: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(contentNoFm)) !== null) {
    const tag = match[1];
    // Ignore pure numbers or hex codes (e.g. #123456)
    if (!/^\d+$/.test(tag) && !/^[0-9a-fA-F]{3,8}$/.test(tag)) {
      tags.push(tag);
    }
  }

  return Array.from(new Set(tags));
}

interface ParsedLink {
  raw: string;
  target: string;
  alias?: string;
  relation?: string;
  type: 'wikilink' | 'markdown';
}

/**
 * Extracts both Obsidian Wikilinks [[Target|Alias]], Typed Links [[relation:Target|Alias]],
 * and Standard Markdown links [text](target.md).
 * Robust to both unescaped and escaped bracket syntax (e.g. \[\[Target\]\] from markdown serializers).
 */
export function extractLinksFromContent(content: string): ParsedLink[] {
  const links: ParsedLink[] = [];
  if (!content) return links;

  // Unescape backslashed markdown brackets and pipes: \[\[ -> [[, \]\] -> ]], \| -> |
  const unescapedContent = content.replace(/\\([[\]|])/g, '$1');

  // 1. Wikilinks [[Note Name]], [[relation:Note Name]], [[Note Name|Alias]], [[relation:Note|Alias]]
  const wikilinkRegex = /\[\[([^\]\r\n]+)\]\]/g;
  let match: RegExpExecArray | null;

  while ((match = wikilinkRegex.exec(unescapedContent)) !== null) {
    const rawInner = match[1].trim();
    let target = rawInner;
    let alias: string | undefined;
    let relation: string | undefined;

    if (rawInner.includes('|')) {
      const parts = rawInner.split('|');
      target = parts[0].trim();
      alias = parts.slice(1).join('|').trim();
    }

    // Check for typed link relation prefix: [[relation:Target Note]]
    const colonIdx = target.indexOf(':');
    if (colonIdx > 0 && colonIdx < target.length - 1) {
      const potentialRelation = target.substring(0, colonIdx).trim();
      const potentialTarget = target.substring(colonIdx + 1).trim();
      // Ensure potentialRelation is an identifier (letters, digits, underscores, hyphens)
      if (/^[a-zA-Z][a-zA-Z0-9_\- ]*$/.test(potentialRelation) && potentialTarget.length > 0) {
        relation = potentialRelation.toLowerCase().replace(/\s+/g, '_');
        target = potentialTarget;
      }
    }

    if (target) {
      links.push({
        raw: match[0],
        target,
        alias,
        relation,
        type: 'wikilink',
      });
    }
  }

  // 2. Standard Markdown links [text](path/to/file.md)
  const mdLinkRegex = /\[([^\]\r\n]+)\]\(([^)\r\n]+\.(?:md|markdown)(?:#[^)]*)?)\)/gi;
  while ((match = mdLinkRegex.exec(unescapedContent)) !== null) {
    const alias = match[1].trim();
    let target = match[2].trim();
    // Clean target of any url encoding or query/hash
    try {
      target = decodeURIComponent(target);
    } catch {}

    links.push({
      raw: match[0],
      target,
      alias,
      type: 'markdown',
    });
  }

  return links;
}

/**
 * Generates a clean text preview snippet from markdown.
 */
function createSnippet(content: string): string {
  const stripped = content
    .replace(/^---\s*\n[\s\S]*?\n---/, '') // Remove frontmatter
    .replace(/^#+\s+/gm, '') // Remove heading markers
    .replace(/\[\[(.*?)\]\]/g, '$1') // Flatten wikilinks
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Flatten md links
    .replace(/[*_~`>#\-+]/g, '') // Remove formatting chars
    .replace(/\s+/g, ' ')
    .trim();

  return stripped.length > 140 ? stripped.substring(0, 140) + '...' : stripped;
}

/**
 * Builds the complete GraphData model from a collection of MarkdownFile items.
 */
export function buildGraphFromFiles(
  files: MarkdownFile[],
  activeFileId: string | null = null,
  options: { includeTagEdges?: boolean } = {},
  existingNodes?: GraphNode[]
): GraphData {
  const nodeMap = new Map<string, GraphNode>();
  const normalizedToNodeId = new Map<string, string>();
  const allTagsSet = new Set<string>();
  const allFoldersSet = new Set<string>();
  const allRelationsSet = new Set<string>();

  // Cache existing positions so nodes never jump or explode on updates
  const existingPosMap = new Map<
    string,
    { x?: number; y?: number; vx?: number; vy?: number; fx?: number | null; fy?: number | null }
  >();
  if (existingNodes && existingNodes.length > 0) {
    for (const prev of existingNodes) {
      if (prev.x !== undefined && prev.y !== undefined) {
        existingPosMap.set(prev.id, {
          x: prev.x,
          y: prev.y,
          vx: prev.vx,
          vy: prev.vy,
          fx: prev.fx,
          fy: prev.fy,
        });
      }
    }
  }

  // 1. Create GraphNodes for all real files
  for (const file of files) {
    const folder = file.path
      ? file.path.includes('/')
        ? file.path.substring(0, file.path.lastIndexOf('/'))
        : ''
      : '';
    if (folder) allFoldersSet.add(folder);

    const fmTags = extractFrontmatterTags(file.content || '');
    const inlineTags = extractInlineTags(file.content || '');
    const tags = Array.from(new Set([...fmTags, ...inlineTags]));
    tags.forEach((t) => allTagsSet.add(t));

    const words = file.content
      ? file.content.trim().split(/\s+/).filter(Boolean).length
      : 0;

    const prevPos = existingPosMap.get(file.id);

    const node: GraphNode = {
      id: file.id,
      name: file.name,
      path: file.path || file.name,
      fileId: file.id,
      folder: folder || 'Root',
      tags,
      size: words || Math.max(1, Math.round((file.content?.length || 0) / 5)),
      snippet: createSnippet(file.content || ''),
      betweenness: 0,
      rawBetweenness: 0,
      inDegree: 0,
      outDegree: 0,
      isGhost: false,
      isPinned: file.isPinned,
      isActive: file.id === activeFileId,
      x: prevPos?.x,
      y: prevPos?.y,
      vx: prevPos?.vx,
      vy: prevPos?.vy,
      fx: prevPos?.fx,
      fy: prevPos?.fy,
    };

    nodeMap.set(node.id, node);

    // Map both exact name, filename without .md, and full path
    normalizedToNodeId.set(normalizeNoteKey(file.name), node.id);
    normalizedToNodeId.set(normalizeNoteKey(file.path || file.name), node.id);
    normalizedToNodeId.set(file.name.toLowerCase(), node.id);
    normalizedToNodeId.set(file.id, node.id);
  }

  // 2. Parse edges & discover ghost notes
  const edges: GraphEdge[] = [];
  const edgeSet = new Set<string>();

  for (const file of files) {
    const sourceNode = nodeMap.get(file.id);
    if (!sourceNode) continue;

    const parsedLinks = extractLinksFromContent(file.content || '');

    for (const link of parsedLinks) {
      const normTarget = normalizeNoteKey(link.target);
      let targetNodeId = normalizedToNodeId.get(normTarget);

      // If target node does not exist in vault, create a Ghost Node
      if (!targetNodeId) {
        const ghostId = `ghost_${normTarget}`;
        if (!nodeMap.has(ghostId)) {
          const prevGhostPos = existingPosMap.get(ghostId);
          const ghostNode: GraphNode = {
            id: ghostId,
            name: link.target.endsWith('.md') ? link.target : `${link.target}.md`,
            path: link.target,
            folder: 'Uncreated',
            tags: [],
            size: 1,
            snippet: 'This note is referenced but does not exist yet. Click to create.',
            betweenness: 0,
            rawBetweenness: 0,
            inDegree: 0,
            outDegree: 0,
            isGhost: true,
            x: prevGhostPos?.x,
            y: prevGhostPos?.y,
            vx: prevGhostPos?.vx,
            vy: prevGhostPos?.vy,
          };
          nodeMap.set(ghostId, ghostNode);
          normalizedToNodeId.set(normTarget, ghostId);
        }
        targetNodeId = ghostId;
      }

      // Avoid self-loops
      if (sourceNode.id === targetNodeId) continue;

      const edgeKey = `${sourceNode.id}->${targetNodeId}`;
      if (!edgeSet.has(edgeKey)) {
        edgeSet.add(edgeKey);
        if (link.relation) {
          allRelationsSet.add(link.relation);
        }
        edges.push({
          id: edgeKey,
          source: sourceNode.id,
          target: targetNodeId,
          type: link.type,
          label: link.alias,
          relation: link.relation,
        });

        // Update raw in/out degrees
        sourceNode.outDegree += 1;
        const targetNode = nodeMap.get(targetNodeId);
        if (targetNode) {
          targetNode.inDegree += 1;
        }
      }
    }
  }

  // 3. Optional: Add shared tag connections
  if (options.includeTagEdges) {
    const tagToNodeIds = new Map<string, string[]>();
    for (const node of nodeMap.values()) {
      for (const tag of node.tags) {
        const list = tagToNodeIds.get(tag) || [];
        list.push(node.id);
        tagToNodeIds.set(tag, list);
      }
    }

    for (const [tag, ids] of tagToNodeIds.entries()) {
      if (ids.length > 1 && ids.length <= 15) {
        // Connect small clusters of shared tags
        for (let i = 0; i < ids.length; i++) {
          for (let j = i + 1; j < ids.length; j++) {
            const edgeKey = `tag_${tag}_${ids[i]}_${ids[j]}`;
            if (!edgeSet.has(edgeKey)) {
              edgeSet.add(edgeKey);
              edges.push({
                id: edgeKey,
                source: ids[i],
                target: ids[j],
                type: 'tag',
                label: `#${tag}`,
              });
            }
          }
        }
      }
    }
  }

  const nodes = Array.from(nodeMap.values());

  // 4. Calculate Betweenness Centrality & Global Graph Metrics
  const { maxBetweenness, maxInDegree } = calculateCentralityMetrics(nodes, edges);

  return {
    nodes,
    edges,
    tags: Array.from(allTagsSet).sort(),
    folders: Array.from(allFoldersSet).sort(),
    relations: Array.from(allRelationsSet).sort(),
    maxBetweenness,
    maxInDegree,
  };
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Smartly appends a [[Target Note]] or [[relation:Target Note]] wikilink to markdown content.
 * Checks for existing "## Related Notes" or "## Links" section or appends cleanly.
 */
export function addWikilinkToContent(content: string, targetNoteName: string, relation?: string): string {
  const cleanTarget = targetNoteName.replace(/\.md$/i, '').trim();
  const cleanRel = relation ? relation.trim().toLowerCase().replace(/[^a-z0-9_\-]/g, '_') : '';
  const linkText = cleanRel ? `[[${cleanRel}:${cleanTarget}]]` : `[[${cleanTarget}]]`;
  const unescaped = content.replace(/\\([[\]|])/g, '$1');

  // If link already exists, update its relation instead
  const esc = escapeRegExp(cleanTarget);
  const existingRegex = new RegExp(`\\[\\[(?:[a-zA-Z0-9_\\- ]+:)?${esc}(?:\\|[^\\]]*)?\\]\\]`, 'i');
  if (existingRegex.test(unescaped)) {
    return updateWikilinkRelationInContent(content, cleanTarget, cleanRel);
  }

  // Check for existing "## Related Notes" or "## Related" or "## Links" section
  const relatedSectionRegex = /(^|\n)##\s+(Related(?:\s+Notes)?|Links)\s*(\n|$)/i;
  const match = content.match(relatedSectionRegex);

  if (match && match.index !== undefined) {
    const insertPos = match.index + match[0].length;
    return content.slice(0, insertPos) + `- ${linkText}\n` + content.slice(insertPos);
  }

  // Otherwise append cleanly at the end
  const trimmed = content.trimEnd();
  if (!trimmed) {
    return `## Related Notes\n- ${linkText}\n`;
  }
  return `${trimmed}\n\n---\n\n## Related Notes\n- ${linkText}\n`;
}

/**
 * Updates an existing wikilink's relation type in note content (e.g. [[Target]] -> [[depends_on:Target]]).
 */
export function updateWikilinkRelationInContent(
  content: string,
  targetNoteName: string,
  newRelation?: string
): string {
  const cleanTarget = targetNoteName.replace(/\.md$/i, '').trim();
  const cleanRel = newRelation ? newRelation.trim().toLowerCase().replace(/[^a-z0-9_\-]/g, '_') : '';
  const esc = escapeRegExp(cleanTarget);

  let replaced = false;

  // 1. Match unescaped wikilinks: [[old_rel:Target|Alias]] or [[Target|Alias]] or [[Target]]
  const unescapedRegex = new RegExp(`\\[\\[(?:[a-zA-Z0-9_\\-]+:)?(${esc})(\\|[^\\]]+)?\\]\\]`, 'g');
  let updated = content.replace(unescapedRegex, (_match, target, alias) => {
    replaced = true;
    const aliasPart = alias || '';
    return cleanRel ? `[[${cleanRel}:${target}${aliasPart}]]` : `[[${target}${aliasPart}]]`;
  });

  // 2. Match backslash-escaped wikilinks if present
  const escapedRegex = new RegExp(`\\\\\\[\\\\\\[(?:[a-zA-Z0-9_\\-]+:)?(${esc})(\\\\|[^\\]]+)?\\\\\\]\\\\\\]`, 'g');
  updated = updated.replace(escapedRegex, (_match, target, alias) => {
    replaced = true;
    const aliasPart = alias || '';
    return cleanRel ? `[[${cleanRel}:${target}${aliasPart}]]` : `[[${target}${aliasPart}]]`;
  });

  // If not found in note, append it
  if (!replaced) {
    const linkText = cleanRel ? `[[${cleanRel}:${cleanTarget}]]` : `[[${cleanTarget}]]`;
    const trimmed = content.trimEnd();
    if (!trimmed) {
      return `## Related Notes\n- ${linkText}\n`;
    }
    return `${trimmed}\n\n---\n\n## Related Notes\n- ${linkText}\n`;
  }

  return updated;
}

/**
 * Cleanly removes a wikilink or markdown link from note content.
 */
export function removeWikilinkFromContent(content: string, targetNoteName: string): string {
  const cleanTarget = targetNoteName.replace(/\.md$/i, '');
  const esc = escapeRegExp(cleanTarget);

  let updated = content;

  // 1. Remove bullet list line: "- [[Target]]" or "- [[relation:Target]]" or "* [[Target]]" or "- \[\[Target\]\]"
  const bulletRegex = new RegExp(`^[\\t ]*[-*+]\\s*(?:\\[|\n|\r|\\\\)*\\[\\[(?:[a-zA-Z0-9_\\- ]+:)?${esc}(?:\\|[^\\]]*)?\\]\\]\\s*\\n?`, 'gmi');
  updated = updated.replace(bulletRegex, '');

  const escapedBulletRegex = new RegExp(`^[\\t ]*[-*+]\\s*\\\\\\[\\\\\\[(?:[a-zA-Z0-9_\\- ]+:)?${esc}(?:\\\\\\|[^\\]]*)?\\\\\\]\\\\\\]\\s*\\n?`, 'gmi');
  updated = updated.replace(escapedBulletRegex, '');

  const mdBulletRegex = new RegExp(`^[\\t ]*[-*+]\\s*\\[[^\\]]*\\]\\([^)]*${esc}\\.md(?:#[^)]*)?\\)\\s*\\n?`, 'gmi');
  updated = updated.replace(mdBulletRegex, '');

  // 2. Remove inline wikilink "[[Target]]" or "[[relation:Target]]" or "\[\[Target\]\]"
  const inlineRegex = new RegExp(`\\[\\[(?:[a-zA-Z0-9_\\- ]+:)?${esc}(?:\\|[^\\]]*)?\\]\\]`, 'gi');
  updated = updated.replace(inlineRegex, '');

  const escapedInlineRegex = new RegExp(`\\\\\\[\\\\\\[(?:[a-zA-Z0-9_\\- ]+:)?${esc}(?:\\\\\\|[^\\]]*)?\\\\\\]\\\\\\]`, 'gi');
  updated = updated.replace(escapedInlineRegex, '');

  // 3. Clean up empty "## Related Notes" header if no items remain
  updated = updated.replace(/\n##\s+(?:Related(?:\s+Notes)?|Links)\s*\n+(?=(?:---\s*\n)?$)/i, '\n');

  return updated.trimEnd() + '\n';
}

