/**
 * GET /api/comments/[id]/persona — Get persona interactions on a comment
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCommentInteractions } from '@/lib/guardian';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const interactions = await getCommentInteractions(id);
    return NextResponse.json({ interactions });
  } catch (error) {
    console.error('[Persona Interactions API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch interactions' }, { status: 500 });
  }
}
