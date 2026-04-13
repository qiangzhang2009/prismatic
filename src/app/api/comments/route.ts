/**
 * Comments API - GET (list) and POST (create)
 * POST is open to everyone (anonymous + authenticated)
 */

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { cookies } from 'next/headers';
import { processCommentInteractions } from '@/lib/guardian-engine';
import { verifyJWTToken } from '@/lib/user-management';
import { lookupIP, generateAvatarSeed, getAvatarUrl } from '@/lib/geo';

const PRISMATIC_TENANT_ID = '97e7123c-a201-4cbf-a483-b6d777433818';

// Rate limiting per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (record.count >= RATE_LIMIT) return false;
  record.count++;
  return true;
}

async function getVisitorId(): Promise<string> {
  const cookieStore = await cookies();
  let visitorId = cookieStore.get('prismatic-visitor')?.value;
  if (!visitorId) {
    visitorId = crypto.randomUUID();
  }
  return visitorId;
}

// Random anonymous nicknames
const ADJECTIVES = [
  '好奇的', '安静的', '热情的', '浪漫的', '理性的', '忧郁的', '乐观的', '深思的',
  '勇敢的', '温柔的', '神秘的', '幽默的', '冷静的', '活泼的', '文艺的', '务实的',
  '悠闲的', '奔放的', '内敛的', '洒脱的',
];
const ANIMALS = [
  '松鼠', '小鹿', '飞鸟', '游鱼', '萤火虫', '蝴蝶', '小猫', '小兔',
  '海豚', '企鹅', '熊猫', '狐狸', '狼', '豹', '鹤', '龟',
  '鹰', '鸽', '鲸', '熊',
];

function randomNickname(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adj}${animal}`;
}

// GET - List comments
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
  const offset = parseInt(searchParams.get('offset') || '0');
  const sort = searchParams.get('sort') || 'latest';

  try {
    const sql = neon(process.env.DATABASE_URL!);
    const visitorId = await getVisitorId();

    const comments = await sql`
      SELECT
        id, content, author_name, author_avatar, display_name,
        created_at, updated_at, is_pinned, is_edited, likes,
        reactions, view_count, report_count,
        geo_country, geo_region, geo_city, gender, avatar_seed, parent_id
      FROM public.prismatic_comments
      WHERE tenant_id = ${PRISMATIC_TENANT_ID}
        AND is_hidden = FALSE
        AND parent_id IS NULL
      ORDER BY is_pinned DESC, created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const commentIds = comments.map(c => c.id);
    let repliesMap: Record<string, number> = {};

    if (commentIds.length > 0) {
      const replies = await sql`
        SELECT parent_id, COUNT(*)::int as count
        FROM public.prismatic_comments
        WHERE parent_id = ANY(${commentIds}::uuid[]) AND is_hidden = FALSE
        GROUP BY parent_id
      `;
      for (const r of replies) {
        repliesMap[r.parent_id] = Number(r.count);
      }
    }

    const totalResult = await sql`
      SELECT COUNT(*)::int as count
      FROM public.prismatic_comments
      WHERE tenant_id = ${PRISMATIC_TENANT_ID}
        AND is_hidden = FALSE
        AND parent_id IS NULL
    `;

    let processedComments = comments.map(c => {
      const reactions = c.reactions || [];
      const counts: Record<string, number> = {};
      let userReaction: string | null = null;

      for (const r of reactions) {
        counts[r.emoji] = (counts[r.emoji] || 0) + 1;
        if (r.visitorId === visitorId) {
          userReaction = r.emoji;
        }
      }

      const avatarUrl = c.avatar_seed
        ? getAvatarUrl(c.avatar_seed, c.gender || undefined)
        : (c.author_avatar || null);

      const location = [c.geo_country, c.geo_region, c.geo_city]
        .filter(Boolean)
        .join(' · ');

      return {
        id: c.id,
        content: c.content,
        author_name: c.author_name,
        author_avatar: c.author_avatar,
        avatar_url: avatarUrl,
        display_name: c.display_name,
        gender: c.gender || null,
        location: location || null,
        created_at: c.created_at,
        updated_at: c.updated_at,
        is_pinned: c.is_pinned,
        is_edited: c.is_edited,
        likes: c.likes || 0,
        reactions: counts,
        reactionCount: reactions.length,
        userReaction,
        view_count: c.view_count || 0,
        report_count: c.report_count || 0,
        replyCount: repliesMap[c.id] || 0,
      };
    });

    if (sort === 'popular') {
      processedComments.sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        if (b.reactionCount !== a.reactionCount) return b.reactionCount - a.reactionCount;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }

    return NextResponse.json({
      comments: processedComments,
      total: Number(totalResult[0]?.count || 0),
      hasMore: offset + limit < Number(totalResult[0]?.count || 0),
    });
  } catch (error) {
    console.error('Failed to fetch comments:', error);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

// POST - Create comment (open to everyone)
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')
    || req.headers.get('x-real-ip')
    || 'unknown';

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment.' },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { content, parentId, gender } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    if (content.length > 1000) {
      return NextResponse.json({ error: 'Content must be 1000 characters or less' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const token = cookieStore.get('prismatic_token')?.value;

    let displayName: string;
    let avatar: string;
    let avatarSeed: string | null = null;

    if (token) {
      const payload = verifyJWTToken(token);
      if (payload) {
        const { getUserById } = await import('@/lib/user-management');
        const user = await getUserById(payload.userId);
        if (user) {
          displayName = (user.name || user.email.split('@')[0]).slice(0, 30);
          avatar = user.avatar || '👤';
        } else {
          displayName = randomNickname();
          avatarSeed = generateAvatarSeed(ip, gender);
          avatar = avatarSeed.slice(0, 8);
        }
      } else {
        displayName = randomNickname();
        avatarSeed = generateAvatarSeed(ip, gender);
        avatar = avatarSeed.slice(0, 8);
      }
    } else {
      displayName = randomNickname();
      avatarSeed = generateAvatarSeed(ip, gender);
      avatar = avatarSeed.slice(0, 8);
    }

    // Geo lookup
    let geoCountry: string | null = null;
    let geoRegion: string | null = null;
    let geoCity: string | null = null;
    let geoCountryCode: string | null = null;

    try {
      const geo = await lookupIP(ip);
      if (geo) {
        geoCountry = geo.country;
        geoRegion = geo.region;
        geoCity = geo.city;
        geoCountryCode = geo.countryCode;
      }
    } catch {
      // geo lookup failed, continue without it
    }

    const sql = neon(process.env.DATABASE_URL!);

    // Build location string for DB column
    const locationStr = geoCountry
      ? [geoCountry, geoRegion, geoCity].filter(Boolean).join(' · ')
      : null;

    // Single INSERT with all columns at once (type-safe via template tag)
    const result = await sql`
      INSERT INTO public.prismatic_comments (
        tenant_id, content, author_name, author_avatar, display_name,
        parent_id, ip_hash, avatar_seed, gender,
        geo_country, geo_region, geo_city, geo_country_code, location
      )
      VALUES (
        ${PRISMATIC_TENANT_ID},
        ${content.trim()},
        ${displayName},
        ${avatar},
        ${displayName},
        ${parentId || null},
        ${ip.slice(0, 64)},
        ${avatarSeed || null},
        ${gender || null},
        ${locationStr},
        ${geoRegion || null},
        ${geoCity || null},
        ${geoCountryCode || null},
        ${locationStr}
      )
      RETURNING id
    `;

    const newCommentId = result[0].id;

    // Build response
    const avatarUrl = avatarSeed
      ? getAvatarUrl(avatarSeed, gender || undefined)
      : avatar;

    // Trigger Guardian AI Engine (fire and forget)
    if (!parentId) {
      processCommentInteractions(newCommentId, content.trim(), displayName);
    }

    return NextResponse.json({
      success: true,
      comment: {
        id: newCommentId,
        content: content.trim(),
        author_name: displayName,
        author_avatar: avatar,
        avatar_url: avatarUrl,
        display_name: displayName,
        gender: gender || null,
        location,
        created_at: new Date().toISOString(),
        is_pinned: false,
        is_edited: false,
        likes: 0,
        reactions: {},
        reactionCount: 0,
        userReaction: null,
        view_count: 0,
        report_count: 0,
        replyCount: 0,
      }
    });
  } catch (error) {
    console.error('Failed to create comment:', error);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
}
