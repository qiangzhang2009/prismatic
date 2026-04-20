#!/usr/bin/env bun
/**
 * wittsrc-graph-query.ts
 *
 * Graph traversal queries on the Wittgenstein Nachlass knowledge graph.
 * Supports: all edges, type filtering, depth traversal, path finding.
 *
 * Usage:
 *   bun run scripts/wittsrc-graph-query.ts work-ms-114
 *   bun run scripts/wittsrc-graph-query.ts work-ms-114 --type evolves_to --depth 3
 *   bun run scripts/wittsrc-graph-query.ts --type contradicts
 *   bun run scripts/wittsrc-graph-query.ts work-ms-114 --path-to work-pi
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';

type LinkType = 'cites' | 'evolves_to' | 'contradicts' | 'influenced_by' | 'defines' | 'revisits';

interface GraphNode {
  slug: string;
  type: string;
  period: [number, number] | null;
  label: string;
}

interface GraphEdge {
  from: string;
  to: string;
  type: LinkType;
  confidence: number;
}

interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  meta?: { totalNodes: number; totalEdges: number; avgConfidence: number };
}

// ============================================================================
// GRAPH TRAVERSAL
// ============================================================================

function bfsTraversal(
  graph: Graph,
  startSlug: string,
  options: {
    type?: LinkType;
    direction?: 'in' | 'out' | 'both';
    depth?: number;
    maxDepth?: number;
  } = {}
): { nodes: Set<string>; edges: GraphEdge[] } {
  const { type, direction = 'both', maxDepth = 10 } = options;
  const visited = new Set<string>([startSlug]);
  const queue: Array<{ slug: string; depth: number }> = [{ slug: startSlug, depth: 0 }];
  const matchingEdges: GraphEdge[] = [];

  while (queue.length > 0) {
    const { slug, depth } = queue.shift()!;
    if (depth > maxDepth) continue;

    for (const edge of graph.edges) {
      let isMatch = false;
      const targetKey = direction === 'out' ? 'from' : direction === 'in' ? 'to' : null;
      const otherKey = direction === 'out' ? 'to' : direction === 'in' ? 'from' : null;

      if (direction === 'both') {
        if (edge.from === slug && (!type || edge.type === type)) {
          isMatch = true;
          if (!visited.has(edge.to)) {
            visited.add(edge.to);
            queue.push({ slug: edge.to, depth: depth + 1 });
          }
        }
        if (edge.to === slug && (!type || edge.type === type)) {
          isMatch = true;
          if (!visited.has(edge.from)) {
            visited.add(edge.from);
            queue.push({ slug: edge.from, depth: depth + 1 });
          }
        }
      } else {
        if (edge[targetKey!] === slug && (!type || edge.type === type)) {
          isMatch = true;
          const neighbor = edge[otherKey!];
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push({ slug: neighbor, depth: depth + 1 });
          }
        }
      }

      if (isMatch) matchingEdges.push(edge);
    }
  }

  return { nodes: visited, edges: matchingEdges };
}

function findPath(graph: Graph, from: string, to: string): string[] | null {
  // BFS shortest path
  const visited = new Set<string>([from]);
  const queue: Array<{ slug: string; path: string[] }> = [{ slug: from, path: [from] }];

  while (queue.length > 0) {
    const { slug, path } = queue.shift()!;
    if (slug === to) return path;

    for (const edge of graph.edges) {
      let neighbor: string | null = null;
      if (edge.from === slug && !visited.has(edge.to)) neighbor = edge.to;
      if (edge.to === slug && !visited.has(edge.from)) neighbor = edge.from;
      if (neighbor) {
        visited.add(neighbor);
        queue.push({ slug: neighbor, path: [...path, `${edge.type}:${neighbor}`] });
      }
    }
  }

  return null;
}

function renderGraph(
  graph: Graph,
  nodes: Set<string>,
  edges: GraphEdge[],
  format: 'text' | 'mermaid' | 'json' = 'text'
): string {
  const nodeMap = new Map(graph.nodes.map(n => [n.slug, n]));

  if (format === 'json') {
    const subgraphNodes = graph.nodes.filter(n => nodes.has(n.slug));
    const subgraphEdges = graph.edges.filter(e => nodes.has(e.from) && nodes.has(e.to));
    return JSON.stringify({ nodes: subgraphNodes, edges: subgraphEdges }, null, 2);
  }

  if (format === 'mermaid') {
    const lines = ['graph TD'];
    const nodeIds: Record<string, string> = {};
    let i = 0;
    for (const slug of nodes) {
      const id = `N${i++}`;
      nodeIds[slug] = id;
      const node = nodeMap.get(slug);
      lines.push(`  ${id}["${node?.label || slug}"]`);
    }
    for (const edge of edges) {
      if (nodeIds[edge.from] && nodeIds[edge.to]) {
        lines.push(`  ${nodeIds[edge.from]} --"${edge.type}"--> ${nodeIds[edge.to]}`);
      }
    }
    return lines.join('\n');
  }

  // Text format
  const lines: string[] = [];
  const periodLabel = (p: [number, number] | null) =>
    p ? ` [${p[0]}-${p[1]}]` : '';

  lines.push(`\n=== Graph Query Results ===\n`);

  const sortedNodes = [...nodes].sort((a, b) => {
    const na = nodeMap.get(a);
    const nb = nodeMap.get(b);
    return (na?.period?.[0] || 0) - (nb?.period?.[0] || 0);
  });

  for (const slug of sortedNodes) {
    const node = nodeMap.get(slug);
    if (!node) continue;
    lines.push(`  ${node.label}${periodLabel(node.period)} (${node.type})`);
  }

  lines.push(`\n--- Relationships (${edges.length}) ---\n`);
  const typeGroups: Record<string, GraphEdge[]> = {};
  for (const edge of edges) {
    if (!typeGroups[edge.type]) typeGroups[edge.type] = [];
    typeGroups[edge.type].push(edge);
  }
  for (const [type, group] of Object.entries(typeGroups).sort((a, b) => b[1].length - a[1].length)) {
    lines.push(`\n  ${type} (${group.length}):`);
    for (const edge of group.slice(0, 10)) {
      const fromLabel = nodeMap.get(edge.from)?.label || edge.from;
      const toLabel = nodeMap.get(edge.to)?.label || edge.to;
      lines.push(`    ${fromLabel} --→ ${toLabel} (conf: ${edge.confidence.toFixed(2)})`);
    }
    if (group.length > 10) lines.push(`    ... and ${group.length - 10} more`);
  }

  return lines.join('\n');
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const slug = args.find(a => !a.startsWith('--')) || '';
  const type = args.includes('--type') ? args[args.indexOf('--type') + 1] as LinkType : undefined;
  const direction = (args.includes('--direction') ? args[args.indexOf('--direction') + 1] : 'both') as 'in' | 'out' | 'both';
  const depth = args.includes('--depth') ? parseInt(args[args.indexOf('--depth') + 1]) : 3;
  const format = args.includes('--format') ? args[args.indexOf('--format') + 1] as 'text' | 'mermaid' | 'json' : 'text';
  const pathTo = args.includes('--path-to') ? args[args.indexOf('--path-to') + 1] : null;

  // Load graph
  const scriptDir = join(dirname(process.argv[1] || import.meta.filename), '..');
  let graph: Graph;

  try {
    const graphPath = 'corpus/wittgenstein/brain/.links/graph.json';
    const content = await readFile(graphPath, 'utf-8');
    graph = JSON.parse(content);
  } catch {
    // Try alternate paths
    try {
      const content = await readFile('scripts/.links/graph.json', 'utf-8');
      graph = JSON.parse(content);
    } catch {
      console.error('Could not find graph.json. Run wittsrc-auto-link.ts first.');
      console.error('Expected: corpus/wittgenstein/brain/.links/graph.json');
      process.exit(1);
    }
  }

  // Type filter query
  if (args.includes('--type') && !slug) {
    const filteredEdges = graph.edges.filter(e => e.type === type);
    const allNodes = new Set([
      ...filteredEdges.map(e => e.from),
      ...filteredEdges.map(e => e.to),
    ]);
    console.log(renderGraph(graph, allNodes, filteredEdges, format));
    return;
  }

  // Path finding
  if (pathTo) {
    const path = findPath(graph, slug, pathTo);
    if (!path) {
      console.log(`No path found between ${slug} and ${pathTo}`);
      return;
    }
    console.log(`\nPath: ${slug} → ${pathTo}`);
    console.log(`Steps: ${path.length}`);
    for (const step of path) {
      console.log(`  ${step}`);
    }
    return;
  }

  // BFS traversal
  const result = bfsTraversal(graph, slug, { type, direction, depth });
  console.log(renderGraph(graph, result.nodes, result.edges, format));
  console.log(`\n  ${result.nodes.size} nodes, ${result.edges.length} edges`);
}

main().catch(console.error);
