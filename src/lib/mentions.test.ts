/**
 * Tests for mention parsing (src/lib/mentions.ts)
 */
import { describe, it, expect } from 'vitest';
import { parseMentions, hasPersonaMention, hasMention } from '@/lib/mentions';

describe('parseMentions', () => {
  it('returns plain text unchanged when no mentions', () => {
    const result = parseMentions('Hello world, this is a comment.');
    expect(result).toEqual([{ type: 'text', text: 'Hello world, this is a comment.' }]);
  });

  it('parses a single @mention of a known persona', () => {
    const result = parseMentions('@苏格拉底 你好');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ type: 'persona_mention', text: '@苏格拉底', slug: 'socrates' });
    expect(result[1]).toEqual({ type: 'text', text: ' 你好' });
  });

  it('parses a mention at the start of content', () => {
    const result = parseMentions('@苏格拉底');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: 'persona_mention', text: '@苏格拉底', slug: 'socrates' });
  });

  it('parses a mention in the middle of content', () => {
    const result = parseMentions('你好 @苏格拉底，你怎么看？');
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ type: 'text', text: '你好 ' });
    expect(result[1]).toEqual({ type: 'persona_mention', text: '@苏格拉底', slug: 'socrates' });
    expect(result[2]).toEqual({ type: 'text', text: '，你怎么看？' });
  });

  it('parses multiple mentions', () => {
    const result = parseMentions('@苏格拉底 和 @乔布斯 都很厉害');
    expect(result).toHaveLength(4);
    expect(result[0].type).toBe('persona_mention');
    expect(result[0].slug).toBe('socrates');
    expect(result[1].type).toBe('text');
    expect(result[2].type).toBe('persona_mention');
    expect(result[2].slug).toBe('steve-jobs');
  });

  it('treats unknown @mentions as user mentions', () => {
    const result = parseMentions('@张三 你好吗');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ type: 'user_mention', text: '@张三', userName: '张三' });
  });

  it('matches names with middle dot (Chinese names)', () => {
    // 沃伦·巴菲特 should match warren-buffett
    const result = parseMentions('@沃伦·巴菲特 你好');
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('persona_mention');
    expect(result[0].slug).toBe('warren-buffett');
    expect(result[0].text).toBe('@沃伦·巴菲特');
  });

  it('matches names with middle dot removed', () => {
    // User types 沃伦巴菲特 (without ·) → should still match warren-buffett
    const result = parseMentions('@沃伦巴菲特 你好');
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('persona_mention');
    expect(result[0].slug).toBe('warren-buffett');
  });

  it('matches 马可·奥勒留 (prefers non-stoic variant)', () => {
    const result = parseMentions('@马可·奥勒留 你好');
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('persona_mention');
    // Should match marcus-aurelius, not marcus-aurelius-stoic
    expect(result[0].slug).toBe('marcus-aurelius');
  });

  it('limits mention length to 30 characters', () => {
    // Long name should not match (exceeds 30 char limit)
    const result = parseMentions('@AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA 你好');
    // The regex captures up to 30 chars after @, so the long string gets matched as a user mention
    expect(result[0].type).toBe('user_mention');
  });

  it('handles empty string', () => {
    const result = parseMentions('');
    expect(result).toEqual([{ type: 'text', text: '' }]);
  });

  it('handles mention-only content', () => {
    const result = parseMentions('@苏格拉底');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('persona_mention');
  });

  it('handles text-only without matches', () => {
    const result = parseMentions('No mentions here');
    expect(result).toEqual([{ type: 'text', text: 'No mentions here' }]);
  });

  it('matches short name (nameZhShort) for commonly known personas', () => {
    // 乔布斯 should match steve-jobs via nameZhShort
    const result = parseMentions('@乔布斯 你好');
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('persona_mention');
    expect(result[0].slug).toBe('steve-jobs');

    // 马斯克 should match elon-musk via nameZhShort
    const result2 = parseMentions('@马斯克 你好');
    expect(result2[0].type).toBe('persona_mention');
    expect(result2[0].slug).toBe('elon-musk');

    // 巴菲特 should match warren-buffett via nameZhShort
    const result3 = parseMentions('@巴菲特 你好');
    expect(result3[0].type).toBe('persona_mention');
    expect(result3[0].slug).toBe('warren-buffett');
  });
});

describe('hasPersonaMention', () => {
  it('returns true for known persona mention', () => {
    expect(hasPersonaMention('@苏格拉底 你好')).toBe(true);
  });

  it('returns false for user mention', () => {
    expect(hasPersonaMention('@张三 你好')).toBe(false);
  });

  it('returns false for plain text', () => {
    expect(hasPersonaMention('你好世界')).toBe(false);
  });
});

describe('hasMention', () => {
  it('returns true when @ is present', () => {
    expect(hasMention('Hello @world')).toBe(true);
  });

  it('returns false when no @', () => {
    expect(hasMention('Hello world')).toBe(false);
  });

  it('returns true for mention with middle dot', () => {
    expect(hasMention('@沃伦·巴菲特')).toBe(true);
  });
});
