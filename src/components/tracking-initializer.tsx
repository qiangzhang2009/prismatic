'use client';

/**
 * Prismatic Analytics 追踪初始化组件
 * 在 afterInteractive 脚本加载后初始化 SDK
 */

import { useEffect, useRef } from 'react';

export function TrackingInitializer() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    function init() {
      if (window.zxqTrackV2) {
        window.zxqTrackV2.init({
          tenant: 'prismatic',
          debug: false,
          autoTrack: true,
          // 强制发送到 /api/tracking（由蒸馏 app 转发到 backend-admin Neon 数据库）
          apiUrl: '/api/tracking',
        });
        // 手动触发一次 pageview（SDK autoTrack 在 load 事件时触发，
        // 但 Next.js 的 App Router 页面切换是 SPA 内部路由，load 事件不会重新触发）
        setTimeout(() => {
          window.zxqTrackV2?.pageView();
        }, 100);
      } else {
        // SDK 未加载，延迟重试
        setTimeout(init, 500);
      }
    }

    if (document.readyState === 'complete') {
      init();
    } else {
      window.addEventListener('load', init);
    }
  }, []);

  return null;
}
