'use client';

/**
 * Prismatic — Clash Arena
 * 「关公战秦琼」：让任意两个历史/现代人物跨越时空辩论
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft,
  Swords,
  Play,
  RefreshCw,
  Shield,
  ChevronDown,
  BookOpen,
  Lightbulb,
  CheckCircle2,
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
  { id: 'peter-thiel', name: 'Peter Thiel', nameZh: '彼得·蒂尔', avatar: '🧠', taglineZh: '从0到1', domains: ['创业', '哲学'], accentColor: '#1e1e3f' },
  { id: 'jeff-bezos', name: 'Jeff Bezos', nameZh: '杰夫·贝索斯', avatar: '📦', taglineZh: 'Day 1 心态', domains: ['商业', '战略'], accentColor: '#4d96ff' },
  { id: 'sam-altman', name: 'Sam Altman', nameZh: '萨姆·奥特曼', avatar: '🤖', taglineZh: 'OpenAI CEO', domains: ['AI', '创业'], accentColor: '#10b981' },
  { id: 'ray-dalio', name: 'Ray Dalio', nameZh: '雷·达里奥', avatar: '⚖️', taglineZh: '原则驱动', domains: ['投资', '经济'], accentColor: '#4d96ff' },
  { id: 'warren-buffett', name: 'Warren Buffett', nameZh: '沃伦·巴菲特', avatar: '🎯', taglineZh: '奥马哈先知', domains: ['投资', '商业'], accentColor: '#ffd93d' },
  { id: 'marcus-aurelius', name: 'Marcus Aurelius', nameZh: '马可·奥勒留', avatar: '🛡️', taglineZh: '斯多葛帝王', domains: ['哲学', '领导力'], accentColor: '#c77dff' },
  { id: 'alan-watts', name: 'Alan Watts', nameZh: '阿兰·瓦茨', avatar: '🧘', taglineZh: '禅学西传', domains: ['哲学', '禅学'], accentColor: '#6bcb77' },
  { id: 'einstein', name: 'Albert Einstein', nameZh: '阿尔伯特·爱因斯坦', avatar: '💡', taglineZh: '想象力即一切', domains: ['物理', '思想'], accentColor: '#c77dff' },
  { id: 'confucius', name: 'Confucius', nameZh: '孔子', avatar: '📜', taglineZh: '万世师表', domains: ['哲学', '伦理'], accentColor: '#ff9f43' },
  { id: 'laozi', name: 'Laozi', nameZh: '老子', avatar: '☯️', taglineZh: '道法自然', domains: ['哲学', '道家'], accentColor: '#6bcb77' },
  { id: 'zhang-yiming', name: '张一鸣', nameZh: '张一鸣', avatar: '📱', taglineZh: '字节跳动创始人', domains: ['科技', '商业'], accentColor: '#ff6b6b' },
  { id: 'nassim-taleb', name: 'Nassim Taleb', nameZh: '纳西姆·塔勒布', avatar: '🦅', taglineZh: '反脆弱', domains: ['投资', '风险'], accentColor: '#ffd93d' },
];

interface PreMadeClash {
  id: string;
  title: string;
  subtitle: string;
  topic: string;
  personaAId: string;
  personaBId: string;
}

const PREMADE_CLASHES: PreMadeClash[] = [
  {
    id: 'jobs-vs-bezos',
    title: '乔布斯 vs 贝索斯',
    subtitle: '产品主义 vs 用户至上',
    topic: '「用户体验」与「客户至上」哪个是商业世界的终极奥义？',
    personaAId: 'steve-jobs',
    personaBId: 'jeff-bezos',
  },
  {
    id: 'dalio-vs-thiel',
    title: '达里奥 vs 彼得·蒂尔',
    subtitle: '原则驱动 vs 秘密驱动',
    topic: '成功是因为遵循原则，还是因为发现了别人忽视的秘密？',
    personaAId: 'ray-dalio',
    personaBId: 'peter-thiel',
  },
  {
    id: 'buffett-vs-munger',
    title: '巴菲特 vs 芒格',
    subtitle: '价值投资双雄',
    topic: '在别人恐惧时贪婪，在别人贪婪时恐惧。哪个更难做到？',
    personaAId: 'warren-buffett',
    personaBId: 'charlie-munger',
  },
  {
    id: 'musk-vs-altman',
    title: '马斯克 vs 奥特曼',
    subtitle: 'AI 安全两极',
    topic: 'AI 发展应该加速还是谨慎？开源是人类的希望还是灾难？',
    personaAId: 'elon-musk',
    personaBId: 'sam-altman',
  },
  {
    id: 'graham-vs-thiel',
    title: '格雷厄姆 vs 蒂尔',
    subtitle: 'Startup 两种哲学',
    topic: '创业公司应该快速迭代 MVP，还是一开始就做不可能的事？',
    personaAId: 'paul-graham',
    personaBId: 'peter-thiel',
  },
  {
    id: 'feynman-vs-einstein',
    title: '费曼 vs 爱因斯坦',
    subtitle: '直觉 vs 严谨',
    topic: '真正的科学突破来自大胆的直觉猜想，还是严谨的数学推演？',
    personaAId: 'richard-feynman',
    personaBId: 'einstein',
  },
];

function getPersonaById(id: string): PersonaInfo {
  return ALL_PERSONAS.find((p) => p.id === id) ?? ALL_PERSONAS[0];
}

interface ClashResult {
  topic: string;
  personaA: PersonaInfo;
  personaB: PersonaInfo;
  openingA: string;
  openingB: string;
  rounds: { speaker: 'A' | 'B'; text: string; reasoning: string }[];
  summary: string;
  winner?: 'A' | 'B' | 'tie';
}

function PersonaAvatar({ persona, size = 'md' }: { persona: PersonaInfo; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-8 h-8 text-sm', md: 'w-12 h-12 text-lg', lg: 'w-16 h-16 text-2xl' };
  return (
    <div className={cn('rounded-xl bg-gradient-to-br from-bg-surface to-bg-elevated border border-border-subtle flex items-center justify-center flex-shrink-0', sizes[size])}>
      <span>{persona.avatar}</span>
    </div>
  );
}

function ClashResultCard({ result }: { result: ClashResult }) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      {/* Topic */}
      <div className="text-center py-6 border-b border-border-subtle">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-prism-orange/10 border border-prism-orange/20 text-prism-orange text-xs mb-3">
          <Swords className="w-3 h-3" />
          辩论主题
        </div>
        <h2 className="text-xl font-display font-bold text-text-primary mb-2">{result.topic}</h2>
        <div className="flex items-center justify-center gap-3 text-sm text-text-muted">
          <PersonaAvatar persona={result.personaA} size="sm" />
          <span className="font-medium text-text-secondary">{result.personaA.nameZh}</span>
          <Swords className="w-4 h-4 text-prism-orange" />
          <span className="font-medium text-text-secondary">{result.personaB.nameZh}</span>
          <PersonaAvatar persona={result.personaB} size="sm" />
        </div>
      </div>

      {/* Opening statements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[{ p: result.personaA, text: result.openingA }, { p: result.personaB, text: result.openingB }].map(({ p, text }, i) => (
          <div key={i} className={cn('rounded-2xl border bg-bg-surface p-5', i === 0 ? 'border-l-4 border-l-prism-blue border-border-subtle' : 'border-r-4 border-r-prism-purple border-border-subtle')}>
            <div className="flex items-center gap-3 mb-3">
              <PersonaAvatar persona={p} size="md" />
              <div>
                <p className="font-medium text-sm text-text-primary">{p.nameZh}</p>
                <p className="text-xs text-text-muted">开场陈词</p>
              </div>
            </div>
            <p className="text-sm text-text-secondary italic leading-relaxed">&ldquo;{text}&rdquo;</p>
          </div>
        ))}
      </div>

      {/* Debate rounds */}
      <div>
        <h3 className="text-sm font-medium text-text-secondary mb-3 flex items-center gap-2">
          <BookOpen className="w-4 h-4" />
          辩论交锋
        </h3>
        <div className="space-y-3">
          {result.rounds.map((round, i) => {
            const p = round.speaker === 'A' ? result.personaA : result.personaB;
            const open = expanded === i;
            return (
              <div key={i} className={cn('rounded-xl border transition-all', round.speaker === 'A' ? 'border-l-4 border-l-prism-blue border-border-subtle' : 'border-r-4 border-r-prism-purple border-border-subtle', open ? 'bg-bg-surface' : 'bg-bg-elevated')}>
                <button className="w-full flex items-center gap-3 p-4 text-left" onClick={() => setExpanded(open ? null : i)}>
                  <PersonaAvatar persona={p} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-text-primary">{p.nameZh}</p>
                    <p className="text-xs text-text-muted line-clamp-1">{round.text.slice(0, 60)}...</p>
                  </div>
                  <ChevronDown className={cn('w-4 h-4 text-text-muted flex-shrink-0 transition-transform', open && 'rotate-180')} />
                </button>
                <AnimatePresence>
                  {open && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="px-4 pb-4 border-t border-border-subtle pt-3 space-y-3 overflow-hidden">
                      <p className="text-sm text-text-secondary leading-relaxed">{round.text}</p>
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-bg-base border border-border-subtle">
                        <Lightbulb className="w-3.5 h-3.5 text-prism-amber flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-text-muted">{round.reasoning}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-2xl border border-border-subtle bg-gradient-to-br from-bg-surface to-bg-elevated p-6">
        <h3 className="text-sm font-medium text-text-secondary mb-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-prism-green" />
          综合结论
        </h3>
        <p className="text-sm text-text-secondary leading-relaxed">{result.summary}</p>
      </div>

      <div className="text-center pt-2">
        <button onClick={() => window.location.reload()} className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors">
          <RefreshCw className="w-4 h-4" />
          换一组辩论
        </button>
      </div>
    </motion.div>
  );
}

function buildClashResult(topic: string, pA: PersonaInfo, pB: PersonaInfo): ClashResult {
  return {
    topic,
    personaA: pA,
    personaB: pB,
    openingA: `${pA.nameZh}的开场白：这个问题触及了一个根本性的命题。在我的经验中，答案往往取决于我们是否愿意直面一个不舒适的事实——关于「${topic.slice(0, 10)}」这个话题，真正重要的是...`,
    openingB: `${pB.nameZh}则完全不同意这种思路。我要说的是：你们刚才讨论的那个框架本身就有问题。真正的答案藏在被忽视的角落里——大多数人不愿意面对的地方，才是答案真正存在的地方。`,
    rounds: [
      { speaker: 'A', text: `${pA.nameZh}的回应：你的批评有一定道理，但你忽略了一个关键因素。在我研究的${pA.domains[0] || '这个领域'}案例中，真正有效的策略都遵循了一个基本规律——而你的反驳恰好证明了你对这个规律的理解还不够深刻。`, reasoning: `${pA.nameZh}的论证方式：从自身经验出发，以「我见过足够多案例」作为论据的基础。` },
      { speaker: 'B', text: `${pB.nameZh}直接反击：你说「我见过足够多」？历史上最灾难性的决策，往往都是那些「经验丰富」的人做出的。他们的经验告诉他们应该怎么做——但恰恰是这种自信，毁掉了一切。我想用一个词来描述你刚才的逻辑：过度拟合。`, reasoning: `${pB.nameZh}的论证方式：用极端反例否定对方的前提，而非正面论证。` },
      { speaker: 'A', text: `${pA.nameZh}承认这一点的价值，但提出反驳：好，你的批评让我重新思考了边界条件。但我想说的是——你的「过度拟合」批评本身也值得质疑。你举的那些灾难性案例，到底是因为「经验太多」还是因为「没有原则」？这两件事是不同的。`, reasoning: `高段位辩手的特点：在承认部分正确的同时，寻找对方论证的「前提条件缺失」。` },
      { speaker: 'B', text: `${pB.nameZh}总结：那么我们也许在这一点上达成了一致——不是「经验」vs「理论」，而是「有原则的经验」vs「无原则的经验」。但我要补充最后一点：这个「原则」本身从何而来？它不是来自你的领域经验，而是来自对「你自己的假设」的质疑。`, reasoning: `${pB.nameZh}的苏格拉底式追问：回到「第一性原理」层面的思考。` },
    ],
    summary: `${pA.nameZh}与${pB.nameZh}展现了两种互补的智慧传统：前者强调从经验中提炼原则并坚守之，后者强调对任何原则的前提进行质疑。这场辩论的核心洞见是——最伟大的思考者既不是纯粹的经验主义者，也不是纯粹的怀疑论者，而是那些能够在「坚持原则」与「质疑原则」之间找到动态平衡的人。这种平衡本身，就是智慧。`,
    winner: 'tie',
  };
}

export default function ClashPage() {
  const [clashResult, setClashResult] = useState<ClashResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedA, setSelectedA] = useState<string>('steve-jobs');
  const [selectedB, setSelectedB] = useState<string>('jeff-bezos');
  const [customTopic, setCustomTopic] = useState('');

  const runPremadeClash = (clash: PreMadeClash) => {
    setIsGenerating(true);
    setTimeout(() => {
      const pA = getPersonaById(clash.personaAId);
      const pB = getPersonaById(clash.personaBId);
      setClashResult(buildClashResult(clash.topic, pA, pB));
      setIsGenerating(false);
    }, 2000);
  };

  const runCustomClash = () => {
    if (!customTopic.trim()) return;
    setIsGenerating(true);
    setTimeout(() => {
      const pA = getPersonaById(selectedA);
      const pB = getPersonaById(selectedB);
      setClashResult(buildClashResult(customTopic, pA, pB));
      setIsGenerating(false);
    }, 2000);
  };

  if (clashResult) {
    return (
      <div className="min-h-screen bg-bg-base">
        <header className="sticky top-0 z-50 glass border-b border-border-subtle">
          <div className="max-w-3xl mx-auto px-6 h-16 flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">返回</span>
            </Link>
            <div className="w-px h-5 bg-border-subtle" />
            <div className="flex items-center gap-2">
              <Swords className="w-5 h-5 text-prism-orange" />
              <span className="font-display font-semibold">关公战秦琼</span>
            </div>
          </div>
        </header>
        <div className="max-w-3xl mx-auto px-6 py-10">
          <ClashResultCard result={clashResult} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-base">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border-subtle">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">返回</span>
          </Link>
          <div className="w-px h-5 bg-border-subtle" />
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-prism-orange" />
            <span className="font-display font-semibold">关公战秦琼</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-16 pb-12 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-prism-orange/10 border border-prism-orange/20 mb-6">
            <Swords className="w-8 h-8 text-prism-orange" />
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold mb-3">
            让历史人物
            <span className="gradient-text"> 跨越时空辩论</span>
          </h1>
          <p className="text-text-secondary max-w-lg mx-auto">
            芒格 vs 巴菲特、乔布斯 vs 贝索斯、马斯克 vs 奥特曼……让人类历史上最聪明的大脑，为你正面交锋、激烈碰撞。
          </p>
          <div className="inline-flex items-center gap-2 text-xs text-text-muted mt-3">
            <Shield className="w-3.5 h-3.5" />
            仅供教育娱乐目的 · AI 生成不代表真实人物观点
          </div>
        </div>
      </section>

      <section className="px-6 pb-20">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Pre-made clashes */}
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-4 flex items-center gap-2">
              <Swords className="w-4 h-4 text-prism-orange" />
              精选对决
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {PREMADE_CLASHES.map((clash) => {
                const pA = getPersonaById(clash.personaAId);
                const pB = getPersonaById(clash.personaBId);
                return (
                  <motion.button
                    key={clash.id}
                    onClick={() => runPremadeClash(clash)}
                    className="text-left rounded-2xl border border-border-subtle bg-bg-elevated p-5 hover:border-border-medium transition-all group"
                    whileHover={{ y: -2 }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex -space-x-2">
                        <div className="w-8 h-8 rounded-lg bg-bg-surface border-2 border-bg-elevated flex items-center justify-center text-sm">{pA.avatar}</div>
                        <div className="w-8 h-8 rounded-lg bg-bg-surface border-2 border-bg-elevated flex items-center justify-center text-sm">{pB.avatar}</div>
                      </div>
                      <Swords className="w-5 h-5 text-prism-orange" />
                    </div>
                    <h3 className="font-semibold text-sm text-text-primary mb-0.5">{clash.title}</h3>
                    <p className="text-xs text-text-muted mb-3">{clash.subtitle}</p>
                    <p className="text-xs text-text-secondary italic line-clamp-2 mb-3">&ldquo;{clash.topic}&rdquo;</p>
                    <div className="flex items-center justify-center gap-2 py-1.5 rounded-lg bg-prism-orange/10 text-prism-orange text-xs font-medium">
                      <Swords className="w-3.5 h-3.5" />
                      开始辩论
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Custom clash */}
          <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6">
            <h3 className="text-sm font-medium text-text-secondary mb-4 flex items-center gap-2">
              <Play className="w-4 h-4 text-prism-blue" />
              自定义对决
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs text-text-muted mb-2 block">辩手 A</label>
                <select value={selectedA} onChange={(e) => setSelectedA(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-bg-elevated border border-border-subtle text-text-primary text-sm focus:outline-none focus:border-prism-blue">
                  {ALL_PERSONAS.filter((p) => p.id !== selectedB).map((p) => (
                    <option key={p.id} value={p.id}>{p.avatar} {p.nameZh}</option>
                  ))}
                </select>
                {(() => { const p = getPersonaById(selectedA); return (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-lg">{p.avatar}</span>
                    <div>
                      <p className="text-xs font-medium text-text-primary">{p.nameZh}</p>
                      <p className="text-[10px] text-text-muted">{p.taglineZh}</p>
                    </div>
                  </div>
                ); })()}
              </div>

              <div>
                <label className="text-xs text-text-muted mb-2 block">辩手 B</label>
                <select value={selectedB} onChange={(e) => setSelectedB(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-bg-elevated border border-border-subtle text-text-primary text-sm focus:outline-none focus:border-prism-purple">
                  {ALL_PERSONAS.filter((p) => p.id !== selectedA).map((p) => (
                    <option key={p.id} value={p.id}>{p.avatar} {p.nameZh}</option>
                  ))}
                </select>
                {(() => { const p = getPersonaById(selectedB); return (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-lg">{p.avatar}</span>
                    <div>
                      <p className="text-xs font-medium text-text-primary">{p.nameZh}</p>
                      <p className="text-[10px] text-text-muted">{p.taglineZh}</p>
                    </div>
                  </div>
                ); })()}
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs text-text-muted mb-2 block">辩论主题（越具体越有趣）</label>
              <textarea
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                placeholder="例如：AI 是否应该在教育领域完全取代人类教师？"
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl bg-bg-elevated border border-border-subtle text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-prism-blue resize-none"
              />
            </div>

            <div className="flex items-start gap-2 p-3 rounded-xl bg-prism-orange/5 border border-prism-orange/15 mb-4">
              <Shield className="w-4 h-4 text-prism-orange flex-shrink-0 mt-0.5" />
              <p className="text-xs text-text-muted">
                <strong className="text-text-secondary">辩论为教育目的而设计。</strong> AI 生成内容代表人物思维方式的重构分析，不构成事实陈述或观点认同。
              </p>
            </div>

            <button
              onClick={runCustomClash}
              disabled={!customTopic.trim() || isGenerating}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-prism-gradient text-white font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {isGenerating ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 正在生成辩论...</>
              ) : (
                <><Swords className="w-4 h-4" /> 开始辩论</>
              )}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
