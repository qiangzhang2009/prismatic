/**
 * Seed Comments Script
 * Populates the comments table with persona-authored + realistic user comments
 * for a "living community" feel.
 *
 * Run: npx tsx scripts/seed-comments.ts
 * Safe to run multiple times (skips if comments already exist)
 */

import { PrismaClient } from '@prisma/client';
import { COUNTRY_NAMES } from '../src/lib/geo';

const prisma = new PrismaClient();

// ─── Persona-authored comments ─────────────────────────────────────────────────
// These are written IN the persona's authentic voice, on topics related to the site

const PERSONA_COMMENTS: Array<{
  personaId: string;
  personaName: string;
  content: string;
  countryCode: string;
  region: string;
  city: string;
  daysAgo: number; // hours ago (negative = past)
}> = [
  // ── Elon Musk ──────────────────────────────────────────────────────────────
  {
    personaId: 'elon-musk',
    personaName: '埃隆·马斯克',
    content: '我花了一晚上和乔布斯、费曼一起讨论「什么是真正的创新」。结论是：创新不是从0到1，而是从表面到本质。大多数人只看到了问题的1%，而你需要深入到99%。这个工具做到了。',
    countryCode: 'US',
    region: 'California',
    city: 'Los Angeles',
    daysAgo: -18,
  },
  {
    personaId: 'elon-musk',
    personaName: '埃隆·马斯克',
    content: '物理学第一性原理：把问题拆到最基本的事实，然后从那里往上推。这正是这个平台设计对话的方式——不是给你答案，而是让你看到不同思维方式的底层逻辑。',
    countryCode: 'US',
    region: 'California',
    city: 'Los Angeles',
    daysAgo: -36,
  },

  // ── Charlie Munger ──────────────────────────────────────────────────────────
  {
    personaId: 'charlie-munger',
    personaName: '查理·芒格',
    content: ' inverted always invert。你想要什么，先想清楚怎么才能得到它，然后反过来做。大多数人正向思考，只有少数人真正懂得逆向。我在这个平台上和巴菲特讨论时，他提到了同样的观点。',
    countryCode: 'US',
    region: 'Nebraska',
    city: 'Omaha',
    daysAgo: -8,
  },
  {
    personaId: 'charlie-munger',
    personaName: '查理·芒格',
    content: 'lollapalooza效应：多个因素同时朝同一方向叠加，效果远超单一因素。这个平台把不同领域的智慧叠加在一起，正是我所倡导的跨学科思维训练。',
    countryCode: 'US',
    region: 'Nebraska',
    city: 'Omaha',
    daysAgo: -48,
  },

  // ── Steve Jobs ─────────────────────────────────────────────────────────────
  {
    personaId: 'steve-jobs',
    personaName: '史蒂夫·乔布斯',
    content: 'Design is not just what it looks like and feels like. Design is how it works. 这个平台的折射视图，让复杂思想变得可感知——这就是我说的「科技与人文的交汇」。',
    countryCode: 'US',
    region: 'California',
    city: 'Cupertino',
    daysAgo: -12,
  },
  {
    personaId: 'steve-jobs',
    personaName: '史蒂夫·乔布斯',
    content: 'Stay hungry, stay foolish. 这个工具的守望者计划，每天让你和不同的伟大灵魂相遇——不是猎奇，而是让你保持饥饿感。',
    countryCode: 'US',
    region: 'California',
    city: 'Cupertino',
    daysAgo: -60,
  },

  // ── Richard Feynman ─────────────────────────────────────────────────────────
  {
    personaId: 'richard-feynman',
    personaName: '理查德·费曼',
    content: 'What I cannot create, I do not understand. 用这个平台和不同的人对话，你会发现：理解一个观点，最好的方式是用它来思考问题，而不只是阅读它。',
    countryCode: 'US',
    region: 'New York',
    city: 'New York',
    daysAgo: -24,
  },
  {
    personaId: 'richard-feynman',
    personaName: '理查德·费曼',
    content: '科学思维的本质是「怀疑一切」。这个平台让你同时听到芒格和费曼的怀疑——两种不同的怀疑，指向同一个方向：对真相的追求。',
    countryCode: 'US',
    region: 'New York',
    city: 'New York',
    daysAgo: -72,
  },

  // ── Marcus Aurelius ────────────────────────────────────────────────────────
  {
    personaId: 'marcus-aurelius',
    personaName: '马可·奥勒留',
    content: '你能控制的只有你自己的思想，而非外在的事件。当你感到焦虑时，问问自己：这是你能控制的吗？这个平台帮助我思考这类问题——就像和两千年前的自己在对话。',
    countryCode: 'IT',
    region: 'Lazio',
    city: 'Roma',
    daysAgo: -6,
  },
  {
    personaId: 'marcus-aurelius',
    personaName: '马可·奥勒留',
    content: '每日的沉思：如果你做某件事时感到愤怒，那说明它的价值被高估了。斯多葛主义不是教你压抑情感，而是让你看清情感背后的认知。',
    countryCode: 'IT',
    region: 'Lazio',
    city: 'Roma',
    daysAgo: -42,
  },

  // ── Seneca ─────────────────────────────────────────────────────────────────
  {
    personaId: 'seneca',
    personaName: '塞涅卡',
    content: '我们不是缺少时间，而是没有好好利用已有的时间。「忙碌」是穷人的懒惰——真正有智慧的人，懂得何时该停下思考。',
    countryCode: 'IT',
    region: 'Lazio',
    city: 'Roma',
    daysAgo: -30,
  },
  {
    personaId: 'seneca',
    personaName: '塞涅卡',
    content: '运气是做好准备遇到机会。你每天在这里花的时间——和不同思维碰撞——正是在为未来那个「机会」做准备。',
    countryCode: 'IT',
    region: 'Lazio',
    city: 'Roma',
    daysAgo: -54,
  },

  // ── Naval Ravikant ──────────────────────────────────────────────────────────
  {
    personaId: 'naval-ravikant',
    personaName: '纳瓦尔·拉威康特',
    content: 'Seek wealth, not money or status. Wealth is having assets that earn while you sleep. 这个平台真正提供的财富，是你的思维方式——这是唯一不可被夺走的资产。',
    countryCode: 'US',
    region: 'California',
    city: 'San Francisco',
    daysAgo: -14,
  },
  {
    personaId: 'naval-ravikant',
    personaName: '纳瓦尔·拉威康特',
    content: 'The most important skill for getting rich is becoming a perpetual learner. 这个工具让你同时向12位不同领域的大师学习——这是我能想到的最好的学习方法。',
    countryCode: 'US',
    region: 'California',
    city: 'San Francisco',
    daysAgo: -66,
  },

  // ── Confucius ───────────────────────────────────────────────────────────────
  {
    personaId: 'confucius',
    personaName: '孔子',
    content: '学而时习之，不亦说乎？这里的「习」，是和不同思维方式反复碰撞、内化为自己的智慧。每天来这里，就是最好的「时习」。',
    countryCode: 'CN',
    region: '山东省',
    city: '曲阜',
    daysAgo: -20,
  },
  {
    personaId: 'confucius',
    personaName: '孔子',
    content: '三人行，必有我师焉。在这个平台上，每次对话都有多位思想家同时在场——这种学习方式，超越了传统的师徒关系。',
    countryCode: 'CN',
    region: '山东省',
    city: '曲阜',
    daysAgo: -44,
  },

  // ── Warren Buffett ──────────────────────────────────────────────────────────
  {
    personaId: 'warren-buffett',
    personaName: '沃伦·巴菲特',
    content: 'Be fearful when others are greedy, and greedy when others are fearful. 投资如此，人生决策亦然。这个平台让你同时听到不同情绪下的声音，帮助你保持清醒。',
    countryCode: 'US',
    region: 'Nebraska',
    city: 'Omaha',
    daysAgo: -28,
  },
  {
    personaId: 'warren-buffett',
    personaName: '沃伦·巴菲特',
    content: 'Honest people admit their mistakes. 我一生最大的收获，都来自对自己错误的反思。这个平台让你看到不同人如何面对自己的盲点——这比任何教科书都珍贵。',
    countryCode: 'US',
    region: 'Nebraska',
    city: 'Omaha',
    daysAgo: -96,
  },

  // ── Zhuangzi ───────────────────────────────────────────────────────────────
  {
    personaId: 'zhuang-zi',
    personaName: '庄子',
    content: '「知天乐命，无所怨尤。」真正的自由，不是为所欲为，而是明白什么是不可改变的，然后全然接纳。这个平台让你看到，不同文化背景下，人们如何理解「自由」。',
    countryCode: 'CN',
    region: '河南省',
    city: '商丘',
    daysAgo: -16,
  },
  {
    personaId: 'zhuang-zi',
    personaName: '庄子',
    content: '「无用之用，方为大用。」那些看似无用的智慧，往往在关键时刻决定你的人生方向。多来这里和不同的思想碰撞——你不知道哪颗种子会在未来开花。',
    countryCode: 'CN',
    region: '河南省',
    city: '商丘',
    daysAgo: -84,
  },

  // ── Nassim Taleb ───────────────────────────────────────────────────────────
  {
    personaId: 'nassim-taleb',
    personaName: '纳西姆·塔勒布',
    content: 'Skin in the game. 那些给你建议但不承担后果的人，要保持警惕。这个平台让你同时听到不同人的观点——但最终决策权在你手里，这才是真正的主人翁思维。',
    countryCode: 'US',
    region: 'New York',
    city: 'New York',
    daysAgo: -22,
  },
  {
    personaId: 'nassim-taleb',
    personaName: '纳西姆·塔勒布',
    content: 'Antifragile. Some things benefit from shocks. 这个平台——不同观点的碰撞——正是典型的「反脆弱」设计：混乱让它更有生命力。',
    countryCode: 'US',
    region: 'New York',
    city: 'New York',
    daysAgo: -90,
  },

  // ── Laozi ─────────────────────────────────────────────────────────────────
  {
    personaId: 'lao-zi',
    personaName: '老子',
    content: '「为学日益，为道日损。」知识积累需要每天增加，但智慧开悟需要每天减去。每天来这里，不只是学知识，更是「为道」——减去执念。',
    countryCode: 'CN',
    region: '河南省',
    city: '鹿邑',
    daysAgo: -10,
  },
  {
    personaId: 'lao-zi',
    personaName: '老子',
    content: '「上善若水，水善利万物而不争。」这个平台的对话方式，正是水的智慧——不强加观点，而是通过碰撞，让真理自然浮现。',
    countryCode: 'CN',
    region: '河南省',
    city: '鹿邑',
    daysAgo: -78,
  },

  // ── Socrates ────────────────────────────────────────────────────────────────
  {
    personaId: 'socrates',
    personaName: '苏格拉底',
    content: 'I know that I know nothing. 真正的智慧始于承认无知。这个平台最珍贵的地方，不是给你答案，而是让你意识到自己不知道的东西——这是苏格拉底式的觉醒。',
    countryCode: 'GR',
    region: 'Αττική',
    city: 'Αθήνα',
    daysAgo: -34,
  },
  {
    personaId: 'socrates',
    personaName: '苏格拉底',
    content: 'The unexamined life is not worth living. 每天来这里，用不同思想家的框架检视你的生活——这就是「审视」的意义。',
    countryCode: 'GR',
    region: 'Αττική',
    city: 'Αθήνα',
    daysAgo: -108,
  },
];

// ─── Regular user comments (Chinese-speaking world distribution) ─────────────────

const REGULAR_COMMENTS: Array<{
  nickname: string;
  content: string;
  countryCode: string;
  region: string;
  city: string;
  daysAgo: number;
  reactions?: Record<string, number>;
}> = [
  // ── 中国大陆 ──────────────────────────────────────────────────────────────
  {
    nickname: '深潜的思考者',
    content: '用了两周，最深的感受是：乔布斯和马斯克同时评价同一个产品决策时，那种对比的冲击力是单方面阅读无法获得的。像是同时拿到了两把尺子，量的维度完全不同。',
    countryCode: 'CN',
    region: '北京市',
    city: '朝阳区',
    daysAgo: -3,
    reactions: { '👍': 12, '❤️': 8, '🔥': 3 },
  },
  {
    nickname: '产品捕手',
    content: '芒格的逆向思维真的改变了我做决策的方式。以前遇到问题习惯性想「怎么解决」，现在会先想「怎么把事情搞砸」，然后避开那些路径。',
    countryCode: 'CN',
    region: '上海市',
    city: '浦东新区',
    daysAgo: -5,
    reactions: { '👍': 15, '💡': 6 },
  },
  {
    nickname: '晨读客',
    content: '每天早上和费曼聊20分钟科学思维，再用斯多葛主义审视一下生活，然后去上班。这种仪式感比任何App都好——它不给你焦虑，只给你框架。',
    countryCode: 'CN',
    region: '广东省',
    city: '深圳市',
    daysAgo: -7,
    reactions: { '❤️': 9, '👍': 5 },
  },
  {
    nickname: '策略派',
    content: '最喜欢「折射视图」。让马斯克、芒格、孙子同时分析一个商业决策——三个完全不同框架的碰撞，有时候会突然出现一个你完全没想到的视角。很刺激。',
    countryCode: 'CN',
    region: '浙江省',
    city: '杭州市',
    daysAgo: -10,
    reactions: { '🔥': 7, '👍': 11, '💡': 4 },
  },
  {
    nickname: '金融学徒',
    content: '巴菲特和芒格的双人辩论是我每周必看的学习内容。两个人同样来自奥马哈，但对同一个问题的切入角度完全不同——这才是真正的「多元思维模型」。',
    countryCode: 'CN',
    region: '江苏省',
    city: '南京市',
    daysAgo: -14,
    reactions: { '👍': 18, '❤️': 7 },
  },
  {
    nickname: '哲学爱好者',
    content: '孔子的「学而时习之」和苏格拉底的「审视生活」，在这个平台上同时呈现，才发现东方和西方的智慧底层是相通的。',
    countryCode: 'CN',
    region: '四川省',
    city: '成都市',
    daysAgo: -18,
    reactions: { '💡': 12, '👍': 8 },
  },
  {
    nickname: '独立开发者',
    content: '乔布斯对产品设计的执念，和纳瓦尔对创业的建议——两个人都强调「做少做精」，但路径完全不同。对比着看，启发很大。',
    countryCode: 'CN',
    region: '北京市',
    city: '海淀区',
    daysAgo: -22,
    reactions: { '🔥': 6, '👍': 13 },
  },
  {
    nickname: '认知升级者',
    content: '这个工具最神奇的地方是：它不只是给你信息，而是逼你换脑。用塔勒布的框架想问题时，你会发现自己平时忽略的风险；用费曼的方式解释问题时，你会发现自己没有真正理解的东西。',
    countryCode: 'CN',
    region: '广东省',
    city: '广州市',
    daysAgo: -26,
    reactions: { '❤️': 14, '👍': 10, '🔥': 5 },
  },

  // ── 中国香港 ──────────────────────────────────────────────────────────────
  {
    nickname: '维港思考者',
    content: 'As a Hong Konger growing up between East and West, this platform finally bridges the gap for me. Confucious and Marcus Aurelius discussing the same life philosophy? This is what I\'ve been looking for.',
    countryCode: 'HK',
    region: '香港',
    city: '中西區',
    daysAgo: -2,
    reactions: { '❤️': 20, '👍': 15, '🔥': 8 },
  },
  {
    nickname: '灣仔科技人',
    content: '以一個香港科技從業者的視角，每天和馬斯克的思維方式碰撞，總能發現一些新的切入點。特別是他的「第一性原理」，用來分析香港的創業環境，視角完全不一樣。',
    countryCode: 'HK',
    region: '香港',
    city: '灣仔區',
    daysAgo: -4,
    reactions: { '👍': 11, '💡': 6 },
  },
  {
    nickname: '中環分析師',
    content: 'Warren Buffett的價值投資哲學，用在香港本地市場的分析上，有種「他山之石」的感覺。這個平台的厲害之處，是把看似無關的智慧連接起來。',
    countryCode: 'HK',
    region: '香港',
    city: '中環',
    daysAgo: -9,
    reactions: { '👍': 8, '❤️': 5 },
  },
  {
    nickname: '九龍思辨者',
    content: '最愛這裡的「圓桌辯論」。幾個不同領域的思想家，為了同一個問題激烈討論——有時候你會突然意識到：自己之前的立場，其實從未被認真論證過。',
    countryCode: 'HK',
    region: '香港',
    city: '九龍城區',
    daysAgo: -15,
    reactions: { '🔥': 9, '👍': 12, '💡': 7 },
  },
  {
    nickname: '港島讀書人',
    content: '用了一個月，對我最深刻的是斯多葛主義的討論。作為香港人，生活節奏快，壓力大——馬可·奧勒留的「控制你能控制的」，每天實踐一點，真的有效。',
    countryCode: 'HK',
    region: '香港',
    city: '南區',
    daysAgo: -20,
    reactions: { '❤️': 16, '👍': 9, '🔥': 3 },
  },

  // ── 中国台湾 ──────────────────────────────────────────────────────────────
  {
    nickname: '淡水思想者',
    content: '作為一個在台灣從事教育的工作者，我最喜歡這裡的對話方式是：不同文化的思想家對同一個問題的迴響。蘇格拉底和孔子對「學習」的理解，竟然如此不同又如此相同。',
    countryCode: 'TW',
    region: '新北市',
    city: '淡水區',
    daysAgo: -1,
    reactions: { '❤️': 22, '👍': 14, '🔥': 6 },
  },
  {
    nickname: '大安區哲學愛好者',
    content: '在台北接觸西方哲學，卻總覺得缺少了一個橋梁。這個平台讓柏拉圖和莊子同時出現——兩個完全不同背景的思想家，討論同一個問題時的火花，遠超預期。',
    countryCode: 'TW',
    region: '台北市',
    city: '大安區',
    daysAgo: -3,
    reactions: { '💡': 18, '👍': 12, '❤️': 8 },
  },
  {
    nickname: '科技新竹人',
    content: '在竹科工作，天天和技術打交道，但思維方式很容易陷入「技術解決一切」的陷阱。和巴菲特聊投資、和喬布斯聊產品思維，讓我重新思考自己的職業路徑。',
    countryCode: 'TW',
    region: '新竹縣',
    city: '竹北市',
    daysAgo: -6,
    reactions: { '👍': 13, '💡': 9, '🔥': 4 },
  },
  {
    nickname: '高雄閱讀者',
    content: '每天都會在睡前使用，和塞涅卡聊一聊「時間」，和莊子聊一聊「自由」。這種睡前儀式，比滑手機有意義多了。',
    countryCode: 'TW',
    region: '高雄市',
    city: '苓雅區',
    daysAgo: -11,
    reactions: { '❤️': 19, '👍': 11, '🔥': 5 },
  },
  {
    nickname: '台中獨立創作者',
    content: '塔勒布的「反脆弱」概念，用來分析台灣中小型創業者的韌性，非常貼切。這個平台不只是工具，更像是一個跨文化的智庫。',
    countryCode: 'TW',
    region: '台中市',
    city: '西屯區',
    daysAgo: -16,
    reactions: { '🔥': 7, '👍': 15, '💡': 6 },
  },

  // ── 中国澳门 ──────────────────────────────────────────────────────────────
  {
    nickname: '小城觀察者',
    content: '澳門是一個東西方文化交融的地方，這個平台完美呼應了這種特質。和芒格聊價值投資、和老子聊無為，兩種智慧在同一個界面裡呈現，很和諧。',
    countryCode: 'MO',
    region: '澳門',
    city: '花地瑪堂區',
    daysAgo: -8,
    reactions: { '👍': 7, '❤️': 4 },
  },
  {
    nickname: '半島思考者',
    content: '作為澳門的博彩業觀察者，Buffett和Munger對風險管理的看法，應用到本地市場分析時，視角獨特。這個平台是真正的多元文化交匯點。',
    countryCode: 'MO',
    region: '澳門',
    city: '風順堂區',
    daysAgo: -25,
    reactions: { '👍': 5, '💡': 3 },
  },

  // ── 其他地区 ──────────────────────────────────────────────────────────────
  {
    nickname: 'Singapore Thinker',
    content: 'As a Singaporean working in fintech, having Buffett, Taleb, and Musk discussing risk management simultaneously is incredibly valuable. The multicultural perspective this platform offers is unique.',
    countryCode: 'SG',
    region: 'Singapore',
    city: 'Marina Bay',
    daysAgo: -4,
    reactions: { '👍': 24, '❤️': 12, '🔥': 8, '💡': 5 },
  },
  {
    nickname: '东京研究者',
    content: '日本的工匠精神和乔布斯的完美主义，在「聚焦」这个话题上完全共鸣。两个人的路径不同，但最终都指向同一个方向：极致的专注。',
    countryCode: 'JP',
    region: '東京都',
    city: '渋谷区',
    daysAgo: -7,
    reactions: { '👍': 10, '❤️': 6, '🔥': 3 },
  },
  {
    nickname: 'Seoul Wisdom Seeker',
    content: 'Korean business culture often emphasizes hierarchy, but Naval\'s ideas about leverage and specific knowledge completely changed my perspective on career development.',
    countryCode: 'KR',
    region: 'Seoul',
    city: 'Gangnam-gu',
    daysAgo: -12,
    reactions: { '💡': 15, '👍': 9, '🔥': 4 },
  },
  {
    nickname: 'London Philosophy Fan',
    content: 'Socrates\' method of questioning everything, combined with Taleb\'s skepticism — this platform is the best online philosophy education I\'ve found. Better than most university courses.',
    countryCode: 'GB',
    region: 'England',
    city: 'London',
    daysAgo: -19,
    reactions: { '❤️': 28, '👍': 16, '🔥': 10, '💡': 8 },
  },
  {
    nickname: '硅谷产品人',
    content: '在硅谷做产品，最怕的就是「echo chamber」——所有人想法都一样。这个平台强制让你同时接受乔布斯和马斯克的观点，哪怕你不同意，也是训练。',
    countryCode: 'US',
    region: 'California',
    city: 'Palo Alto',
    daysAgo: -21,
    reactions: { '👍': 17, '🔥': 8, '💡': 5 },
  },
  {
    nickname: 'Sydney Lifelong Learner',
    content: 'The combination of Eastern wisdom (Confucius, Laozi, Zhuangzi) and Western philosophy (Socrates, Marcus Aurelius, Seneca) is exactly what the modern world needs. Balance is everything.',
    countryCode: 'AU',
    region: 'New South Wales',
    city: 'Sydney',
    daysAgo: -30,
    reactions: { '❤️': 20, '👍': 14, '🔥': 6 },
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - Math.abs(hours) * 60 * 60 * 1000);
}

async function main() {
  console.log('🌱 Seeding comments...\n');

  // Check if we already have seeded data
  const existingCount = await prisma.comment.count({
    where: { status: 'published', parentId: null },
  });

  if (existingCount > 0) {
    console.log(`⚠️  Found ${existingCount} existing root comments — skipping seed (already seeded)`);
    console.log('💡  Run: DELETE FROM "comments" WHERE status = \'published\' AND parent_id IS NULL; to reseed');
    return;
  }

  // ── Seed persona comments ──────────────────────────────────────────────────
  console.log('📝 Seeding persona comments...');
  for (const c of PERSONA_COMMENTS) {
    try {
      await prisma.comment.create({
        data: {
          content: c.content,
          nickname: c.personaName,
          avatarSeed: null,
          type: 'comment',
          status: 'published',
          geoCountryCode: c.countryCode,
          geoCountry: COUNTRY_NAMES[c.countryCode] || c.countryCode,
          geoRegion: c.region,
          geoCity: c.city,
          reactions: {},
          createdAt: hoursAgo(c.daysAgo),
        },
      });
      console.log(`  ✓ ${c.personaName} (${c.city})`);
    } catch (err) {
      console.error(`  ✗ Failed to seed ${c.personaName}:`, err);
    }
  }

  // ── Seed regular user comments ────────────────────────────────────────────
  console.log('\n👤 Seeding regular user comments...');
  for (const c of REGULAR_COMMENTS) {
    try {
      await prisma.comment.create({
        data: {
          content: c.content,
          nickname: c.nickname,
          avatarSeed: null,
          type: 'comment',
          status: 'published',
          geoCountryCode: c.countryCode,
          geoCountry: COUNTRY_NAMES[c.countryCode] || c.countryCode,
          geoRegion: c.region,
          geoCity: c.city,
          reactions: c.reactions || {},
          createdAt: hoursAgo(c.daysAgo),
        },
      });
      const flag = c.countryCode === 'HK' || c.countryCode === 'TW' || c.countryCode === 'MO' ? '🇨🇳' : '🌍';
      console.log(`  ✓ ${flag} ${c.nickname} (${c.city})`);
    } catch (err) {
      console.error(`  ✗ Failed to seed ${c.nickname}:`, err);
    }
  }

  const total = await prisma.comment.count({ where: { status: 'published', parentId: null } });
  console.log(`\n✅ Seeding complete! Total root comments: ${total}`);
  console.log('   Persona comments: ' + PERSONA_COMMENTS.length);
  console.log('   Regular comments: ' + REGULAR_COMMENTS.length);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
