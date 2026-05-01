/**
 * @mention Parsing Utility
 * Parses @mentions in comment content and renders them as clickable links.
 * Supports:
 *   - @人物名 → links to /personas/[slug] if it matches a persona nameZh
 *   - @username → links to user profile
 */

import { PERSONA_LIST } from './personas';

export interface MentionSegment {
  type: 'text' | 'persona_mention' | 'user_mention';
  text: string;
  slug?: string;      // for persona mentions
  userId?: string;    // for user mentions
  userName?: string;  // display name for user mentions
}

/**
 * Parse content into mention segments.
 * @param content - raw comment content
 * @returns array of text/mention segments
 */
export function parseMentions(content: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  // Include middle dot · (U+00B7) common in Chinese names: 沃伦·巴菲特, 马可·奥勒留
  const regex = /@([\p{L}\p{M}\w·]{1,30})/gu;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const rawName = match[1];
    const index = match.index;

    // Push text before the mention
    if (index > lastIndex) {
      segments.push({ type: 'text', text: content.slice(lastIndex, index) });
    }

    // Normalize: remove · to match against persona.nameZh
    // Strip dots on BOTH sides so '马可奥勒留' matches '马可·奥勒留'
    const name = rawName.replace(/·/g, '');

    // Try to match against persona names (with and without ·)
    // Use the first match; prefer the non-stoic version if both match
    let persona = PERSONA_LIST.find(
      (p) =>
        p.nameZh.replace(/·/g, '') === name ||
        p.nameZh === rawName ||
        p.name === name ||
        p.nameEn === name ||
        p.slug === name ||
        (p.nameZhShort && (p.nameZhShort === name || p.nameZhShort === rawName))
    );

    // If multiple personas match (e.g. both marcus-aurelius and marcus-aurelius-stoic
    // for "马可·奥勒留"), prefer the non-stoic version
    if (persona && persona.slug.endsWith('-stoic')) {
      const nonStoicSlug = persona.slug.replace(/-stoic$/, '');
      const nonStoic = PERSONA_LIST.find((p) => p.slug === nonStoicSlug);
      if (nonStoic) {
        persona = nonStoic;
      }
    }

    if (persona) {
      segments.push({
        type: 'persona_mention',
        text: `@${rawName}`,
        slug: persona.slug,
      });
    } else {
      // Treat as user mention
      segments.push({
        type: 'user_mention',
        text: `@${rawName}`,
        userName: rawName,
      });
    }

    lastIndex = index + match[0].length;
  }

  // Push remaining text
  if (lastIndex < content.length) {
    segments.push({ type: 'text', text: content.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: 'text', text: content }];
}

/**
 * Check if content contains any persona mentions
 */
export function hasPersonaMention(content: string): boolean {
  const segments = parseMentions(content);
  return segments.some((s) => s.type === 'persona_mention');
}

/**
 * Check if content contains any @mentions
 */
export function hasMention(content: string): boolean {
  return /@[\p{L}\p{M}\w·]{1,30}/u.test(content);
}
