/**
 * Database Migration API - Run migrations
 * Protected by admin check
 */

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export async function POST(req: NextRequest) {
  // Admin check
  const sessionToken = req.cookies.get('prismatic-session')?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sql = neon(process.env.DATABASE_URL!);
    
    // Check if user is admin
    const sessions = await sql`SELECT user_id FROM public.sessions WHERE id = ${sessionToken} LIMIT 1`;
    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = sessions[0].user_id;
    const users = await sql`SELECT role FROM public.users WHERE id = ${userId} LIMIT 1`;
    if (!users || users[0]?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - admin only' }, { status: 403 });
    }

    // Run migrations
    const results: string[] = [];

    // Create comments table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS public.prismatic_comments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID DEFAULT '97e7123c-a201-4cbf-a483-b6d777433818',
          content TEXT NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 500),
          author_name VARCHAR(50) NOT NULL DEFAULT 'Anonymous',
          author_avatar VARCHAR(10) DEFAULT '👤',
          user_id UUID,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          is_pinned BOOLEAN DEFAULT FALSE,
          is_hidden BOOLEAN DEFAULT FALSE,
          parent_id UUID,
          likes INTEGER DEFAULT 0,
          display_name VARCHAR(50)
        )
      `;
      results.push('Created prismatic_comments table');
    } catch (e: any) {
      results.push(`Comments table: ${e.message}`);
    }

    // Create indexes
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_comments_tenant ON public.prismatic_comments(tenant_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_comments_created ON public.prismatic_comments(created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_comments_pinned ON public.prismatic_comments(is_pinned DESC, created_at DESC)`;
      results.push('Created indexes');
    } catch (e: any) {
      results.push(`Indexes: ${e.message}`);
    }

    // Add RLS policies
    try {
      await sql`ALTER TABLE public.prismatic_comments ENABLE ROW LEVEL SECURITY`;
      await sql`DROP POLICY IF EXISTS "Allow public read" ON public.prismatic_comments`;
      await sql`CREATE POLICY "Allow public read" ON public.prismatic_comments FOR SELECT USING (is_hidden = FALSE)`;
      await sql`DROP POLICY IF EXISTS "Allow public insert" ON public.prismatic_comments`;
      await sql`CREATE POLICY "Allow public insert" ON public.prismatic_comments FOR INSERT WITH CHECK (TRUE)`;
      results.push('RLS policies created');
    } catch (e: any) {
      results.push(`RLS: ${e.message}`);
    }

    // Insert sample comments
    try {
      const existingComments = await sql`SELECT COUNT(*) as count FROM public.prismatic_comments`;
      if (Number(existingComments[0]?.count || 0) === 0) {
        await sql`
          INSERT INTO public.prismatic_comments (content, author_name, author_avatar, display_name, is_pinned)
          VALUES 
            ('这个产品太棒了！让乔布斯和芒格同时思考我的问题，感觉打开了新世界的大门 🚀', '产品爱好者', '🚀', '产品爱好者', true),
            ('作为一个哲学爱好者，终于找到了可以深入探讨斯多葛主义的工具。费曼的思维方式也让人受益匪浅！', '哲学探索者', '🦉', '哲学探索者', false),
            ('张一鸣的实用主义思维对我做产品很有启发，强力推荐！', '创业者小明', '💡', '创业者小明', false)
        `;
        results.push('Sample comments inserted');
      }
    } catch (e: any) {
      results.push(`Sample data: ${e.message}`);
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('Migration failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Also allow GET for checking migration status
export async function GET() {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const result = await sql`SELECT COUNT(*) as count FROM public.prismatic_comments`;
    return NextResponse.json({ 
      tableExists: true, 
      commentCount: Number(result[0]?.count || 0) 
    });
  } catch (error: any) {
    return NextResponse.json({ tableExists: false, error: error.message });
  }
}
