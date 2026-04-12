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
import type { Persona } from '@/lib/types';
import type { PersonaScrollTheme } from '@/lib/persona-scroll-themes';

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
