/**
 * Prismatic — Distillation Methodology Page
 * Shows how we distill real thinkers into AI personas
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Hexagon,
  Sparkles,
  ArrowLeft,
  Search,
  BookOpen,
  Quote,
  Brain,
  CheckCircle2,
  ChevronRight,
  Layers,
  Target,
  FlaskConical,
  FileText,
  Mic,
  Code2,
  Shield,
  Lightbulb,
} from 'lucide-react';
import { PERSONA_LIST } from '@/lib/personas';
import { cn } from '@/lib/utils';

const STEPS = [
  {
    id: 'l1-intelligence',
    icon: <Search className="w-6 h-6" />,
    title: '语料智能分析',
    titleEn: 'L1: Corpus Intelligence',
    color: '#4d96ff',
    duration: '自动',
    description: '自动扫描语料库的规模、词汇分布和语言构成，评估信号强度，生成健康报告。',
    details: [
      '词汇多样性分析（unique word ratio）',
      '语言分布检测（中/英/德/拉丁/希腊等）',
      '语料规模阈值校验（英文≥5000词，中文≥3000词）',
      '来源多样性评分（≥2种来源类型）',
      '信号强度判定（strong / medium / weak）',
    ],
    example: '扫描《论语》语料：确认中文为主（占比99%+），多个来源文件，总词汇量5000+，信号强度 strong → 进入单语言蒸馏管道。',
  },
  {
    id: 'l2-routing',
    icon: <Layers className="w-6 h-6" />,
    title: '路由决策',
    titleEn: 'L2: Route Routing',
    color: '#06b6d4',
    duration: '自动',
    description: '根据语料分析结果，自动选择最优蒸馏路线，匹配输出语言和分段策略。',
    details: [
      'Uni（单语言）：语种占比≥95%，如孔子、老子、苏格拉底',
      'Bi（双语言）：两种语言均≥15%，如维特根斯坦',
      'Multi（多语言）：三种以上语言',
      'Period（分期蒸馏）：跨越150年以上，如杜甫诗歌的早中晚期',
    ],
    example: '孔子语料检测到多个历史分期（先秦/战国），自动选择 Period 路由，按时期分别蒸馏，确保不同时期的思想不混为一谈。',
  },
  {
    id: 'l3-knowledge',
    icon: <Brain className="w-6 h-6" />,
    title: '知识层提取',
    titleEn: 'L3: Knowledge Extraction',
    color: '#c77dff',
    duration: 'LLM 推理',
    description: '从原始语料中提取思维模型、价值观、决策启发式、张力和边界条件，每个字段都附有可验证的原始引用。',
    details: [
      '3-8个核心心智模型（含三语对照：原文/英/中）',
      '决策启发式列表（含应用场景）',
      '核心价值观（附优先级排序）',
      '内在张力（如「自由 vs 责任」）',
      '诚实边界声明（无法回答的问题类型）',
      'Anti-patterns（必须避免的思维模式）',
    ],
    example: '从《孙子兵法》提取「知己知彼」模型：来源「始计篇」，跨域应用于商业谈判，边界在于信息永远不完全对称，不适用于高不确定性决策场景。',
  },
  {
    id: 'l4-expression',
    icon: <Mic className="w-6 h-6" />,
    title: '表达DNA建模',
    titleEn: 'L4: Expression DNA',
    color: '#ff9f43',
    duration: 'LLM 推理',
    description: '不只是说什么，而是如何说——语气、节奏、用词、三段式结构、反问习惯。将语言风格与知识内容解耦提取。',
    details: [
      '标志性词汇 Top-20（禁用词同等重要）',
      '句式特征：短句/从句/停顿频率',
      '确定性水平：高确定性 vs 谨慎型',
      '修辞手法：反问、三段式、类比',
      '中文语境适配：如何在目标语言中保留原味',
    ],
    example: '芒格的表达 DNA：大量使用「反过来想」的反问句式，引用概率论和进化生物学的类比，极少用绝对词（「总是」「从不」为禁用词）。',
  },
  {
    id: 'l5-validation',
    icon: <Shield className="w-6 h-6" />,
    title: '交叉验证与融合',
    titleEn: 'L5: Cross-Validation & Fusion',
    color: '#6bcb77',
    duration: '自动 + LLM',
    description: '多语言版本的交叉验证，检测概念冲突、术语不一致和夸大表述，通过 LLM 仲裁解决矛盾。',
    details: [
      '跨语言概念一致性评分（0-100）',
      '冲突检测：术语冲突 / 强调冲突 / 矛盾',
      '融合方法：intersection / primary_language / LLM 仲裁',
      '表达一致性评分',
      '知识覆盖率评估',
    ],
    example: '《论语》双语言版本中，「君子」在英文中译为 "gentleman" vs "superior man"，冲突类型为「术语冲突」，经 LLM 仲裁后统一为后者，并记录保留理由。',
  },
  {
    id: 'l6-gates',
    icon: <FlaskConical className="w-6 h-6" />,
    title: '四层质量门 + 迭代',
    titleEn: 'L6: Quality Gates & Iteration',
    color: '#ffd93d',
    duration: '自动诊断',
    description: 'Gate 1-4 逐级过滤，自动诊断失败原因并触发针对性修复，最多迭代3轮，最终输出带评分的蒸馏结果。',
    details: [
      'Gate 1 — 语料健康门：词汇量/多样性/来源/信号强度',
      'Gate 2 — 蒸馏完整性门：心智模型数/价值观数/词汇量',
      'Gate 3 — 评分门：四维加权评分 vs 自适应阈值',
      'Gate 4 — 语义验证门：证据相关性/表达知识一致性',
      '自动诊断：识别失败原因 → 推荐修复动作',
      '版本追踪：每次迭代记录诊断和修复历史',
    ],
    example: 'Gate 3 检测到「表达DNA评分 42 < 阈值 55」，自动诊断为「词汇量不足」，触发 Expression 层重新提取，第2轮迭代后评分提升至 68，Gate 3 通过。',
  },
];

const QUALITY_STANDARDS = [
  {
    icon: <Quote className="w-5 h-5" />,
    title: '可验证的引用',
    description: '每个观点背后都有原始出处。避免编造或过度推断。',
    color: '#4d96ff',
  },
  {
    icon: <Shield className="w-5 h-5" />,
    title: '诚实的边界',
    description: '明确标注哪些问题无法回答（人物已故、资料不足、观点矛盾）。',
    color: '#c77dff',
  },
  {
    icon: <Target className="w-5 h-5" />,
    title: '避免过度神化',
    description: '同时呈现 strengths 和 blindspots，忠实还原而非完美化。',
    color: '#ff9f43',
  },
  {
    icon: <FileText className="w-5 h-5" />,
    title: '透明的研究过程',
    description: '展示参考资料列表和研究日期，让用户了解信息的时效性。',
    color: '#6bcb77',
  },
];

const MENTAL_MODEL_EXAMPLE = {
  name: '反向思考',
  nameEn: 'Inversion',
  persona: 'charlie-munger',
  personaName: 'Charlie Munger',
  personaNameZh: '查理·芒格',
  color: '#4d96ff',
  oneLiner: '不要问「如何成功」，而要问「如何失败」——然后避免它们。',
  evidence: [
    { quote: 'Just the other day I got a note saying, "Munger, why do you always think about the other side of the question?" I said, "Well, I am trying to get rid of the ones that are wrong."', source: 'University of Michigan Ross School of Business, 2009', year: 2009 },
    { quote: 'All I want to know is where I\'m going to die, so I\'ll never go there.', source: 'Poor Charlie\'s Almanack', year: 2005 },
  ],
  crossDomain: ['投资', '战略', '决策', '风险管理'],
  application: '面对重大决策时，先列出所有可能导致失败的路径（短期贪婪、过度杠杆、忽视尾部风险），然后逐一建立规避机制。',
  limitation: '反向思考需要丰富的失败案例库。对于全新领域或前所未有的决策，历史样本有限，反向推理可能遗漏未知风险。',
};

export default function MethodologyPage() {
  const [activeStep, setActiveStep] = useState('l1-intelligence');
  const [showExample, setShowExample] = useState(false);

  const currentStep = STEPS.find((s) => s.id === activeStep)!;

  return (
    <div className="min-h-screen bg-bg-base">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border-subtle">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">返回</span>
          </Link>
          <div className="w-px h-5 bg-border-subtle" />
          <div className="flex items-center gap-2">
            <Hexagon className="w-5 h-5 text-prism-blue" strokeWidth={1.5} />
            <span className="font-display font-semibold">蒸馏方法论</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-20 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-prism-blue/30 bg-prism-blue/10 text-prism-blue text-sm mb-6">
              <Lightbulb className="w-3.5 h-3.5" />
              科学蒸馏，不是角色扮演
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-bold mb-6">
              如何把真实思想家
              <br />
              <span className="gradient-text">变成 AI 思维伙伴</span>
            </h1>
            <p className="text-lg text-text-secondary max-w-2xl mx-auto mb-8">
              我们不是让AI扮演名人。通过六层自动蒸馏管道，系统化提取真实思想家的心智模型、表达DNA和决策框架，
              并以四层质量门逐级验证，最终得到可量化评估、可迭代改进的 AI 思维伙伴。
            </p>
          </motion.div>

          {/* Stats */}
          <motion.div
            className="flex items-center justify-center gap-10 flex-wrap"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {[
              { value: '6层', label: '自动蒸馏管道' },
              { value: '65', label: '已蒸馏人物' },
              { value: '1.8GB', label: '原始语料' },
              { value: 'Gate 1-4', label: '四层质量门' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-2xl font-bold gradient-text">{s.value}</div>
                <div className="text-sm text-text-muted">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Process Steps */}
      <section className="py-16 px-6 bg-bg-surface/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-display font-bold mb-3">六层自动蒸馏管道（Zero）</h2>
            <p className="text-text-secondary">基于 Zero 蒸馏引擎，从语料输入到带评分蒸馏结果，全流程自动执行，Gate 1-4 逐级质量门控</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Step tabs */}
            <div className="lg:col-span-4 space-y-2">
              {STEPS.map((step, i) => (
                <motion.button
                  key={step.id}
                  onClick={() => setActiveStep(step.id)}
                  className={cn(
                    'w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all duration-200',
                    activeStep === step.id
                      ? 'bg-bg-elevated border prism-border'
                      : 'border border-transparent hover:border-border-subtle hover:bg-bg-surface'
                  )}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${step.color}20`, color: step.color }}
                  >
                    {step.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{step.title}</div>
                    <div className="text-xs text-text-muted">{step.titleEn}</div>
                  </div>
                  <ChevronRight className={cn('w-4 h-4 flex-shrink-0 transition-transform', activeStep === step.id ? 'rotate-90' : 'text-text-muted')} />
                </motion.button>
              ))}
            </div>

            {/* Step detail */}
            <div className="lg:col-span-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-2xl border border-border-subtle bg-bg-surface p-6 md:p-8"
                >
                  <div className="flex items-start gap-4 mb-6">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${currentStep.color}20`, color: currentStep.color }}
                    >
                      {currentStep.icon}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-1">{currentStep.title}</h3>
                      <p className="text-sm text-text-muted">{currentStep.titleEn}</p>
                      <span
                        className="inline-block mt-2 text-xs px-2 py-0.5 rounded-md border"
                        style={{ borderColor: `${currentStep.color}40`, color: currentStep.color }}
                      >
                        {currentStep.duration}
                      </span>
                    </div>
                  </div>

                  <p className="text-text-secondary mb-6">{currentStep.description}</p>

                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-text-muted mb-3">交付物</h4>
                    <div className="space-y-2">
                      {currentStep.details.map((detail, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: currentStep.color }} />
                          <span className="text-sm text-text-secondary">{detail}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div
                    className="rounded-xl p-4 text-sm"
                    style={{ backgroundColor: `${currentStep.color}10`, borderLeft: `3px solid ${currentStep.color}` }}
                  >
                    <div className="text-xs text-text-muted mb-1">示例</div>
                    <p className="text-text-secondary italic">{currentStep.example}</p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* Quality Standards */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-display font-bold mb-3">质量标准</h2>
            <p className="text-text-secondary">我们拒绝「听起来像」的敷衍。每个蒸馏结果都必须经得起检验。</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {QUALITY_STANDARDS.map((standard, i) => (
              <motion.div
                key={standard.title}
                className="rounded-2xl p-6 border border-border-subtle bg-bg-surface"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                  style={{ backgroundColor: `${standard.color}20`, color: standard.color }}
                >
                  {standard.icon}
                </div>
                <h3 className="font-semibold mb-2">{standard.title}</h3>
                <p className="text-sm text-text-secondary">{standard.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Mental Model Example */}
      <section className="py-16 px-6 bg-bg-surface/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-display font-bold mb-3">心智模型示例</h2>
            <p className="text-text-secondary">每个心智模型都经过严格提取和验证，确保可操作性和可信度</p>
          </div>

          <motion.div
            className="rounded-2xl border border-border-subtle bg-bg-surface overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Header */}
            <div
              className="px-6 py-4 flex items-center gap-4"
              style={{ background: `linear-gradient(135deg, ${MENTAL_MODEL_EXAMPLE.color}15, ${MENTAL_MODEL_EXAMPLE.color}05)` }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                style={{ background: MENTAL_MODEL_EXAMPLE.color }}
              >
                {MENTAL_MODEL_EXAMPLE.personaNameZh[0]}
              </div>
              <div>
                <div className="text-xs text-text-muted">来自</div>
                <div className="font-medium text-sm">{MENTAL_MODEL_EXAMPLE.personaNameZh}</div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {MENTAL_MODEL_EXAMPLE.crossDomain.map((d) => (
                  <span key={d} className="text-xs px-2 py-0.5 rounded-md bg-bg-elevated text-text-secondary">
                    {d}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-6 md:p-8">
              <h3 className="text-2xl font-display font-bold mb-2" style={{ color: MENTAL_MODEL_EXAMPLE.color }}>
                {MENTAL_MODEL_EXAMPLE.name}
              </h3>
              <p className="text-lg text-text-secondary mb-6 italic">
                &ldquo;{MENTAL_MODEL_EXAMPLE.oneLiner}&rdquo;
              </p>

              {/* Evidence */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-text-muted mb-3 flex items-center gap-2">
                  <Quote className="w-4 h-4" />
                  原始引用
                </h4>
                <div className="space-y-3">
                  {MENTAL_MODEL_EXAMPLE.evidence.map((e, i) => (
                    <div key={i} className="pl-4 border-l-2 border-border-subtle">
                      <p className="text-sm text-text-secondary italic mb-1">&ldquo;{e.quote}&rdquo;</p>
                      <p className="text-xs text-text-muted">
                        — {e.source}{e.year ? `, ${e.year}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Application */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-text-muted mb-2 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" />
                  实际应用
                </h4>
                <p className="text-sm text-text-secondary">{MENTAL_MODEL_EXAMPLE.application}</p>
              </div>

              {/* Limitation */}
              <div className="rounded-xl p-4 bg-red-500/5 border border-red-500/20">
                <h4 className="text-sm font-medium text-red-400 mb-2">边界条件</h4>
                <p className="text-sm text-text-secondary">{MENTAL_MODEL_EXAMPLE.limitation}</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            className="rounded-2xl p-10 border border-border-subtle bg-gradient-to-br from-bg-surface to-bg-elevated"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <h2 className="text-2xl font-display font-bold mb-4">亲身体验蒸馏的力量</h2>
            <p className="text-text-secondary mb-8 max-w-lg mx-auto">
              65位经过科学蒸馏的思维伙伴已经就位。选择一位或多位，开启真正有深度的认知协作。
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link href="/app" className="btn-primary inline-flex items-center gap-2">
                开始体验
                <ChevronRight className="w-4 h-4" />
              </Link>
              <Link href="/personas" className="btn-ghost inline-flex items-center gap-2 border border-border-subtle rounded-xl px-6 py-2.5">
                <BookOpen className="w-4 h-4" />
                查看人物库
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border-subtle">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Hexagon className="w-5 h-5 text-prism-blue" strokeWidth={1.5} />
            <span className="font-display font-semibold text-text-secondary">Prismatic</span>
          </div>
          <div className="text-sm text-text-muted">
            蒸馏方法论 · 版本 {new Date().toISOString().slice(0, 10)}
          </div>
        </div>
      </footer>
    </div>
  );
}
