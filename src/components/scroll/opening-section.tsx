'use client';

/**
 * Opening Section — World-class minimalist hero
 * Design philosophy: Steve Jobs × Dieter Rams
 * Single focal point: the name. Nothing else competes.
 */
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import type { Persona } from '@/lib/types';
import type { PersonaScrollTheme } from '@/lib/persona-scroll-themes';

interface Props {
  persona: Persona;
  theme: PersonaScrollTheme;
}

export function OpeningSection({ persona, theme }: Props) {
  const tagline = theme.taglineOverride ?? persona.taglineZh;
  const sectionRef = useRef<HTMLElement>(null);
  
  // Use section-specific scroll tracking for better performance
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });

  // Parallax subtle shift on scroll - optimized with will-change
  const y = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <section
      ref={sectionRef}
      className="relative flex flex-col items-center justify-center overflow-hidden"
      style={{ minHeight: '100svh' }}
    >
      {/* ── Background: subtle grid texture ─────────────────────── */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* Fine grid */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(${theme.primaryColor}08 1px, transparent 1px),
              linear-gradient(90deg, ${theme.primaryColor}08 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
        {/* Fade to bottom */}
        <div
          className="absolute inset-x-0 bottom-0 h-40"
          style={{ background: `linear-gradient(to top, ${theme.gradientFrom}, transparent)` }}
        />
        {/* Left vertical accent line */}
        <motion.div
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 1.5, ease: [0.4, 0, 0.2, 1], delay: 0.2 }}
          className="absolute left-1/2 top-0 bottom-0 w-px origin-top"
          style={{
            background: `linear-gradient(to bottom, ${theme.primaryColor}40, transparent 60%)`,
          }}
        />
      </div>

      {/* ── Main content ───────────────────────────────────────── */}
      <motion.div
        className="relative z-10 flex flex-col items-center px-8 py-32 text-center will-change-transform"
        style={{ y, opacity }}
      >
        {/* Decorative top mark */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1], delay: 0.3 }}
          className="mb-20"
        >
          <div
            className="h-px"
            style={{
              width: '48px',
              background: `linear-gradient(to right, transparent, ${theme.primaryColor})`,
            }}
          />
        </motion.div>

        {/* Label: Domain */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1], delay: 0.4 }}
          className="mb-6"
        >
          <span
            className="text-xs tracking-widest uppercase font-medium"
            style={{
              color: theme.primaryColor,
              opacity: 0.6,
              letterSpacing: '0.35em',
              fontFamily: theme.fontDisplay,
            }}
          >
            {persona.domain[0] ?? 'Thought Leader'}
          </span>
        </motion.div>

        {/* ═══ Main name — THE focal point ═══ */}
        <motion.h1
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            duration: 1.2,
            ease: [0.16, 1, 0.3, 1], // expo out
            delay: 0.5,
          }}
          className="text-center leading-none tracking-tight mb-2"
          style={{
            fontSize: 'clamp(3.5rem, 11vw, 9rem)',
            fontWeight: 800,
            fontFamily: theme.fontZh ?? '"Noto Serif SC", serif',
            color: '#f1f5f9',
            letterSpacing: '-0.02em',
          }}
        >
          {persona.nameZh}
        </motion.h1>

        {/* English name — muted */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1], delay: 0.9 }}
          className="text-center mb-16"
          style={{
            fontSize: 'clamp(0.75rem, 1.8vw, 1.1rem)',
            color: theme.primaryColor,
            opacity: 0.5,
            letterSpacing: '0.25em',
            fontFamily: theme.fontDisplay,
            fontWeight: 400,
          }}
        >
          {persona.nameEn}
        </motion.p>

        {/* Tagline — the essence in one line */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1], delay: 1.1 }}
          className="text-center max-w-lg leading-relaxed"
          style={{
            fontSize: 'clamp(0.9rem, 1.8vw, 1.15rem)',
            color: '#64748b',
            fontFamily: theme.fontZh ?? '"Noto Serif SC", serif',
            letterSpacing: '0.02em',
          }}
        >
          {tagline}
        </motion.p>

        {/* Bottom divider */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1], delay: 1.3 }}
          className="mt-16 mb-12"
        >
          <div
            className="h-px"
            style={{
              width: '48px',
              background: `linear-gradient(to left, transparent, ${theme.primaryColor})`,
            }}
          />
        </motion.div>
      </motion.div>

      {/* ── Scroll indicator — ultra minimal ───────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 0.8 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3"
        style={{ opacity: opacity }}
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          className="flex flex-col items-center gap-1"
        >
          <span
            className="text-xs"
            style={{ color: theme.primaryColor, opacity: 0.4, letterSpacing: '0.2em', fontSize: '0.6rem' }}
          >
            SCROLL
          </span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <motion.path
              d="M6 2 L6 10 M2 7 L6 10 L10 7"
              stroke={theme.primaryColor}
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 2.5, repeat: Infinity }}
            />
          </svg>
        </motion.div>
      </motion.div>

      {/* ── Corner marks — Dieter Rams style ───────────────────── */}
      <div
        className="absolute top-6 left-6 w-6 h-6 pointer-events-none"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M0 6 L0 0 L6 0" stroke={theme.primaryColor} strokeWidth="0.75" opacity="0.2" />
        </svg>
      </div>
      <div
        className="absolute top-6 right-6 w-6 h-6 pointer-events-none"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M18 0 L24 0 L24 6" stroke={theme.primaryColor} strokeWidth="0.75" opacity="0.2" />
        </svg>
      </div>
    </section>
  );
}
