/**
 * GET /api/rag/search — Search the TCM ancient text corpus
 *
 * Query params:
 *   q          — Search query (required)
 *   topK       — Number of results (default 5, max 20)
 *   sourceId   — Optional: filter by specific source ID
 *
 * Auth: Any authenticated user. Returns raw corpus matches with citations.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { retrieve } from '@/lib/tcm-rag';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  const topK = Math.min(parseInt(searchParams.get('topK') ?? '5', 10), 20);
  const sourceId = searchParams.get('sourceId');

  if (!q) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  if (q.length > 500) {
    return NextResponse.json({ error: 'Query too long (max 500 characters)' }, { status: 400 });
  }

  try {
    const chunks = await retrieve(q, topK, sourceId ? [sourceId] : null);

    return NextResponse.json({
      query: q,
      count: chunks.length,
      results: chunks.map(c => ({
        chunkId: c.chunkId,
        sourceId: c.sourceId,
        source: c.source,
        text: c.text,
        keywords: c.keywords,
        preview: c.preview,
        relevance: c.relevance,
        charCount: c.charCount,
      })),
    });
  } catch (error) {
    console.error('[RAG Search] Error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
