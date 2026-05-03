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

let _manifest = null;
let _sourceCache = {};
let _manifestCache = null;

/**
 * Load manifest (cached)
 */
export async function loadManifest() {
  if (_manifest) return _manifest;
  if (!fs.existsSync(MANIFEST)) return [];
  _manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  return _manifest;
}

/**
 * Load chunks for a specific source (lazy, cached per source)
 */
async function loadSource(sourceId: string): Promise<any[]> {
  if (_sourceCache[sourceId]) return _sourceCache[sourceId];
  const sourcePath = path.join(SOURCES_DIR, `${sourceId}.json`);
  if (!fs.existsSync(sourcePath)) return [];
  try {
    _sourceCache[sourceId] = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  } catch {
    _sourceCache[sourceId] = [];
  }
  return _sourceCache[sourceId];
}

/**
 * Load all chunks from manifest (only for local dev with full vectors.json)
 * Used when sources dir is not available.
 */
async function loadFullStore() {
  const fullPath = path.join(DATA_DIR, 'vectors.json');
  if (!fs.existsSync(fullPath)) return null;
  if (_manifestCache) return _manifestCache;
  try {
    _manifestCache = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch {
    _manifestCache = null;
  }
  return _manifestCache;
}

/**
 * BM25-style keyword retrieval (per-source lazy loading)
 */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-z0-9]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

function scoreChunk(chunk, queryTokens) {
  const textLower = chunk.text.toLowerCase();
  const kwLower = (chunk.keywords || '').toLowerCase();
  const score = queryTokens.reduce((acc, token) => {
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
 * @param {string} query - User query (symptoms, disease, herb, etc.)
 * @param {number} topK - Number of chunks to return (default 5)
 * @param {string[]} sourceFilter - Optional: restrict to specific source IDs
 * @returns {Promise<Array>} Top-k relevant chunks with source metadata
 */
export async function retrieve(query: string, topK = 5, sourceFilter: string[] | null = null) {
  const queryTokens = tokenize(query);

  if (queryTokens.length === 0) {
    const manifest = await loadManifest();
    if (manifest.length > 0) {
      const first = manifest[0];
      const chunks = await loadSource(first.sourceId);
      return chunks.slice(0, topK).map(c => ({
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
  const targetSources = sourceFilter || manifest.map(m => m.sourceId);

  // Load all relevant sources and score chunks
  const scored = [];
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

  return top.map(c => ({
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
export async function buildRAGContext(query: string, topK = 5, sourceFilter: string[] | null = null) {
  const chunks = await retrieve(query, topK, sourceFilter);

  if (chunks.length === 0) {
    return {
      context: '',
      citations: [],
      note: 'No relevant ancient texts found for this query.',
    };
  }

  const sections = chunks.map((c, i) => {
    const citation = c.source || c.sourceId;
    return `【古籍${i + 1}】《${citation}》\n${c.text}`;
  });

  const citations = chunks.map(c => ({
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
export async function getRAGStats() {
  const manifest = await loadManifest();

  if (!manifest || manifest.length === 0) {
    return { ready: false, error: 'RAG manifest not found. Run the ingestion script first.' };
  }

  const successfulSources = manifest.filter(m => m.status === 'chunked');
  const totalChars = successfulSources.reduce((s, m) => s + m.totalChars, 0);
  const totalChunks = successfulSources.reduce((s, m) => s + m.chunkCount, 0);

  return {
    ready: true,
    totalChunks,
    totalSources: successfulSources.length,
    totalChars,
    totalCharsMB: (totalChars / 1024 / 1024).toFixed(1),
    createdAt: manifest[0]?.createdAt || '',
    sources: successfulSources.map(m => ({
      sourceId: m.sourceId,
      chunkCount: m.chunkCount,
      totalChars: m.totalChars,
    })),
  };
}

/**
 * Clear the in-memory cache (useful for memory management)
 */
export function clearCache() {
  _sourceCache = {};
  _manifest = null;
  _manifestCache = null;
}
