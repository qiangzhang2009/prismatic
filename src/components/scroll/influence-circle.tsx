'use client';

/**
 * Influence Circle — Star-field radial influence visualization
 * Design: constellation map, not a chart — the persona as the center of their universe
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

export function InfluenceCircle({ persona, theme }: Props) {
  const domains = persona.domain.slice(0, 6);
  const values = persona.values.slice(0, 5);

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
          影响圈
        </span>
        <div className="h-px flex-1" style={{ background: `linear-gradient(to left, transparent, ${theme.primaryColor}30)` }} />
      </div>

      <div className="max-w-3xl mx-auto flex flex-col md:flex-row gap-14 items-center">
        {/* ── Constellation SVG ─────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="flex-shrink-0"
        >
          <svg
            viewBox="0 0 340 340"
            className="w-64 h-64 md:w-72 md:h-72"
            aria-hidden="true"
          >
            {/* Background stars */}
            {Array.from({ length: 30 }, (_, i) => {
              const x = 30 + Math.random() * 280;
              const y = 30 + Math.random() * 280;
              const r = 0.5 + Math.random() * 1;
              return (
                <circle
                  key={i}
                  cx={x} cy={y} r={r}
                  fill={theme.primaryColor}
                  opacity={0.1 + Math.random() * 0.15}
                />
              );
            })}

            {/* Constellation rings — dashed orbital lines */}
            {[1, 2, 3].map((ring) => {
              const r = 40 + ring * 38;
              return (
                <motion.circle
                  key={ring}
                  cx="170" cy="170" r={r}
                  fill="none"
                  stroke={theme.primaryColor}
                  strokeWidth="0.5"
                  strokeDasharray="3 7"
                  opacity={0.12}
                  initial={{ pathLength: 0, opacity: 0 }}
                  whileInView={{ pathLength: 1, opacity: 0.12 }}
                  viewport={{ once: true }}
                  transition={{ duration: 2, delay: ring * 0.3 }}
                />
              );
            })}

            {/* Domain nodes on the constellation */}
            {domains.map((domain, i) => {
              const totalAngle = domains.length;
              const angleRad = (i / totalAngle) * 2 * Math.PI - Math.PI / 2;
              const orbitR = 80 + (i % 2) * 28;
              const cx = 170 + orbitR * Math.cos(angleRad);
              const cy = 170 + orbitR * Math.sin(angleRad);
              const labelR = orbitR + 22;
              const lx = 170 + labelR * Math.cos(angleRad);
              const ly = 170 + labelR * Math.sin(angleRad);

              return (
                <g key={domain}>
                  {/* Constellation line from center */}
                  <motion.line
                    x1="170" y1="170" x2={cx} y2={cy}
                    stroke={theme.primaryColor}
                    strokeWidth="0.5"
                    opacity={0.15}
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.4 + i * 0.1 }}
                  />
                  {/* Node star */}
                  <motion.circle
                    cx={cx} cy={cy}
                    r={i % 2 === 0 ? 5 : 4}
                    fill={theme.primaryColor}
                    opacity={0.55}
                    initial={{ scale: 0, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 0.55 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.6 + i * 0.1, type: 'spring', stiffness: 300 }}
                  />
                  {/* Label */}
                  <motion.text
                    x={lx} y={ly}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={theme.primaryColor}
                    fontSize="8"
                    opacity={0.4}
                    fontFamily="system-ui"
                    initial={{ opacity: 0, y: ly + 5 }}
                    whileInView={{ opacity: 0.4, y: ly }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.8 + i * 0.1 }}
                  >
                    {(() => { const label = domainLabel(domain); return label.length > 6 ? label.slice(0, 5) + '…' : label; })()}
                  </motion.text>
                </g>
              );
            })}

            {/* Center — the persona */}
            <motion.circle cx="170" cy="170" r="14"
              fill={`${theme.primaryColor}18`}
              stroke={theme.primaryColor}
              strokeWidth="1"
              opacity={0.6}
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2, type: 'spring', stiffness: 200 }}
            />
            <motion.circle cx="170" cy="170" r="6"
              fill={theme.primaryColor}
              opacity={0.8}
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2.5, repeat: Infinity }}
            />

            {/* Center name */}
            <motion.text
              x="170" y="195" textAnchor="middle"
              fill={theme.primaryColor}
              fontSize="8" opacity={0.5}
              fontFamily="system-ui"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 0.5 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              {persona.nameZh.length > 4 ? persona.nameZh.slice(0, 4) : persona.nameZh}
            </motion.text>
          </svg>
        </motion.div>

        {/* ── Values list ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="flex-1"
        >
          <h3
            className="text-base font-medium mb-5"
            style={{ color: theme.primaryColor, opacity: 0.6, letterSpacing: '0.15em', fontSize: '0.7rem', textTransform: 'uppercase' }}
          >
            核心价值观
          </h3>

          <div className="space-y-4">
            {values.length > 0 ? values.map((v, i) => (
              <motion.div
                key={v.name}
                initial={{ opacity: 0, x: 16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }}
                className="flex items-start gap-3"
              >
                {/* Dash */}
                <div className="w-4 h-px mt-2.5 flex-shrink-0" style={{ background: theme.primaryColor, opacity: 0.4 - i * 0.05 }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: '#cbd5e1' }}>{v.nameZh || v.name}</p>
                  {v.description && (
                    <p className="text-xs mt-0.5" style={{ color: '#64748b', lineHeight: 1.5 }}>{v.description}</p>
                  )}
                </div>
              </motion.div>
            )) : (
              <p className="text-sm" style={{ color: '#64748b' }}>暂无价值观数据</p>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
