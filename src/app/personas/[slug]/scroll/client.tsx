'use client';

/**
 * Prismatic — Persona Scroll Experience (Client)
 * A long-scroll immersive page that unfolds a persona like a scroll painting.
 */

import Link from 'next/link';
import { getPersona } from '@/lib/personas';
import { getPersonaScrollTheme, getThemeCSSVars } from '@/lib/persona-scroll-themes';
import { OpeningSection } from '@/components/scroll/opening-section';
import { SoulPortrait } from '@/components/scroll/soul-portrait';
import { CoreQuotes } from '@/components/scroll/core-quotes';
import { MentalModelMap } from '@/components/scroll/mental-model-map';
import { LifeTimeline } from '@/components/scroll/life-timeline';
import { BooksSection } from '@/components/scroll/books-section';
import { InfluenceCircle } from '@/components/scroll/influence-circle';
import { CTASection } from '@/components/scroll/cta-section';
import { AstroProfile } from '@/components/scroll/astro-profile';
import { ParticleCanvas } from '@/components/scroll/particle-canvas';

interface Props {
  slug: string;
}

export function PersonaScrollClient({ slug }: Props) {
  const persona = getPersona(slug);
  if (!persona) return null;

  const theme = getPersonaScrollTheme(persona.slug, persona.domain);
  const cssVars = getThemeCSSVars(theme);

  return (
    <div
      className="scroll-container"
      style={{
        ...cssVars,
        background: theme.bgValue,
        minHeight: '100vh',
        color: '#e2e8f0',
      }}
    >
      {/* Sticky header */}
      <header
        className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-6"
        style={{
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(16px)',
          borderBottom: `1px solid ${theme.primaryColor}22`,
        }}
      >
        <Link
          href={`/personas/${persona.slug}`}
          className="text-sm transition-opacity hover:opacity-100"
          style={{ color: theme.primaryColor, opacity: 0.7 }}
        >
          {'← 返回'}
        </Link>
        <span
          className="text-sm font-medium opacity-80 hidden sm:block"
          style={{ color: theme.primaryColor }}
        >
          {persona.nameZh}
        </span>
        <span
          className="text-xs opacity-40 hidden md:block"
          style={{ color: theme.primaryColor }}
        >
          {persona.nameEn}
        </span>
      </header>

      {/* Sections */}
      <OpeningSection persona={persona} theme={theme} />
      <SoulPortrait persona={persona} theme={theme} />

      {/* Particle Canvas — lightweight visual identity for every persona */}
      {theme.particleStyle !== 'none' && (
        <div className="relative w-full px-6 pb-16" style={{ maxWidth: '900px', margin: '0 auto' }}>
          {/* Section label */}
          <div className="flex items-center gap-4 mb-8">
            <div
              className="h-px flex-1"
              style={{
                background: `linear-gradient(to right, transparent, ${theme.primaryColor}33)`,
              }}
            />
            <span
              className="text-xs tracking-widest uppercase font-medium px-4 py-1 rounded-full"
              style={{
                color: theme.primaryColor,
                background: `${theme.primaryColor}0a`,
                border: `1px solid ${theme.primaryColor}22`,
              }}
            >
              {theme.particleStyle === 'circuit' ? '电路图谱' : theme.particleStyle === 'stars' ? '星图' : theme.particleStyle === 'waves' ? '波纹' : theme.particleStyle === 'leaves' ? '落叶' : '粒子场'}
            </span>
            <div
              className="h-px flex-1"
              style={{
                background: `linear-gradient(to left, transparent, ${theme.primaryColor}33)`,
              }}
            />
          </div>

          <ParticleCanvas
            initials={persona.nameEn.split(' ').map(w => w[0]).join('').slice(0, 2)}
            nameZh={persona.nameZh}
            primaryColor={theme.primaryColor}
            secondaryColor={theme.secondaryColor}
            particleStyle={theme.particleStyle}
            height={420}
            bgValue={theme.bgValue}
          />
        </div>
      )}

      <CoreQuotes persona={persona} theme={theme} />
      <MentalModelMap persona={persona} theme={theme} />
      <LifeTimeline persona={persona} theme={theme} />
      <BooksSection persona={persona} theme={theme} />
      <InfluenceCircle persona={persona} theme={theme} />
      <AstroProfile persona={persona} theme={theme} />
      <CTASection persona={persona} theme={theme} />
    </div>
  );
}
