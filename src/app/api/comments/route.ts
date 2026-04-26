/**
 * GET /api/comments — List comments
 * POST /api/comments — Create a comment (open to everyone)
 */
import { NextRequest, NextResponse } from 'next/server';
import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { processCommentInteractions } from '@/lib/guardian-engine';
import { verifyJWTToken } from '@/lib/user-management';
import { lookupIP, generateAvatarSeed, getAvatarUrl, COUNTRY_NAMES } from '@/lib/geo';
import { getTodayGuardians } from '@/lib/guardian';
import { extractGuardianMention, getMentionHint } from '@/lib/guardian-mention';

/**
 * Extract the real client IP from request headers.
 * Handles various proxy headers and returns the best available IP.
 */
function getClientIP(req: NextRequest): string {
  // Priority order: most reliable first
  // 1. Cloudflare
  const cfIP = req.headers.get('cf-connecting-ip');
  if (cfIP && cfIP !== 'unknown') return cfIP;

  // 2. Akamai / True-Client-IP
  const trueClientIP = req.headers.get('true-client-ip');
  if (trueClientIP && trueClientIP !== 'unknown') return trueClientIP;

  // 3. X-Forwarded-For (may contain multiple IPs, first is original client)
  const xForwardedFor = req.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    // Take the first IP (original client), remove any port
    const firstIP = xForwardedFor.split(',')[0].trim().split(':')[0];
    if (firstIP && firstIP !== 'unknown' && firstIP !== '127.0.0.1') {
      return firstIP;
    }
  }

  // 4. X-Real-IP (Nginx)
  const xRealIP = req.headers.get('x-real-ip');
  if (xRealIP && xRealIP !== 'unknown') return xRealIP.split(':')[0];

  // 5. X-Cluster-Client-IP (older proxies)
  const clusterIP = req.headers.get('x-cluster-client-ip');
  if (clusterIP && clusterIP !== 'unknown') return clusterIP.split(':')[0];

  // 6. Forwarded header (newer standard)
  const forwarded = req.headers.get('forwarded');
  if (forwarded) {
    const match = forwarded.match(/for=([^;]+)/);
    if (match && match[1]) return match[1].replace(/[\[\]"]/g, '').split(':')[0];
  }

  return 'unknown';
}

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

  try {
    const cookieStore = await cookies();
    const visitorId = cookieStore.get('prismatic-visitor')?.value || 'anonymous';

    // Use Neon directly to bypass any Prisma model proxy issues
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      return NextResponse.json({ error: 'DATABASE_URL not set' }, { status: 500 });
    }
    // eslint-disable-next-line
    const sql = neon(connectionString) as NeonQueryFunction<false, false>;

    const rows = await sql`
      SELECT
        c.id,
        c.content,
        c.nickname,
        c."avatarSeed",
        c.gender,
        c."geoCountryCode",
        c."geoCountry",
        c."geoRegion",
        c."geoCity",
        c."createdAt",
        c."updatedAt",
        c.reactions,
        c."personaSlug",
        c."mentionedGuardianId",
        c."mentionedGuardianReply",
        c."mentionedGuardianRepliedAt"
      FROM comments c
      WHERE c.status = 'published' AND c."parentId" IS NULL
      ORDER BY c."createdAt" DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const countRows = await sql`
      SELECT COUNT(*) as total
      FROM comments c
      WHERE c.status = 'published' AND c."parentId" IS NULL
    `;

    const total = Number(countRows[0]?.total ?? 0);

    const processedComments = [];
    for (let i = 0; i < rows.length; i++) {
      const c = rows[i] as any;
      const counts: Record<string, number> = {};
      let userReaction: string | null = null;

      const rawReactions = c.reactions;
      if (Array.isArray(rawReactions)) {
        for (let j = 0; j < rawReactions.length; j++) {
          const r = rawReactions[j] as any;
          if (r && typeof r === 'object' && typeof r.emoji === 'string') {
            const emoji = r.emoji;
            counts[emoji] = (counts[emoji] || 0) + 1;
            if (r.visitorId === visitorId) {
              userReaction = emoji;
            }
          }
        }
      } else if (rawReactions && typeof rawReactions === 'object') {
        const entries = Object.entries(rawReactions);
        for (let j = 0; j < entries.length; j++) {
          const [emoji, count] = entries[j];
          if (typeof emoji === 'string') {
            counts[emoji] = Number(count) || 0;
          }
        }
      }

      const geoCountry = COUNTRY_NAMES[c.geoCountryCode || ''] || c.geoCountry || '';
      const location = [geoCountry, c.geoRegion, c.geoCity].filter(Boolean).join(' · ') || null;

      processedComments.push({
        id: c.id,
        content: c.content,
        author_name: c.nickname,
        author_avatar: null,
        avatar_url: c.avatarSeed ? getAvatarUrl(c.avatarSeed, c.gender || undefined) : null,
        display_name: c.nickname,
        gender: c.gender || null,
        location,
        created_at: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
        updated_at: c.updatedAt ? new Date(c.updatedAt).toISOString() : new Date().toISOString(),
        is_pinned: false,
        is_edited: false,
        likes: 0,
        reactions: counts,
        reactionCount: Object.values(counts).reduce((a: number, b: number) => a + b, 0),
        userReaction,
        view_count: 0,
        report_count: 0,
        replyCount: 0,
        personaSlug: c.personaSlug,
        mentionedGuardianId: c.mentionedGuardianId ?? null,
        mentionedGuardianReply: c.mentionedGuardianReply ?? null,
        mentionedGuardianRepliedAt: c.mentionedGuardianRepliedAt
          ? new Date(c.mentionedGuardianRepliedAt).toISOString()
          : null,
        ipHash: (c.ipHash as string) || null,
        userId: (c.userId as string) || null,
      });
    }

    if (sort === 'popular') {
      processedComments.sort((a: any, b: any) => {
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
  const ip = getClientIP(req);

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment.' },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { content, parentId, gender, personaSlug } = body;
    const visitorIdFromHeader = req.headers.get('x-visitor-id');

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
          ipHash = visitorIdFromHeader || ip.slice(0, 64);
        }
      } else {
        nickname = randomNickname();
        avatarSeed = generateAvatarSeed(ip, gender);
        ipHash = visitorIdFromHeader || ip.slice(0, 64);
      }
    } else {
      nickname = randomNickname();
      avatarSeed = generateAvatarSeed(ip, gender);
      ipHash = ip.slice(0, 64);
    }

    // ── Parallel: geo lookup + guardian detection (both with timeout) ─────
    let geoCountryCode: string | null = null;
    let geoCountry: string | null = null;
    let geoRegion: string | null = null;
    let geoCity: string | null = null;
    let mentionedGuardianId: string | null = null;
    let mentionHint: string | null = null;

    const geoPromiseTimed = Promise.race([
      lookupIP(ip),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 500)),
    ]).catch(() => null);

    const guardianPromise = getTodayGuardians().catch(() => []);

    // Wait for both in parallel, but with a short timeout
    const [geo, guardians] = await Promise.all([geoPromiseTimed, guardianPromise]);

    if (geo) {
      geoCountryCode = geo.countryCode;
      geoCountry = geo.country;
      geoRegion = geo.region;
      geoCity = geo.city;
    }

    // Extract @守望者 mention (from today's guardians list)
    if (guardians.length > 0) {
      const guardianIds = guardians.map((g) => g.personaId);
      const mentionResult = extractGuardianMention(content, guardianIds);
      if (mentionResult.mentionedPersonaId) {
        mentionedGuardianId = mentionResult.mentionedPersonaId;
      }
      mentionHint = getMentionHint(mentionResult);
    }

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
        mentionedGuardianId,
      },
    });

    const avatarUrl = avatarSeed ? getAvatarUrl(avatarSeed, gender || undefined) : null;
    const location = [geoCountry, geoRegion, geoCity].filter(Boolean).join(' · ') || null;

    // ── Fire-and-forget: guardian LLM reply ─────────────────────────────────
    // The LLM call is expensive (3-15s). We return immediately and let it run
    // in the background. The frontend polls /api/comments/[id] to pick up the
    // reply once it's ready.
    if (mentionedGuardianId) {
      processCommentInteractions(newComment.id, content.trim(), nickname, mentionedGuardianId)
        .catch((e) => console.error('[Comments] Guardian reply (async) failed:', e));
    } else {
      processCommentInteractions(newComment.id, content.trim(), nickname, null)
        .catch((e) => console.error('[Comments] Guardian reply (organic) failed:', e));
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
        mentionedGuardianId,
        mentionedGuardianReply: null,   // will be picked up by frontend polling
        mentionedGuardianRepliedAt: null,
        mentionHint: mentionedGuardianId ? '守望者正在思考中...' : null,
        ipHash: ipHash,
      }
    });
  } catch (error) {
    console.error('Failed to create comment:', error);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
}
