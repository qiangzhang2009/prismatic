'use client';

/**
 * Books Section — Gallery-style book showcase
 * Design: floating book cards with subtle 3D perspective, editorial feel
 */
import { motion } from 'framer-motion';
import type { Persona } from '@/lib/types';
import type { PersonaScrollTheme } from '@/lib/persona-scroll-themes';

interface Props {
  persona: Persona;
  theme: PersonaScrollTheme;
}

function BookCard({
  title,
  subtitle,
  type,
  theme,
  index,
}: {
  title: string;
  subtitle: string;
  type: string;
  theme: PersonaScrollTheme;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay: index * 0.1, ease: [0.4, 0, 0.2, 1] }}
      whileHover={{ y: -8 }}
      className="relative flex-shrink-0"
      style={{ width: '160px', perspective: '800px' }}
    >
      {/* Book body */}
      <div
        className="relative rounded-xl overflow-hidden"
        style={{
          height: '220px',
          background: `linear-gradient(145deg, ${theme.gradientFrom}, ${theme.primaryColor}18)`,
          border: `1px solid ${theme.primaryColor}20`,
        }}
      >
        {/* Spine line */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ background: `linear-gradient(to bottom, ${theme.primaryColor}60, transparent)` }}
        />
        {/* Top accent */}
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: `linear-gradient(to right, transparent, ${theme.primaryColor}50, transparent)` }}
        />

        {/* Content */}
        <div className="relative h-full flex flex-col justify-between p-4">
          {/* Type badge */}
          <div>
            <span
              className="text-xs px-2 py-0.5 rounded-full inline-block"
              style={{
                color: theme.primaryColor,
                background: `${theme.primaryColor}12`,
                border: `1px solid ${theme.primaryColor}22`,
                fontSize: '0.6rem',
                letterSpacing: '0.05em',
              }}
            >
              {type}
            </span>
          </div>

          {/* Bottom content */}
          <div>
            <p
              className="text-sm font-semibold leading-snug mb-1"
              style={{
                fontFamily: theme.fontZh ?? '"Noto Serif SC", serif',
                color: '#e2e8f0',
                fontSize: '0.8rem',
              }}
            >
              {title}
            </p>
            <p className="text-xs leading-relaxed" style={{ color: '#64748b', fontSize: '0.65rem' }}>
              {subtitle}
            </p>
          </div>
        </div>

        {/* Hover shimmer */}
        <div
          className="absolute inset-0 pointer-events-none rounded-xl"
          style={{
            background: `linear-gradient(135deg, transparent 40%, ${theme.primaryColor}08 60%, transparent 80%)`,
            transform: 'translateX(-100%)',
          }}
        />
      </div>
    </motion.div>
  );
}

export function BooksSection({ persona, theme }: Props) {
  const books = persona.sources
    .filter(s => s.type === 'book' || s.type === 'essay' || s.type === 'classical_text')
    .slice(0, 6)
    .map(s => ({
      title: s.title.length > 20 ? s.title.slice(0, 18) + '…' : s.title,
      subtitle: s.description?.slice(0, 60) || s.source || '经典原典',
      type: s.type === 'classical_text' ? '古典原典' : s.type === 'essay' ? '文章' : '著作',
    }));

  const displayBooks =
    books.length > 0
      ? books
      : persona.mentalModels.slice(0, 4).map(m => ({
          title: m.nameZh,
          subtitle: m.oneLiner.slice(0, 50),
          type: '思想模型',
        }));

  return (
    <section
      className="relative px-6 py-28"
      style={{ borderTop: `1px solid ${theme.primaryColor}15` }}
    >
      {/* Section label */}
      <div className="flex items-center gap-4 mb-14 max-w-6xl mx-auto">
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
          原典著作
        </span>
        <div className="h-px flex-1" style={{ background: `linear-gradient(to left, transparent, ${theme.primaryColor}30)` }} />
      </div>

      {/* Books horizontal scroll */}
      <div
        className="flex gap-5 overflow-x-auto pb-4"
        style={{ scrollbarWidth: 'thin', scrollbarColor: `${theme.primaryColor}20 transparent` }}
      >
        {displayBooks.map((book, i) => (
          <BookCard key={i} {...book} theme={theme} index={i} />
        ))}
      </div>

      <p
        className="text-center text-xs mt-6"
        style={{ color: theme.primaryColor, opacity: 0.3 }}
      >
        ← 横向滑动 →
      </p>
    </section>
  );
}
