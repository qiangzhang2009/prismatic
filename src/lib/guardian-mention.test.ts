/**
 * Tests for guardian mention extraction (src/lib/guardian-mention.ts)
 */
import { describe, it, expect } from 'vitest';
import { extractGuardianMention, getMentionHint } from '@/lib/guardian-mention';

describe('extractGuardianMention', () => {
  it('returns null for plain text without mentions', () => {
    const result = extractGuardianMention('这是一条普通评论', []);
    expect(result.mentionedPersonaId).toBeNull();
    expect(result.mentionedPersonaNameZh).toBeNull();
    expect(result.isTodayGuardian).toBe(false);
    expect(result.gradientFrom).toBe('');
    expect(result.gradientTo).toBe('');
  });

  it('returns null for user mention (unknown persona)', () => {
    const result = extractGuardianMention('@张三 你好', []);
    expect(result.mentionedPersonaId).toBeNull();
    expect(result.isTodayGuardian).toBe(false);
  });

  it('extracts first persona mention', () => {
    const result = extractGuardianMention('@苏格拉底 你怎么看？', []);
    expect(result.mentionedPersonaId).toBe('socrates');
    expect(result.mentionedPersonaNameZh).toBe('苏格拉底');
    expect(result.isTodayGuardian).toBe(false); // empty todayGuardianIds
    expect(result.gradientFrom).toBeTruthy();
    expect(result.gradientTo).toBeTruthy();
  });

  it('returns isTodayGuardian true when persona is in today list', () => {
    const result = extractGuardianMention('@苏格拉底 你好', ['socrates']);
    expect(result.mentionedPersonaId).toBe('socrates');
    expect(result.isTodayGuardian).toBe(true);
  });

  it('returns isTodayGuardian false when persona not in today list', () => {
    // Use @乔布斯 (nameZhShort for steve-jobs) since there's no '乔布斯' direct
    const result = extractGuardianMention('@乔布斯 你好', ['socrates', 'marcus-aurelius']);
    expect(result.mentionedPersonaId).toBe('steve-jobs');
    expect(result.isTodayGuardian).toBe(false);
  });

  it('uses first mention when multiple mentions exist', () => {
    const result = extractGuardianMention('@苏格拉底 和 @乔布斯 都很厉害', []);
    // First mention should be socrates
    expect(result.mentionedPersonaId).toBe('socrates');
  });

  it('handles mention with middle dot', () => {
    const result = extractGuardianMention('@沃伦·巴菲特 投资哲学很棒', []);
    expect(result.mentionedPersonaId).toBe('warren-buffett');
    expect(result.mentionedPersonaNameZh).toBe('沃伦·巴菲特');
  });

  it('handles mention at the start', () => {
    const result = extractGuardianMention('@马可·奥勒留 你好', []);
    expect(result.mentionedPersonaId).toBe('marcus-aurelius');
    expect(result.mentionedPersonaNameZh).toBe('马可·奥勒留');
  });

  it('sets correct gradient colors for known personas', () => {
    const result = extractGuardianMention('@苏格拉底 你好', []);
    expect(result.gradientFrom).toBeTruthy();
    expect(result.gradientTo).toBeTruthy();
    // Colors should be non-empty strings
    expect(typeof result.gradientFrom).toBe('string');
    expect(typeof result.gradientTo).toBe('string');
    expect(result.gradientFrom.length).toBeGreaterThan(0);
  });
});

describe('getMentionHint', () => {
  it('returns null when no persona mentioned', () => {
    const result = extractGuardianMention('普通评论', []);
    expect(getMentionHint(result)).toBeNull();
  });

  it('returns null when mentioned persona is today guardian', () => {
    const result = extractGuardianMention('@苏格拉底 你好', ['socrates']);
    expect(getMentionHint(result)).toBeNull(); // no hint needed, will get reply
  });

  it('returns hint when mentioned persona is NOT today guardian', () => {
    const result = extractGuardianMention('@乔布斯 你好', []);
    const hint = getMentionHint(result);
    expect(hint).not.toBeNull();
    expect(hint).toContain('乔布斯');
  });
});
