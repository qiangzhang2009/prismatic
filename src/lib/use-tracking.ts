'use client';

/**
 * Prismatic 追踪 Hook
 * 封装 zxqTrackV2 SDK，提供类型安全的追踪接口
 */

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

declare global {
  interface Window {
    _lastMessageSentTime?: number;
    zxqTrackV2?: {
      init: (options: { tenant: string; apiUrl?: string; debug?: boolean; autoTrack?: boolean }) => void;
      pageView: () => void;
      click: (label: string, category?: string, data?: Record<string, unknown>) => void;
      custom: (eventName: string, data?: Record<string, unknown>) => void;
      track: (eventType: string, data?: Record<string, unknown>) => void;
      personaView: (personaId: string, personaName: string, domain?: string) => void;
      modelExpand: (personaId: string, modelId: string, modelName: string) => void;
      graphNodeClick: (nodeType: 'persona' | 'model' | 'concept' | 'source' | 'domain', nodeId: string, nodeLabel: string, fromPersonaId?: string) => void;
      chatStart: (personaId: string, personaName: string, mode: string, domain?: string) => void;
      chatMessage: (personaId: string, mode: string, turn: number, aiLatencyMs?: number, modelUsed?: string, confidenceScore?: number) => void;
      modeSwitch: (fromMode: string, toMode: string, personaId?: string) => void;
      getVisitorId: () => string;
      getSessionId: () => string;
    };
  }
}

interface TrackingConfig {
  tenant?: string;
  apiUrl?: string;
  debug?: boolean;
}

let initialized = false;

// 初始化追踪 SDK
function initTracker(config: TrackingConfig = {}) {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  const tenant = config.tenant || 'prismatic';
  const apiUrl = config.apiUrl || (typeof window !== 'undefined' ? `${window.location.origin}/api/tracking` : '/api/tracking');

  // 初始化 SDK
  if (window.zxqTrackV2) {
    window.zxqTrackV2.init({
      tenant,
      apiUrl,
      debug: config.debug || false,
      autoTrack: true,
    });
  }
}

// 页面浏览追踪
export function trackPageView() {
  if (window.zxqTrackV2) {
    window.zxqTrackV2.pageView();
  }
}

// 人物卡片浏览
export function trackPersonaView(personaId: string, personaName: string, domain?: string) {
  if (window.zxqTrackV2) {
    window.zxqTrackV2.personaView(personaId, personaName, domain);
  }
}

// 思维模型展开
export function trackModelExpand(personaId: string, modelId: string, modelName: string) {
  if (window.zxqTrackV2) {
    window.zxqTrackV2.modelExpand(personaId, modelId, modelName);
  }
}

// 图谱节点点击
export function trackGraphNodeClick(
  nodeType: 'persona' | 'model' | 'concept' | 'source' | 'domain',
  nodeId: string,
  nodeLabel: string,
  fromPersonaId?: string
) {
  if (window.zxqTrackV2) {
    window.zxqTrackV2.graphNodeClick(nodeType, nodeId, nodeLabel, fromPersonaId);
  }
}

// 对话开始
export function trackChatStart(personaId: string, personaName: string, mode: string, domain?: string) {
  if (window.zxqTrackV2) {
    window.zxqTrackV2.chatStart(personaId, personaName, mode, domain);
  }
}

// 对话消息（带 AI 延迟和置信度）
export function trackChatMessage(
  personaId: string,
  mode: string,
  turn: number,
  aiLatencyMs?: number,
  modelUsed?: string,
  confidenceScore?: number
) {
  if (window.zxqTrackV2) {
    window.zxqTrackV2.chatMessage(personaId, mode, turn, aiLatencyMs, modelUsed, confidenceScore);
  }
}

// 模式切换
export function trackModeSwitch(fromMode: string, toMode: string, personaId?: string) {
  if (window.zxqTrackV2) {
    window.zxqTrackV2.modeSwitch(fromMode, toMode, personaId);
  }
}

// 自定义事件
export function trackCustom(eventName: string, data?: Record<string, unknown>) {
  if (window.zxqTrackV2) {
    window.zxqTrackV2.custom(eventName, data);
  }
}

// 点击追踪
export function trackClick(label: string, category?: string, data?: Record<string, unknown>) {
  if (window.zxqTrackV2) {
    window.zxqTrackV2.click(label, category, data);
  }
}

// React Hook: 自动追踪页面浏览
export function useTracking(config: TrackingConfig = {}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialized = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 加载追踪脚本
    if (!window.zxqTrackV2) {
      const script = document.createElement('script');
      const baseUrl = window.location.origin;
      script.src = `${baseUrl}/dist/zxq-tracking-v2.min.js`;
      script.async = true;
      script.onload = () => {
        initTracker(config);
      };
      document.head.appendChild(script);
    } else if (!initialized.current) {
      initTracker(config);
    }

    initialized.current = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 追踪路由变化
  useEffect(() => {
    if (typeof window === 'undefined' || !window.zxqTrackV2) return;
    trackPageView();
  }, [pathname, searchParams]);
}

// 获取访客 ID
export function getVisitorId(): string {
  return window.zxqTrackV2?.getVisitorId() || '';
}

// 获取会话 ID
export function getSessionId(): string {
  return window.zxqTrackV2?.getSessionId() || '';
}
