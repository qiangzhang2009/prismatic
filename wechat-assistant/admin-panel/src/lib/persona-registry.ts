// ============================================
// Persona Registry — 加载和管理 Persona 配置
// ============================================
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { WechatPersona } from './persona-types';

// 默认 Persona slug
export const DEFAULT_PERSONA_SLUG = 'smart-assistant';

// 已知内置 Persona 列表
export const BUILTIN_PERSONAS = [
  'smart-assistant',
  'customer-service',
  'mentor',
  'entertainer',
  'strict-moderator',
] as const;

export type BuiltinPersonaSlug = (typeof BUILTIN_PERSONAS)[number];

// 内置 Persona JSON 存储（内存缓存）
let personaCache: Map<string, WechatPersona> | null = null;

// Persona 文件目录（admin-panel/corpus/personas/）
function getPersonaPath(slug: string): string {
  return join(process.cwd(), 'corpus', 'personas', `${slug}.json`);
}

// ============================================
// 加载单个 Persona
// ============================================
export async function loadPersona(slug: string): Promise<WechatPersona | null> {
  // 优先从缓存读
  if (personaCache?.has(slug)) {
    return personaCache.get(slug)!;
  }

  try {
    const filePath = getPersonaPath(slug);
    const content = await readFile(filePath, 'utf-8');
    const persona = JSON.parse(content) as WechatPersona;

    if (!personaCache) personaCache = new Map();
    personaCache.set(slug, persona);

    return persona;
  } catch {
    return null;
  }
}

// ============================================
// 加载所有 Persona
// ============================================
export async function loadAllPersonas(): Promise<WechatPersona[]> {
  const personas: WechatPersona[] = [];

  for (const slug of BUILTIN_PERSONAS) {
    const p = await loadPersona(slug);
    if (p) personas.push(p);
  }

  return personas;
}

// ============================================
// 从 Persona 构建 Prompt
// ============================================
export function buildPersonaPrompt(persona: WechatPersona): string {
  const sections: string[] = [];

  // 身份定义
  sections.push(`## 身份\n\n${persona.identity.tagline}`);
  sections.push(`语气: ${persona.identity.tone}`);
  if (persona.identity.greeting) {
    sections.push(`开场白: ${persona.identity.greeting}`);
  }

  // 约束条件
  if (persona.identity.constraints.length > 0) {
    sections.push(`\n## 约束\n\n${persona.identity.constraints.map((c) => `- ${c}`).join('\n')}`);
  }

  // 表达 DNA
  sections.push(`\n## 表达风格\n\n`);
  sections.push(`- 句子类型: ${persona.expressionDNA.sentencePattern.type}`);
  sections.push(`- 情绪温度: ${persona.expressionDNA.emotionalTemperature} (${persona.expressionDNA.emotionalIndex}/100)`);
  sections.push(`- 确定性水平: ${persona.expressionDNA.certaintyLevel}`);
  sections.push(
    `- 从不使用的词: ${persona.expressionDNA.tabooWords.join(', ') || '无'}`,
  );
  sections.push(
    `- 标志性句式: ${persona.expressionDNA.favoritePatterns.slice(0, 3).join(' | ') || '无'}`,
  );

  // 决策启发式
  if (persona.decisionHeuristics.length > 0) {
    sections.push(
      `\n## 决策启发式\n\n${persona.decisionHeuristics
        .slice(0, 5)
        .map((h) => `- [${h.priority}] ${h.situation} → ${h.response}`)
        .join('\n')}`,
    );
  }

  // 群管约束
  sections.push(`\n## 群管约束\n\n`);
  sections.push(
    `- 回复长度: ${persona.moderation.responseLength === 'short' ? '简短（<100字）' : persona.moderation.responseLength === 'medium' ? '中等（100-200字）' : '详细（>200字）'}`,
  );
  if (persona.moderation.blockTopics.length > 0) {
    sections.push(`- 拒绝的话题: ${persona.moderation.blockTopics.join(', ')}`);
  }

  // 诚实边界
  if (persona.honestBoundaries.length > 0) {
    sections.push(
      `\n## 我无法做到的事\n\n${persona.honestBoundaries.map((b) => `- ${b}`).join('\n')}`,
    );
  }

  return sections.join('\n');
}

// ============================================
// 表达 DNA 校准器
// ============================================
export function calibrateExpressionDNA(
  text: string,
  persona: WechatPersona,
): string {
  let calibrated = text;

  // 替换禁止词汇
  for (const taboo of persona.expressionDNA.tabooWords) {
    const regex = new RegExp(taboo, 'gi');
    calibrated = calibrated.replace(regex, '[已过滤]');
  }

  // 调整确定性水平
  if (persona.expressionDNA.certaintyLevel === 'low') {
    calibrated = calibrated
      .replace(/\b一定\b/g, '可能会')
      .replace(/\b绝对\b/g, '大概')
      .replace(/\b必须\b/g, '可以考虑')
      .replace(/\b毫无疑问\b/g, '可能');
  } else if (persona.expressionDNA.certaintyLevel === 'high') {
    calibrated = calibrated
      .replace(/\b也许\b/g, '一定')
      .replace(/\b可能\b(?!会)/g, '确定')
      .replace(/\b大概\b/g, '绝对');
  }

  return calibrated;
}

// ============================================
// 获取群的活跃 Persona
// ============================================
export async function getActivePersonaSlug(groupId: string): Promise<string> {
  // 从数据库读取群的 Persona 配置
  // 注意：此函数需要在 API 路由中使用，因为 Prisma 客户端不能在 Edge Runtime 使用
  const { db } = await import('./db');

  try {
    const group = await db.group.findUnique({
      where: { id: groupId },
      include: { persona: true },
    });
    return group?.persona?.slug ?? DEFAULT_PERSONA_SLUG;
  } catch {
    return DEFAULT_PERSONA_SLUG;
  }
}

// ============================================
// 清除缓存（部署新 Persona 后调用）
// ============================================
export function clearPersonaCache(): void {
  personaCache = null;
}
