'use client';

/**
 * AstroProfile — Fun personality archetype based on persona's domain & values
 * 趣味性格解读：基于人物领域与价值观生成性格原型描述
 * ⚠ Disclaimer: Purely for entertainment — not real astrology/psychology
 */
import { motion } from 'framer-motion';
import type { Persona } from '@/lib/types';
import type { PersonaScrollTheme } from '@/lib/persona-scroll-themes';
import { DOMAINS } from '@/lib/constants';

function domainLabel(key: string): string {
  return DOMAINS[key as keyof typeof DOMAINS]?.label ?? key;
}

interface Props {
  persona: Persona;
  theme: PersonaScrollTheme;
}

// ─── Archetype Engine ──────────────────────────────────────────────────────────

function deriveArchetype(persona: Persona): { title: string; desc: string; traits: string[]; symbol: string } {
  const domain = persona.domain[0] ?? '';
  const firstStrength = persona.strengths[0];
  const strength = typeof firstStrength === 'string' ? firstStrength : (firstStrength?.textZh || firstStrength?.text || firstStrength?.description || '');
  const values = persona.values.map(v => v.name).join('');

  // Derive archetype from domain + values
  const map: Record<string, { title: string; symbol: string; traitGroups: string[][] }> = {
    philosophy: {
      title: '智者',
      symbol: '∞',
      traitGroups: [['洞察力', '思辨力', '抽象思维'], ['内省', '超然', '热爱智慧']],
    },
    product: {
      title: '匠人',
      symbol: '◈',
      traitGroups: [['极致追求', '用户直觉', '细节敏感'], ['偏执', '完美主义', '简约即美']],
    },
    investment: {
      title: '炼金术士',
      symbol: '◉',
      traitGroups: [['风险直觉', '长期主义', '逆向思维'], ['耐心', '独立判断', '概率思维']],
    },
    technology: {
      title: '炼火者',
      symbol: '△',
      traitGroups: [['第一性原理', '工程思维', '可扩展性'], ['极客', '简洁方案', '技术浪漫']],
    },
    leadership: {
      title: '布道者',
      symbol: '◇',
      traitGroups: [['愿景驱动', '感召力', '使命传递'], ['狂热', '改变世界', '敢于冒险']],
    },
    creativity: {
      title: '炼光者',
      symbol: '✦',
      traitGroups: [['跨维连接', '直觉跃迁', '形式敏感'], ['不安分', '独特视角', '美即正义']],
    },
    science: {
      title: '求真者',
      symbol: '◎',
      traitGroups: [['第一性', '实验精神', '模型构建'], ['怀疑一切', '精确', '认知诚实']],
    },
    default: {
      title: '炼道者',
      symbol: '◈',
      traitGroups: [['直觉', '专注', '韧性'], ['深度', '使命', '独特路径']],
    },
  };

  const key = Object.keys(map).find(k => domain.includes(k)) ?? 'default';
  const entry = map[key];
  const traits = entry.traitGroups[0].slice(0, 3);
  const desc = `${persona.nameZh} 以${entry.traitGroups[0].slice(0, 2).join('与')}为核心驱动力，在${domainLabel(domain) || '跨界领域'}中展现出罕见的${entry.traitGroups[1][0]}特质。`;

  return { title: entry.title, desc, traits, symbol: entry.symbol };
}

export function AstroProfile({ persona, theme }: Props) {
  const { title, desc, traits, symbol } = deriveArchetype(persona);

  return (
    <section
      className="relative px-6 py-24"
      style={{ borderTop: `1px solid ${theme.primaryColor}18` }}
    >
      {/* Section label */}
      <div className="flex items-center gap-4 mb-12 max-w-2xl mx-auto">
        <div className="h-px flex-1" style={{ background: `linear-gradient(to right, transparent, ${theme.primaryColor}33)` }} />
        <span
          className="text-xs tracking-widest uppercase font-medium px-4 py-1 rounded-full"
          style={{
            color: theme.primaryColor,
            background: `${theme.primaryColor}0a`,
            border: `1px solid ${theme.primaryColor}22`,
          }}
        >
          性格原型
        </span>
        <div className="h-px flex-1" style={{ background: `linear-gradient(to left, transparent, ${theme.primaryColor}33)` }} />
      </div>

      {/* Archetype card */}
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="relative text-center will-change-transform"
        >
          {/* Symbol */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-6"
            style={{ fontSize: '2.5rem', color: theme.primaryColor, opacity: 0.7, lineHeight: 1 }}
          >
            {symbol}
          </motion.div>

          {/* Title */}
          <motion.h3
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-3xl font-bold mb-4"
            style={{
              fontFamily: theme.fontZh ?? '"Noto Serif SC", serif',
              color: theme.primaryColor,
              letterSpacing: '0.2em',
            }}
          >
            {title} · Archetype
          </motion.h3>

          {/* Desc */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-sm leading-7 mb-8"
            style={{ color: '#94a3b8', fontFamily: theme.fontZh ?? 'inherit', maxWidth: '480px', margin: '0 auto 2rem' }}
          >
            {desc}
          </motion.p>

          {/* Trait tags */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-wrap justify-center gap-2 will-change-opacity"
          >
            {traits.map((trait, i) => (
              <motion.span
                key={trait}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.5 + i * 0.08 }}
                className="px-4 py-1.5 rounded-full text-xs font-medium"
                style={{
                  color: theme.primaryColor,
                  background: `${theme.primaryColor}0e`,
                  border: `1px solid ${theme.primaryColor}28`,
                  letterSpacing: '0.05em',
                }}
              >
                {trait}
              </motion.span>
            ))}
          </motion.div>

          {/* Disclaimer */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="mt-8 text-xs"
            style={{ color: theme.primaryColor, opacity: 0.25 }}
          >
            趣味解读 · 仅供参考 · 纯属娱乐
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
