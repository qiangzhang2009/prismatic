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
    id: 'research',
    icon: <Search className="w-6 h-6" />,
    title: '深度研究',
    titleEn: 'Deep Research',
    color: '#4d96ff',
    duration: '3-5天/人',
    description: '系统梳理目标人物的公开著作、演讲、访谈、传记、论文、社交媒体和采访记录。',
    details: [
      '梳理所有可获取的原始资料（书籍、演讲、采访）',
      '提取核心观点、方法论和思维框架',
      '识别反复出现的主题和思维模式',
      '区分公开立场与真实想法',
      '标注信息来源的可靠性和背景',
    ],
    example: '以乔布斯为例：研究 Walter Isaacson 传记、D conference 全程录像、All Things D 采访、Stanford 毕业典礼演讲、iPad 发布会原文稿。',
  },
  {
    id: 'extract',
    icon: <Brain className="w-6 h-6" />,
    title: '心智模型提取',
    titleEn: 'Mental Model Extraction',
    color: '#c77dff',
    duration: '2-3天/人',
    description: '从海量资料中提取可复用的思维工具。每个模型都需有具体出处和实际应用场景。',
    details: [
      '识别3-8个核心心智模型',
      '每个模型包含：名称、一句话定义、原始引用、跨领域应用',
      '标注模型的局限性（边界条件）',
      '区分核心观点与偶发观点',
      '建立模型之间的逻辑关系图',
    ],
    example: '乔布斯的「聚焦即说不」模型：来源 WWDC 1997，应用于产品优先级判断，局限在于过度的聚焦可能导致视野收窄。',
  },
  {
    id: 'voice',
    icon: <Mic className="w-6 h-6" />,
    title: '表达DNA建模',
    titleEn: 'Voice & Expression DNA',
    color: '#ff9f43',
    duration: '1-2天/人',
    description: '不只是说什么，而是如何说——语气、节奏、用词、三段式结构、反问习惯。',
    details: [
      '句式特征：短句还是从句？停顿频率？',
      '标志性词汇和短语',
      '常用修辞手法（反问、三段式、类比）',
      '情绪温度：激情型、冷静型、幽默型？',
      '确定性水平：高确定性还是谨慎型？',
    ],
    example: '乔布斯的表达DNA：短句为主，大量反问，「就是这样」或「简直是垃圾」二元判断，从不用「也许」「可能」「大概」。',
  },
  {
    id: 'system',
    icon: <Code2 className="w-6 h-6" />,
    title: '系统提示词工程',
    titleEn: 'System Prompt Engineering',
    color: '#6bcb77',
    duration: '1-2天/人',
    description: '将所有研究成果转化为精确的指令体系，包含角色定义、边界条件、表达风格和行为规则。',
    details: [
      'Identity Prompt：角色核心认同（10-20字）',
      'System Prompt Template：完整行为指令',
      'Decision Heuristics：决策启发式列表',
      'Forbidden Patterns：必须避免的思维模式',
      'Honest Boundaries：诚实边界声明',
    ],
    example: '"我是乔布斯。我创造了Mac和iPhone，但更重要的是——我证明了技术与人文的交汇处能产生改变世界的东西。"',
  },
  {
    id: 'eval',
    icon: <FlaskConical className="w-6 h-6" />,
    title: '盲测评估',
    titleEn: 'Blind Evaluation',
    color: '#ffd93d',
    duration: '1-2天',
    description: '不告知测试者具体是哪位人物的情况下，让评估者与AI对话，验证表达一致性和思维准确性。',
    details: [
      '10+道盲测题目，涵盖人物核心观点',
      '评估表达风格一致性（能否识别出来？）',
      '思维准确性（观点是否忠实于原始？）',
      '边界条件是否清晰（哪些问题不该回答？）',
      '多轮对话中的身份一致性',
    ],
    example: '将蒸馏后的乔布斯AI发给熟悉乔布斯的人，看对方能否在3轮对话内识别出来，并评价对话质量。',
  },
  {
    id: 'iterate',
    icon: <Layers className="w-6 h-6" />,
    title: '迭代优化',
    titleEn: 'Iteration & Refinement',
    color: '#ff6b6b',
    duration: '持续',
    description: '根据真实使用反馈持续优化。每个蒸馏人物都有版本号，随着反馈改进。',
    details: [
      '监控AI输出的高频场景',
      '收集用户的「感觉不对」反馈',
      '识别表达的「过度夸张」问题',
      '补充新的公开资料和观点',
      '更新版本号，追踪演变历史',
    ],
    example: '初始版本2.1 → 用户反馈在谈论数据问题时过于情绪化 → 2.2版增加数据场景的边界条件 → 持续循环。',
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
  name: '聚焦即说不',
  nameEn: 'Focus = Saying No',
  persona: 'steve-jobs',
  personaName: 'Steve Jobs',
  personaNameZh: '史蒂夫·乔布斯',
  color: '#ff6b6b',
  oneLiner: '聚焦不是对你要做的事说Yes，而是对其他一百个好主意说No。',
  evidence: [
    { quote: 'People think focus means saying yes to the thing you\'ve got to focus on. But that\'s not what it means at all. It means saying no to the hundred other good ideas.', source: 'WWDC 1997', year: 1997 },
    { quote: 'Innovation is saying no to 1,000 things.', source: 'Various interviews' },
  ],
  crossDomain: ['产品', '战略', '人生'],
  application: '当面对产品功能列表、战略优先级时，先问该砍什么，而不是先问该加什么。',
  limitation: '说No需要极强判断力。说错了No可能错过整个市场。适合有清晰愿景的情况，不适合探索阶段。',
};

export default function MethodologyPage() {
  const [activeStep, setActiveStep] = useState('research');
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
              我们不是让AI扮演名人。我们用严谨的研究方法，提取真实思想家的心智模型和思维方式，
              让用户能够与人类历史上最聪明的大脑进行真实的认知协作。
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
              { value: '6步', label: '标准蒸馏流程' },
              { value: '3-8', label: '个核心心智模型/人' },
              { value: '100+', label: '个可验证引用' },
              { value: '持续', label: '迭代优化' },
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
            <h2 className="text-3xl font-display font-bold mb-3">六步科学蒸馏法</h2>
            <p className="text-text-secondary">每一步都有明确目标和交付物，确保最终结果的可靠性</p>
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
              15位经过科学蒸馏的思维伙伴已经就位。选择一位或多位，开启真正有深度的认知协作。
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
