/**
 * Prismatic — Analytics SDK v2
 *
 * 统一的数据埋点与分析系统，使用 Prisma Client 访问新的分析表：
 * - user_sessions: 用户会话跟踪
 * - user_events: 详细用户行为事件
 * - daily_metrics: 用户级每日聚合指标
 * - admin_audit_logs: 管理员操作审计日志
 * - system_daily_stats: 系统级每日统计
 *
 * 同时兼容旧表（prismatic_events、page_events）以保证向后兼容。
 */

import { prisma } from '@/lib/prisma';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type SessionData = {
  sessionId: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  country?: string;
  deviceType?: 'mobile' | 'desktop' | 'tablet';
  browser?: string;
  os?: string;
};

export type EventData = {
  userId: string;
  sessionId?: string;
  eventType: string;
  eventName: string;
  properties?: Record<string, unknown>;
  context?: Record<string, unknown>;
  personaId?: string;
  personaName?: string;
  conversationId?: string;
  createdAt?: Date;
};

export type MetricData = {
  userId: string;
  statDate: Date;
  messagesSent?: number;
  personasUsedCount?: number;
  timeSpentSeconds?: number;
  featuresUsed?: Record<string, unknown>;
  lastConversationAt?: Date;
};

export type AuditLogData = {
  adminId: string;
  targetUserId: string;
  action: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
};

// ─── Session Manager ���───────────────────────────────────────────────────────────

/**
 * 创建或更新用户会话。
 * 调用时机：页面加载、路由变更时。
 */
export async function trackSession(data: SessionData): Promise<string | null> {
  try {
    if (!data.userId) {
      // 匿名会话，暂时不持久化（可后续扩展）
      return null;
    }

    const existing = await prisma.userSession.findUnique({
      where: { sessionId: data.sessionId },
    });

    if (existing) {
      // 更新现有会话
      return await prisma.userSession.update({
        where: { sessionId: data.sessionId },
        data: {
          pageViews: { increment: 1 },
          endedAt: null, // 标记为活跃
          ...(data.ipAddress && { ipAddress: data.ipAddress }),
          ...(data.userAgent && { userAgent: data.userAgent }),
          ...(data.referrer && { referrer: data.referrer }),
          ...(data.country && { country: data.country }),
          ...(data.deviceType && { deviceType: data.deviceType }),
          ...(data.browser && { browser: data.browser }),
          ...(data.os && { os: data.os }),
        },
      }).then(() => data.sessionId);
    } else {
      // 创建新会话
      const session = await prisma.userSession.create({
        data: {
          sessionId: data.sessionId,
          userId: data.userId,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          referrer: data.referrer,
          country: data.country,
          deviceType: data.deviceType,
          browser: data.browser,
          os: data.os,
          startedAt: new Date(),
          pageViews: 1,
          messagesSent: 0,
        },
      });
      return session.sessionId;
    }
  } catch (error) {
    console.error('[Analytics] trackSession error:', error);
    return null;
  }
}

/**
 * 结束用户会话。
 * 调用时机：页面卸载、用户登出。
 */
export async function endSession(sessionId: string, durationSeconds?: number): Promise<boolean> {
  try {
    await prisma.userSession.update({
      where: { sessionId },
      data: {
        endedAt: new Date(),
        ...(durationSeconds !== undefined && { durationSeconds }),
      },
    });
    return true;
  } catch (error) {
    console.error('[Analytics] endSession error:', error);
    return false;
  }
}

/**
 * 更新会话的消息计数。
 * 调用时机：用户发送消息时。
 */
export async function incrementSessionMessages(sessionId: string): Promise<boolean> {
  try {
    await prisma.userSession.update({
      where: { sessionId },
      data: { messagesSent: { increment: 1 } },
    });
    return true;
  } catch (error) {
    console.error('[Analytics] incrementSessionMessages error:', error);
    return false;
  }
}

// ─── Event Tracker ──────────────────────────────────────────────────────────────

/**
 * 记录用户行为事件。
 * 调用时机：任何需要埋点的用户操作（页面浏览、按钮点击、功能使用等）。
 */
export async function trackEvent(data: EventData): Promise<string | null> {
  try {
    const event = await prisma.userEvent.create({
      data: {
        userId: data.userId,
        sessionId: data.sessionId,
        eventType: data.eventType,
        eventName: data.eventName,
        properties: data.properties ? JSON.stringify(data.properties) : undefined,
        context: data.context ? JSON.stringify(data.context) : undefined,
        personaId: data.personaId,
        personaName: data.personaName,
        conversationId: data.conversationId,
        createdAt: data.createdAt || new Date(),
      },
    });
    return event.id;
  } catch (error) {
    console.error('[Analytics] trackEvent error:', error);
    return null;
  }
}

/**
 * 批量记录事件（用于高性能场景）。
 */
export async function trackEvents(events: EventData[]): Promise<string[]> {
  try {
    await prisma.userEvent.createMany({
      data: events.map(e => ({
        userId: e.userId,
        sessionId: e.sessionId || undefined,
        eventType: e.eventType,
        eventName: e.eventName,
        properties: e.properties ? JSON.stringify(e.properties) : undefined,
        context: e.context ? JSON.stringify(e.context) : undefined,
        personaId: e.personaId,
        personaName: e.personaName,
        conversationId: e.conversationId,
        createdAt: e.createdAt || new Date(),
      })),
    });
    // createMany 不返回 IDs，用时间戳+索引生成唯一标识符
    return events.map((_, idx) => `${Date.now()}-${idx}`);
  } catch (error) {
    console.error('[Analytics] trackEvents error:', error);
    return [];
  }
}

// ─── Chat-specific Tracking ─────────────────────────────────────────────────────

/**
 * 追踪对话开始事件。
 */
export async function trackChatStart(personaId: string, personaName?: string): Promise<string | null> {
  return trackEvent({
    userId: '', // 需要在调用时填充
    eventType: 'chat_start',
    eventName: 'chat_start',
    personaId,
    personaName,
  });
}

/**
 * 追踪对话结束事件。
 */
export async function trackChatEnd(conversationId: string, properties?: Record<string, unknown>): Promise<string | null> {
  return trackEvent({
    userId: '', // 需要在调用时填充
    eventType: 'chat_end',
    eventName: 'chat_end',
    conversationId,
    properties,
  });
}

// ─── Daily Metrics ──────────────────────────────────────────────────────────────

/**
 * 创建或更新用户每日指标。
 * 调用时机：每日首次活动或定期汇总任务。
 */
export async function upsertDailyMetric(data: MetricData): Promise<boolean> {
  try {
    const statDate = new Date(data.statDate);
    statDate.setHours(0, 0, 0, 0);

    await prisma.dailyMetric.upsert({
      where: {
        userId_statDate: {
          userId: data.userId,
          statDate,
        },
      },
      create: {
        userId: data.userId,
        statDate,
        messagesSent: data.messagesSent || 0,
        personasUsedCount: data.personasUsedCount || 0,
        timeSpentSeconds: data.timeSpentSeconds || 0,
        featuresUsed: data.featuresUsed ? JSON.stringify(data.featuresUsed) : '{}',
        lastConversationAt: data.lastConversationAt,
      },
      update: {
        ...(data.messagesSent !== undefined && { messagesSent: { increment: data.messagesSent } }),
        ...(data.personasUsedCount !== undefined && { personasUsedCount: { increment: data.personasUsedCount } }),
        ...(data.timeSpentSeconds !== undefined && { timeSpentSeconds: { increment: data.timeSpentSeconds } }),
        ...(data.featuresUsed && { featuresUsed: { set: JSON.stringify(data.featuresUsed) } }),
        ...(data.lastConversationAt && { lastConversationAt: data.lastConversationAt }),
      },
    });
    return true;
  } catch (error) {
    console.error('[Analytics] upsertDailyMetric error:', error);
    return false;
  }
}

// ─── Admin Audit ─────────────────────────────────────────────────────────────────

/**
 * 记录管理员操作审计日志。
 * 调用时机：管理员修改用户信息、权限、额度等。
 */
export async function logAdminAudit(data: AuditLogData): Promise<string | null> {
  try {
    const log = await prisma.adminAuditLog.create({
      data: {
        adminId: data.adminId,
        targetUserId: data.targetUserId,
        action: data.action,
        oldValues: data.oldValues ? JSON.stringify(data.oldValues) : '{}',
        newValues: data.newValues ? JSON.stringify(data.newValues) : '{}',
        reason: data.reason,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        createdAt: new Date(),
      },
    });
    return log.id;
  } catch (error) {
    console.error('[Analytics] logAdminAudit error:', error);
    return null;
  }
}

// ─── System Stats ────────────────────────────────────────────────────────────────

/**
 * 更新系统每日统计（供定时任务调用）。
 * 调用时机：每天凌晨 00:00 的 cron job。
 */
export async function upsertSystemDailyStat(data: {
  statDate: Date;
  totalUsers?: number;
  activeUsers?: number;
  newUsers?: number;
  totalMessages?: number;
  totalConversations?: number;
  totalApiCost?: number;
  revenueEstimate?: number;
  dau?: number;
  mau?: number;
}): Promise<boolean> {
  try {
    const statDate = new Date(data.statDate);
    statDate.setHours(0, 0, 0, 0);

    await prisma.systemDailyStat.upsert({
      where: { statDate },
      create: {
        statDate,
        totalUsers: data.totalUsers || 0,
        activeUsers: data.activeUsers || 0,
        newUsers: data.newUsers || 0,
        totalMessages: data.totalMessages || 0,
        totalConversations: data.totalConversations || 0,
        totalApiCost: data.totalApiCost ? parseFloat(String(data.totalApiCost)) : 0,
        revenueEstimate: data.revenueEstimate ? parseFloat(String(data.revenueEstimate)) : 0,
        dau: data.dau || 0,
        mau: data.mau || 0,
      },
      update: {
        ...(data.totalUsers !== undefined && { totalUsers: data.totalUsers }),
        ...(data.activeUsers !== undefined && { activeUsers: data.activeUsers }),
        ...(data.newUsers !== undefined && { newUsers: data.newUsers }),
        ...(data.totalMessages !== undefined && { totalMessages: data.totalMessages }),
        ...(data.totalConversations !== undefined && { totalConversations: data.totalConversations }),
        ...(data.totalApiCost !== undefined && { totalApiCost: parseFloat(String(data.totalApiCost)) }),
        ...(data.revenueEstimate !== undefined && { revenueEstimate: parseFloat(String(data.revenueEstimate)) }),
        ...(data.dau !== undefined && { dau: data.dau }),
        ...(data.mau !== undefined && { mau: data.mau }),
      },
    });
    return true;
  } catch (error) {
    console.error('[Analytics] upsertSystemDailyStat error:', error);
    return false;
  }
}

// ─── Analytics Queries ──────────────────────────────────────────────────────────

/**
 * 获取用户行为历史（用于用户详情页）。
 */
export async function getUserActivityHistory(userId: string, limit: number = 50) {
  try {
    const [events, sessions, metrics] = await Promise.all([
      prisma.userEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          eventType: true,
          eventName: true,
          properties: true,
          context: true,
          personaName: true,
          conversationId: true,
          createdAt: true,
        },
      }),
      prisma.userSession.findMany({
        where: { userId },
        orderBy: { startedAt: 'desc' },
        take: 10,
        select: {
          sessionId: true,
          startedAt: true,
          endedAt: true,
          pageViews: true,
          messagesSent: true,
          deviceType: true,
          country: true,
        },
      }),
      prisma.dailyMetric.findMany({
        where: { userId },
        orderBy: { statDate: 'desc' },
        take: 30,
        select: {
          statDate: true,
          messagesSent: true,
          personasUsedCount: true,
          timeSpentSeconds: true,
          lastConversationAt: true,
        },
      }),
    ]);

    return { events, sessions, metrics };
  } catch (error) {
    console.error('[Analytics] getUserActivityHistory error:', error);
    return { events: [], sessions: [], metrics: [] };
  }
}

/**
 * 获取管理员审计日志（用于后台管理）。
 */
export async function getAdminAuditLogs(limit: number = 100, offset: number = 0) {
  try {
    const logs = await prisma.adminAuditLog.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        adminId: true,
        targetUserId: true,
        action: true,
        oldValues: true,
        newValues: true,
        reason: true,
        ipAddress: true,
        createdAt: true,
        admin: { select: { name: true, email: true } },
        targetUser: { select: { name: true, email: true } },
      },
    });
    return logs;
  } catch (error) {
    console.error('[Analytics] getAdminAuditLogs error:', error);
    return [];
  }
}

/**
 * 获取系统概览统计数据（替代旧的 tracking overview）。
 */
export async function getSystemOverview(days: number = 7) {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 获取系统每日统计
    const systemStats = await prisma.systemDailyStat.findMany({
      where: {
        statDate: { gte: startDate, lte: endDate },
      },
      orderBy: { statDate: 'desc' },
    });

    // 如果无数据，返回零值
    if (systemStats.length === 0) {
      return {
        totalUsers: 0,
        activeUsers: 0,
        newUsers: 0,
        totalMessages: 0,
        totalConversations: 0,
        totalApiCost: 0,
        dau: 0,
        mau: 0,
      };
    }

    // 聚合计算
    const latest = systemStats[0];
    const total = systemStats.reduce(
      (acc, s) => ({
        totalUsers: acc.totalUsers + s.totalUsers,
        activeUsers: acc.activeUsers + s.activeUsers,
        newUsers: acc.newUsers + s.newUsers,
        totalMessages: acc.totalMessages + s.totalMessages,
        totalConversations: acc.totalConversations + s.totalConversations,
        totalApiCost: acc.totalApiCost + Number(s.totalApiCost),
        revenueEstimate: acc.revenueEstimate + Number(s.revenueEstimate),
        dau: Math.max(acc.dau, s.dau),
        mau: Math.max(acc.mau, s.mau),
      }),
      { totalUsers: 0, activeUsers: 0, newUsers: 0, totalMessages: 0, totalConversations: 0, totalApiCost: 0, revenueEstimate: 0, dau: 0, mau: 0 }
    );

    return {
      ...total,
      totalApiCost: parseFloat(total.totalApiCost.toFixed(4)),
      revenueEstimate: parseFloat(total.revenueEstimate.toFixed(4)),
    };
  } catch (error) {
    console.error('[Analytics] getSystemOverview error:', error);
    return {
      totalUsers: 0, activeUsers: 0, newUsers: 0, totalMessages: 0, totalConversations: 0, totalApiCost: 0, dau: 0, mau: 0,
    };
  }
}
