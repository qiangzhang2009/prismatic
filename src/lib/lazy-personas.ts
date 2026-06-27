/**
 * Prismatic — Lazy Persona Loader
 * Dynamic import for full persona data to optimize initial bundle size.
 * 
 * Usage:
 *   import { getFullPersona, getPersonaPersona } from '@/lib/lazy-personas';
 *   const persona = await getFullPersona('steve-jobs');
 */

import type { Persona } from './types';

// Re-export the lightweight index for backward compatibility
export { PERSONA_INDEX, PERSONA_INDEX_MAP, type PersonaIndexEntry } from './persona-index';

// ─── Lazy Loading Implementation ──────────────────────────────────────────────

// Cache for loaded full personas
const personaCache = new Map<string, Persona>();

// Dynamic import of full persona data
async function loadPersonaData(): Promise<Record<string, Persona>> {
  const { PERSONAS } = await import('./personas');
  return PERSONAS;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get a full persona by slug. Uses dynamic import to avoid loading all personas upfront.
 * Results are cached after first load.
 */
export async function getFullPersona(slug: string): Promise<Persona | undefined> {
  // Check cache first
  if (personaCache.has(slug)) {
    return personaCache.get(slug);
  }

  // Lazy load all personas and cache
  const allPersonas = await loadPersonaData();
  
  // Cache all loaded personas
  for (const [key, persona] of Object.entries(allPersonas)) {
    personaCache.set(key, persona);
  }
  
  return personaCache.get(slug);
}

/**
 * Get multiple full personas by slugs. More efficient than calling getFullPersona multiple times.
 */
export async function getFullPersonas(slugs: string[]): Promise<Persona[]> {
  // Ensure all are loaded
  if (personaCache.size === 0) {
    const allPersonas = await loadPersonaData();
    for (const [key, persona] of Object.entries(allPersonas)) {
      personaCache.set(key, persona);
    }
  }
  
  return slugs
    .map(slug => personaCache.get(slug))
    .filter((p): p is Persona => p !== undefined);
}

/**
 * Synchronous access to all full personas. Only use this for SSR or when you need all personas.
 * This will load the entire personas module.
 */
export function getAllPersonasSync(): Record<string, Persona> {
  // This will be set after first dynamic import
  if (personaCache.size === 0) {
    // For synchronous access, we need to require synchronously
    // This is a fallback for SSR pages
    console.warn('[lazy-personas] Synchronous access called before lazy load. Consider using getFullPersona() instead.');
    // Return empty cache - SSR pages should use dynamic import
    return {};
  }
  return Object.fromEntries(personaCache.entries());
}

/**
 * Preload all personas into cache. Call this during app initialization.
 */
export async function preloadAllPersonas(): Promise<void> {
  await loadPersonaData();
}

/**
 * Clear the persona cache. Useful for testing or memory management.
 */
export function clearPersonaCache(): void {
  personaCache.clear();
}

// ─── Type helper for full persona access ─────────────────────────────────────

/**
 * Type-safe wrapper for accessing full persona data.
 * Returns the persona if available, undefined otherwise.
 */
export type PersonaWithSlug<T extends { slug: string }> = T & Persona;
