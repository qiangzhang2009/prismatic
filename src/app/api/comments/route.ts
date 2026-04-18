/**
 * GET /api/comments — List comments
 * POST /api/comments — Create a comment (open to everyone)
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { processCommentInteractions } from '@/lib/guardian-engine';
import { verifyJWTToken } from '@/lib/user-management';
import { lookupIP, generateAvatarSeed, getAvatarUrl, COUNTRY_NAMES } from '@/lib/geo';

const RATE_LIMIT = 10;
const RATE_WINDOW = 60 * 1000;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

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
  const date = searchParams.get('date');
  const personaSlug = searchParams.get('personaSlug');

  try {
    const cookieStore = await cookies();
    const visitorId = cookieStore.get('prismatic-visitor')?.value || 'anonymous';

    const where: any = {
      status: 'published',
      parentId: null, // root comments only
    };

    if (date) {
      const dateStart = new Date(`${date}T00:00:00Z`);
      const dateEnd = new Date(`${date}T23:59:59Z`);
      where.createdAt = { gte: dateStart, lte: dateEnd };
    }

    if (personaSlug) {
      where.personaSlug = personaSlug;
    }

    const comments = await prisma.comment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      include: {
        _count: { select: { replies: true } },
      },
    });

    const total = await prisma.comment.count({ where });

    const processedComments = comments.map(c => {
      // reactions is stored as either:
      // - object {emoji: count} — legacy/seed format
      // - array [{emoji, visitorId}] — real-time user reactions
      const rawReactions = typeof c.reactions === 'string' ? JSON.parse(c.reactions as string) : (c.reactions || []);
      const counts: Record<string, number> = {};
      let userReaction: string | null = null;

      if (Array.isArray(rawReactions)) {
        for (const r of rawReactions as any[]) {
          counts[r.emoji] = (counts[r.emoji] || 0) + 1;
          if ((r as any).visitorId === visitorId) {
            userReaction = r.emoji;
          }
        }
      } else if (rawReactions && typeof rawReactions === 'object') {
        // Object format: {emoji: count}
        for (const [emoji, count] of Object.entries(rawReactions)) {
          counts[emoji] = Number(count);
        }
      }

      const avatarUrl = c.avatarSeed
        ? getAvatarUrl(c.avatarSeed, c.gender || undefined)
        : null;

      const geoCountry = COUNTRY_NAMES[c.geoCountryCode || ''] || c.geoCountry || '';
      const location = [geoCountry, c.geoRegion, c.geoCity].filter(Boolean).join(' · ') || null;

      return {
        id: c.id,
        content: c.content,
        author_name: c.nickname,
        author_avatar: null,
        avatar_url: avatarUrl,
        display_name: c.nickname,
        gender: c.gender || null,
        location,
        created_at: c.createdAt.toISOString(),
        updated_at: c.updatedAt.toISOString(),
        is_pinned: false,
        is_edited: false,
        likes: 0,
        reactions: counts,
        reactionCount: Object.values(counts).reduce((a, b) => a + b, 0),
        userReaction,
        view_count: 0,
        report_count: 0,
        replyCount: c._count.replies,
        personaSlug: c.personaSlug,
      };
    });

    if (sort === 'popular') {
      processedComments.sort((a, b) => {
        if (b.reactionCount !== a.reactionCount) return b.reactionCount - a.reactionCount;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }

    return NextResponse.json({
      comments: processedComments,
      total,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Failed to fetch comments:', msg);
    return NextResponse.json({ error: 'Failed to fetch comments', detail: msg }, { status: 500 });
  }
}

// POST - Create comment
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
    const { content, parentId, gender, personaSlug } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    if (content.length > 1000) {
      return NextResponse.json({ error: 'Content must be 1000 characters or less' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const token = cookieStore.get('prismatic_token')?.value;

    let nickname: string;
    let avatarSeed: string | null = null;
    let ipHash: string | null = null;
    let userId: string | null = null;

    if (token) {
      const payload = verifyJWTToken(token);
      if (payload) {
        const { getUserById } = await import('@/lib/user-management');
        const user = await getUserById(payload.userId);
        if (user) {
          nickname = (user.name || user.email.split('@')[0]).slice(0, 30);
          userId = user.id;
        } else {
          nickname = randomNickname();
          avatarSeed = generateAvatarSeed(ip, gender);
          ipHash = ip.slice(0, 64);
        }
      } else {
        nickname = randomNickname();
        avatarSeed = generateAvatarSeed(ip, gender);
        ipHash = ip.slice(0, 64);
      }
    } else {
      nickname = randomNickname();
      avatarSeed = generateAvatarSeed(ip, gender);
      ipHash = ip.slice(0, 64);
    }

    let geoCountryCode: string | null = null;
    let geoCountry: string | null = null;
    let geoRegion: string | null = null;
    let geoCity: string | null = null;

    try {
      const geo = await lookupIP(ip);
      if (geo) {
        geoCountry = geo.country;
        geoRegion = geo.region;
        geoCity = geo.city;
        geoCountryCode = geo.countryCode;
      }
    } catch { /* geo lookup failed */ }

    const newComment = await prisma.comment.create({
      data: {
        content: content.trim(),
        userId,
        nickname,
        avatarSeed,
        ipHash,
        gender: gender || null,
        geoCountryCode,
        geoCountry,
        geoRegion,
        geoCity,
        parentId: parentId || null,
        type: parentId ? 'reply' : 'comment',
        personaSlug: personaSlug || null,
        status: 'published',
          reactions: [],
      },
    });

    const avatarUrl = avatarSeed ? getAvatarUrl(avatarSeed, gender || undefined) : null;
    const location = [geoCountry, geoRegion, geoCity].filter(Boolean).join(' · ') || null;

    if (!parentId) {
      processCommentInteractions(newComment.id, content.trim(), nickname).catch(console.error);
    }

    return NextResponse.json({
      success: true,
      comment: {
        id: newComment.id,
        content: newComment.content,
        author_name: nickname,
        author_avatar: null,
        avatar_url: avatarUrl,
        display_name: nickname,
        gender: gender || null,
        location,
        created_at: newComment.createdAt.toISOString(),
        updated_at: newComment.updatedAt.toISOString(),
        is_pinned: false,
        is_edited: false,
        likes: 0,
          reactions: [],
        reactionCount: 0,
        userReaction: null,
        view_count: 0,
        report_count: 0,
        replyCount: 0,
        personaSlug: newComment.personaSlug,
      }
    });
  } catch (error) {
    console.error('Failed to create comment:', error);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
}
