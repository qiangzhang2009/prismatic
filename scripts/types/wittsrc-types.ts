---
version: 1.0.0
---

# WittSrc Brain — Shared Type Definitions

## Link Types

```typescript
type LinkType = 'cites' | 'evolves_to' | 'contradicts' | 'influenced_by' | 'defines' | 'revisits';
```

| Type | Meaning | Direction | Confidence |
|------|---------|-----------|------------|
| `cites` | A references B | A → B | High |
| `evolves_to` | A is an earlier version of B | A → B | Medium |
| `contradicts` | A's position contradicts B's | None | Low |
| `influenced_by` | A's thought was shaped by B | A → B | High |
| `defines` | A (a work) defines B (a concept) | Work → Concept | High |
| `revisits` | A (later) revisits B (earlier) | Later → Earlier | Medium |

## Page Types

```typescript
type PageType = 'work' | 'concept' | 'person' | 'timeline';
```

## Brain Page Frontmatter

```yaml
---
type: work|concept|person|timeline
title: string
slug: string
period: [startYear, endYear]
source: string
sourceUrl?: string
collection?: string
wordCount: number
encoding: clarino|wittsrg|gutenberg|sep|iep
importedAt: ISO-date-string
---
```

## Graph Structure

```typescript
interface GraphNode {
  slug: string;
  type: 'work' | 'concept' | 'person' | 'reference';
  period: [number, number] | null;
  label: string;
}

interface GraphEdge {
  from: string;   // source slug
  to: string;     // target slug
  type: LinkType;
  confidence: number; // 0-1
}

interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  meta: {
    extractedAt: string;
    totalNodes: number;
    totalEdges: number;
    avgConfidence: number;
  };
}
```

## Extraction Output

```typescript
interface ExtractedLink {
  sourceSlug: string;
  targetSlug: string;
  type: LinkType;
  anchorText: string;
  context: string;
  confidence: number;
  deterministic: boolean;
  line: number;
}

interface ExtractedEntity {
  type: 'manuscript' | 'pi' | 'pr' | 'zettel' | 'oc' | 'person' | 'concept';
  value: string;
  slug: string;
  anchorText: string;
  context: string;
  line: number;
  confidence: number;
}
```

## Enrichment Tiers

```typescript
type EnrichmentTier = 1 | 2 | 3;

interface EnrichmentCriteria {
  tier: EnrichmentTier;
  conditions: string[];
  content: string;
  sources: string[];
}
```

| Tier | Trigger | Content Level |
|------|---------|----------------|
| 1 | 8+ mentions OR core entity | Full page with SEP/IEP enrichment |
| 2 | 3+ mentions OR 2+ sources | Standard page with intro |
| 3 | 1 mention | Stub page (title + first source) |
