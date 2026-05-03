/**
 * TCM RAG Retrieval Engine
 * Simple BM25-style keyword retrieval over 701 ancient TCM texts
 *
 * Architecture: Per-source lazy loading
 *   - Corpus split into 700 per-source JSON files (data/tcm-rag/sources/{sourceId}.json)
 *   - Only sources matching the query are loaded into memory
 *   - Maximum single source: ~16MB (074-普济方), well within serverless limits
 *
 * Production upgrade path:
 *   → ChromaDB for semantic vector search
 *   → Pinecone for cloud-scale retrieval
 *   → DeepSeek text-embedding-v2 for actual embeddings
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data/tcm-rag');
const SOURCES_DIR = path.join(DATA_DIR, 'sources');
const MANIFEST = path.join(DATA_DIR, 'manifest.json');

interface ManifestEntry {
  sourceId: string;
  source: string;
  status: string;
  chunkCount: number;
  totalChars: number;
  createdAt: string;
}

interface ChunkData {
  chunkId: string;
  sourceId: string;
  source: string;
  text: string;
  keywords: string;
  preview: string;
  charCount: number;
  [key: string]: unknown;
}

interface RetrievedChunk {
  chunkId: string;
  sourceId: string;
  source: string;
  text: string;
  keywords: string;
  preview: string;
  relevance: number;
  charCount?: number;
}

let _manifest: ManifestEntry[] | null = null;
let _sourceCache: Record<string, ChunkData[]> = {};
let _manifestCache: ChunkData[] | null = null;

/**
 * Load manifest (cached)
 */
async function loadManifest(): Promise<ManifestEntry[]> {
  if (_manifest) return _manifest;
  if (!fs.existsSync(MANIFEST)) return [];
  _manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as ManifestEntry[];
  return _manifest;
}

/**
 * Load chunks for a specific source (lazy, cached per source)
 */
async function loadSource(sourceId: string): Promise<ChunkData[]> {
  if (_sourceCache[sourceId]) return _sourceCache[sourceId];
  const sourcePath = path.join(SOURCES_DIR, `${sourceId}.json`);
  if (!fs.existsSync(sourcePath)) return [];
  try {
    _sourceCache[sourceId] = JSON.parse(fs.readFileSync(sourcePath, 'utf8')) as ChunkData[];
  } catch {
    _sourceCache[sourceId] = [];
  }
  return _sourceCache[sourceId];
}

/**
 * Load all chunks from manifest (only for local dev with full vectors.json)
 * Used when sources dir is not available.
 */
async function loadFullStore(): Promise<ChunkData[] | null> {
  const fullPath = path.join(DATA_DIR, 'vectors.json');
  if (!fs.existsSync(fullPath)) return null;
  if (_manifestCache) return _manifestCache;
  try {
    const raw = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    _manifestCache = raw.chunks as ChunkData[];
  } catch {
    _manifestCache = null;
  }
  return _manifestCache;
}

/**
 * BM25-style keyword retrieval (per-source lazy loading)
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-z0-9]/g, ' ')
    .split(/\s+/)
    .filter((t: string) => t.length > 1);
}

function scoreChunk(chunk: ChunkData, queryTokens: string[]): number {
  const textLower = chunk.text.toLowerCase();
  const kwLower = (chunk.keywords || '').toLowerCase();
  const score = queryTokens.reduce((acc: number, token: string) => {
    const textCount = (textLower.match(new RegExp(token, 'g')) || []).length;
    const kwCount = (kwLower.match(new RegExp(token, 'g')) || []).length;
    // Weight keywords field 3x
    return acc + textCount + kwCount * 3;
  }, 0);
  return score;
}

/**
 * Retrieve the most relevant chunks for a given query
 *
 * @param query - User query (symptoms, disease, herb, etc.)
 * @param topK - Number of chunks to return (default 5)
 * @param sourceFilter - Optional: restrict to specific source IDs
 * @returns Top-k relevant chunks with source metadata
 */
export async function retrieve(
  query: string,
  topK = 5,
  sourceFilter: string[] | null = null
): Promise<RetrievedChunk[]> {
  const queryTokens = tokenize(query);

  if (queryTokens.length === 0) {
    const manifest = await loadManifest();
    if (manifest.length > 0) {
      const first = manifest[0];
      const chunks = await loadSource(first.sourceId);
      return chunks.slice(0, topK).map((c: ChunkData) => ({
        chunkId: c.chunkId,
        sourceId: c.sourceId,
        source: c.source,
        text: c.text.slice(0, 500),
        keywords: c.keywords,
        preview: c.preview,
        relevance: 0,
        charCount: c.charCount,
      }));
    }
    return [];
  }

  const manifest = await loadManifest();
  const targetSources = sourceFilter || manifest.map((m: ManifestEntry) => m.sourceId);

  // Load all relevant sources and score chunks
  const scored: (ChunkData & { relevance: number })[] = [];
  for (const sourceId of targetSources) {
    const chunks = await loadSource(sourceId);
    for (const chunk of chunks) {
      const relevance = scoreChunk(chunk, queryTokens);
      if (relevance > 0) {
        scored.push({ ...chunk, relevance });
      }
    }
  }

  scored.sort((a, b) => b.relevance - a.relevance);

  const top = scored.slice(0, topK);

  return top.map((c: ChunkData & { relevance: number }) => ({
    chunkId: c.chunkId,
    sourceId: c.sourceId,
    source: c.source,
    text: c.text.slice(0, 600),
    keywords: c.keywords,
    preview: c.preview,
    relevance: c.relevance,
    charCount: c.charCount,
  }));
}

/**
 * Build an RAG context string from retrieved chunks
 * formatted for injection into LLM prompts
 */
export async function buildRAGContext(
  query: string,
  topK = 5,
  sourceFilter: string[] | null = null
): Promise<{ context: string; citations: unknown[]; note: string }> {
  const chunks = await retrieve(query, topK, sourceFilter);

  if (chunks.length === 0) {
    return {
      context: '',
      citations: [],
      note: 'No relevant ancient texts found for this query.',
    };
  }

  const sections = chunks.map((c: RetrievedChunk, i: number) => {
    const citation = c.source || c.sourceId;
    return `【古籍${i + 1}】《${citation}》\n${c.text}`;
  });

  const citations = chunks.map((c: RetrievedChunk) => ({
    source: c.source || c.sourceId,
    keywords: c.keywords,
    relevance: c.relevance,
  }));

  return {
    context: sections.join('\n\n---\n\n'),
    citations,
    note: `基于 ${chunks.length} 条古籍引证`,
  };
}

/**
 * Get RAG store statistics
 */
export async function getRAGStats(): Promise<{
  ready: boolean;
  error?: string;
  totalChunks?: number;
  totalSources?: number;
  totalChars?: number;
  totalCharsMB?: string;
  createdAt?: string;
  sources?: { sourceId: string; chunkCount: number; totalChars: number }[];
}> {
  const manifest = await loadManifest();

  if (!manifest || manifest.length === 0) {
    return { ready: false, error: 'RAG manifest not found. Run the ingestion script first.' };
  }

  const successfulSources = manifest.filter((m: ManifestEntry) => m.status === 'chunked');
  const totalChars = successfulSources.reduce((s: number, m: ManifestEntry) => s + m.totalChars, 0);
  const totalChunks = successfulSources.reduce((s: number, m: ManifestEntry) => s + m.chunkCount, 0);

  return {
    ready: true,
    totalChunks,
    totalSources: successfulSources.length,
    totalChars,
    totalCharsMB: (totalChars / 1024 / 1024).toFixed(1),
    createdAt: manifest[0]?.createdAt || '',
    sources: successfulSources.map((m: ManifestEntry) => ({
      sourceId: m.sourceId,
      chunkCount: m.chunkCount,
      totalChars: m.totalChars,
    })),
  };
}

/**
 * Clear the in-memory cache (useful for memory management)
 */
export function clearCache(): void {
  _sourceCache = {};
  _manifest = null;
  _manifestCache = null;
}
