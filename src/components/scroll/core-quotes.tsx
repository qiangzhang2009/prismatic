'use client';

/**
 * Core Quotes — Magazine editorial layout
 * Design: generous whitespace, typographic hierarchy, breath-taking entry animation
 */
import { motion } from 'framer-motion';
import type { Persona } from '@/lib/types';
import type { PersonaScrollTheme } from '@/lib/persona-scroll-themes';

interface Props {
  persona: Persona;
  theme: PersonaScrollTheme;
}

export function CoreQuotes({ persona, theme }: Props) {
  const quotes = persona.mentalModels.slice(0, 5).map((m) => ({
    text: m.oneLiner,
    source: m.nameZh,
  }));

  if (quotes.length === 0) return null;

  return (
    <section
      className="relative px-6 py-28"
      style={{ borderTop: `1px solid ${theme.primaryColor}15` }}
    >
      {/* Section label */}
      <div className="flex items-center gap-4 mb-16 max-w-3xl mx-auto">
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
          思想精华
        </span>
        <div className="h-px flex-1" style={{ background: `linear-gradient(to left, transparent, ${theme.primaryColor}30)` }} />
      </div>

      {/* Quote list */}
      <div className="max-w-3xl mx-auto">
        {quotes.map((quote, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1], delay: i * 0.08 }}
            className="relative py-8"
          >
            {/* Top divider (except first) */}
            {i > 0 && (
              <div
                className="absolute top-0 left-0 right-0 h-px"
                style={{ background: `${theme.primaryColor}12` }}
              />
            )}

            {/* Large decorative quote mark */}
            <div
              className="absolute left-0 top-2 select-none leading-none pointer-events-none"
              style={{
                fontSize: '4rem',
                color: theme.primaryColor,
                opacity: 0.1,
                fontFamily: 'Georgia, serif',
                lineHeight: 1,
                fontWeight: 300,
              }}
              aria-hidden="true"
            >
              &ldquo;
            </div>

            {/* Quote content */}
            <div className="pl-8">
              <blockquote
                className="relative"
                style={{ borderLeft: `1px solid ${theme.primaryColor}30`, paddingLeft: '1.5rem' }}
              >
                {/* Number accent */}
                <span
                  className="absolute -left-3 -top-1 text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full"
                  style={{
                    color: theme.primaryColor,
                    background: `${theme.primaryColor}10`,
                    border: `1px solid ${theme.primaryColor}25`,
                    fontFamily: theme.fontDisplay,
                    fontSize: '0.6rem',
                  }}
                  aria-hidden="true"
                >
                  {String(i + 1).padStart(2, '0')}
                </span>

                <p
                  className="text-base md:text-lg leading-relaxed mb-3"
                  style={{
                    fontFamily: theme.fontZh ?? '"Noto Serif SC", serif',
                    color: '#cbd5e1',
                    fontWeight: 400,
                    letterSpacing: '0.01em',
                  }}
                >
                  {quote.text}
                </p>

                <footer
                  className="text-xs tracking-wider mt-2"
                  style={{ color: theme.primaryColor, opacity: 0.45, fontFamily: theme.fontDisplay }}
                >
                  — {quote.source}
                </footer>
              </blockquote>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
