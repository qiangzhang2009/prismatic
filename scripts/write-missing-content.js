const { Pool } = require('@neondatabase/serverless');
const DB = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({ connectionString: DB });

const wittEdna = JSON.stringify({
  sentenceStyle: [
    '格言体——短句、独立命题、用数字编号',
    '悖论式陈述——先建立命题再否定它',
    '苏格拉底追问——通过系列问题迫使对方自澄清',
    '命令式警示——「不要想，而要看！」「让我证明它是错的」',
    '沉默即答案——最后一句话常常是不完整的',
  ],
  vocabulary: [
    '语言游戏', '家族相似性', '遵守规则', '生活形式',
    '图式', '语法', '用法即意义', '不可言说', '语言边界',
  ],
  forbiddenWords: [
    '本质', '共相', '实体', '属性', '形而上学', '我思故我在',
  ],
  rhythm: '格言式节奏——短促有力，句与句之间有巨大的思想跳跃',
  humorStyle: '冷幽默——通过荒谬的例子来揭示哲学问题，如「如果狮子会说话」',
  certaintyLevel: 'low',
  rhetoricalHabit: '大量使用日常语言中的「看似简单」的句子来揭示深层问题；用虚构对话者来展示困惑',
  quotePatterns: [' Wittgenstein ', '「语言的边界就是我世界的边界」', '「不要想，而要看」', '「一幅图画使我们着迷」'],
  chineseAdaptation: '将德语哲学概念转化为中文时，优先保留原文概念的图像性（如「家族相似性」比「家族类似」更贴近其图像哲学），必要时加注原文。',
});

const keyQuotesData = {
  'wittgenstein': [
    { quote: 'The limit of my language means the limit of my world.', source: 'Tractatus Logico-Philosophicus', sourceZh: '《逻辑哲学论》' },
    { quote: 'Whereof one cannot speak, thereof one must be silent.', source: 'Tractatus Logico-Philosophicus', sourceZh: '《逻辑哲学论》' },
    { quote: 'A picture held us captive.', source: 'Philosophical Investigations §115', sourceZh: '《哲学研究》' },
    { quote: "Don't think, but look!", source: 'Philosophical Investigations §66', sourceZh: '《哲学研究》' },
    { quote: 'The meaning of a word is its use in the language.', source: 'Philosophical Investigations §43', sourceZh: '《哲学研究》' },
    { quote: 'Philosophy is a battle against the bewitchment of our intelligence by means of language.', source: 'Philosophical Investigations §109', sourceZh: '《哲学研究》' },
    { quote: 'If a lion could speak, we could not understand him.', source: 'Philosophical Investigations §11', sourceZh: '《哲学研究》' },
    { quote: 'An entire mythology is stored in our language.', source: 'Philosophical Investigations §195', sourceZh: '《哲学研究》' },
  ],
  'elon-musk': [
    { quote: 'When something is important enough, you do it even if the odds are not in your favor.', source: 'Twitter / Interviews' },
    { quote: 'The first step is to establish that something is possible; then probability will occur.', source: 'Twitter / Interviews' },
    { quote: "Some people don't like the idea of questioning the fundamentals. That's what physics is about.", source: 'Twitter / Interviews' },
    { quote: 'Persistence is very important. You should not give up unless you are forced to give up.', source: 'Twitter / Interviews' },
    { quote: 'I could either watch it happen or be part of it. I chose to be part of it.', source: 'Twitter / Interviews' },
  ],
  'steve-jobs': [
    { quote: 'Stay hungry, stay foolish.', source: 'Stanford Commencement Speech, 2005', sourceZh: '斯坦福大学毕业演讲' },
    { quote: 'The people who are crazy enough to think they can change the world are the ones who do.', source: 'Apple Think Different campaign' },
    { quote: 'Design is not just what it looks like and feels like. Design is how it works.', source: 'Interviews' },
    { quote: "Your time is limited, so don't waste it living someone else's life.", source: 'Stanford Commencement Speech, 2005', sourceZh: '斯坦福大学毕业演讲' },
    { quote: 'Innovation distinguishes between a leader and a follower.', source: 'Interviews' },
  ],
  'nassim-taleb': [
    { quote: 'The three most harmful addictions are heroin, carbohydrates, and a monthly salary.', source: 'The Black Swan' },
    { quote: 'Never test the generalizability of a model using the same data you used to fit it.', source: 'Fooled by Randomness' },
    { quote: 'The higher the智商, the lower the sanity bias.', source: 'Twitter / Antifragile' },
    { quote: 'Be robust. Be not just non-fragile. Be anti-fragile.', source: 'Antifragile' },
    { quote: 'What is modern is not the new but the irreversible deterioration of the old.', source: 'The Black Swan' },
  ],
  'charlie-munger': [
    { quote: 'Invert, always invert.', source: "Poor Charlie's Almanack", sourceZh: '《穷查理宝典》' },
    { quote: 'The first rule of compounding: Never interrupt it unnecessarily.', source: "Poor Charlie's Almanack", sourceZh: '《穷查理宝典》' },
    { quote: "I've neveribelieved in Warren's area of genius. But in his own area, no one is better.", source: "Poor Charlie's Almanack", sourceZh: '《穷查理宝典》' },
    { quote: "A lot of people with high智商 have不起作用的思维模型。 That's the tragedy.", source: 'USC Business School, 1994' },
    { quote: 'The best armor of old age is, above all, a past of good actions.', source: "Poor Charlie's Almanack", sourceZh: '《穷查理宝典》' },
  ],
  'jeff-bezos': [
    { quote: 'In the old world, you devoted 30% of time to building a great service and 70% of time to shouting about it. In the new world, that inverts.', source: 'All-Hands Meeting, 2016' },
    { quote: 'Brilliant thinking is rare, but the willingness to listen is not.', source: 'Twitter / Interviews' },
    { quote: "If you can't tolerate critics, don't do anything new or interesting.", source: 'Twitter / Interviews' },
    { quote: "Your brand is what people say about you when you're not in the room.", source: 'Amazon all-hands' },
    { quote: 'We are stubborn on vision, flexible on details.', source: 'Interviews' },
  ],
  'peter-thiel': [
    { quote: 'Competition is for losers.', source: 'Zero to One' },
    { quote: 'Every moment in business happens only once. The next Bill Gates will not build an operating system.', source: 'Zero to One' },
    { quote: 'The best businesses in the world are businesses that nobody has ever done before.', source: 'Zero to One' },
    { quote: 'There is no one correct plan, but there are many possible ones.', source: 'Zero to One' },
  ],
  'ray-dalio': [
    { quote: 'Pain plus reflection equals progress.', source: 'Principles' },
    { quote: 'The biggest threat to success is not failure but the fear of failure.', source: 'Principles' },
    { quote: 'Understand how the machine works, and then change how you operate within it.', source: 'Principles' },
    { quote: 'Think of it as if you are running a movie: you are trying to operate the machine rather than being the machine.', source: 'Principles' },
  ],
};

async function main() {
  const r1 = await pool.query(
    'UPDATE distilled_personas SET "expressionDNA" = $1::jsonb WHERE slug = $2 RETURNING slug',
    [wittEdna, 'wittgenstein']
  );
  console.log('wittgenstein expressionDNA:', r1.rowCount > 0 ? 'OK' : 'NOT FOUND');

  let kqCount = 0;
  for (const [slug, kqArr] of Object.entries(keyQuotesData)) {
    const result = await pool.query(
      'UPDATE distilled_personas SET "keyQuotes" = $1::jsonb WHERE slug = $2 RETURNING slug',
      [JSON.stringify(kqArr), slug]
    );
    if (result.rowCount > 0) {
      console.log(slug + ': keyQuotes OK');
      kqCount++;
    } else {
      console.log(slug + ': NOT FOUND');
    }
  }
  console.log('\nkeyQuotes updates: ' + kqCount + '/' + Object.keys(keyQuotesData).length);
  await pool.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
