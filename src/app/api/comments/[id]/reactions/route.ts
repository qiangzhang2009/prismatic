/**
 * Comments Reactions API - POST (add reaction)
 */

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { cookies } from 'next/headers';

const PRISMATIC_TENANT_ID = '97e7123c-a201-4cbf-a483-b6d777433818';

const VALID_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '💯', '✨', '🎉'];

// Get or create visitor ID
async function getVisitorId(): Promise<string> {
  const cookieStore = await cookies();
  let visitorId = cookieStore.get('prismatic-visitor')?.value;
  
  if (!visitorId) {
    visitorId = crypto.randomUUID();
  }
  
  return visitorId;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const body = await req.json();
    const { emoji } = body;
    
    if (!VALID_REACTIONS.includes(emoji)) {
      return NextResponse.json({ error: 'Invalid reaction' }, { status: 400 });
    }
    
    const visitorId = await getVisitorId();
    const sql = neon(process.env.DATABASE_URL!);
    
    // Get current reactions
    const comment = await sql`
      SELECT reactions FROM public.prismatic_comments 
      WHERE id = ${id} AND tenant_id = ${PRISMATIC_TENANT_ID}
    `;
    
    if (!comment || comment.length === 0) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }
    
    let reactions = comment[0].reactions || [];
    
    // Check if visitor already reacted with this emoji
    const existingIndex = reactions.findIndex(
      (r: any) => r.emoji === emoji && r.visitorId === visitorId
    );
    
    if (existingIndex >= 0) {
      // Remove reaction (toggle off)
      reactions.splice(existingIndex, 1);
    } else {
      // Add reaction
      reactions.push({ emoji, visitorId, addedAt: new Date().toISOString() });
    }
    
    // Update database
    await sql`
      UPDATE public.prismatic_comments 
      SET reactions = ${JSON.stringify(reactions)}, updated_at = NOW()
      WHERE id = ${id}
    `;
    
    // Get updated counts
    const counts: Record<string, number> = {};
    for (const r of reactions) {
      counts[r.emoji] = (counts[r.emoji] || 0) + 1;
    }
    
    const userReacted = reactions.some((r: any) => r.visitorId === visitorId);
    
    return NextResponse.json({
      success: true,
      counts,
      userReacted,
      total: reactions.length
    });
  } catch (error) {
    console.error('Failed to add reaction:', error);
    return NextResponse.json({ error: 'Failed to add reaction' }, { status: 500 });
  }
}
