'use client';

/**
 * CTA Section — Minimalist closing: the only call is to begin
 * Design: ultra minimal, maximum impact, one thing and one thing only
 */
import { motion } from 'framer-motion';
import type { Persona } from '@/lib/types';
import type { PersonaScrollTheme } from '@/lib/persona-scroll-themes';

interface Props {
  persona: Persona;
  theme: PersonaScrollTheme;
}

export function CTASection({ persona, theme }: Props) {
  return (
    <section
      className="relative flex flex-col items-center justify-center overflow-hidden"
      style={{ minHeight: '80vh', borderTop: `1px solid ${theme.primaryColor}15` }}
    >
      {/* Ambient radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 70% 50% at 50% 50%, ${theme.primaryColor}0d, transparent 70%)`,
        }}
        aria-hidden="true"
      />

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
        className="relative z-10 text-center px-8 py-32"
      >
        {/* Label */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="text-xs tracking-widest uppercase mb-8"
          style={{
            color: theme.primaryColor,
            opacity: 0.45,
            letterSpacing: '0.35em',
            fontFamily: theme.fontDisplay,
          }}
        >
          开启对话
        </motion.p>

        {/* Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mb-6 leading-tight"
          style={{
            fontSize: 'clamp(2.2rem, 6vw, 4.5rem)',
            fontWeight: 800,
            fontFamily: theme.fontZh ?? '"Noto Serif SC", serif',
            color: '#f1f5f9',
            letterSpacing: '-0.01em',
          }}
        >
          与{persona.nameZh}对话
        </motion.h2>

        {/* Sub text */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="text-sm leading-7 mb-12"
          style={{ color: '#64748b', maxWidth: '360px', margin: '0 auto 3rem', fontFamily: theme.fontZh ?? 'inherit' }}
        >
          跨越时空的思维碰撞，让这个灵魂为你解答疑惑
        </motion.p>

        {/* CTA Button */}
        <motion.a
          href={`/app?persona=${persona.slug}`}
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5, type: 'spring', stiffness: 200, damping: 20 }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          className="relative inline-flex items-center gap-3 px-10 py-4 rounded-2xl text-white font-semibold text-base transition-all"
          style={{
            background: theme.primaryColor,
            boxShadow: `0 0 30px ${theme.primaryColor}30, 0 0 60px ${theme.primaryColor}15`,
            letterSpacing: '0.02em',
          }}
        >
          <span>开始对话</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </motion.a>

        {/* Footer mark */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="mt-16"
        >
          <div className="w-8 h-px mx-auto mb-3" style={{ background: `${theme.primaryColor}30` }} />
          <p
            className="text-xs"
            style={{ color: theme.primaryColor, opacity: 0.2, letterSpacing: '0.1em', fontFamily: theme.fontDisplay }}
          >
            {persona.nameEn} · Prismatic
          </p>
        </motion.div>
      </motion.div>
    </section>
  );
}
