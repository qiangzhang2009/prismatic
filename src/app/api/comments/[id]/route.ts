/**
 * Comments API - PATCH (admin actions) and DELETE
 */

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { authenticateRequest, authenticateAdminRequest } from '@/lib/user-management';

const PRISMATIC_TENANT_ID = '97e7123c-a201-4cbf-a483-b6d777433818';

// PATCH - Admin actions (pin, hide, edit)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await authenticateAdminRequest(req);
  if (!adminId) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { id } = await params;
  try {
    const body = await req.json();
    const { action, content } = body;

    const sql = neon(process.env.DATABASE_URL!);

    if (action === 'pin') {
      await sql`UPDATE prismatic_comments SET is_pinned = TRUE WHERE id = ${id}`;
      return NextResponse.json({ success: true });
    }

    if (action === 'unpin') {
      await sql`UPDATE prismatic_comments SET is_pinned = FALSE WHERE id = ${id}`;
      return NextResponse.json({ success: true });
    }

    if (action === 'hide') {
      await sql`UPDATE prismatic_comments SET is_hidden = TRUE WHERE id = ${id}`;
      return NextResponse.json({ success: true });
    }

    if (action === 'show') {
      await sql`UPDATE prismatic_comments SET is_hidden = FALSE WHERE id = ${id}`;
      return NextResponse.json({ success: true });
    }

    if (action === 'edit' && content !== undefined) {
      await sql`UPDATE prismatic_comments SET content = ${content}, updated_at = NOW() WHERE id = ${id}`;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Comment admin action error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a comment
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await authenticateRequest(req);
  const adminId = await authenticateAdminRequest(req);

  if (!userId && !adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  try {
    const sql = neon(process.env.DATABASE_URL!);

    // Check comment exists
    const [comment] = await sql`SELECT user_id FROM prismatic_comments WHERE id = ${id}`;
    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Only the author or an admin can delete
    const isAdminUser = !!adminId;
    if (comment.user_id !== userId && !isAdminUser) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await sql`DELETE FROM prismatic_comments WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete comment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
