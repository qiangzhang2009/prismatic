/**
 * Prismatic — Persona Scroll Theme Configuration
 * Each persona has a unique visual soul. Core 10 are hand-tuned,
 * others are auto-generated from domain.
 */

export interface PersonaScrollTheme {
  /** Primary accent color (used for text highlights, borders) */
  primaryColor: string;
  /** Secondary accent */
  secondaryColor: string;
  /** Gradient background from color */
  gradientFrom: string;
  /** Gradient background to color */
  gradientTo: string;
  /** Background type */
  bgType: 'gradient' | 'solid' | 'particles';
  /** CSS gradient value or solid hex */
  bgValue: string;
  /** Display font for this persona */
  fontDisplay: string;
  /** Font for Chinese text */
  fontZh?: string;
  /** Scroll animation easing */
  scrollEasing: 'ease' | 'spring' | 'linear';
  /** Particle/decorative style */
  particleStyle: 'stars' | 'none' | 'circuit' | 'waves' | 'leaves';
  /** Optional tagline override (falls back to persona.taglineZh) */
  taglineOverride?: string;
  /** Visual mood description */
  mood: 'minimal' | 'dramatic' | 'philosophical' | 'energetic' | 'classical';
  /** Section transition: vertical 'slide' or 'fade' */
  transitionStyle: 'slide' | 'fade';
}

// Domain → visual style auto-mapping
const DOMAIN_THEMES: Record<string, { primaryColor: string; gradientFrom: string; gradientTo: string; mood: PersonaScrollTheme['mood']; particleStyle: PersonaScrollTheme['particleStyle'] }> = {
  product: { primaryColor: '#8b5cf6', gradientFrom: '#1a1a2e', gradientTo: '#16213e', mood: 'minimal', particleStyle: 'none' },
  design: { primaryColor: '#f472b6', gradientFrom: '#1f1147', gradientTo: '#0f172a', mood: 'dramatic', particleStyle: 'waves' },
  strategy: { primaryColor: '#f59e0b', gradientFrom: '#1c1917', gradientTo: '#292524', mood: 'dramatic', particleStyle: 'circuit' },
  investment: { primaryColor: '#10b981', gradientFrom: '#052e16', gradientTo: '#064e3b', mood: 'minimal', particleStyle: 'none' },
  philosophy: { primaryColor: '#a78bfa', gradientFrom: '#0c0a1d', gradientTo: '#1e1b4b', mood: 'philosophical', particleStyle: 'stars' },
  technology: { primaryColor: '#38bdf8', gradientFrom: '#0c1a2e', gradientTo: '#0f172a', mood: 'energetic', particleStyle: 'circuit' },
  engineering: { primaryColor: '#22d3ee', gradientFrom: '#083344', gradientTo: '#0c4a6e', mood: 'minimal', particleStyle: 'circuit' },
  leadership: { primaryColor: '#fb923c', gradientFrom: '#1c0a00', gradientTo: '#431407', mood: 'dramatic', particleStyle: 'none' },
  creativity: { primaryColor: '#e879f9', gradientFrom: '#1a0533', gradientTo: '#4c1d95', mood: 'dramatic', particleStyle: 'waves' },
  education: { primaryColor: '#34d399', gradientFrom: '#022c22', gradientTo: '#064e3b', mood: 'minimal', particleStyle: 'none' },
  negotiation: { primaryColor: '#f87171', gradientFrom: '#1f0a0a', gradientTo: '#450a0a', mood: 'dramatic', particleStyle: 'none' },
  science: { primaryColor: '#60a5fa', gradientFrom: '#0c1929', gradientTo: '#1e3a5f', mood: 'minimal', particleStyle: 'stars' },
  risk: { primaryColor: '#fbbf24', gradientFrom: '#1c1400', gradientTo: '#292524', mood: 'dramatic', particleStyle: 'none' },
  ethics: { primaryColor: '#6ee7b7', gradientFrom: '#052e16', gradientTo: '#064e3b', mood: 'philosophical', particleStyle: 'none' },
  psychology: { primaryColor: '#c084fc', gradientFrom: '#1a0533', gradientTo: '#3b0764', mood: 'philosophical', particleStyle: 'stars' },
  spirituality: { primaryColor: '#fcd34d', gradientFrom: '#1c1400', gradientTo: '#422006', mood: 'classical', particleStyle: 'waves' },
  stoicism: { primaryColor: '#d4a574', gradientFrom: '#1a1008', gradientTo: '#292524', mood: 'classical', particleStyle: 'none' },
  'zen-buddhism': { primaryColor: '#86efac', gradientFrom: '#052e16', gradientTo: '#14532d', mood: 'classical', particleStyle: 'leaves' },
  AI: { primaryColor: '#818cf8', gradientFrom: '#0c0a1d', gradientTo: '#1e1b4b', mood: 'energetic', particleStyle: 'circuit' },
  semiconductor: { primaryColor: '#4ade80', gradientFrom: '#052e16', gradientTo: '#166534', mood: 'minimal', particleStyle: 'circuit' },
  'e-commerce': { primaryColor: '#fb923c', gradientFrom: '#1c0a00', gradientTo: '#431407', mood: 'minimal', particleStyle: 'none' },
  space: { primaryColor: '#38bdf8', gradientFrom: '#030712', gradientTo: '#0c1a2e', mood: 'dramatic', particleStyle: 'stars' },
  economics: { primaryColor: '#a3e635', gradientFrom: '#0a1a05', gradientTo: '#1a2e05', mood: 'minimal', particleStyle: 'none' },
  startup: { primaryColor: '#f97316', gradientFrom: '#1c0a00', gradientTo: '#431407', mood: 'energetic', particleStyle: 'circuit' },
  investing: { primaryColor: '#10b981', gradientFrom: '#022c22', gradientTo: '#064e3b', mood: 'minimal', particleStyle: 'none' },
  innovation: { primaryColor: '#38bdf8', gradientFrom: '#0c1929', gradientTo: '#0f172a', mood: 'energetic', particleStyle: 'circuit' },
  principles: { primaryColor: '#10b981', gradientFrom: '#052e16', gradientTo: '#064e3b', mood: 'minimal', particleStyle: 'none' },
};

// Default fallback
const DEFAULT_THEME: PersonaScrollTheme = {
  primaryColor: '#8b5cf6',
  gradientFrom: '#1a1a2e',
  gradientTo: '#16213e',
  bgType: 'gradient',
  bgValue: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
  fontDisplay: 'Georgia, serif',
  scrollEasing: 'spring',
  particleStyle: 'none',
  mood: 'minimal',
  transitionStyle: 'fade',
  secondaryColor: '#8b5cf6',
};

// ─── Hand-tuned themes for core personas ─────────────────────────────────────

const CORE_THEMES: Record<string, PersonaScrollTheme> = {

  'naval-ravikant': {
    primaryColor: '#60a5fa',
    secondaryColor: '#3b82f6',
    gradientFrom: '#0a0f1e',
    gradientTo: '#0f172a',
    bgType: 'particles',
    bgValue: 'linear-gradient(135deg, #0a0f1e 0%, #0f172a 50%, #0c1929 100%)',
    fontDisplay: 'Georgia, "Noto Serif SC", serif',
    fontZh: '"Noto Serif SC", serif',
    scrollEasing: 'ease',
    particleStyle: 'stars',
    taglineOverride: '财富是健康、知识和爱的复制品',
    mood: 'philosophical',
    transitionStyle: 'fade',
  },

  'steve-jobs': {
    primaryColor: '#f87171',
    secondaryColor: '#fb923c',
    gradientFrom: '#0a0a0a',
    gradientTo: '#18181b',
    bgType: 'solid',
    bgValue: 'linear-gradient(135deg, #0a0a0a 0%, #18181b 60%, #1c1c1e 100%)',
    fontDisplay: '"SF Pro Display", -apple-system, sans-serif',
    scrollEasing: 'spring',
    particleStyle: 'none',
    taglineOverride: '保持饥饿，保持愚蠢',
    mood: 'minimal',
    transitionStyle: 'slide',
  },

  'charlie-munger': {
    primaryColor: '#d4a574',
    secondaryColor: '#b45309',
    gradientFrom: '#1c0f08',
    gradientTo: '#292524',
    bgType: 'gradient',
    bgValue: 'linear-gradient(135deg, #1c0f08 0%, #292524 100%)',
    fontDisplay: '"Georgia", "Times New Roman", serif',
    fontZh: '"Noto Serif SC", serif',
    scrollEasing: 'ease',
    particleStyle: 'none',
    taglineOverride: '知道自己会死在哪里，就永远不去那里',
    mood: 'classical',
    transitionStyle: 'fade',
  },

  'elon-musk': {
    primaryColor: '#f97316',
    secondaryColor: '#fbbf24',
    gradientFrom: '#030712',
    gradientTo: '#0c1a2e',
    bgType: 'particles',
    bgValue: 'radial-gradient(ellipse at 20% 50%, #1a0a00 0%, #030712 60%)',
    fontDisplay: 'Arial, sans-serif',
    scrollEasing: 'spring',
    particleStyle: 'circuit',
    taglineOverride: '失败只是一个选项，若从未失败则说明创新不足',
    mood: 'energetic',
    transitionStyle: 'slide',
  },

  'ray-dalio': {
    primaryColor: '#10b981',
    secondaryColor: '#34d399',
    gradientFrom: '#022c22',
    gradientTo: '#064e3b',
    bgType: 'gradient',
    bgValue: 'linear-gradient(135deg, #022c22 0%, #064e3b 100%)',
    fontDisplay: '"Arial", sans-serif',
    scrollEasing: 'ease',
    particleStyle: 'none',
    taglineOverride: '痛苦+反思=进步',
    mood: 'minimal',
    transitionStyle: 'fade',
  },

  'peter-thiel': {
    primaryColor: '#6b7280',
    secondaryColor: '#9ca3af',
    gradientFrom: '#09090b',
    gradientTo: '#18181b',
    bgType: 'solid',
    bgValue: 'linear-gradient(135deg, #09090b 0%, #18181b 100%)',
    fontDisplay: '"Times New Roman", serif',
    fontZh: '"Noto Serif SC", serif',
    scrollEasing: 'ease',
    particleStyle: 'none',
    taglineOverride: '竞争是失败的遗产',
    mood: 'philosophical',
    transitionStyle: 'fade',
  },

  'paul-graham': {
    primaryColor: '#f97316',
    secondaryColor: '#fb923c',
    gradientFrom: '#1c0a00',
    gradientTo: '#292524',
    bgType: 'gradient',
    bgValue: 'linear-gradient(135deg, #1c0a00 0%, #292524 100%)',
    fontDisplay: '"Georgia", serif',
    fontZh: '"Noto Serif SC", serif',
    scrollEasing: 'ease',
    particleStyle: 'none',
    taglineOverride: '做自己真正热爱的事，财富会随之而来',
    mood: 'classical',
    transitionStyle: 'fade',
  },

  'jeff-bezos': {
    primaryColor: '#3b82f6',
    secondaryColor: '#60a5fa',
    gradientFrom: '#0c1929',
    gradientTo: '#1e3a5f',
    bgType: 'gradient',
    bgValue: 'linear-gradient(135deg, #0c1929 0%, #1e3a5f 100%)',
    fontDisplay: 'Arial, sans-serif',
    scrollEasing: 'ease',
    particleStyle: 'none',
    taglineOverride: '客户很难被取悦，但他们会为你的用心而忠诚',
    mood: 'minimal',
    transitionStyle: 'fade',
  },

  'confucius': {
    primaryColor: '#a78bfa',
    secondaryColor: '#7c3aed',
    gradientFrom: '#0c0a1d',
    gradientTo: '#1e1b4b',
    bgType: 'gradient',
    bgValue: 'linear-gradient(135deg, #0c0a1d 0%, #1e1b4b 60%, #0c0a1d 100%)',
    fontDisplay: '"Noto Serif SC", "STSong", serif',
    fontZh: '"Noto Serif SC", "STSong", serif',
    scrollEasing: 'ease',
    particleStyle: 'none',
    taglineOverride: '己所不欲，勿施于人',
    mood: 'classical',
    transitionStyle: 'fade',
  },

  'socrates': {
    primaryColor: '#d4a574',
    secondaryColor: '#a78bfa',
    gradientFrom: '#1a1008',
    gradientTo: '#292524',
    bgType: 'gradient',
    bgValue: 'linear-gradient(135deg, #1a1008 0%, #292524 100%)',
    fontDisplay: '"Times New Roman", "Noto Serif SC", serif',
    fontZh: '"Noto Serif SC", serif',
    scrollEasing: 'ease',
    particleStyle: 'none',
    taglineOverride: '我唯一知道的，就是我一无所知',
    mood: 'classical',
    transitionStyle: 'fade',
  },
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Get scroll theme for a persona.
 * Core personas return hand-tuned themes; others auto-generate from domain.
 */
export function getPersonaScrollTheme(
  slug: string,
  domains: string[]
): PersonaScrollTheme {
  // 1. Check hand-tuned themes first
  if (CORE_THEMES[slug]) {
    return CORE_THEMES[slug];
  }

  // 2. Auto-generate from primary domain
  const primaryDomain = domains[0] ?? '';
  const domainTheme = DOMAIN_THEMES[primaryDomain] ?? DOMAIN_THEMES[domains.find(d => DOMAIN_THEMES[d]) ?? ''];

  const base = domainTheme ?? {
    primaryColor: '#8b5cf6',
    gradientFrom: '#1a1a2e',
    gradientTo: '#16213e',
    mood: 'minimal' as const,
    particleStyle: 'none' as const,
  };

  return {
    primaryColor: base.primaryColor,
    secondaryColor: base.primaryColor + '99',
    gradientFrom: base.gradientFrom,
    gradientTo: base.gradientTo,
    bgType: base.particleStyle !== 'none' ? 'particles' : 'gradient',
    bgValue: `linear-gradient(135deg, ${base.gradientFrom} 0%, ${base.gradientTo} 100%)`,
    fontDisplay: 'Georgia, serif',
    scrollEasing: 'ease',
    particleStyle: base.particleStyle,
    mood: base.mood,
    transitionStyle: 'fade',
  };
}

/** Get CSS custom properties object from theme */
export function getThemeCSSVars(theme: PersonaScrollTheme): Record<string, string> {
  return {
    '--scroll-primary': theme.primaryColor,
    '--scroll-secondary': theme.secondaryColor,
    '--scroll-gradient-from': theme.gradientFrom,
    '--scroll-gradient-to': theme.gradientTo,
    '--scroll-font-display': theme.fontDisplay,
    '--scroll-font-zh': theme.fontZh ?? '"Noto Serif SC", serif',
    '--scroll-easing': theme.scrollEasing === 'spring' ? 'cubic-bezier(0.34, 1.56, 0.64, 1)' :
                       theme.scrollEasing === 'ease' ? 'cubic-bezier(0.4, 0, 0.2, 1)' :
                       'linear',
  };
}
