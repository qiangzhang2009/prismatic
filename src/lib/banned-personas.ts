/**
 * Banned Personas — Lightweight constant
 * Separated from personas.ts to avoid bundling the 1MB persona data
 * for components that only need this list.
 */
export const BANNED_PERSONAS = ['zhang-xuefeng', 'donald-trump', 'taylor-swift'] as const;
export type BannedPersonaId = typeof BANNED_PERSONAS[number];
