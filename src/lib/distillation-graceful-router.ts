/**
 * Prismatic — Layer 2: Graceful Degradation Router
 *
 * Given a knowledge gap detection result, decides HOW the system should respond:
 * 1. normal        → Use distilled corpus knowledge directly
 * 2. extrapolate   → Use Identity + Heuristics to extrapolate
 * 3. honest_boundary → Clearly state knowledge boundaries
 * 4. refer_sources → Cite relevant source materials
 * 5. hybrid        → Combine known facts + honest extrapolation
 *
 * Decision matrix:
 * ┌─────────────────┬──────────────┬──────────────┬────────────────────┐
 * │ 严重程度         │ 是否在世       │ 敏感话题      │ 决策              │
 * ├─────────────────┼──────────────┼──────────────┼────────────────────┤
 * │ none            │ any          │ any          │ normal             │
 * │ minor           │ 已故          │ no           │ normal             │
 * │ minor           │ 已故          │ yes          │ honest_boundary   │
 * │ minor           │ 在世          │ no           │ hybrid            │
 * │ significant     │ 已故          │ any          │ honest_boundary   │
 * │ significant     │ 在世          │ no           │ extrapolate       │
 * │ significant     │ 在世          │ yes          │ honest_boundary   │
 * │ severe          │ any          │ any          │ honest_boundary   │
 * └─────────────────┴──────────────┴──────────────┴────────────────────┘
 *
 * Strategy overrides (from Persona metadata):
 * - 'extrapolate_identity': Always prefer extrapolation for living personas
 * - 'honest_boundary': Never extrapolate, always state boundaries
 * - 'refer_sources': Always try to cite known sources first
 * - 'hybrid': Combine known facts + extrapolation (default for living personas)
 */

import type {
  KnowledgeGapDetectionResult,
  GapSeverity,
  DegradationMode,
  GracefulDegradationResult,
  CorpusMetadata,
  KnowledgeLayer,
  ExpressionLayer,
  ExtrapolationResult,
} from './distillation-v4-types';

// ─── Decision Matrix ─────────────────────────────────────────────────────────────

interface RouteDecision {
  mode: DegradationMode;
  reason: string;
  confidenceBoost: number; // 调整置信度
  priorityRules: string[];
}

/**
 * 根据检测结果和人物元数据，决定降级模式。
 *
 * @param gapResult 知识缺口检测结果
 * @param metadata 人物元数据（语料截止日期、是否在世等）
 * @param personaId 人物 ID
 * @returns 路由决策
 */
export function decideDegradationRoute(
  gapResult: KnowledgeGapDetectionResult,
  metadata: CorpusMetadata,
  personaId: string
): RouteDecision {
  const { severity, isSensitive } = gapResult;
  const { isAlive, knowledgeGapStrategy, sensitiveTopics } = metadata;
  const priorityRules: string[] = [];

  // ── Step 0: Strategy Override ───────────────────────────────────────────────
  // 如果明确设置了策略，按策略执行
  if (knowledgeGapStrategy === 'honest_boundary') {
    priorityRules.push('策略覆盖: 明确设置为 honest_boundary');
    return {
      mode: 'honest_boundary',
      reason: `人物元数据指定不做推演，只陈述知识边界`,
      confidenceBoost: 1.0,
      priorityRules,
    };
  }

  if (knowledgeGapStrategy === 'refer_sources') {
    priorityRules.push('策略覆盖: refer_sources');
    return {
      mode: 'refer_sources',
      reason: `人物元数据指定优先引用已有 sources`,
      confidenceBoost: 1.0,
      priorityRules,
    };
  }

  // ── Step 1: Severity = none ──────────────────────────────────────────────
  if (severity === 'none') {
    priorityRules.push('严重程度: none — 正常蒸馏路由');
    return {
      mode: 'normal',
      reason: '问题落在语料库覆盖范围内，无知识缺口',
      confidenceBoost: 1.0,
      priorityRules,
    };
  }

  // ── Step 2: Severity = severe ───────────────────────────────────────────
  if (severity === 'severe' || isSensitive) {
    // 生死大事、未来预测、敏感话题 → 直接告知边界
    priorityRules.push(`严重程度: ${severity} → honest_boundary`);
    priorityRules.push('敏感话题检测: true → 不做推演');
    return {
      mode: 'honest_boundary',
      reason: `严重程度为 ${severity}，或涉及敏感话题，不适合推演回答`,
      confidenceBoost: 0.5,
      priorityRules,
    };
  }

  // ── Step 3: Severity = significant ───────────────────────────────────────
  if (severity === 'significant') {
    if (!isAlive) {
      // 已故人物：生平已完整记录，应陈述边界
      priorityRules.push('严重程度: significant + 已故人物 → honest_boundary');
      priorityRules.push('已故人物生平有明确边界，不应虚构或推演');
      return {
        mode: 'honest_boundary',
        reason: `已故人物的生平记录有明确边界，问题可能超出其实际经历`,
        confidenceBoost: 0.7,
        priorityRules,
      };
    } else {
      // 在世人物 + 推演策略允许 → 推演
      if (knowledgeGapStrategy === 'extrapolate_identity') {
        priorityRules.push(`严重程度: significant + 在世人物 + extrapolate_identity → extrapolate`);
        return {
          mode: 'extrapolate',
          reason: `在世人物，${knowledgeGapStrategy} 策略允许基于 Identity + Heuristics 推演`,
          confidenceBoost: 0.8,
          priorityRules,
        };
      } else {
        // 默认 hybrid：先引用已知，再诚实推演
        priorityRules.push(`严重程度: significant + 在世人物 + hybrid → hybrid`);
        priorityRules.push('在世人物但问题超出语料库范围，混合已知事实与诚实边界声明');
        return {
          mode: 'hybrid',
          reason: `在世人物，${knowledgeGapStrategy} 策略，混合模式`,
          confidenceBoost: 0.7,
          priorityRules,
        };
      }
    }
  }

  // ── Step 4: Severity = minor ────────────────────────────────────────────
  if (severity === 'minor') {
    if (isSensitive) {
      priorityRules.push('严重程度: minor + 敏感话题 → honest_boundary');
      return {
        mode: 'honest_boundary',
        reason: '轻微知识缺口但涉及敏感话题',
        confidenceBoost: 0.6,
        priorityRules,
      };
    }

    if (!isAlive) {
      // 已故人物：轻微缺口可能只是时间边界问题，尝试正常蒸馏
      priorityRules.push('严重程度: minor + 已故人物 → normal');
      priorityRules.push('轻微缺口可能在语料库边界，可用已知信息回答');
      return {
        mode: 'normal',
        reason: '轻微缺口，已故人物的生平知识可能仍可部分回答',
        confidenceBoost: 0.9,
        priorityRules,
      };
    }

    // 在世人物 + 轻微缺口
    if (knowledgeGapStrategy === 'extrapolate_identity') {
      priorityRules.push(`严重程度: minor + 在世人物 + extrapolate_identity → extrapolate`);
      return {
        mode: 'extrapolate',
        reason: '轻微知识缺口，在世人物允许推演',
        confidenceBoost: 0.9,
        priorityRules,
      };
    }

    priorityRules.push(`严重程度: minor + 在世人物 + hybrid → hybrid`);
    return {
      mode: 'hybrid',
      reason: '轻微缺口，尝试混合已知事实和边界声明',
      confidenceBoost: 0.85,
      priorityRules,
    };
  }

  // Fallback
  return {
    mode: 'normal',
    reason: '默认正常路由',
    confidenceBoost: 1.0,
    priorityRules: ['默认 fallback'],
  };
}

// ─── Summary Formatter ───────────────────────────────────────────────────────────

/**
 * 格式化路由决策为可读摘要
 */
export function summarizeRouteDecision(
  decision: RouteDecision,
  gapResult: KnowledgeGapDetectionResult,
  metadata: CorpusMetadata
): string {
  const modeLabels: Record<DegradationMode, string> = {
    normal: '正常蒸馏',
    extrapolate: '身份推演 (Extrapolate)',
    honest_boundary: '诚实边界 (Honest Boundary)',
    refer_sources: '引用来源 (Refer Sources)',
    hybrid: '混合模式 (Hybrid)',
  };

  const parts = [
    `路由决策: ${modeLabels[decision.mode]}`,
    `严重程度: ${gapResult.severity}`,
    `是否在世: ${metadata.isAlive ? '是' : '否'}`,
    `检测置信度: ${(gapResult.confidence * 100).toFixed(0)}%`,
    `调整后置信度: ${(gapResult.confidence * decision.confidenceBoost * 100).toFixed(0)}%`,
    `决策原因: ${decision.reason}`,
  ];

  if (decision.priorityRules.length > 0) {
    parts.push(`优先级规则:`);
    for (const rule of decision.priorityRules) {
      parts.push(`  - ${rule}`);
    }
  }

  if (gapResult.signals.length > 0) {
    parts.push(`检测到的信号:`);
    for (const signal of gapResult.signals.slice(0, 5)) {
      parts.push(`  - [${signal.type}] ${signal.description} (置信度: ${(signal.confidence * 100).toFixed(0)}%)`);
    }
  }

  return parts.join('\n');
}

// ─── Quick Route (for hot path) ─────────────────────────────────────────────────

/**
 * 快速路由决策，用于对话热路径。
 * 只用 severity 和 isAlive 做判断，最小化计算开销。
 */
export function quickDegradationRoute(
  severity: GapSeverity,
  isAlive: boolean,
  isSensitive: boolean
): DegradationMode {
  if (severity === 'none') return 'normal';
  if (severity === 'severe' || isSensitive) return 'honest_boundary';
  if (severity === 'significant' && !isAlive) return 'honest_boundary';
  if (severity === 'significant' && isAlive) return 'hybrid';
  if (severity === 'minor' && !isAlive) return 'normal';
  return 'hybrid';
}
