/**
 * @mention Parsing Utility
 * Parses @mentions in comment content and renders them as clickable links.
 * Supports:
 *   - @人物全名 → links to /personas/[slug]
 *   - @大众昵称 → links to /personas/[slug] (via PERSONA_NICKNAMES)
 *   - @username → links to user profile
 */

import { PERSONA_LIST } from './personas';
import { resolvePersonaByNickname } from './persona-nicknames';

export interface MentionSegment {
  type: 'text' | 'persona_mention' | 'user_mention';
  text: string;
  slug?: string;       // for persona mentions
  userId?: string;    // for user mentions
  userName?: string;   // display name for user mentions
}

/**
 * Parse content into mention segments.
 * @param content - raw comment content
 * @returns array of text/mention segments
 */
export function parseMentions(content: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  const regex = /@([\p{L}\p{M}\w]{1,30})/gu;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const name = match[1];
    const index = match.index;

    // Push text before the mention
    if (index > lastIndex) {
      segments.push({ type: 'text', text: content.slice(lastIndex, index) });
    }

    // Try to match against persona names (exact first)
    const persona = PERSONA_LIST.find(
      (p) =>
        p.nameZh === name ||
        p.name === name ||
        p.nameEn === name ||
        p.slug === name
    );

    if (persona) {
      segments.push({
        type: 'persona_mention',
        text: `@${name}`,
        slug: persona.slug,
      });
    } else {
      // Try nickname / alias lookup (大众昵称)
      const nicknameId = resolvePersonaByNickname(name);
      if (nicknameId) {
        const nicknamePersona = PERSONA_LIST.find((p) => p.slug === nicknameId);
        if (nicknamePersona) {
          segments.push({
            type: 'persona_mention',
            text: `@${name}`,
            slug: nicknamePersona.slug,
          });
        } else {
          // Nickname resolved but persona not found — treat as user mention
          segments.push({
            type: 'user_mention',
            text: `@${name}`,
            userName: name,
          });
        }
      } else {
        // Treat as user mention
        segments.push({
          type: 'user_mention',
          text: `@${name}`,
          userName: name,
        });
      }
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
  return /@[\p{L}\p{M}\w]{1,30}/u.test(content);
}
