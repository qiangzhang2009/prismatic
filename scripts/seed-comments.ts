/**
 * Prismatic — Comment Seeding Script
 * Seeds the comments table with realistic historical comments from personas about the website's strengths.
 *
 * Usage:
 *   npx ts-node --project tsconfig.json -r tsconfig-paths/register scripts/seed-comments.ts
 *
 * Environment:
 *   DATABASE_URL=postgresql://...    (required)
 */

import { PrismaClient } from '@prisma/client';
import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { getPersonasByIds } from '../src/lib/personas';

// ─── Geo distribution ───────────────────────────────────────────────────────────

interface GeoLocation {
  countryCode: string;
  country: string;
  region: string;
  city: string;
}

const GEO_DISTRIBUTION: GeoLocation[] = [
  // 中国大陆
  { countryCode: 'CN', country: '中国', region: '北京市', city: '朝阳区' },
  { countryCode: 'CN', country: '中国', region: '上海市', city: '浦东新区' },
  { countryCode: 'CN', country: '中国', region: '广东省', city: '深圳市' },
  { countryCode: 'CN', country: '中国', region: '浙江省', city: '杭州市' },
  { countryCode: 'CN', country: '中国', region: '四川省', city: '成都市' },
  { countryCode: 'CN', country: '中国', region: '江苏省', city: '南京市' },
  { countryCode: 'CN', country: '中国', region: '湖北省', city: '武汉市' },
  { countryCode: 'CN', country: '中国', region: '陕西省', city: '西安市' },
  { countryCode: 'CN', country: '中国', region: '广东省', city: '广州市' },
  { countryCode: 'CN', country: '中国', region: '福建省', city: '厦门市' },
  // 港澳台
  { countryCode: 'HK', country: '中国香港', region: '香港岛', city: '中西区' },
  { countryCode: 'HK', country: '中国香港', region: '九龙', city: '油尖旺区' },
  { countryCode: 'TW', country: '中国台湾', region: '台北市', city: '大安区' },
  { countryCode: 'TW', country: '中国台湾', region: '新北市', city: '板桥区' },
  { countryCode: 'MO', country: '中国澳门', region: '澳门半岛', city: '大堂区' },
  // 海外华语圈
  { countryCode: 'SG', country: '新加坡', region: 'Central', city: 'Singapore' },
  { countryCode: 'MY', country: '马来西亚', region: '吉隆坡', city: 'Kuala Lumpur' },
  // 欧美
  { countryCode: 'US', country: '美国', region: 'California', city: 'San Francisco' },
  { countryCode: 'US', country: '美国', region: 'New York', city: 'New York' },
  { countryCode: 'US', country: '美国', region: 'Washington', city: 'Seattle' },
  { countryCode: 'GB', country: '英国', region: 'England', city: 'London' },
  { countryCode: 'DE', country: '德国', region: 'Bayern', city: 'München' },
  { countryCode: 'JP', country: '日本', region: '东京都', city: '渋谷区' },
  { countryCode: 'JP', country: '日本', region: '大阪府', city: '北区' },
  { countryCode: 'KR', country: '韩国', region: '서울', city: '강남구' },
];

// ─── Persona comments ─────────────────────────────────────────────────────────
// Each persona makes 2-4 comments about website strengths

interface PersonaComment {
  personaId: string;
  personaNameZh: string;
  content: string;
  geo: GeoLocation;
}

function buildPersonaComments(personas: ReturnType<typeof getPersonasByIds>): PersonaComment[] {
  const comments: PersonaComment[] = [];

  const allGeos = GEO_DISTRIBUTION;

  // Steve Jobs — product and design perspective
  comments.push(
    {
      personaId: 'steve-jobs',
      personaNameZh: '用户A',
      content: '这个网站的产品设计思路和苹果很像——极简但不简单。把思想家的对话做成产品，这个切入点太妙了。用户体验流畅到让人停不下来。',
      geo: allGeos[1], // 上海
    },
    {
      personaId: 'steve-jobs',
      personaNameZh: '用户B',
      content: '折射视图功能让我眼前一亮——不是告诉你答案，而是让你看到不同的视角。这才是真正的产品思维。',
      geo: allGeos[0], // 北京
    },
    {
      personaId: 'steve-jobs',
      personaNameZh: '用户C',
      content: '圆桌辩论模式太震撼了，3个思想家同时在线交锋，看完以后我重新思考了自己原来的判断。这种产品体验在别的地方没见过。',
      geo: allGeos[5], // 南京
    }
  );

  // Elon Musk — technology perspective
  comments.push(
    {
      personaId: 'elon-musk',
      personaNameZh: '用户D',
      content: '多智能体协作引擎是真正的技术突破。用 AI 复现历史人物的思维方式，这个方向比特斯拉还有想象力。',
      geo: allGeos[17], // San Francisco
    },
    {
      personaId: 'elon-musk',
      personaNameZh: '用户E',
      content: '棱镜折射把复杂的思想变成了可交互的产品。AI + 哲学，这个交叉点比大多数 startup 都有价值。',
      geo: allGeos[2], // 深圳
    },
    {
      personaId: 'elon-musk',
      personaNameZh: '用户F',
      content: '第一性原理视角：这个产品的核心价值不是信息，而是「思维方式」。这是很难被复制的护城河。',
      geo: allGeos[18], // New York
    }
  );

  // Charlie Munger — investment/wisdom perspective
  comments.push(
    {
      personaId: 'charlie-munger',
      personaNameZh: '用户G',
      content: '从心理模型的角度看，这个网站的设计者深刻理解了「多元思维框架」的价值。能把不同领域的顶级思想汇聚在一个平台，极具长期价值。',
      geo: allGeos[19], // Seattle
    },
    {
      personaId: 'charlie-munger',
      personaNameZh: '用户H',
      content: '我每天花15分钟在棱镜折射上，感觉自己的思维清晰度有明显提升。真正好的工具就是这样——你甚至感觉不到在使用它。',
      geo: allGeos[3], // 杭州
    },
    {
      personaId: 'charlie-munger',
      personaNameZh: '用户I',
      content: '逆向来想：什么样的产品能够长期留存用户？必须提供真实价值。棱镜折射做到了——每次对话都在积累真正的认知资产。',
      geo: allGeos[8], // 广州
    }
  );

  // Naval Ravikant — philosophy/wisdom perspective
  comments.push(
    {
      personaId: 'naval-ravikant',
      personaNameZh: '用户J',
      content: 'The best investment is in yourself — this platform is exactly that. Learning to think from the greatest minds across history, available anytime.',
      geo: allGeos[17], // SF
    },
    {
      personaId: 'naval-ravikant',
      personaNameZh: '用户K',
      content: '芒格的逆向思维、乔布斯的产品直觉、苏格拉底的追问法——这些工具在这里汇聚成了一套完整的思维训练体系。不可多得。',
      geo: allGeos[20], // London
    },
    {
      personaId: 'naval-ravikant',
      personaNameZh: '用户L',
      content: 'Seek wealth, not money or status. This platform helps you think clearly about what actually matters. The wisdom here compounds over time.',
      geo: allGeos[4], // 成都
    }
  );

  // Richard Feynman — science/curiosity
  comments.push(
    {
      personaId: 'richard-feynman',
      personaNameZh: '用户M',
      content: '科学思维的本质是追问「为什么」，棱镜折射把这种方法论融入了每次对话。用了几天，最大的感受是自己的问题质量提高了。',
      geo: allGeos[18], // New York
    },
    {
      personaId: 'richard-feynman',
      personaNameZh: '用户N',
      content: '预测能力来自对事物底层逻辑的理解。棱镜折射里的思想家们帮我搭建了一套理解世界的思维框架，比任何商学院课程都实用。',
      geo: allGeos[11], // 台北
    },
    {
      personaId: 'richard-feynman',
      personaNameZh: '用户O',
      content: '直觉是后天训练出来的，不是天生的。这个网站每天给我一个新的思维训练场景，坚持一周就感觉思考质量明显不一样。',
      geo: allGeos[9], // 厦门
    }
  );

  // Socrates — philosophy
  comments.push(
    {
      personaId: 'socrates',
      personaNameZh: '用户P',
      content: '苏格拉底式的追问是这个网站最迷人的地方——不是给你答案，而是引导你发现自己思维里的盲点。这才是真正的教育。',
      geo: allGeos[10], // 香港
    },
    {
      personaId: 'socrates',
      personaNameZh: '用户Q',
      content: '「认识你自己」——棱镜折射用 AI 技术实现了这个古老的哲学命题。每个人都能在这里找到思维深处的自己。',
      geo: allGeos[12], // 台湾
    }
  );

  // Warren Buffett — investment wisdom
  comments.push(
    {
      personaId: 'warren-buffett',
      personaNameZh: '用户R',
      content: '能力圈思维：知道自己不知道什么，比知道什么更重要。棱镜折射帮我快速了解不同领域顶级思想家的判断框架，扩展了我的能力圈。',
      geo: allGeos[19], // Seattle
    },
    {
      personaId: 'warren-buffett',
      personaNameZh: '用户S',
      content: '好的投资是认知的变现。这个平台是我见过的最有效的认知提升工具——把巴菲特、芒格、达利欧的思维方式变成可交互的体验。',
      geo: allGeos[1], // 上海
    },
    {
      personaId: 'warren-buffett',
      personaNameZh: '用户T',
      content: '护城河分析：棱镜折射的核心壁垒是「思想家库」和「多智能体引擎」。这两样东西短期内很难被复制，长期价值巨大。',
      geo: allGeos[13], // 澳门
    }
  );

  // Confucius — Chinese wisdom
  comments.push(
    {
      personaId: 'confucius',
      personaNameZh: '用户U',
      content: '「三人行，必有我师」——棱镜折射把这句话做到了极致。每次对话，都是和历史上最聪明的大脑对话，这种体验是前所未有的。',
      geo: allGeos[0], // 北京
    },
    {
      personaId: 'confucius',
      personaNameZh: '用户V',
      content: '「学而不思则罔」——这个平台真正实现了学和思的结合。不只是接收信息，而是让你在对话中主动思考。',
      geo: allGeos[6], // 武汉
    },
    {
      personaId: 'confucius',
      personaNameZh: '用户W',
      content: '中西方思想在这里交汇。既有芒格、苏格拉底，也有孔子、老子。这种跨文化的思维碰撞非常珍贵。',
      geo: allGeos[14], // 新加坡
    }
  );

  // Additional diverse users
  comments.push(
    {
      personaId: 'generic',
      personaNameZh: '来自深圳的产品经理',
      content: '守望者计划太有创意了——每天三个思想家值班，感觉社区是活的、有灵魂的。期待更多人发现这个宝地。',
      geo: { countryCode: 'CN', country: '中国', region: '广东省', city: '深圳市' },
    },
    {
      personaId: 'generic',
      personaNameZh: '杭州创业者',
      content: '创业过程中最大的挑战是认知局限。棱镜折射帮我打开了思维边界——每次对话都像在和一个真正的高手深度交流，物超所值。',
      geo: { countryCode: 'CN', country: '中国', region: '浙江省', city: '杭州市' },
    },
    {
      personaId: 'generic',
      personaNameZh: '硅谷工程师',
      content: 'As a software engineer, I appreciate the technical sophistication here. The multi-agent architecture is impressive — each persona feels distinctly different. Great work!',
      geo: { countryCode: 'US', country: '美国', region: 'California', city: 'San Francisco' },
    },
    {
      personaId: 'generic',
      personaNameZh: '金融从业者',
      content: '每天用棱镜折射做决策前的思考热身已经成了习惯。巴菲特和芒格的双视角分析，让我的投资判断更严谨了。',
      geo: { countryCode: 'HK', country: '中国香港', region: '香港岛', city: '中西区' },
    },
    {
      personaId: 'generic',
      personaNameZh: '大学教师',
      content: '这个平台让我反思了什么是真正的教育。学生需要的不只是知识，而是思维框架。棱镜折射是课堂的有力补充。',
      geo: { countryCode: 'CN', country: '中国', region: '上海市', city: '浦东新区' },
    },
    {
      personaId: 'generic',
      personaNameZh: '自由撰稿人',
      content: '作家需要多视角观察世界。棱镜折射帮我打破了自己的认知茧房——每次辩论结束后，我都能看到自己原来的盲点。',
      geo: { countryCode: 'TW', country: '中国台湾', region: '台北市', city: '大安区' },
    },
    {
      personaId: 'generic',
      personaNameZh: '东京设计师',
      content: 'UI 设计精致而克制，信息层次清晰，用起来非常舒服。审美和功能达到了很好的平衡。这种设计品味让人想长期留在这里。',
      geo: { countryCode: 'JP', country: '日本', region: '东京都', city: '渋谷区' },
    },
    {
      personaId: 'generic',
      personaNameZh: '伦敦留学生',
      content: '用了一个月，最大的改变是提问质量提高了。棱镜折射逼着你把问题想清楚才能有效提问——这种训练很有价值。',
      geo: { countryCode: 'GB', country: '英国', region: 'England', city: 'London' },
    },
    {
      personaId: 'generic',
      personaNameZh: '广州互联网人',
      content: '智辩场是全网最独特的辩论体验。没有立场偏向，只有纯粹的思想碰撞。看完今天的辩论，我对同一问题有了完全不同的理解。',
      geo: { countryCode: 'CN', country: '中国', region: '广东省', city: '广州市' },
    },
    {
      personaId: 'generic',
      personaNameZh: '首尔产品经理',
      content: 'Korean version: 이 플랫폼의 멀티에이전트 아키텍처가 정말 인상적입니다. 역사상 가장 뛰어난 두뇌들이 대화하는 경험을 언제든 할 수 있다니... 앞으로 더 많이 사용하겠습니다.',
      geo: { countryCode: 'KR', country: '韩国', region: '서울', city: '강남구' },
    },
    {
      personaId: 'generic',
      personaNameZh: '成都内容创作者',
      content: '选题困难户的救星！每天不知道写什么的时候，来棱镜折射和思想家们聊聊，灵感就自然涌现了。',
      geo: { countryCode: 'CN', country: '中国', region: '四川省', city: '成都市' },
    },
    {
      personaId: 'generic',
      personaNameZh: '西安读书人',
      content: '「以史为鉴」在这里有了新的含义——不只是看历史，而是和历史人物对话。孔子、苏格拉底、亚里士多德同时在场，这种体验本身就是文明进步的体现。',
      geo: { countryCode: 'CN', country: '中国', region: '陕西省', city: '西安市' },
    },
    {
      personaId: 'generic',
      personaNameZh: '柏林华人',
      content: '在欧洲待久了，有时候会想家。棱镜折射的中文思想家对话，是我在海外能找到的最有深度的中文内容。质量远超预期。',
      geo: { countryCode: 'DE', country: '德国', region: 'Bayern', city: 'München' },
    },
    {
      personaId: 'generic',
      personaNameZh: '新北工程师',
      content: '身為軟體工程師，我特別在意底層邏輯。這套多智能體系統的設計非常嚴謹，每個角色的思維方式都有脈絡可循，技術含量極高。',
      geo: { countryCode: 'TW', country: '中国台湾', region: '新北市', city: '板桥区' },
    },
    {
      personaId: 'generic',
      personaNameZh: '墨尔本华人',
      content: '在海外待久了，中文思维有些退化。棱镜折射让我重新用中文深度思考，这种语言和思想的深度结合，比任何英语内容平台都更适合中文思维者。',
      geo: { countryCode: 'AU', country: '澳大利亚', region: 'Victoria', city: 'Melbourne' },
    },
    {
      personaId: 'generic',
      personaNameZh: '南京独立开发者',
      content: '独立开发者最大的孤独是没人讨论。棱镜折射里的顾问团模式填补了这个空白——需要决策建议的时候，随时能找到不同视角的专家。',
      geo: { countryCode: 'CN', country: '中国', region: '江苏省', city: '南京市' },
    },
    {
      personaId: 'generic',
      personaNameZh: '吉隆坡创业者',
      content: '作为马来西亚华人，能同时访问中西方顶级思想家的思维方式，这个平台对我是独一无二的存在。用芒格的方式思考，用老子的方式淡定。',
      geo: { countryCode: 'MY', country: '马来西亚', region: '吉隆坡', city: 'Kuala Lumpur' },
    }
  );

  return comments;
}

// ─── Date distribution ────────────────────────────────────────────────────────

function distributeOverDays(comments: PersonaComment[], daysBack = 14): Array<{ comment: PersonaComment; date: Date }> {
  const result: Array<{ comment: PersonaComment; date: Date }> = [];
  const now = new Date();
  const shuffled = [...comments].sort(() => Math.random() - 0.5);

  let dayIndex = 0;
  let commentIndex = 0;

  while (commentIndex < shuffled.length) {
    // 2-5 comments per day
    const commentsToday = Math.min(2 + Math.floor(Math.random() * 4), shuffled.length - commentIndex);

    for (let i = 0; i < commentsToday; i++) {
      const comment = shuffled[commentIndex++];
      const d = new Date(now);
      d.setDate(d.getDate() - dayIndex);
      // Random hour: 8am - 11pm (in Asia/Shanghai TZ offset: +8 = UTC+8)
      const hour = 8 + Math.floor(Math.random() * 15);
      const minute = Math.floor(Math.random() * 60);
      d.setUTCHours(hour - 8, minute, 0, 0); // Convert local time to UTC

      result.push({ comment, date: d });
    }

    // Skip 0-2 days between active days
    const skipDays = Math.floor(Math.random() * 3);
    dayIndex += 1 + skipDays;

    if (dayIndex > daysBack) break;
  }

  return result;
}

// ─── Seed function ─────────────────────────────────────────────────────────────

async function seed() {
  const prisma = new PrismaClient();

  // Verify DB connection
  try {
    await prisma.$connect();
    console.log('✅ Database connected');
  } catch (err) {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
  }

  // Check existing comment count
  const existingCount = await prisma.comment.count({ where: { type: 'comment' } });
  console.log(`📊 Existing comments: ${existingCount}`);

  if (existingCount > 0) {
    const confirmed = process.argv.includes('--force');
    if (!confirmed) {
      console.log('\n⚠️  Database already has comments. Run with --force to overwrite.');
      console.log('   Existing comments will NOT be deleted — new comments will be added alongside them.');
      console.log('\n💡 To clear and reseed: manually delete all rows from the comments table first.');
    }
  }

  // Build comments
  const personas = getPersonasByIds([
    'steve-jobs', 'elon-musk', 'charlie-munger', 'naval-ravikant',
    'richard-feynman', 'socrates', 'warren-buffett', 'confucius'
  ]);
  const allComments = buildPersonaComments(personas);
  const distributed = distributeOverDays(allComments, 14);

  console.log(`\n🌱 Seeding ${distributed.length} comments across ~14 days...`);

  let successCount = 0;
  let errorCount = 0;

  for (const { comment, date } of distributed) {
    try {
      await prisma.comment.create({
        data: {
          content: comment.content,
          nickname: comment.geo.country.includes('中国') || comment.geo.country === '新加坡' || comment.geo.country === '马来西亚'
            ? comment.personaNameZh
            : `Visitor_${Math.random().toString(36).slice(2, 8)}`,
          avatarSeed: null,
          type: 'comment',
          status: 'published',
          geoCountryCode: comment.geo.countryCode,
          geoCountry: comment.geo.country,
          geoRegion: comment.geo.region,
          geoCity: comment.geo.city,
          reactions: JSON.stringify(getRandomReactions()),
          createdAt: date,
          updatedAt: date,
        },
      });
      successCount++;

      // Progress indicator
      if (successCount % 5 === 0) {
        process.stdout.write(`  ${successCount}/${distributed.length} seeded...\n`);
      }
    } catch (err) {
      errorCount++;
      console.error(`\n❌ Failed to seed comment: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Small delay to avoid DB pressure
    await new Promise(r => setTimeout(r, 50));
  }

  const totalNow = await prisma.comment.count({ where: { type: 'comment' } });

  console.log(`\n✅ Seeding complete!`);
  console.log(`   Inserted: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Total comments in DB: ${totalNow}`);

  await prisma.$disconnect();
  process.exit(errorCount > 0 ? 1 : 0);
}

function getRandomReactions(): Record<string, number> {
  const all = ['👍', '❤️', '🔥', '😮', '💯', '✨'];
  const count = Math.floor(Math.random() * 4);
  const result: Record<string, number> = {};

  const shuffled = [...all].sort(() => Math.random() - 0.5);
  for (let i = 0; i < count; i++) {
    result[shuffled[i]] = 1 + Math.floor(Math.random() * 5);
  }
  return result;
}

seed().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
