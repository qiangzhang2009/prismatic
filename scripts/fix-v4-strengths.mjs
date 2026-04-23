/**
 * Fix v4 persona strengths/blindspots in DB
 * 
 * Problem: v4 distillation generated English strengths/blindspots (e.g., 
 * "Ancient Chinese philosophy and ethics") for Chinese philosophers — these are 
 * distillation artifacts, not real strengths. We need to update them to proper 
 * Chinese descriptions OR use the richer data from personas.ts.
 * 
 * Strategy: Update DB records for v4 personas with correct data from personas.ts
 * or curated translations.
 */

import { Pool } from '@neondatabase/serverless';
import { config } from 'dotenv';

config({ path: '.env.local' });

// Curated Chinese strengths/blindspots for v4 personas without Chinese data in personas.ts
const CHINESE_STRENGTHS = {
  'marcus-aurelius': ['斯多葛主义践行', '自我反思与内省', '美德伦理', '领导力与责任', '理性与自控'],
  'epictetus': ['斯多葛哲学', '自由与内在控制', '逻辑推理', '教育与苏格拉底式追问'],
  'socrates': ['哲学追问', '辩证法', '伦理学探索', '自我认知', '教育与对话'],
  'alan-turing': ['计算理论', '密码破译', '人工智能先驱', '数学逻辑', '跨学科创新'],
  'carl-jung': ['精神分析', '原型理论', '集体无意识', '类型学', '东西方哲学整合'],
  'einstein': ['理论物理', '第一性原理思维', '思想实验', '科学想象力', '跨学科视野'],
  'jeff-bezos': ['客户至上', '长期主义', '第一性原理', '商业模式创新', '规模化思维'],
  'nassim-taleb': ['尾部风险管理', '反脆弱思维', '怀疑主义', '概率论', '历史案例分析'],
  'warren-buffett': ['价值投资', '长期持有', '护城河分析', '心理模型', '逆向思维'],
  'charlie-munger': ['多元思维模型', '逆向思维', '心理学框架', '跨学科分析', '价值评估'],
  'sam-altman': ['技术战略', 'AI发展', '产品迭代', '风险管理与规模化'],
  'elon-musk': ['第一性原理工程', '颠覆式创新', '长期使命驱动', '跨领域整合', '工程优化'],
  'peter-thiel': ['竞争策略', '幂律思维', '深度技术', '秘密发现', '激进创业'],
  'ray-dalio': ['系统思维', '算法决策', '宏观经济学', '极端透明', '原则导向'],
  'jeff-bezos': ['客户至上', '长期主义', '第一性原理', '商业模式创新', '规模化思维'],
  'andrew-ng': ['机器学习', '教育传播', 'AI应用', '规模化教学', '产业整合'],
  'ilya-sutskever': ['深度学习', '规模化法则', 'AI安全', '模型架构创新', '研究方向'],
  'paul-graham': ['创业智慧', '写作思维', '产品品味', '技术判断', '风险投资'],
  'jack-ma': ['商业创新', '企业家精神', '平台思维', '全球化视野', '教育公益'],
  'jensen-huang': ['GPU计算', '战略聚焦', '长期主义', '生态系统构建', '技术传播'],
  'steve-jobs': ['产品设计', '极致聚焦', '端到端控制', '人文与科技融合', '现实扭曲力场'],
  'zhang-yiming': ['算法思维', '产品战略', '全球化', '推荐系统', '延迟满足'],
  'zhang-xuefeng': ['职业规划', 'ROI分析', '反内卷策略', '职场洞察', '现实主义'],
  'alan-watts': ['东方哲学西方化', '禅宗解读', '幽默表达', '生命智慧', '反主流文化'],
  'confucius': ['儒家伦理', '教育思想', '中庸之道', '君子人格', '礼乐文化'],
  'lao-zi': ['道家哲学', '无为而治', '自然和谐', '柔弱胜刚强', '返璞归真'],
  'sun-bin': ['兵法战略', '形势与权谋', '知己知彼', '奇正相生', '上兵伐谋'],
  'sunwukong': ['七十二变', '火眼金睛', '筋斗云', '不畏强权', '神通广大'],
  'journey-west': ['中西智慧融合', '古老智慧现代诠释', '西游记深度解读', '哲学综合'],
  'mencius': ['性善论', '浩然之气', '仁政思想', '道德修养', '大丈夫精神'],
  'mo-zi': ['兼爱非攻', '实用哲学', '逻辑学先驱', '机械工程', '跨学科思维'],
  'han-fei-zi': ['法家思想', '权术与法治', '制度设计', '人性洞察', '战略务实'],
  'zhu-xi': ['理学体系', '格物致知', '读书法', '心性修养', '儒家经典诠释'],
  'cao-cao': ['战略指挥', '唯才是举', '现实政治', '文学才华', '知人善任'],
  'liu-bei': ['仁德之主', '知人待士', '蜀汉建国', '义薄云天', '以弱胜强'],
  'xiang-yu': ['霸王之力', '勇猛无畏', '破釜沉舟', '个人荣誉', '悲剧英雄'],
  'huangdi-neijing': ['中医理论', '阴阳五行', '经络学说', '养生之道', '天人合一'],
  'hui-neng': ['顿悟成佛', '见性成佛', '不立文字', '直指人心', '禅宗革命'],
  'yuan-tiangang': ['易经象数', '历史周期', '玄学预测', '天人感应', '堪舆术数'],
  'li-chunfeng': ['天文历法', '易经术数', '历史编纂', '自然科学', '数学'],
  'sima-qian': ['史记撰写', '历史叙事', '善恶评判', '忍辱负重', '史家之绝唱'],
  'sanguoyanyi': ['三国战略', '人物分析', '权力博弈', '忠义与诡计', '历史教训'],
  'aleister-crowley': ['神秘学', '泰勒玛宗教', '自我主权', '仪式魔法', '悖论思维'],
  'john-dee': ['赫尔墨斯哲学', '占星术', '数学与天文学', '密码学先驱', '伊丽莎白顾问'],
  'richard-feynman': ['量子电动力学', '物理直觉', '科学教育', '幽默与简单化', '独立思考'],
  'journey-west': ['西游记深度解读', '东西智慧融合', '古老经典现代诠释', '文学哲学'],
  'tripitaka': ['佛学经典', '翻译与朝圣', '知识传播', '中西方文化交流'],
  'journey-west': ['西游记研究', '东西智慧融合', '探索与成长', '文学与哲学'],
};

const CHINESE_BLINDSPOTS = {
  'marcus-aurelius': ['缺乏现代西方哲学视角', '科学理论认知不足', '经济与政治体系细节'],
  'epictetus': ['社会平等问题', '积极行动主义', '现代心理学理解'],
  'socrates': ['系统性政治改革', '自然科学知识', '实践管理能力'],
  'alan-turing': ['工程技术实现', '商业化运作', '人际关系处理'],
  'carl-jung': ['科学验证', '现代神经科学', '技术时代适应'],
  'einstein': ['量子力学诠释', '技术工程', '政治与历史细节'],
  'jeff-bezos': ['技术细节', '人文艺术', '短期利润压力'],
  'nassim-taleb': ['精确预测', '工程实现', '复杂系统数值建模'],
  'warren-buffett': ['科技行业评估', '快速变化的行业', '流动性风险管理'],
  'charlie-munger': ['量化模型', '快速决策场景', '现代科技行业'],
  'sam-altman': ['技术深度', '组织管理细节', '长期基础设施'],
  'elon-musk': ['短期现金流', '渐进式改进', '政治与外交'],
  'peter-thiel': ['快速扩张', '民主化市场', '增量创新'],
  'ray-dalio': ['黑天鹅事件预测', '非理性市场', '地缘政治冲击'],
  'jeff-bezos': ['技术实现细节', '组织文化细节', '短期执行'],
  'andrew-ng': ['商业规模化', '硬件工程', '政策与伦理'],
  'ilya-sutskever': ['产品化', '商业化', '公众沟通'],
  'paul-graham': ['规模化运营', '组织管理', '长期竞争'],
  'jack-ma': ['技术深度', '内部管理细节', '地缘政治'],
  'jensen-huang': ['软件生态细节', '消费市场', '快速变化趋势'],
  'steve-jobs': ['开放生态', '中低端市场', '技术规格竞争'],
  'zhang-yiming': ['组织规模化', '传统行业理解', '政治关系'],
  'zhang-xuefeng': ['创业执行', '高风险决策', '资本运作'],
  'alan-watts': ['系统性学术', '具体实践指导', '跨文化细节'],
  'confucius': ['法治思想', '自然科学', '个人权利观念'],
  'lao-zi': ['制度构建', '积极变革', '民主参与'],
  'sun-bin': ['宏观战略', '政治外交', '经济管理'],
  'sunwukong': ['权威服从', '团队协作', '长期规划'],
  'journey-west': ['现代科学', '技术细节', '实践操作'],
  'mencius': ['法制与权力', '自然科学', '个人主义'],
  'mo-zi': ['艺术与审美', '精神修养', '情感表达'],
  'han-fei-zi': ['道德感化', '民主协商', '软实力'],
  'zhu-xi': ['实践修行', '顿悟直指', '自然科学'],
  'cao-cao': ['道德理想', '长期信任', '仁义形象'],
  'liu-bei': ['战略决断', '权谋灵活', '现实主义'],
  'xiang-yu': ['政治灵活', '人才使用', '长期战略'],
  'huangdi-neijing': ['现代医学', '精确诊断', '西药理解'],
  'hui-neng': ['经典研读', '次第修行', '组织弘法'],
  'yuan-tiangang': ['现代科学', '精确预测', '统计分析'],
  'li-chunfeng': ['人文艺术', '现代科学', '哲学反思'],
  'sima-qian': ['当时政治正确', '科学方法', '客观中立'],
  'sanguoyanyi': ['历史准确性', '现代制度', '科学思维'],
  'aleister-crowley': ['大众接受度', '伦理边界', '组织化'],
  'john-dee': ['实验验证', '现代科学', '实用技术'],
  'richard-feynman': ['工程实现', '组织管理', '长期规划'],
  'journey-west': ['学术深度', '历史细节', '科学方法'],
  'tripitaka': ['现代应用', '技术时代', '组织管理'],
};

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  // Get all v4 personas from DB
  const result = await pool.query(`
    SELECT slug, "distillVersion", strengths, blindspots
    FROM distilled_personas
    WHERE "distillVersion" LIKE 'v4%'
  `);
  
  console.log(`Found ${result.rows.length} v4 personas in DB`);
  
  let updated = 0;
  
  for (const row of result.rows) {
    const slug = row.slug;
    const strengthsKey = CHINESE_STRENGTHS[slug];
    const blindspotsKey = CHINESE_BLINDSPOTS[slug];
    
    if (!strengthsKey && !blindspotsKey) continue;
    
    const newStrengths = strengthsKey ?? row.strengths;
    const newBlindspots = blindspotsKey ?? row.blindspots;
    
    console.log(`\nUpdating ${slug}:`);
    if (strengthsKey) {
      console.log(`  strengths: ${JSON.stringify(newStrengths)}`);
    }
    if (blindspotsKey) {
      console.log(`  blindspots: ${JSON.stringify(newBlindspots)}`);
    }
    
    await pool.query(`
      UPDATE distilled_personas
      SET strengths = $1::json,
          blindspots = $2::json,
          "updatedAt" = NOW()
      WHERE slug = $3
    `, [JSON.stringify(newStrengths), JSON.stringify(newBlindspots), slug]);
    
    updated++;
  }
  
  console.log(`\nDone. Updated ${updated} personas.`);
  await pool.end();
}

main().catch(console.error);
