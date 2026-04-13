/**
 * Comments Replies API - GET (list replies for a comment)
 */

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getAvatarUrl } from '@/lib/geo';

const PRISMATIC_TENANT_ID = '97e7123c-a201-4cbf-a483-b6d777433818';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parentId = searchParams.get('parentId');

  if (!parentId) {
    return NextResponse.json({ error: 'parentId is required' }, { status: 400 });
  }

  try {
    const sql = neon(process.env.DATABASE_URL!);

    const replies = await sql`
      SELECT
        id,
        content,
        author_name,
        author_avatar,
        display_name,
        created_at,
        updated_at,
        likes,
        gender,
        avatar_seed,
        geo_country,
        geo_region,
        geo_city
      FROM public.prismatic_comments
      WHERE tenant_id = ${PRISMATIC_TENANT_ID}
        AND is_hidden = FALSE
        AND parent_id = ${parentId}
      ORDER BY created_at ASC
    `;

    return NextResponse.json({
      replies: replies.map(r => {
        const avatarUrl = r.avatar_seed
          ? getAvatarUrl(r.avatar_seed, r.gender || undefined)
          : (r.author_avatar || null);
        const location = [r.geo_country, r.geo_region, r.geo_city]
          .filter(Boolean)
          .join(' · ');
        return {
          ...r,
          avatar_url: avatarUrl,
          gender: r.gender || null,
          location: location || null,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        };
      }),
    });
  } catch (error) {
    console.error('Failed to fetch replies:', error);
    return NextResponse.json({ error: 'Failed to fetch replies' }, { status: 500 });
  }
}
