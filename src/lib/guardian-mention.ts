/**
 * Guardian Mention Parser
 * Extracts @守望者 mentions from comment content.
 * Rules:
 * 1. Parse @mention using parseMentions(), find first matching persona
 * 2. Check if that persona is in today's guardian list
 * 3. Return mention metadata for DB storage and frontend display
 */

import { parseMentions } from './mentions';
import { PERSONA_LIST } from './personas';

export interface GuardianMentionResult {
  mentionedPersonaId: string | null;
  mentionedPersonaNameZh: string | null;
  isTodayGuardian: boolean;
  gradientFrom: string;
  gradientTo: string;
}

/**
 * Extract the first @守望者 mention from comment content.
 * Returns null if no persona is mentioned.
 */
export function extractGuardianMention(
  content: string,
  todayGuardianIds: string[]
): GuardianMentionResult {
  const segments = parseMentions(content);
  const personaMentions = segments.filter(
    (s) => s.type === 'persona_mention' && s.slug
  );

  if (personaMentions.length === 0) {
    return {
      mentionedPersonaId: null,
      mentionedPersonaNameZh: null,
      isTodayGuardian: false,
      gradientFrom: '',
      gradientTo: '',
    };
  }

  // Use the first @ mention
  const first = personaMentions[0];
  const slug = first.slug!;

  // Check if mentioned persona exists in PERSONA_LIST
  const persona = PERSONA_LIST.find(
    (p) => p.slug === slug || p.nameZh === first.text.slice(1)
  );

  if (!persona) {
    return {
      mentionedPersonaId: null,
      mentionedPersonaNameZh: null,
      isTodayGuardian: false,
      gradientFrom: '',
      gradientTo: '',
    };
  }

  const isTodayGuardian = todayGuardianIds.includes(persona.slug);

  return {
    mentionedPersonaId: persona.slug,
    mentionedPersonaNameZh: persona.nameZh,
    isTodayGuardian,
    gradientFrom: persona.gradientFrom || '#4d96ff',
    gradientTo: persona.gradientTo || '#c77dff',
  };
}

/**
 * Get a mention hint message for the frontend.
 */
export function getMentionHint(
  result: GuardianMentionResult
): string | null {
  if (!result.mentionedPersonaId) return null;
  if (result.isTodayGuardian) return null; // no hint needed, will get reply
  return `${result.mentionedPersonaNameZh} 今日未值班，但你的呼唤TA会看到`;
}
