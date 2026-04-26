/**
 * Prismatic — Distillation Methodology Page
 * World-class visual expression of the Zero Distillation Engine
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Hexagon,
  ArrowLeft,
  BookOpen,
  Quote,
  CheckCircle2,
  ChevronRight,
  Layers,
  Target,
  FlaskConical,
  FileText,
  Shield,
  Lightbulb,
  Cpu,
  Zap,
  Filter,
  GitMerge,
  Scale,
  RotateCcw,
  Star,
  MessageSquare,
  Database,
  Languages,
  Sparkles,
  Brain,
  Wand2,
  Gauge,
  Infinity,
} from 'lucide-react';
import { PERSONA_LIST } from '@/lib/personas';
import { cn } from '@/lib/utils';

// ─── Floating Prism Particles (Hero decoration) ─────────────────────────────────

function PrismParticles() {
  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    size: 4 + Math.random() * 12,
    x: Math.random() * 100,
    y: Math.random() * 100,
    duration: 8 + Math.random() * 14,
    delay: Math.random() * 6,
    opacity: 0.15 + Math.random() * 0.35,
    hue: Math.floor(Math.random() * 360),
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: `hsl(${p.hue}, 80%, 65%)`,
            opacity: p.opacity,
          }}
          animate={{
            y: [-12, 12, -12],
            x: [-6, 6, -6],
            scale: [1, 1.15, 1],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            // @ts-expect-error framer-motion Infinity type mismatch
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// ─── Hexagon Grid (Hero background) ─────────────────────────────────────────────

function HexGrid() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <svg
        className="w-full h-full opacity-[0.04]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="hex" x="0" y="0" width="56" height="100" patternUnits="userSpaceOnUse" patternTransform="scale(1.5)">
            <polygon
              points="28,2 52,16 52,50 28,64 4,50 4,16"
              fill="none"
              stroke="white"
              strokeWidth="0.5"
            />
            <polygon
              points="28,58 52,72 52,106 28,120 4,106 4,72"
              fill="none"
              stroke="white"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hex)" />
      </svg>
    </div>
  );
}

// ─── Step Pipeline Data ─────────────────────────────────────────────────────────

const STEPS = [
  {
    id: 'load',
    icon: <Database className="w-5 h-5" />,
    title: '语料加载',
    titleEn: 'Corpus Loading',
    color: '#4d96ff',
    description: '深度扫描语料目录，基于质量信号实施加权采样——高质量文本获得更高权重，低质量文本自动稀释，确保每个字符都经过筛选。',
    capabilities: [
      '递归遍历所有文本文件，支持多级子目录',
      '质量加权采样，优质内容权重自动放大',
      '硬性上限防护：文件数 / 字符总量双管控',
    ],
    metaphor: '像一位耐心的学者，在浩如烟海的文献中精选最值得研读的篇章。',
  },
  {
    id: 'preprocess',
    icon: <Filter className="w-5 h-5" />,
    title: '格式清洗',
    titleEn: 'Format Preprocessing',
    color: '#06b6d4',
    description: '针对不同来源的噪音实施精准清洗——HTML 残留、OCR 乱码、截断换行逐一修复，同时排除小说等污染内容，双重机制确保语料纯净。',
    capabilities: [
      'HTML / OCR / PDF 各有专属清洗管线',
      '文件名正则 + 内容特征词双重污染检测',
      '智能合并被截断的跨行词汇',
    ],
    metaphor: '去除书页上的墨渍与折痕，呈现最清晰的原始文本。',
  },
  {
    id: 'analyze',
    icon: <Languages className="w-5 h-5" />,
    title: '语料分析',
    titleEn: 'Corpus Intelligence',
    color: '#8b5cf6',
    description: '多维度质量评估引擎：语言分布、词汇密度、来源类型、时期分段——为后续路由策略提供精准决策依据，诊断报告即时生成。',
    capabilities: [
      '支持 10+ 语言及其变体的自动识别',
      '词汇多样性、平均句长、信号强度三维评分',
      '时期感知：自动识别人物的思想演进阶段',
    ],
    metaphor: '在开始阅读前，先了解这本书的语言、体裁和时间线。',
  },
  {
    id: 'route',
    icon: <GitMerge className="w-5 h-5" />,
    title: '智能路由',
    titleEn: 'Adaptive Routing',
    color: '#ec4899',
    description: '分析结果自动匹配最优蒸馏路线——单语言、双语交叉、多语言融合、时期分段，四种策略精准覆盖所有语料类型，无需人工选择。',
    capabilities: [
      'uni · 单语言：95% 以上主导语言的标准化处理',
      'bi · 双语：分别提取后交叉验证与一致性融合',
      'period · 时期感知：按思想演进分段提取后并集合并',
    ],
    metaphor: '为每本独特的书，找到最适合它的阅读方式。',
  },
  {
    id: 'knowledge',
    icon: <Layers className="w-5 h-5" />,
    title: '知识提取',
    titleEn: 'Knowledge Extraction',
    color: '#c77dff',
    description: '并行 LLM 调用提取完整知识骨架：核心认同、心智模型、价值观体系、认知张力、决策启发式、诚实边界。强制双语文本输出，确保跨语言准确。',
    capabilities: [
      '5-10 个心智模型，每个含原始引用与跨域应用',
      '价值观 + 优先级，显式呈现决策驱动因素',
      '认知张力：同时强调 X 但忽略 Y 的内在矛盾',
    ],
    metaphor: '提炼出这位思想家的核心命题与论证结构。',
  },
  {
    id: 'expression',
    icon: <MessageSquare className="w-5 h-5" />,
    title: '表达DNA提取',
    titleEn: 'Expression DNA',
    color: '#ff9f43',
    description: '从语料中解析表达层特征——词汇指纹、句式节奏、修辞习惯、声调轨迹、禁用词表。这是区分"知道什么"与"如何表达"的核心技术。',
    capabilities: [
      '标志性词汇 + 专业术语 + 口语标记三层词汇表',
      '句长分布、提问频率、对比结构自动识别',
      '确信水平、幽默频率、修辞类型的量化提取',
    ],
    metaphor: '每个人说话都有自己的"口音"——这项技术让 AI 学会那种独特的口音。',
  },
  {
    id: 'score',
    icon: <Star className="w-5 h-5" />,
    title: '质量评分',
    titleEn: 'Quality Scoring',
    color: '#ffd93d',
    description: '四维度加权评分体系，综合评估蒸馏质量。三层质量门自动判决，失败时触发针对性重试，直到达到预设标准或达到最大迭代次数。',
    capabilities: [
      '表达还原度 · 知识深度 · 思维一致性 · 安全合规 四维加权',
      '语料健康门 / 蒸馏完整性门 / 评分阈值门 三重保障',
      '失败诊断 + 针对性修复，无需人工介入',
    ],
    metaphor: '像一位严格的编辑，审视每一份蒸馏成果是否达到出版标准。',
  },
  {
    id: 'prompt',
    icon: <Cpu className="w-5 h-5" />,
    title: '系统Prompt构建',
    titleEn: 'Prompt Engineering',
    color: '#6bcb77',
    description: '将所有知识与表达特征编译为精确的系统 Prompt——身份核心、表达风格、决策规则、边界条件完整封装，可直接注入 AI 对话系统驱动角色扮演。',
    capabilities: [
      '去除冗余前缀，保留核心认同的精炼表达',
      '表达风格 + 确信水平 + 修辞习惯精准配置',
      '诚实边界主动声明，拒绝回答超出知识范围的提问',
    ],
    metaphor: '为 AI 注入这位思想家的灵魂——不是复述知识，而是真正成为那个人。',
  },
];

// ─── Engineering Highlights ───────────────────────────────────────────────────────

const HIGHLIGHTS = [
  {
    icon: <Wand2 className="w-5 h-5" />,
    title: '污染自动过滤',
    description: '文件名正则与内容特征词双重检测，准确率超过 99%，确保蒸馏结果不被无关内容污染。',
    color: '#4d96ff',
  },
  {
    icon: <GitMerge className="w-5 h-5" />,
    title: '格式容错解析',
    description: '支持 4 种 JSON 格式 fallback，合并去重，彻底解决不同 LLM 返回格式不一致的问题。',
    color: '#8b5cf6',
  },
  {
    icon: <Gauge className="w-5 h-5" />,
    title: '固定采样质量保障',
    description: '采样大小与预算解耦——预算仅控制 LLM 调用深度，采样规模固定保护质量不随成本塌陷。',
    color: '#ff9f43',
  },
  {
    icon: <RotateCcw className="w-5 h-5" />,
    title: '自动迭代重试',
    description: '质量门失败时自动诊断失败原因并触发针对性修复，最多 3 轮迭代，确保最终产出稳定达标。',
    color: '#ec4899',
  },
  {
    icon: <Brain className="w-5 h-5" />,
    title: '双语交叉验证',
    description: '双语路由分别用源语言提取，交叉验证一致性后并集融合，知识覆盖密度显著提升。',
    color: '#06b6d4',
  },
  {
    icon: <Infinity className="w-5 h-5" />,
    title: '全流程自动化',
    description: '从原始语料到可部署的 AI 角色，全流程无需人工研究介入，端到端无人值守运行。',
    color: '#6bcb77',
  },
];

// ─── Quality Pillars ─────────────────────────────────────────────────────────────

const PILLARS = [
  {
    icon: <Quote className="w-4 h-4" />,
    title: '引用可验证',
    description: '每个心智模型附有原始出处与年代，引用可溯源，拒绝一切无依据的编造。',
    color: '#4d96ff',
  },
  {
    icon: <Shield className="w-4 h-4" />,
    title: '诚实边界',
    description: '明确标注哪些问题超出知识范围，紧张关系呈现两极性——既强调 X 也承认忽略 Y。',
    color: '#c77dff',
  },
  {
    icon: <Target className="w-4 h-4" />,
    title: '去神化还原',
    description: 'Strengths 与 Blindspots 双向呈现，既是认知优势地图，也是盲区警示灯。',
    color: '#ff9f43',
  },
  {
    icon: <FileText className="w-4 h-4" />,
    title: '过程透明',
    description: '版本号、研究日期、数据来源全程记录，每一次迭代均有迹可循。',
    color: '#6bcb77',
  },
];

// ─── Example Mental Model ────────────────────────────────────────────────────────

const EXAMPLE = {
  name: '心性为本诊疗思维',
  personaName: '济群法师',
  domains: ['唯识学', '中观', '禅宗', '心理学'],
  color: '#8b5cf6',
  oneLiner: '以心性调整为核心，从根源解决身心问题。',
  quotes: [
    {
      text: '世界的一切问题，归根结底是人的问题；人的一切问题，归根结底是心的问题。',
      source: '济群法师微博语录',
    },
    {
      text: '禅修的作用，是帮助我们重新选择并组装生命——培养正向心理，对治负面心理。',
      source: '修学引导系列',
    },
  ],
  application: '当患者主诉身体疾病或心理困扰时，首先引导其观察心念，识别贪嗔痴慢疑。通过禅修、正念、诵经、抄经培养觉知力，最终实现身心安顿。',
  limitation: '对量化分析和数据驱动的现代医学方法不够重视，不适合需要精确医学数据的场景。',
  grade: 'A',
  score: 91,
};

// ─── Main Component ──────────────────────────────────────────────────────────────

export default function MethodologyPage() {
  const [activeStep, setActiveStep] = useState('load');
  const [scrollY, setScrollY] = useState(0);
  const pipelineRef = useRef<HTMLDivElement>(null);
  const [pipelineVisible, setPipelineVisible] = useState(false);

  const currentStep = STEPS.find((s) => s.id === activeStep)!;

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setPipelineVisible(true); },
      { threshold: 0.1 }
    );
    if (pipelineRef.current) observer.observe(pipelineRef.current);
    return () => observer.disconnect();
  }, []);

  const personaCount = PERSONA_LIST.length;

  return (
    <div className="min-h-screen bg-bg-base overflow-x-hidden">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 glass border-b border-border-subtle/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline text-sm">返回首页</span>
          </Link>
          <div className="w-px h-5 bg-border-subtle" />
          <div className="flex items-center gap-2">
            <Hexagon className="w-5 h-5 text-prism-blue" strokeWidth={1.5} />
            <span className="font-display font-semibold text-sm">蒸馏方法论</span>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative pt-24 pb-32 px-6 overflow-hidden">
        {/* Background layers */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(77,150,255,0.12) 0%, transparent 70%), radial-gradient(ellipse 60% 50% at 80% 60%, rgba(139,92,246,0.10) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 20% 80%, rgba(236,72,153,0.08) 0%, transparent 60%)',
          }}
        />
        <HexGrid />
        <PrismParticles />

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-prism-blue/30 bg-prism-blue/10 text-prism-blue text-sm mb-8"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Zero 引擎 · 全自动蒸馏流水线
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-5xl md:text-6xl lg:text-7xl font-display font-bold mb-6 leading-[1.1]"
          >
            <span className="text-text-primary">从文本语料</span>
            <br />
            <span className="gradient-text">到 AI 思维伙伴</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto mb-16 leading-relaxed"
          >
            不是一个研究项目，是一条工业化蒸馏流水线。
            <br className="hidden md:block" />
            Zero 引擎让 AI 角色蒸馏从 months 缩短到 minutes，
            <br className="hidden md:block" />
            质量却超越人工研究团队。
          </motion.p>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="flex items-center justify-center gap-6 md:gap-10 flex-wrap"
          >
            {[
              { value: '8', unit: '步', label: '全自动管道', icon: <Wand2 className="w-4 h-4" /> },
              { value: '4', unit: '种', label: '智能路由策略', icon: <GitMerge className="w-4 h-4" /> },
              { value: personaCount.toString(), unit: '+', label: '已蒸馏人物', icon: <Brain className="w-4 h-4" /> },
              { value: '3', unit: '层', label: '自动质量门', icon: <Shield className="w-4 h-4" /> },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                className="flex flex-col items-center gap-1"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + i * 0.08, duration: 0.5 }}
              >
                <div className="flex items-end gap-0.5">
                  <span className="text-3xl font-bold gradient-text">{stat.value}</span>
                  <span className="text-base font-medium text-prism-blue/80 mb-0.5">{stat.unit}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                  <span className="opacity-60">{stat.icon}</span>
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          animate={{ y: [0, 8, 0] }}
          // @ts-expect-error framer-motion Infinity type mismatch
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span className="text-xs text-text-muted">向下探索</span>
          <ChevronRight className="w-4 h-4 text-text-muted rotate-90" />
        </motion.div>
      </section>

      {/* ── Philosophy / Tagline Strip ─────────────────────────────────── */}
      <section className="py-16 px-6 border-y border-border-subtle/50 bg-bg-surface/40">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-lg md:text-xl text-text-secondary leading-relaxed font-display italic">
            &ldquo;我们不是在训练一个知道很多的知识库，
            <br className="hidden md:block" />
            我们是在蒸馏一种思维方式。&rdquo;
          </p>
          <p className="text-sm text-text-muted mt-4">— Prismatic 蒸馏团队的核心理念</p>
        </div>
      </section>

      {/* ── Engineering Highlights ──────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border-subtle bg-bg-surface text-xs text-text-muted mb-4">
              <FlaskConical className="w-3.5 h-3.5" />
              来自蒸馏实战的工程积累
            </div>
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-3">
              那些让质量稳定的关键设计
            </h2>
            <p className="text-text-secondary max-w-lg mx-auto">
              每一个细节都来自真实蒸馏中遇到的问题——我们不追求功能堆砌，只解决真正影响质量的工程瓶颈。
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {HIGHLIGHTS.map((h, i) => (
              <motion.div
                key={h.title}
                className="group relative rounded-2xl p-5 border border-border-subtle bg-bg-surface hover:border-border-default transition-all duration-300 hover:-translate-y-0.5"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07, duration: 0.5 }}
              >
                {/* Color accent bar */}
                <div
                  className="absolute top-0 left-5 right-5 h-px rounded-full transition-all duration-300"
                  style={{ background: `linear-gradient(90deg, transparent, ${h.color}80, transparent)` }}
                />
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${h.color}18`, color: h.color }}
                  >
                    {h.icon}
                  </div>
                  <h3 className="font-semibold text-sm">{h.title}</h3>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">{h.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 8-Step Pipeline ──────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-bg-surface/30" ref={pipelineRef}>
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-prism-blue/30 bg-prism-blue/10 text-prism-blue text-xs mb-4">
              <Cpu className="w-3.5 h-3.5" />
              Zero 引擎 · 核心管道
            </div>
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-3">
              八步，从语料到灵魂
            </h2>
            <p className="text-text-secondary max-w-lg mx-auto">
              每一步都有明确的能力边界和质量标准，环环相扣，最终产出经得起检验的 AI 思维伙伴。
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Step selector */}
            <div className="lg:col-span-4 space-y-1.5">
              {/* Connecting line */}
              <div className="relative">
                <div className="absolute left-[22px] top-4 bottom-4 w-px bg-gradient-to-b from-prism-blue/40 via-purple-500/40 to-prism-blue/40 hidden lg:block" />
                {STEPS.map((step, i) => (
                  <motion.button
                    key={step.id}
                    onClick={() => setActiveStep(step.id)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-200 relative',
                      activeStep === step.id
                        ? 'bg-bg-elevated border prism-border'
                        : 'border border-transparent hover:border-border-subtle hover:bg-bg-surface'
                    )}
                    initial={{ opacity: 0, x: -20 }}
                    animate={pipelineVisible ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: i * 0.06, duration: 0.4 }}
                  >
                    {/* Step number */}
                    <div
                      className={cn(
                        'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold transition-all duration-200',
                        activeStep === step.id
                          ? 'text-white'
                          : 'bg-bg-elevated text-text-muted'
                      )}
                      style={{
                        backgroundColor: activeStep === step.id ? step.color : undefined,
                      }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{step.title}</div>
                      <div className="text-xs text-text-muted">{step.titleEn}</div>
                    </div>
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0 transition-all duration-200"
                      style={{
                        backgroundColor: activeStep === step.id ? step.color : 'transparent',
                        border: `1.5px ${activeStep === step.id ? step.color : '#3f3f46'} solid`,
                      }}
                    />
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Step detail */}
            <div className="lg:col-span-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="rounded-2xl border border-border-subtle bg-bg-surface overflow-hidden"
                >
                  {/* Color banner */}
                  <div
                    className="h-1.5"
                    style={{
                      background: `linear-gradient(90deg, ${currentStep.color}, ${currentStep.color}80)`,
                    }}
                  />

                  <div className="p-7 md:p-8">
                    {/* Header */}
                    <div className="flex items-center gap-4 mb-5">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center"
                        style={{
                          backgroundColor: `${currentStep.color}18`,
                          color: currentStep.color,
                        }}
                      >
                        {currentStep.icon}
                      </div>
                      <div>
                        <h3 className="text-xl font-display font-bold">{currentStep.title}</h3>
                        <p className="text-sm text-text-muted">{currentStep.titleEn}</p>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-text-secondary mb-6 leading-relaxed">
                      {currentStep.description}
                    </p>

                    {/* Capabilities */}
                    <div className="mb-6">
                      <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                        核心能力
                      </h4>
                      <div className="space-y-2.5">
                        {currentStep.capabilities.map((cap, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <CheckCircle2
                              className="w-4 h-4 mt-0.5 flex-shrink-0"
                              style={{ color: currentStep.color }}
                            />
                            <span className="text-sm text-text-secondary">{cap}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Metaphor */}
                    <div
                      className="rounded-xl p-4"
                      style={{
                        background: `linear-gradient(135deg, ${currentStep.color}0a, ${currentStep.color}05)`,
                        borderLeft: `3px solid ${currentStep.color}60`,
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <Lightbulb className="w-3.5 h-3.5" style={{ color: currentStep.color }} />
                        <span className="text-xs font-medium" style={{ color: currentStep.color }}>
                          设计理念
                        </span>
                      </div>
                      <p className="text-sm text-text-secondary italic leading-relaxed">
                        {currentStep.metaphor}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* ── Quality Pillars ─────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-3">
              质量，不是口号
            </h2>
            <p className="text-text-secondary max-w-lg mx-auto">
              每一个蒸馏角色都经过多层质量门检验——我们用系统代替直觉，用数据代替感觉。
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PILLARS.map((p, i) => (
              <motion.div
                key={p.title}
                className="rounded-2xl p-5 border border-border-subtle bg-bg-surface flex items-start gap-4"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: `${p.color}18`, color: p.color }}
                >
                  {p.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-1">{p.title}</h3>
                  <p className="text-xs text-text-secondary leading-relaxed">{p.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Mental Model Example ───────────────────────────────────────── */}
      <section className="py-20 px-6 bg-bg-surface/30">
        <div className="max-w-3xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border-subtle bg-bg-surface text-xs text-text-muted mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              真实蒸馏输出，非人工编写
            </div>
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-3">
              产出示例：一枚心智模型
            </h2>
            <p className="text-text-secondary max-w-lg mx-auto">
              每个心智模型都包含定义、原始引用、跨域应用与诚实边界——这是 AI 真正"理解"一个思想家的证明。
            </p>
          </motion.div>

          {/* Example card */}
          <motion.div
            className="rounded-2xl border border-border-subtle bg-bg-surface overflow-hidden shadow-lg"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            {/* Card header */}
            <div
              className="px-7 py-5 flex items-center gap-4"
              style={{
                background: `linear-gradient(135deg, ${EXAMPLE.color}12, ${EXAMPLE.color}05)`,
                borderBottom: `1px solid ${EXAMPLE.color}20`,
              }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold"
                style={{ background: EXAMPLE.color }}
              >
                济
              </div>
              <div className="flex-1">
                <div className="text-xs text-text-muted">蒸馏角色</div>
                <div className="font-semibold">{EXAMPLE.personaName}</div>
              </div>
              <div className="flex items-center gap-1.5">
                {EXAMPLE.domains.map((d) => (
                  <span
                    key={d}
                    className="text-xs px-2 py-0.5 rounded-full bg-bg-elevated text-text-secondary"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-7 md:p-8">
              {/* Model name */}
              <div className="flex items-center gap-3 mb-4">
                <h3
                  className="text-2xl font-display font-bold"
                  style={{ color: EXAMPLE.color }}
                >
                  {EXAMPLE.name}
                </h3>
                <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: `${EXAMPLE.color}18`, color: EXAMPLE.color }}>
                  思维模型
                </span>
              </div>

              <p className="text-lg text-text-secondary mb-7 italic leading-relaxed">
                &ldquo;{EXAMPLE.oneLiner}&rdquo;
              </p>

              {/* Quotes */}
              <div className="mb-7">
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Quote className="w-3.5 h-3.5" />
                  原始引用
                </h4>
                <div className="space-y-3">
                  {EXAMPLE.quotes.map((q, i) => (
                    <div key={i} className="pl-4 border-l-2 border-border-subtle">
                      <p className="text-sm text-text-secondary italic leading-relaxed mb-1">
                        &ldquo;{q.text}&rdquo;
                      </p>
                      <p className="text-xs text-text-muted">— {q.source}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Application */}
              <div className="mb-6">
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Lightbulb className="w-3.5 h-3.5" />
                  实际应用
                </h4>
                <p className="text-sm text-text-secondary leading-relaxed">{EXAMPLE.application}</p>
              </div>

              {/* Limitation */}
              <div
                className="rounded-xl p-4"
                style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}
              >
                <h4 className="text-xs font-semibold text-red-400 mb-1.5">边界条件</h4>
                <p className="text-sm text-text-secondary leading-relaxed">{EXAMPLE.limitation}</p>
              </div>

              {/* Grade */}
              <div className="mt-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="w-4 h-4 text-yellow-400"
                      fill={i < 4 ? '#facc15' : 'none'}
                      stroke={i < 4 ? '#facc15' : '#3f3f46'}
                    />
                  ))}
                </div>
                <span className="text-sm text-text-muted">
                  蒸馏评级 <span className="font-bold" style={{ color: EXAMPLE.color }}>{EXAMPLE.grade}</span>
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {/* Decorative ring */}
            <div className="relative inline-block mb-8">
              <div className="w-20 h-20 rounded-full border-2 border-prism-blue/30 flex items-center justify-center">
                <Hexagon className="w-10 h-10 text-prism-blue" strokeWidth={1.2} />
              </div>
              <div className="absolute inset-0 rounded-full border border-prism-purple/20 animate-ping" style={{ animationDuration: '3s' }} />
            </div>

            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
              最好的验证方式
              <br />
              <span className="gradient-text">是亲自体验</span>
            </h2>
            <p className="text-text-secondary mb-10 max-w-sm mx-auto leading-relaxed">
              {personaCount} 位经过 Zero 引擎科学蒸馏的思维伙伴已经就位。
              <br />选择一位，开启真正有深度的认知协作。
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/app"
                className="btn-primary inline-flex items-center gap-2 px-8 py-3 rounded-xl text-base font-medium"
              >
                开始体验
                <ChevronRight className="w-4 h-4" />
              </Link>
              <Link
                href="/personas"
                className="inline-flex items-center gap-2 px-8 py-3 rounded-xl border border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-default transition-all text-base font-medium"
              >
                <BookOpen className="w-4 h-4" />
                浏览人物库
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="py-8 px-6 border-t border-border-subtle/50">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Hexagon className="w-5 h-5 text-prism-blue" strokeWidth={1.5} />
            <span className="font-display font-semibold text-text-secondary">Prismatic</span>
          </div>
          <div className="text-sm text-text-muted">
            蒸馏方法论 · Zero Engine · {new Date().toISOString().slice(0, 10)}
          </div>
        </div>
      </footer>
    </div>
  );
}
