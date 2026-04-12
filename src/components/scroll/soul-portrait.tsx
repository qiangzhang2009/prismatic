'use client';

/**
 * Soul Portrait — Minimalist geometric portrait
 * Design: geometric construction, clean strokes, breathing motion
 * Every element is intentional. Nothing decorative for its own sake.
 */
import { motion } from 'framer-motion';
import type { Persona } from '@/lib/types';
import type { PersonaScrollTheme } from '@/lib/persona-scroll-themes';

interface Props {
  persona: Persona;
  theme: PersonaScrollTheme;
}

// ─── Geometric Portrait Engine ────────────────────────────────────────────────

function getPortraitVariant(domain: string[]): 'classical' | 'geometric' | 'flowing' | 'angular' {
  const d = domain[0] ?? '';
  if (['philosophy', 'stoicism', 'zen-buddhism', 'spirituality'].some(k => d.includes(k))) return 'classical';
  if (['technology', 'engineering', 'AI', 'semiconductor'].some(k => d.includes(k))) return 'geometric';
  if (['creativity', 'design'].some(k => d.includes(k))) return 'flowing';
  return 'angular';
}

function GeometricPortrait({ theme, domains }: { theme: PersonaScrollTheme; domains: string[] }) {
  const primary = theme.primaryColor;
  const variant = getPortraitVariant(domains);
  const c = (opacity: number) => `${primary}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;

  if (variant === 'classical') {
    // Classical: circle + cross composition — like a compass rose / astronomical diagram
    return (
      <div className="relative flex items-center justify-center w-full max-w-xs mx-auto">
        <svg viewBox="0 0 280 320" className="w-full" aria-hidden="true">
          {/* Outer circle */}
          <motion.circle
            cx="140" cy="150" r="110"
            fill="none" stroke={primary}
            strokeWidth="0.75" opacity={0.18}
            animate={{ opacity: [0.12, 0.2, 0.12] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* Middle ring */}
          <motion.circle
            cx="140" cy="150" r="80"
            fill="none" stroke={primary}
            strokeWidth="0.5" opacity={0.12}
            animate={{ r: [78, 84, 78] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* Inner circle */}
          <motion.circle
            cx="140" cy="150" r="40"
            fill={primary} opacity={0.08}
            animate={{ opacity: [0.06, 0.12, 0.06], r: [38, 42, 38] }}
            transition={{ duration: 3.5, repeat: Infinity }}
          />
          {/* Center dot — the soul */}
          <motion.circle
            cx="140" cy="150" r="6"
            fill={primary}
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          />
          {/* Cardinal points */}
          {[0, 90, 180, 270].map((deg, i) => {
            const rad = (deg * Math.PI) / 180;
            const x1 = 140 + Math.cos(rad) * 85;
            const y1 = 150 + Math.sin(rad) * 85;
            const x2 = 140 + Math.cos(rad) * 100;
            const y2 = 150 + Math.sin(rad) * 100;
            return (
              <motion.line
                key={deg} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={primary} strokeWidth="0.75" opacity={0.25}
                animate={{ opacity: [0.15, 0.35, 0.15] }}
                transition={{ duration: 3 + i * 0.5, repeat: Infinity, delay: i * 0.3 }}
              />
            );
          })}
          {/* Vertical axis */}
          <line x1="140" y1="40" x2="140" y2="260" stroke={primary} strokeWidth="0.5" opacity="0.1" />
          {/* Horizontal axis */}
          <line x1="40" y1="150" x2="240" y2="150" stroke={primary} strokeWidth="0.5" opacity="0.1" />
          {/* Signature line below */}
          <motion.path
            d="M 100 280 Q 140 285 180 280"
            fill="none" stroke={primary} strokeWidth="0.75" opacity={0.15}
            animate={{ opacity: [0.1, 0.2, 0.1] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
        </svg>
      </div>
    );
  }

  if (variant === 'geometric') {
    // Geometric: hex + triangle mesh — like circuit / architecture
    return (
      <div className="relative flex items-center justify-center w-full max-w-xs mx-auto">
        <svg viewBox="0 0 280 300" className="w-full" aria-hidden="true">
          {/* Hexagon outline */}
          {['M 140 60 L 205 95 L 205 175 L 140 210 L 75 175 L 75 95 Z'].map((d, i) => (
            <motion.path
              key="hex"
              d={d}
              fill="none" stroke={primary} strokeWidth="0.75" opacity={0.15}
              animate={{ opacity: [0.1, 0.2, 0.1] }}
              transition={{ duration: 4 + i, repeat: Infinity, ease: 'easeInOut' }}
            />
          ))}
          {/* Inner hex */}
          <motion.path
            d="M 140 95 L 178 117 L 178 163 L 140 185 L 102 163 L 102 117 Z"
            fill={primary} opacity={0.06}
            animate={{ opacity: [0.04, 0.1, 0.04] }}
            transition={{ duration: 3.5, repeat: Infinity }}
          />
          {/* Triangular divisions */}
          <line x1="140" y1="60" x2="75" y2="175" stroke={primary} strokeWidth="0.5" opacity={0.1} />
          <line x1="140" y1="60" x2="205" y2="175" stroke={primary} strokeWidth="0.5" opacity={0.1} />
          <line x1="75" y1="95" x2="205" y2="175" stroke={primary} strokeWidth="0.5" opacity={0.1} />
          {/* Center node */}
          <motion.circle cx="140" cy="140" r="8"
            fill={primary} opacity={0.7}
            animate={{ opacity: [0.5, 0.9, 0.5] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          />
          <motion.circle cx="140" cy="140" r="16"
            fill="none" stroke={primary} strokeWidth="0.75" opacity={0.2}
            animate={{ r: [14, 20, 14], opacity: [0.15, 0.3, 0.15] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
          {/* Tech lines */}
          {[80, 140, 200].map((y, i) => (
            <motion.line key={y} x1="80" y1={y} x2="200" y2={y}
              stroke={primary} strokeWidth="0.5" opacity={0.08}
              animate={{ opacity: [0.05, 0.12, 0.05] }}
              transition={{ duration: 3 + i * 0.4, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
          {/* Bottom signal */}
          <motion.path
            d="M 80 250 L 110 230 L 140 245 L 170 225 L 200 240"
            fill="none" stroke={primary} strokeWidth="1" opacity={0.2}
            animate={{ pathLength: [0, 1], opacity: [0.1, 0.25, 0.1] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
        </svg>
      </div>
    );
  }

  if (variant === 'flowing') {
    // Flowing: wave forms — organic, musical
    return (
      <div className="relative flex items-center justify-center w-full max-w-xs mx-auto">
        <svg viewBox="0 0 280 300" className="w-full" aria-hidden="true">
          {/* Wave layers */}
          {[0.7, 0.5, 0.3].map((scale, i) => (
            <motion.path
              key={i}
              d={`M 20 ${150 + i * 20} Q 70 ${100 + i * 10} 140 ${150 + i * 20} Q 210 ${200 + i * 10} 260 ${150 + i * 20}`}
              fill="none" stroke={primary}
              strokeWidth="1" opacity={0.15 - i * 0.04}
              animate={{ d: [
                `M 20 ${150 + i * 20} Q 70 ${100 + i * 10} 140 ${150 + i * 20} Q 210 ${200 + i * 10} 260 ${150 + i * 20}`,
                `M 20 ${150 + i * 20} Q 70 ${90 + i * 15} 140 ${150 + i * 20} Q 210 ${210 + i * 5} 260 ${150 + i * 20}`,
                `M 20 ${150 + i * 20} Q 70 ${100 + i * 10} 140 ${150 + i * 20} Q 210 ${200 + i * 10} 260 ${150 + i * 20}`,
              ]}}
              transition={{ duration: 4 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.5 }}
            />
          ))}
          {/* Central form */}
          <motion.ellipse cx="140" cy="140" rx="50" ry="65"
            fill={primary} opacity={0.07}
            animate={{ opacity: [0.05, 0.1, 0.05], rx: [48, 54, 48] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
          <motion.circle cx="140" cy="140" r="5"
            fill={primary}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          />
        </svg>
      </div>
    );
  }

  // Default: angular — clean intersecting lines
  return (
    <div className="relative flex items-center justify-center w-full max-w-xs mx-auto">
      <svg viewBox="0 0 280 320" className="w-full" aria-hidden="true">
        {/* Outer diamond */}
        <motion.polygon
          points="140,40 240,150 140,260 40,150"
          fill="none" stroke={primary} strokeWidth="0.75" opacity={0.15}
          animate={{ opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 5, repeat: Infinity }}
        />
        {/* Inner diamond */}
        <motion.polygon
          points="140,80 200,150 140,220 80,150"
          fill={primary} opacity={0.06}
          animate={{ opacity: [0.04, 0.09, 0.04] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
        {/* Center node */}
        <motion.circle cx="140" cy="150" r="7"
          fill={primary}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2.5, repeat: Infinity }}
        />
        {/* Radial lines */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
          const rad = (deg * Math.PI) / 180;
          const x2 = 140 + Math.cos(rad) * 130;
          const y2 = 150 + Math.sin(rad) * 130;
          return (
            <motion.line key={deg} x1="140" y1="150" x2={x2} y2={y2}
              stroke={primary} strokeWidth="0.5" opacity={0.08}
              animate={{ opacity: [0.05, 0.12, 0.05] }}
              transition={{ duration: 3 + i * 0.3, repeat: Infinity, delay: i * 0.15 }}
            />
          );
        })}
        {/* Base triangle accent */}
        <motion.polygon
          points="140,230 160,260 120,260"
          fill="none" stroke={primary} strokeWidth="0.75" opacity={0.12}
          animate={{ opacity: [0.08, 0.18, 0.08] }}
          transition={{ duration: 3.5, repeat: Infinity }}
        />
      </svg>
    </div>
  );
}

export function SoulPortrait({ persona, theme }: Props) {
  return (
    <section
      className="relative px-6 py-28"
      style={{ borderTop: `1px solid ${theme.primaryColor}15` }}
    >
      {/* Section label */}
      <div className="flex items-center gap-4 mb-16 max-w-4xl mx-auto">
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
          灵魂肖像
        </span>
        <div className="h-px flex-1" style={{ background: `linear-gradient(to left, transparent, ${theme.primaryColor}30)` }} />
      </div>

      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-12 md:gap-20">
        {/* Portrait — left */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
          className="flex-shrink-0 w-64 md:w-72"
        >
          <GeometricPortrait theme={theme} domains={persona.domain} />
        </motion.div>

        {/* Text — right */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1], delay: 0.15 }}
          className="flex-1 text-center md:text-left"
        >
          {/* Name with accent line */}
          <div className="flex items-center gap-3 mb-4 justify-center md:justify-start">
            <div className="w-8 h-px" style={{ background: theme.primaryColor }} />
            <span
              className="text-sm tracking-widest uppercase"
              style={{ color: theme.primaryColor, opacity: 0.5, fontFamily: theme.fontDisplay }}
            >
              {persona.nameEn}
            </span>
          </div>

          <h2
            className="text-2xl font-bold mb-5 leading-snug"
            style={{ fontFamily: theme.fontZh ?? '"Noto Serif SC", serif', color: '#e2e8f0' }}
          >
            {persona.nameZh}
          </h2>

          <p
            className="text-sm leading-7 mb-6"
            style={{ color: '#64748b', fontFamily: theme.fontZh ?? 'inherit' }}
          >
            {persona.briefZh}
          </p>

          {/* Domain pills */}
          <div className="flex flex-wrap gap-2 justify-center md:justify-start">
            {persona.domain.slice(0, 3).map((d) => (
              <span
                key={d}
                className="px-3 py-1 rounded-full text-xs font-medium"
                style={{
                  border: `1px solid ${theme.primaryColor}35`,
                  color: theme.primaryColor,
                  background: `${theme.primaryColor}07`,
                  letterSpacing: '0.05em',
                }}
              >
                {d}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
