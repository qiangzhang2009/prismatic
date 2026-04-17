/**
 * Prismatic — Session Manager (Client-side)
 *
 * 浏览器端的会话管理，负责：
 * 1. 生成/恢复会话 ID
 * 2. 会话生命周期（开始、活跃、结束）
 * 3. 与后端同步会话数据
 * 4. 自动页面浏览/路由变更追踪
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';

// ─── Storage Keys ────────────────────────────────────────────────────────────────

const SESSION_ID_KEY = 'prismatic_session_id';
const SESSION_START_KEY = 'prismatic_session_start';

// ─── Session ID Management ──────────────────────────────────────────────────────

function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';

  let sessionId = sessionStorage.getItem(SESSION_ID_KEY);

  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
    sessionStorage.setItem(SESSION_START_KEY, Date.now().toString());
  }

  return sessionId;
}

export function getSessionStartTime(): number | null {
  if (typeof window === 'undefined') return null;
  const start = sessionStorage.getItem(SESSION_START_KEY);
  return start ? parseInt(start, 10) : null;
}

// ─── API Calls ──────────────────────────────────────────────────────────────────

interface SessionData {
  sessionId: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  deviceType?: 'mobile' | 'desktop' | 'tablet';
}

interface EventData {
  userId: string;
  sessionId?: string;
  eventType: string;
  eventName: string;
  properties?: Record<string, unknown>;
  context?: Record<string, unknown>;
  personaId?: string;
  personaName?: string;
  conversationId?: string;
}

async function sendToAPI(endpoint: string, data: unknown): Promise<void> {
  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      // 使用 keepalive 确保页面卸载时也能发送
      keepalive: true,
    });
  } catch (error) {
    console.error('[SessionManager] API call failed:', error);
  }
}

// ─── Device Detection ───────────────────────────────────────────────────────────

function detectDeviceType(): 'mobile' | 'desktop' | 'tablet' {
  if (typeof window === 'undefined') return 'desktop';

  const ua = navigator.userAgent.toLowerCase();
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile';
  return 'desktop';
}

function detectBrowser(): string {
  if (typeof window === 'undefined') return 'unknown';

  const ua = navigator.userAgent;
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Edg')) return 'Edge';
  return 'unknown';
}

function detectOS(): string {
  if (typeof window === 'undefined') return 'unknown';

  const ua = navigator.userAgent;
  if (ua.includes('Win')) return 'Windows';
  if (ua.includes('Mac')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  return 'unknown';
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

interface UseSessionManagerOptions {
  /** 用户 ID（未登录时为 undefined） */
  userId?: string;
  /** 是否自动追踪页面浏览（默认 true） */
  autoTrackPageViews?: boolean;
  /** 页面浏览防抖延迟（ms） */
  pageViewDebounce?: number;
}

export function useSessionManager(options: UseSessionManagerOptions = {}) {
  const {
    userId,
    autoTrackPageViews = true,
    pageViewDebounce = 300,
  } = options;

  const sessionIdRef = useRef<string>('');
  const pageViewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 初始化会话
  useEffect(() => {
    sessionIdRef.current = getOrCreateSessionId();

    if (userId) {
      // 注册会话到后端
      sendToAPI('/api/analytics/session/start', {
        sessionId: sessionIdRef.current,
        userId,
        userAgent: navigator.userAgent,
        referrer: document.referrer,
        deviceType: detectDeviceType(),
        browser: detectBrowser(),
        os: detectOS(),
      } satisfies SessionData);
    }

    // 页面可见性变化时更新会话状态
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // 页面隐藏时，发送心跳
        sendToAPI('/api/analytics/session/heartbeat', {
          sessionId: sessionIdRef.current,
          userId,
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 页面卸载时结束会话
    const handleBeforeUnload = () => {
      const startTime = getSessionStartTime();
      const duration = startTime ? Math.round((Date.now() - startTime) / 1000) : undefined;

      sendToAPI('/api/analytics/session/end', {
        sessionId: sessionIdRef.current,
        userId,
        durationSeconds: duration,
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [userId]);

  // 自动追踪页面浏览
  useEffect(() => {
    if (!autoTrackPageViews || !userId) return;

    const trackPageView = () => {
      // 防抖
      if (pageViewTimeoutRef.current) {
        clearTimeout(pageViewTimeoutRef.current);
      }

      pageViewTimeoutRef.current = setTimeout(() => {
        sendToAPI('/api/analytics/event', {
          userId,
          sessionId: sessionIdRef.current,
          eventType: 'page_view',
          eventName: 'page_view',
          properties: {
            url: window.location.pathname,
            title: document.title,
          },
          context: {
            referrer: document.referrer,
            deviceType: detectDeviceType(),
          },
        } satisfies EventData);
      }, pageViewDebounce);
    };

    trackPageView();

    // 监听路由变化（假设使用 Next.js App Router）
    // 对于其他路由方案，可根据实际情况调整
    const observer = new MutationObserver(() => {
      // Next.js App Router 页面变更不会触发 popstate
    });

    // 使用 popstate 监听浏览器前进/后退
    window.addEventListener('popstate', trackPageView);

    return () => {
      if (pageViewTimeoutRef.current) {
        clearTimeout(pageViewTimeoutRef.current);
      }
      window.removeEventListener('popstate', trackPageView);
      observer.disconnect();
    };
  }, [autoTrackPageViews, pageViewDebounce, userId]);

  // ─── Public API ──────────────────────────────────────────────────────────────

  const trackEvent = useCallback((data: Omit<EventData, 'userId' | 'sessionId'>) => {
    if (!userId) return;

    sendToAPI('/api/analytics/event', {
      userId,
      sessionId: sessionIdRef.current,
      ...data,
    } satisfies EventData);
  }, [userId]);

  const trackChatStart = useCallback((personaId: string, personaName: string) => {
    trackEvent({
      eventType: 'chat_start',
      eventName: 'chat_start',
      personaId,
      personaName,
    });
  }, [trackEvent]);

  const trackChatEnd = useCallback((conversationId: string, metadata?: Record<string, unknown>) => {
    trackEvent({
      eventType: 'chat_end',
      eventName: 'chat_end',
      conversationId,
      properties: metadata,
    });
  }, [trackEvent]);

  const trackFeatureUse = useCallback((featureName: string, properties?: Record<string, unknown>) => {
    trackEvent({
      eventType: 'feature_used',
      eventName: featureName,
      properties,
    });
  }, [trackEvent]);

  return {
    sessionId: sessionIdRef.current,
    trackEvent,
    trackChatStart,
    trackChatEnd,
    trackFeatureUse,
  };
}

// ─── Standalone Utilities (for non-hook contexts) ───────────────────────────────

export function trackEventOnce(data: Omit<EventData, 'sessionId'>): void {
  const sessionId = getOrCreateSessionId();
  sendToAPI('/api/analytics/event', {
    ...data,
    sessionId,
  } satisfies EventData);
}

export function getSessionIdOnce(): string {
  return getOrCreateSessionId();
}
