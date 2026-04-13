'use client';

/**
 * Prismatic — Cross Perspective Comparison
 * 让任意多位人物对同一问题给出各自的答案
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft,
  GitCompare,
  CheckCircle,
  XCircle,
  Lightbulb,
  RefreshCw,
  Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PersonaInfo {
  id: string;
  name: string;
  nameZh: string;
  avatar: string;
  taglineZh: string;
  domains: string[];
  accentColor: string;
}

const ALL_PERSONAS: PersonaInfo[] = [
  { id: 'steve-jobs', name: 'Steve Jobs', nameZh: '史蒂夫·乔布斯', avatar: '🍎', taglineZh: 'Think Different', domains: ['科技', '产品'], accentColor: '#ff6b6b' },
  { id: 'elon-musk', name: 'Elon Musk', nameZh: '埃隆·马斯克', avatar: '🚀', taglineZh: '让人类成为多星球物种', domains: ['科技', '航天'], accentColor: '#ffd93d' },
  { id: 'charlie-munger', name: 'Charlie Munger', nameZh: '查理·芒格', avatar: '📚', taglineZh: '多元思维模型', domains: ['投资', '思维'], accentColor: '#6bcb77' },
  { id: 'naval-ravikant', name: 'Naval Ravikant', nameZh: '纳瓦尔·拉威康特', avatar: '⚓', taglineZh: '财富与幸福的工程学', domains: ['创业', '哲学'], accentColor: '#4d96ff' },
  { id: 'richard-feynman', name: 'Richard Feynman', nameZh: '理查德·费曼', avatar: '⚛️', taglineZh: '科学即想象', domains: ['物理', '科学'], accentColor: '#c77dff' },
  { id: 'paul-graham', name: 'Paul Graham', nameZh: '保罗·格雷厄姆', avatar: '✍️', taglineZh: 'YC 创始人', domains: ['创业', '技术'], accentColor: '#ff9f43' },
  { id: 'peter-thiel', name: 'Peter Thiel', nameZh: '彼得·蒂尔', avatar: '🧠', taglineZh: '从0到1', domains: ['创业', '哲学'], accentColor: '#a855f7' },
  { id: 'jeff-bezos', name: 'Jeff Bezos', nameZh: '杰夫·贝索斯', avatar: '📦', taglineZh: 'Day 1 心态', domains: ['商业', '战略'], accentColor: '#4d96ff' },
  { id: 'sam-altman', name: 'Sam Altman', nameZh: '萨姆·奥特曼', avatar: '🤖', taglineZh: 'OpenAI CEO', domains: ['AI', '创业'], accentColor: '#10b981' },
  { id: 'ray-dalio', name: 'Ray Dalio', nameZh: '雷·达里奥', avatar: '⚖️', taglineZh: '原则驱动', domains: ['投资', '经济'], accentColor: '#4d96ff' },
  { id: 'warren-buffett', name: 'Warren Buffett', nameZh: '沃伦·巴菲特', avatar: '🎯', taglineZh: '奥马哈先知', domains: ['投资', '商业'], accentColor: '#ffd93d' },
  { id: 'marcus-aurelius', name: 'Marcus Aurelius', nameZh: '马可·奥勒留', avatar: '🛡️', taglineZh: '斯多葛帝王', domains: ['哲学', '领导力'], accentColor: '#c77dff' },
  { id: 'alan-watts', name: 'Alan Watts', nameZh: '阿兰·瓦茨', avatar: '🧘', taglineZh: '禅学西传', domains: ['哲学', '禅学'], accentColor: '#6bcb77' },
  { id: 'einstein', name: 'Albert Einstein', nameZh: '阿尔伯特·爱因斯坦', avatar: '💡', taglineZh: '想象力即一切', domains: ['物理', '思想'], accentColor: '#c77dff' },
  { id: 'confucius', name: 'Confucius', nameZh: '孔子', avatar: '📜', taglineZh: '万世师表', domains: ['哲学', '伦理'], accentColor: '#ff9f43' },
  { id: 'zhang-yiming', name: '张一鸣', nameZh: '张一鸣', avatar: '📱', taglineZh: '字节跳动创始人', domains: ['科技', '商业'], accentColor: '#ff6b6b' },
  { id: 'nassim-taleb', name: 'Nassim Taleb', nameZh: '纳西姆·塔勒布', avatar: '🦅', taglineZh: '反脆弱', domains: ['投资', '风险'], accentColor: '#ffd93d' },
];

function getPersonaById(id: string): PersonaInfo {
  return ALL_PERSONAS.find((p) => p.id === id) ?? ALL_PERSONAS[0];
}

interface ComparisonResult {
  topic: string;
  answers: {
    persona: PersonaInfo;
    answer: string;
    stance: 'pro' | 'con' | 'neutral' | 'synthesis';
    keyPoints: string[];
    memorableQuote: string;
  }[];
  synthesis: string;
  tags: string[];
}

const STANCE_CONFIG = {
  pro: { icon: CheckCircle, label: '支持', color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/20', accent: '#4ade80' },
  con: { icon: XCircle, label: '质疑', color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20', accent: '#f87171' },
  neutral: { icon: GitCompare, label: '中立', color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20', accent: '#60a5fa' },
  synthesis: { icon: GitCompare, label: '综合', color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20', accent: '#c084fc' },
};

const PREMADE_COMPARISONS = [
  { id: 'ai-replace', title: 'AI 会取代人类工作吗？', topic: 'AI 革命在10年内将如何改变就业市场？哪些工作最危险？', personas: ['sam-altman', 'elon-musk', 'warren-buffett'], tags: ['AI', '就业', '未来'] },
  { id: 'startup-advice', title: '创业第一课', topic: '第一次创业最重要的是什么？是找到Product-Market Fit，还是团队，还是融资时机？', personas: ['paul-graham', 'peter-thiel', 'warren-buffett'], tags: ['创业', '投资', '战略'] },
  { id: 'china-us-relations', title: '中美博弈', topic: '中美关系未来10年的走向？脱钩不可避免还是可以通过商业互利避免？', personas: ['ray-dalio', 'peter-thiel', 'warren-buffett'], tags: ['地缘政治', '经济', '全球化'] },
  { id: 'bitcoin-future', title: '比特币的终极命运', topic: '比特币在未来货币体系中的角色：会成为数字黄金，还是最终归零？', personas: ['elon-musk', 'warren-buffett', 'peter-thiel'], tags: ['加密货币', '投资', '金融'] },
  { id: 'meaning-of-life', title: '人生的意义是什么？', topic: '在人工智能时代，「人生意义」这个命题是否还有意义？', personas: ['marcus-aurelius', 'alan-watts', 'steve-jobs'], tags: ['哲学', 'AI', '意义'] },
];

function buildComparison(topic: string, personaIds: string[]): ComparisonResult {
  const answers = personaIds.map((id, i) => {
    const p = getPersonaById(id);
    const stances: ('pro' | 'con' | 'neutral' | 'synthesis')[] = ['pro', 'con', 'neutral', 'synthesis'];
    const stance = stances[i % stances.length];
    const cfg = STANCE_CONFIG[stance];

    const answerTemplates = {
      pro: `面对「${topic.slice(0, 15)}」，${p.nameZh}会首先看到其中的机遇。历史告诉我们，每一次技术革命在短期内确实会带来混乱，但从长远看，它总是创造了比消灭更多的机会。关键在于我们如何适应和拥抱变化，而不是恐惧它。`,
      con: `${p.nameZh}对此持更审慎的态度。我不是说进步不可能，但我必须指出——当前对「${topic.slice(0, 15)}」的主流乐观预期，建立在对历史的部分误读之上。真正的问题在于——谁将承担转型成本？往往不是那些制定乐观预测的人。`,
      neutral: `${p.nameZh}的分析框架是：这个问题不能简单地用「好」或「坏」来回答。它取决于我们讨论的时间尺度、具体语境，以及我们愿意做出什么样的权衡。最好的思考方式不是问「这好不好」，而是问「在什么条件下，这会向好的方向发展？」`,
      synthesis: `${p.nameZh}提出了一个整合视角：「好」与「坏」在这个议题中并非二元对立。它们在一定条件下可以相互转化。真正需要培养的智慧，不是非此即彼的选择，而是理解「在何时、何种条件下」应该偏向哪一端的动态判断能力。`,
    };

    const quoteTemplates = {
      pro: '真正的风险不是做错了什么，而是不敢去尝试。',
      con: '大家都对的地方，往往最值得怀疑。',
      neutral: '重要的不是你相信什么，而是你是否理解自己为什么相信。',
      synthesis: '最伟大的洞察往往在看似对立的两极之间。',
    };

    return {
      persona: p,
      answer: answerTemplates[stance],
      stance,
      keyPoints: [
        `从${p.domains[0] || '核心'}视角切入`,
        '长期视角下的价值判断',
        '关注结构性变化',
      ],
      memorableQuote: quoteTemplates[stance],
    };
  });

  const names = answers.map((a) => a.persona.nameZh).join('、');

  return {
    topic,
    answers,
    synthesis: `从${names}的不同视角来看，「${topic}」这个问题没有简单的答案。每个人基于自己的经验和领域背景，给出了不同的切入点和分析框架。跨视角思考的价值不在于找到一个「正确答案」，而在于理解问题的全貌——当你同时理解「支持」「质疑」「中立」三种立场时，你对这个问题的理解就远超只持有单一观点的人了。`,
    tags: answers.slice(0, 2).flatMap((a) => a.persona.domains).slice(0, 3),
  };
}

function AnswerCard({ result, index }: { result: ComparisonResult['answers'][0]; index: number }) {
  const cfg = STANCE_CONFIG[result.stance];
  const Icon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.15 }}
      className={cn('rounded-2xl border bg-bg-surface overflow-hidden', cfg.border)}
    >
      <div className={cn('px-5 py-4 border-b flex items-center gap-3', cfg.border)}>
        <div className="w-9 h-9 rounded-lg bg-bg-surface border border-border-subtle flex items-center justify-center text-lg flex-shrink-0">
          {result.persona.avatar}
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm text-text-primary">{result.persona.nameZh}</p>
          <p className="text-xs text-text-muted">{result.persona.taglineZh}</p>
        </div>
        <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', cfg.bg, cfg.color)}>
          <Icon className="w-3.5 h-3.5" />
          {cfg.label}
        </div>
      </div>

      <div className="p-5 space-y-3">
        <p className="text-sm text-text-secondary leading-relaxed">{result.answer}</p>
        <div className="space-y-1.5">
          {result.keyPoints.map((point, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-text-secondary">
              <div className="w-1 h-1 rounded-full bg-text-muted mt-1.5 flex-shrink-0" />
              {point}
            </div>
          ))}
        </div>
        <div className={cn('rounded-lg p-3 border', cfg.border)}>
          <p className="text-xs text-text-muted italic">&ldquo;{result.memorableQuote}&rdquo;</p>
          <p className="text-xs text-text-muted mt-1">— {result.persona.nameZh}</p>
        </div>
      </div>
    </motion.div>
  );
}

export default function ComparePage() {
  const [selected, setSelected] = useState<string[]>(['steve-jobs', 'elon-musk']);
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);

  const togglePersona = (id: string) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.length > 2 ? prev.filter((p) => p !== id) : prev
        : prev.length < 4 ? [...prev, id] : prev
    );
  };

  const runPremade = (comp: typeof PREMADE_COMPARISONS[0]) => {
    setIsGenerating(true);
    setTopic(comp.topic);
    setSelected(comp.personas);
    setTimeout(() => {
      setResult(buildComparison(comp.topic, comp.personas));
      setIsGenerating(false);
    }, 2000);
  };

  const runCustom = () => {
    if (selected.length < 2 || !topic.trim()) return;
    setIsGenerating(true);
    setTimeout(() => {
      setResult(buildComparison(topic, selected));
      setIsGenerating(false);
    }, 2000);
  };

  if (result) {
    return (
      <div className="min-h-screen bg-bg-base">
        <header className="sticky top-0 z-50 glass border-b border-border-subtle">
          <div className="max-w-4xl mx-auto px-6 h-16 flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">返回</span>
            </Link>
            <div className="w-px h-5 bg-border-subtle" />
            <div className="flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-prism-blue" />
              <span className="font-display font-semibold">跨视角对比</span>
            </div>
          </div>
        </header>
        <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-prism-blue/10 border border-prism-blue/20 text-prism-blue text-xs mb-3">
              <GitCompare className="w-3 h-3" />
              跨视角对比
            </div>
            <h2 className="text-xl font-display font-bold text-text-primary mb-2">{result.topic}</h2>
            <div className="flex flex-wrap justify-center gap-2">
              {result.tags.map((tag) => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-bg-elevated text-text-muted border border-border-subtle">{tag}</span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.answers.map((answer, i) => (
              <AnswerCard key={answer.persona.id} result={answer} index={i} />
            ))}
          </div>

          <div className="rounded-2xl border border-prism-amber/30 bg-gradient-to-br from-prism-amber/5 to-bg-elevated p-6">
            <h3 className="text-sm font-medium text-prism-amber mb-3 flex items-center gap-2">
              <Lightbulb className="w-4 h-4" />
              综合洞见
            </h3>
            <p className="text-sm text-text-secondary leading-relaxed">{result.synthesis}</p>
          </div>

          <div className="text-center">
            <button onClick={() => { setResult(null); setTopic(''); }} className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors">
              <RefreshCw className="w-4 h-4" />
              换一组人物对比
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-base">
      <header className="sticky top-0 z-50 glass border-b border-border-subtle">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">返回</span>
          </Link>
          <div className="w-px h-5 bg-border-subtle" />
          <div className="flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-prism-blue" />
            <span className="font-display font-semibold">跨视角对比</span>
          </div>
        </div>
      </header>

      <section className="pt-16 pb-12 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-prism-blue/10 border border-prism-blue/20 mb-6">
            <GitCompare className="w-8 h-8 text-prism-blue" />
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold mb-3">
            同一个问题
            <span className="gradient-text"> 不同大脑的回答</span>
          </h1>
          <p className="text-text-secondary max-w-lg mx-auto">
            选择一个话题，让多位思想家同时给出各自的答案。没有任何两个伟大头脑会以完全相同的方式看待世界——而这种差异本身就是智慧。
          </p>
        </div>
      </section>

      <section className="px-6 pb-20">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Pre-made */}
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-4 flex items-center gap-2">
              <Play className="w-4 h-4 text-prism-blue" />
              精选话题
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {PREMADE_COMPARISONS.map((comp) => (
                <motion.button
                  key={comp.id}
                  onClick={() => runPremade(comp)}
                  className="text-left rounded-2xl border border-border-subtle bg-bg-elevated p-5 hover:border-border-medium transition-all"
                >
                  <h4 className="font-semibold text-sm text-text-primary mb-1">{comp.title}</h4>
                  <p className="text-xs text-text-muted mb-3">{comp.topic.slice(0, 30)}...</p>
                  <div className="flex -space-x-1.5">
                    {comp.personas.map((id) => {
                      const p = getPersonaById(id);
                      return (
                        <div key={id} className="w-7 h-7 rounded-lg bg-bg-surface border-2 border-bg-elevated flex items-center justify-center text-xs">{p.avatar}</div>
                      );
                    })}
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Custom */}
          <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6">
            <h3 className="text-sm font-medium text-text-secondary mb-4 flex items-center gap-2">
              <GitCompare className="w-4 h-4" />
              自定义对比
            </h3>

            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-text-muted">选择 2-4 位人物</label>
                <span className="text-xs text-text-muted">{selected.length}/4 已选</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {ALL_PERSONAS.map((p) => {
                  const is = selected.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => togglePersona(p.id)}
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-all',
                        is
                          ? 'bg-prism-blue/20 border-prism-blue/40 text-prism-blue'
                          : 'bg-bg-elevated border-border-subtle text-text-muted hover:text-text-secondary'
                      )}
                    >
                      <span className="text-sm">{p.avatar}</span>
                      {p.nameZh}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-5">
              <label className="text-xs text-text-muted mb-2 block">选择一个你关心的问题</label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="例如：普通人应该如何为 AI 时代做准备？"
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl bg-bg-elevated border border-border-subtle text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-prism-blue resize-none"
              />
            </div>

            <button
              onClick={runCustom}
              disabled={selected.length < 2 || !topic.trim() || isGenerating}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-prism-gradient text-white font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {isGenerating ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 正在生成对比分析...</>
              ) : (
                <><GitCompare className="w-4 h-4" /> 生成跨视角对比</>
              )}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
