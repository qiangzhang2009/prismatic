'use client';

/**
 * Life Timeline — Minimalist horizontal timeline
 * Design: single line, clean dots, precise typography
 */
import { motion } from 'framer-motion';
import type { Persona } from '@/lib/types';
import type { PersonaScrollTheme } from '@/lib/persona-scroll-themes';

interface Props {
  persona: Persona;
  theme: PersonaScrollTheme;
}

interface TimelineItem {
  year: number;
  title: string;
  description: string;
  type: 'birth' | 'career' | 'achievement' | 'book';
}

function extractTimeline(persona: Persona): TimelineItem[] {
  const items: TimelineItem[] = [];

  for (const mm of persona.mentalModels) {
    for (const ev of mm.evidence) {
      if (ev.year) {
        items.push({
          year: ev.year,
          title: mm.nameZh,
          description: ev.quote.slice(0, 80) + (ev.quote.length > 80 ? '…' : ''),
          type: 'achievement',
        });
      }
    }
  }

  const bookSources = persona.sources.filter(s => s.type === 'book');
  if (bookSources.length > 0) {
    items.push({
      year: 2000,
      title: '代表著作',
      description: bookSources[0].title,
      type: 'book',
    });
  }

  items.sort((a, b) => a.year - b.year);

  if (items.length === 0) {
    items.push({
      year: 1970,
      title: '思想形成',
      description: '早期思想积累与形成',
      type: 'career',
    });
  }

  return items;
}

const TYPE_LABELS: Record<string, string> = {
  birth: '诞生',
  career: '职业生涯',
  achievement: '思想成就',
  book: '著作出版',
};

export function LifeTimeline({ persona, theme }: Props) {
  const items = extractTimeline(persona);

  return (
    <section
      className="relative px-6 py-28"
      style={{ borderTop: `1px solid ${theme.primaryColor}15` }}
    >
      {/* Section label */}
      <div className="flex items-center gap-4 mb-16 max-w-6xl mx-auto">
        <div className="h-px flex-1" style={{ background: `linear-gradient(to right, transparent, ${theme.primaryColor}30)` }} />
        <span
          className="text-xs tracking-widest uppercase font-medium px-4 py-1 rounded-full"
          style={{
            color: theme.primaryColor,
            background: `${theme.primaryColor}08`,
            border: `1px solid ${theme.primaryColor}20`,
            letterSpacing: '0.2em',
          }}
        >
          人生轨迹
        </span>
        <div className="h-px flex-1" style={{ background: `linear-gradient(to left, transparent, ${theme.primaryColor}30)` }} />
      </div>

      {/* Timeline — horizontal scroll */}
      <div
        className="max-w-6xl mx-auto overflow-x-auto pb-4"
        style={{ scrollbarWidth: 'thin', scrollbarColor: `${theme.primaryColor}25 transparent` }}
      >
        {/* The timeline line */}
        <div className="relative" style={{ minWidth: `${Math.max(items.length, 3) * 240 + 120}px` }}>
          {/* Horizontal axis */}
          <div
            className="absolute left-12 right-12 h-px top-1/2"
            style={{ background: `linear-gradient(to right, transparent, ${theme.primaryColor}25 10%, ${theme.primaryColor}25 90%, transparent)` }}
          />

          {items.map((item, i) => (
            <motion.div
              key={`${item.year}-${i}`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.07, ease: [0.4, 0, 0.2, 1] }}
              className="relative inline-block align-top"
              style={{ width: '240px', paddingTop: '60px', paddingBottom: '60px', paddingLeft: '12px', paddingRight: '12px' }}
            >
              {/* Year — above the line */}
              <div className="absolute left-1/2 -translate-x-1/2" style={{ top: '-1rem' }}>
                <span
                  className="text-3xl font-bold block text-center"
                  style={{
                    fontFamily: theme.fontDisplay,
                    color: theme.primaryColor,
                    opacity: 0.55,
                    lineHeight: 1,
                  }}
                >
                  {item.year}
                </span>
              </div>

              {/* Dot on the line */}
              <div
                className="absolute left-1/2 -translate-x-1/2 top-1/2 w-2.5 h-2.5 rounded-full"
                style={{
                  background: theme.primaryColor,
                  boxShadow: `0 0 12px ${theme.primaryColor}60`,
                  transform: 'translate(-50%, -50%)',
                }}
              />

              {/* Card — below the line */}
              <div
                className="mt-8 mx-1 p-4 rounded-xl"
                style={{
                  background: `${theme.primaryColor}06`,
                  border: `1px solid ${theme.primaryColor}18`,
                }}
              >
                {/* Type label */}
                <span
                  className="text-xs px-2 py-0.5 rounded-full mb-2 inline-block"
                  style={{
                    color: theme.primaryColor,
                    background: `${theme.primaryColor}10`,
                    fontSize: '0.6rem',
                    letterSpacing: '0.05em',
                  }}
                >
                  {TYPE_LABELS[item.type] ?? item.type}
                </span>

                <p
                  className="text-sm font-medium mb-1 leading-snug"
                  style={{ color: '#e2e8f0', fontFamily: theme.fontZh ?? 'inherit' }}
                >
                  {item.title}
                </p>
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: '#64748b' }}
                >
                  {item.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Drag hint */}
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="text-center text-xs mt-4"
        style={{ color: theme.primaryColor, opacity: 0.3 }}
      >
        ← 左右滑动探索 →
      </motion.p>
    </section>
  );
}
