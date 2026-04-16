/**
 * GET /api/tracking-sdk — Serve the tracking SDK
 * Proxies the SDK from backend-admin or serves inline.
 * This ensures the tracking SDK is always available for Prismatic app.
 */
import { NextResponse } from 'next/server';

const BACKEND_ADMIN_URL = process.env.BACKEND_ADMIN_URL || 'https://backend-admin-gold.vercel.app';

// SDK source embedded directly (matches the backend-admin's tracking SDK v2)
const SDK_SOURCE = `
(function(global) {
  'use strict';

  var config = {
    tenantSlug: 'prismatic',
    apiUrl: '/api/tracking/internal',
    sessionTimeout: 1800000,
    debug: false,
    _backendOrigin: ''
  };

  (function detectBackendOrigin() {
    var scripts = global.document && global.document.getElementsByTagName('script');
    if (!scripts) return;
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src || '';
      if (src.indexOf('tracking-sdk') !== -1 || src.indexOf('zxq-tracking') !== -1) {
        try {
          var u = new global.URL(src);
          config._backendOrigin = u.origin;
        } catch(e) {}
        break;
      }
    }
  })();

  function getApiUrl() {
    if (config._backendOrigin) return config._backendOrigin + '/api/tracking';
    return config.apiUrl;
  }

  var visitorId = '', sessionId = '', sessionStartTime = 0, pageStartTime = 0;
  var toolStartTimes = {};
  var geoCache = { country: '', region: '', city: '', isp: '' };

  function getGeoInfo() {
    return new Promise(function(resolve) {
      var timeout = setTimeout(function() { resolve(geoCache); }, 3000);
      fetch('https://ip-api.com/json/?fields=status,country,region,city,org')
        .then(function(r) { clearTimeout(timeout); return r.json(); })
        .then(function(data) {
          if (data && data.status === 'success') {
            geoCache = { country: data.country || '', region: data.regionName || '', city: data.city || '', isp: data.org || '' };
          }
          resolve(geoCache);
        })
        .catch(function() { clearTimeout(timeout); resolve(geoCache); });
    });
  }

  function initGeoInfo() { getGeoInfo().then(function(info) { geoCache = info; }); }

  function generateId(prefix) { return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9); }

  function getDeviceInfo() {
    if (typeof window === 'undefined') return {};
    var ua = navigator.userAgent, deviceType = 'desktop';
    if (/tablet|ipad|playbook|silk/i.test(ua)) deviceType = 'tablet';
    else if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) deviceType = 'mobile';
    var browser = 'unknown';
    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';
    var os = 'unknown';
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    return { deviceType: deviceType, browser: browser, os: os, screenWidth: window.screen.width, screenHeight: window.screen.height, language: navigator.language || 'unknown' };
  }

  function getTrafficSource() {
    if (typeof document === 'undefined') return 'direct';
    var referrer = document.referrer;
    if (!referrer) return 'direct';
    try {
      var refUrl = new URL(referrer), hostname = refUrl.hostname;
      var searchEngines = ['google', 'bing', 'yahoo', 'baidu', 'yandex', 'duckduckgo', 'sogou'];
      if (searchEngines.some(function(se) { return hostname.includes(se); })) return 'search';
      var socialMedia = ['facebook', 'twitter', 'linkedin', 'instagram', 'youtube', 'tiktok', 'weibo', 'zhihu'];
      if (socialMedia.some(function(sm) { return hostname.includes(sm); })) return 'social';
      return 'referral';
    } catch { return 'direct'; }
  }

  function getVisitorId() {
    if (visitorId) return visitorId;
    var storageKey = 'zxq_visitor_id', id = global.localStorage && global.localStorage.getItem(storageKey);
    if (!id) { id = generateId('visitor'); global.localStorage && global.localStorage.setItem(storageKey, id); }
    visitorId = id;
    return id;
  }

  function getSessionId() {
    if (sessionId) return sessionId;
    var storageKey = 'zxq_session_id', timeKey = 'zxq_session_time', now = Date.now();
    var id = global.sessionStorage && global.sessionStorage.getItem(storageKey);
    var sessionTime = parseInt((global.sessionStorage && global.sessionStorage.getItem(timeKey)) || '0');
    if (!id || (now - sessionTime > config.sessionTimeout)) {
      id = generateId('session');
      global.sessionStorage && global.sessionStorage.setItem(storageKey, id);
      global.sessionStorage && global.sessionStorage.setItem(timeKey, now.toString());
      sessionStartTime = now;
    } else { sessionStartTime = sessionTime; }
    sessionId = id;
    return id;
  }

  function getSessionDuration() { return Date.now() - sessionStartTime; }
  function getPageDuration() { return Date.now() - pageStartTime; }

  function send(eventType, eventData) {
    if (typeof window === 'undefined') return;
    var deviceInfo = getDeviceInfo();
    var payload = {
      event_type: eventType,
      tenant_slug: config.tenantSlug,
      session_id: getSessionId(),
      visitor_id: getVisitorId(),
      timestamp: new Date().toISOString(),
      website_url: window.location.origin,
      page_url: window.location.href,
      page_title: document.title,
      referrer: document.referrer,
      user_agent: navigator.userAgent,
      device_type: deviceInfo.deviceType || 'unknown',
      browser: deviceInfo.browser || 'unknown',
      os: deviceInfo.os || 'unknown',
      screen_resolution: deviceInfo.screenWidth && deviceInfo.screenHeight ? deviceInfo.screenWidth + 'x' + deviceInfo.screenHeight : 'unknown',
      language: deviceInfo.language || 'unknown',
      traffic_source: getTrafficSource(),
      session_duration_ms: getSessionDuration(),
      page_duration_ms: getPageDuration(),
      geo_country: geoCache.country || '',
      geo_region: geoCache.region || '',
      geo_city: geoCache.city || '',
      geo_isp: geoCache.isp || '',
      event_data: eventData || {}
    };
    if (config.debug) console.log('[ZxqTrack]', eventType, payload);
    var finalApiUrl = getApiUrl();
    if (navigator.sendBeacon) { var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' }); navigator.sendBeacon(finalApiUrl, blob); }
    else { fetch(finalApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true }).catch(function() {}); }
  }

  function trackPageView(additionalData) {
    send('page_view', {
      page_path: typeof window !== 'undefined' ? window.location.pathname : '',
      page_title: typeof document !== 'undefined' ? document.title : '',
      viewport_width: typeof window !== 'undefined' ? window.innerWidth : 0,
      viewport_height: typeof window !== 'undefined' ? window.innerHeight : 0,
      time_on_page_ms: getPageDuration(),
      ...additionalData
    });
  }

  function trackClick(label, category, data) {
    send('click', {
      element: 'link', label: label, category: category || 'general',
      click_duration_ms: pageStartTime ? Date.now() - pageStartTime : 0,
      ...data
    });
  }

  function trackFormSubmit(formName, success, fields) {
    send('form_submit', {
      form_name: formName,
      submit_result: success ? 'success' : 'error',
      fields: fields || {},
      form_completion_time_ms: pageStartTime ? Date.now() - pageStartTime : 0,
      visitor_name: fields && (fields.name || fields['姓名'] || ''),
      visitor_email: fields && (fields.email || fields['邮箱'] || ''),
      visitor_phone: fields && (fields.phone || fields['电话'] || ''),
      company_name: fields && (fields.company || fields['公司名称'] || ''),
      product_type: fields && (fields.productType || fields['产品类型'] || ''),
      target_market: fields && (fields.targetMarket || fields['目标市场'] || ''),
      message: fields && (fields.message || fields['需求'] || fields['询价内容'] || '')
    });
  }

  function trackToolInteraction(toolName, action, data) {
    var now = Date.now();
    var eventPayload = { tool_name: toolName, action: action, duration_ms: 0, duration_seconds: 0 };
    if (action === 'start' || action === 'input') toolStartTimes[toolName] = now;
    if (toolStartTimes[toolName] && (action === 'complete' || action === 'abandon' || action === 'submit')) {
      var toolDuration = now - toolStartTimes[toolName];
      eventPayload.duration_ms = toolDuration;
      eventPayload.duration_seconds = Math.round(toolDuration / 1000);
      delete toolStartTimes[toolName];
    }
    if (data && typeof data === 'object') {
      if (data.completedSteps !== undefined || data.totalSteps !== undefined) {
        eventPayload.completed_steps = data.completedSteps || 0;
        eventPayload.total_steps = data.totalSteps || 1;
        eventPayload.progress_percent = data.totalSteps ? Math.round((data.completedSteps / data.totalSteps) * 100) : 0;
      }
      eventPayload.is_abandoned = action === 'abandon';
      eventPayload.is_completed = action === 'complete';
      Object.keys(data).forEach(function(key) {
        if (key !== 'completedSteps' && key !== 'totalSteps' && key !== 'is_abandoned' && key !== 'is_completed') {
          eventPayload[key] = data[key];
        }
      });
    }
    send('tool_interaction', eventPayload);
  }

  function trackAIAnalysis(analysisType, action, params) {
    var now = Date.now();
    var payload = {
      tool_name: analysisType, action: action,
      analysis_mode: params && params.analysisMode,
      product_type: params && (params.productType || params.product_type),
      target_region: params && (params.targetRegion || params.target_market),
      user_role: params && (params.userRole || params.user_role),
      business_stage: params && (params.businessStage || params.business_stage),
      duration_ms: params && params.startTime ? now - params.startTime : 0,
      duration_seconds: params && params.startTime ? Math.round((now - params.startTime) / 1000) : 0,
      result_summary: params && params.resultSummary,
      ai_result_content: params && params.aiResultContent,
      ai_result_length: params && params.aiResultLength,
      completed_steps: params && params.completedSteps,
      total_steps: params && params.totalSteps,
      is_abandoned: action === 'abandon',
      is_completed: action === 'complete'
    };
    send('tool_interaction', payload);
  }

  function trackScroll(depth) {
    send('scroll', {
      scroll_depth: depth,
      page_path: typeof window !== 'undefined' ? window.location.pathname : '',
      scroll_duration_ms: pageStartTime ? Date.now() - pageStartTime : 0
    });
  }

  function trackCustom(eventName, data) {
    send('custom', {
      event_name: eventName,
      custom_duration_ms: pageStartTime ? Date.now() - pageStartTime : 0,
      ...data
    });
  }

  function init(options) {
    config.tenantSlug = options.tenant || 'prismatic';
    if (options.apiUrl) config.apiUrl = options.apiUrl;
    config.debug = options.debug || false;
    getVisitorId();
    getSessionId();
    initGeoInfo();
    if (options.autoTrack !== false) {
      if (document.readyState === 'complete') initAutoTracking();
      else global.addEventListener('load', initAutoTracking);
    }
  }

  var autoTracked = false;
  function initAutoTracking() {
    if (autoTracked || typeof window === 'undefined') return;
    autoTracked = true;
    pageStartTime = Date.now();
    getGeoInfo().then(function(info) { geoCache = info; trackPageView(); });
    global.addEventListener('beforeunload', function() {
      var duration = Math.round((Date.now() - pageStartTime) / 1000);
      send('page_leave', { duration_seconds: duration, duration_ms: Date.now() - pageStartTime, page_path: window.location.pathname, is_bounce: sessionStartTime === pageStartTime });
    });
    var maxScroll = 0, trackedMilestones = {};
    global.addEventListener('scroll', function() {
      var scrollPercent = Math.round((window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100);
      if (scrollPercent > maxScroll) maxScroll = scrollPercent;
      [25, 50, 75, 100].forEach(function(m) {
        if (maxScroll >= m && !trackedMilestones[m]) { trackScroll(m); trackedMilestones[m] = true; }
      });
    }, { passive: true });
    document.addEventListener('click', function(e) {
      var target = e.target || e.srcElement, trackData = target && target.getAttribute && target.getAttribute('data-track');
      if (trackData) {
        try { var data = JSON.parse(trackData); trackClick(data.label || (target.textContent || ''), data.category, data); }
        catch { trackClick(target.textContent || ''); }
      }
    });
    document.addEventListener('submit', function(e) {
      var form = e.target || e.srcElement;
      if (form && form.tagName === 'FORM') {
        var formName = form.name || form.id || 'anonymous', formData = new FormData(form), fields = {};
        formData.forEach(function(value, key) { fields[key] = value; });
        setTimeout(function() { trackFormSubmit(formName, true, fields); }, 500);
      }
    });
  }

  var zxqTrack = {
    init: init, pageView: trackPageView, click: trackClick, form: trackFormSubmit,
    tool: trackToolInteraction, ai: trackAIAnalysis, scroll: trackScroll,
    custom: trackCustom,
    track: function(eventType, data) { send(eventType, data); },
    getVisitorId: getVisitorId, getSessionId: getSessionId,
    getPageDuration: getPageDuration, getSessionDuration: getSessionDuration,
    initAutoTracking: initAutoTracking,
    startToolTimer: function(toolName) { toolStartTimes[toolName] = Date.now(); },
    endToolTimer: function(toolName) { var duration = toolStartTimes[toolName] ? Date.now() - toolStartTimes[toolName] : 0; delete toolStartTimes[toolName]; return duration; }
  };

  // v2 API (Prismatic app expects zxqTrackV2)
  global.zxqTrackV2 = zxqTrack;
  global.zxqTrack = zxqTrack;
  if (typeof module !== 'undefined' && module.exports) module.exports = zxqTrack;
})(typeof window !== 'undefined' ? window : global);
`.trim();

export const runtime = 'edge';

export async function GET() {
  return new Response(SDK_SOURCE, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
