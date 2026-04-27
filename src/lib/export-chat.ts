'use client';

/**
 * 导出聊天记录工具函数
 */
import { getPersonasByIds } from '@/lib/personas';
import type { AgentMessage, Mode } from '@/lib/types';

// 网站链接
const WEBSITE_URL = 'https://prismatic.zxqconsulting.com';

/**
 * 格式化时间为中文格式
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 获取模式中文名称
 */
function getModeName(mode: Mode): string {
  const names: Record<Mode, string> = {
    solo: '导师对话',
    prism: '折射视图',
    roundtable: '圆桌辩论',
    mission: '任务特攻队',
    epoch: '关公战秦琼',
    council: '顾问团',
    oracle: '预言家',
    fiction: '共创故事',
  };
  return names[mode] || mode;
}

// ─── Canvas Layout Constants ────────────────────────────────────────────────────
const CANVAS_WIDTH = 720;
const PADDING = 50;
const CONTENT_WIDTH = CANVAS_WIDTH - PADDING * 2; // 620px

const HEADER_HEIGHT = 140;
const FOOTER_CONTENT_HEIGHT = 95; // actual footer content height (text + QR)
const FOOTER_BG_HEIGHT = FOOTER_CONTENT_HEIGHT + 30; // 125px — enough room for gradient line + content
const MESSAGE_SPACING = 28;
const LINE_HEIGHT = 26;
const AVATAR_SIZE = 36;
const CANVAS_MIN_HEIGHT = 700;

// ─── Message height measurement (pixel-accurate via canvas) ──────────────────

function measureMessageHeights(messages: AgentMessage[], fontFamily: string): number[] {
  const measureCanvas = document.createElement('canvas');
  const ctx = measureCanvas.getContext('2d')!;
  ctx.font = `15px ${fontFamily}`;

  // These MUST match the actual draw dimensions exactly:
  // User bubble: bubbleX = 370, bubbleWidth = CANVAS_WIDTH/2 - PADDING - 10 = 290
  //   textWidth = bubbleWidth - 30 = 260
  // Agent bubble: textWidth = CONTENT_WIDTH - AVATAR_SIZE - 20 = 568
  const USER_TEXT_WIDTH = CANVAS_WIDTH / 2 - PADDING - 10 - 30; // 260
  const AGENT_TEXT_WIDTH = CONTENT_WIDTH - AVATAR_SIZE - 20;     // 568

  return messages.map(msg => {
    if (msg.role === 'user') {
      const lines = wrapTextToLines(ctx, msg.content, USER_TEXT_WIDTH);
      return Math.max(lines.length * LINE_HEIGHT + 50, 70);
    } else if (msg.role === 'system') {
      const contentLines = msg.content.split('\n').filter(l => l.trim());
      return Math.max(contentLines.length * LINE_HEIGHT, 20) + 50;
    } else {
      const lines = wrapTextToLines(ctx, msg.content, AGENT_TEXT_WIDTH);
      return Math.max(lines.length * LINE_HEIGHT + 50, 70);
    }
  });
}

// ─── Pair-counting helpers ────────────────────────────────────────────────────

/**
 * Count complete Q&A pairs in the message list (user + following agent messages).
 * A pair starts with a user message.
 */
function countCompletePairs(messages: AgentMessage[], maxPairs: number): number {
  const chatMessages = messages.filter(m => m.content?.trim());
  let pairs = 0;
  for (const msg of chatMessages) {
    if (msg.role === 'user') {
      pairs++;
      if (pairs >= maxPairs) break;
    }
  }
  return Math.min(pairs, maxPairs);
}

/**
 * Find the index (exclusive) of the last chat message to include for a given
 * number of complete Q&A pairs. Includes the AI reply after each user message.
 */
function findLastChatMsgIndexForPairs(
  messages: AgentMessage[],
  targetPairs: number
): number {
  const chatMessages = messages.filter(m => m.content?.trim());
  let pairs = 0;
  for (let i = 0; i < chatMessages.length; i++) {
    if (chatMessages[i].role === 'user') {
      pairs++;
      if (pairs >= targetPairs) {
        // include all messages up to and including this user
        // (the AI reply after it naturally follows)
        return i + 1;
      }
    }
  }
  return chatMessages.length;
}

// ─── Image Export ─────────────────────────────────────────────────────────────

export async function exportChatAsImage(
  messages: AgentMessage[],
  selectedPersonaIds: string[],
  mode: Mode,
  _conversationTitle?: string
): Promise<string> {
  console.log('[exportChatAsImage] START', { messageCount: messages.length, personaCount: selectedPersonaIds.length });
  const personas = getPersonasByIds(selectedPersonaIds);
  const modeName = getModeName(mode);
  const personaNames = personas.map(p => p.nameZh).join('、');

  const chatMessages = messages.filter(m => m.content && m.content.trim());
  console.log('[exportChatAsImage] filtered messages:', chatMessages.length);
  const fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  // ── How many complete pairs to attempt ────────────────────────────────
  const MAX_PAIRS = 4;
  const pairCount = countCompletePairs(messages, MAX_PAIRS);
  const lastChatIdx = findLastChatMsgIndexForPairs(messages, MAX_PAIRS);
  const messagesToShow = chatMessages.slice(0, lastChatIdx);
  const totalChatMessages = chatMessages.length;

  // ── Measure heights ───────────────────────────────────────────────────
  console.log('[exportChatAsImage] measuring heights...');
  const messageHeights = measureMessageHeights(messagesToShow, fontFamily);
  const totalMessagesHeight = messageHeights.reduce((a, b) => a + b, 0)
    + Math.max(messagesToShow.length - 1, 0) * MESSAGE_SPACING;

  // ── Canvas dimensions ──────────────────────────────────────────────────
  console.log('[exportChatAsImage] building canvas dimensions...');
  const footerY = HEADER_HEIGHT + totalMessagesHeight + PADDING * 2;
  // Reserve: gap after last message, then footer background
  const canvasHeight = Math.max(
    CANVAS_MIN_HEIGHT,
    footerY + FOOTER_BG_HEIGHT + PADDING
  );

  // The truncation boundary is the top of the footer background
  const truncationBoundary = canvasHeight - FOOTER_BG_HEIGHT;

  // ── Create Canvas ─────────────────────────────────────────────────────
  console.log('[exportChatAsImage] creating canvas element...');
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.font = `15px ${fontFamily}`;

  console.log('[exportChatAsImage] drawing background...');
  // Background
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, CANVAS_WIDTH, canvasHeight);

  // Top gradient bar
  const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, 0);
  gradient.addColorStop(0, '#4d96ff');
  gradient.addColorStop(0.5, '#9b6dff');
  gradient.addColorStop(1, '#c77dff');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, 5);

  console.log('[exportChatAsImage] drawing header...');
  // Header
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 32px ${fontFamily}`;
  ctx.fillText('棱镜对话记录', PADDING, 60);

  ctx.fillStyle = '#1a1a30';
  roundRect(ctx, PADDING, 75, CANVAS_WIDTH - PADDING * 2, 55, 10);
  ctx.fill();

  ctx.font = `15px ${fontFamily}`;
  ctx.fillStyle = '#a0a0c0';
  ctx.fillText(`📌 ${modeName}`, PADDING + 15, 100);
  ctx.fillText(`👥 ${personaNames}`, PADDING + 200, 100);
  ctx.fillText(`💬 ${totalChatMessages} 条消息`, PADDING + 420, 100);

  ctx.strokeStyle = '#2a2a4a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PADDING, HEADER_HEIGHT);
  ctx.lineTo(CANVAS_WIDTH - PADDING, HEADER_HEIGHT);
  ctx.stroke();

  console.log('[exportChatAsImage] drawing messages...', messagesToShow.length);
  // ── Draw messages ─────────────────────────────────────────────────────
  let yPos = HEADER_HEIGHT + 25;
  let drawnCount = 0;
  let truncatedCount = totalChatMessages - messagesToShow.length;

  for (let i = 0; i < messagesToShow.length; i++) {
    const msg = messagesToShow[i];
    const msgHeight = messageHeights[i];

    // Stop before overlapping the footer
    if (yPos + msgHeight > truncationBoundary) {
      drawnCount = i;
      truncatedCount = totalChatMessages - drawnCount;
      console.log('[exportChatAsImage] truncating at msg', i, 'truncatedCount:', truncatedCount);
      drawTruncationNotice(ctx, truncatedCount, yPos);
      console.log('[exportChatAsImage] drawing footer...');
      await drawFooter(ctx, canvasHeight);
      console.log('[exportChatAsImage] returning dataURL');
      return canvas.toDataURL('image/jpeg', 0.92);
    }

    if (msg.role === 'user') {
      drawUserMessage(ctx, msg.content, yPos, msgHeight);
    } else if (msg.role === 'system') {
      drawSystemMessage(ctx, msg.content, yPos, msgHeight);
    } else {
      const persona = personas.find(p => p.id === msg.personaId);
      drawAgentMessage(ctx, msg.content, yPos, msgHeight, persona);
    }

    yPos += msgHeight + MESSAGE_SPACING;
    drawnCount = i + 1;
  }

  const finalTruncatedCount = totalChatMessages - drawnCount;
  if (finalTruncatedCount > 0) {
    drawTruncationNotice(ctx, finalTruncatedCount, yPos);
  }

  console.log('[exportChatAsImage] drawing footer...');
  await drawFooter(ctx, canvasHeight);
  console.log('[exportChatAsImage] returning dataURL');
  return canvas.toDataURL('image/jpeg', 0.92);
}

function drawTruncationNotice(
  ctx: CanvasRenderingContext2D,
  truncatedCount: number,
  yPos: number
) {
  ctx.fillStyle = '#1a1a30';
  roundRect(ctx, PADDING, yPos, CONTENT_WIDTH, 44, 10);
  ctx.fill();
  ctx.fillStyle = '#8080a0';
  ctx.font = `14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillText(
    `还有 ${truncatedCount} 条消息未显示 · 导出更多请使用文本格式`,
    PADDING + 15,
    yPos + 28
  );
}

async function drawFooter(
  ctx: CanvasRenderingContext2D,
  canvasHeight: number
): Promise<void> {
  const footerY = canvasHeight - FOOTER_BG_HEIGHT;
  const fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  // Footer background
  ctx.fillStyle = '#0d0d20';
  ctx.fillRect(0, footerY, CANVAS_WIDTH, FOOTER_BG_HEIGHT);

  // Top border
  ctx.strokeStyle = '#2a2a4a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, footerY);
  ctx.lineTo(CANVAS_WIDTH, footerY);
  ctx.stroke();

  // Gradient line
  const grad = ctx.createLinearGradient(0, footerY, CANVAS_WIDTH, footerY);
  grad.addColorStop(0, '#4d96ff');
  grad.addColorStop(0.5, '#9b6dff');
  grad.addColorStop(1, '#c77dff');
  ctx.fillStyle = grad;
  ctx.fillRect(0, footerY, CANVAS_WIDTH, 3);

  // Brand info
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 16px ${fontFamily}`;
  ctx.fillText('✨ 由「棱镜」导出', PADDING, footerY + 28);

  ctx.fillStyle = '#6060a0';
  ctx.font = `13px ${fontFamily}`;
  ctx.fillText(WEBSITE_URL, PADDING, footerY + 48);

  ctx.fillStyle = '#404060';
  ctx.font = `12px ${fontFamily}`;
  ctx.fillText(`导出时间：${formatDate(new Date())}`, PADDING, footerY + 68);

  // QR Code — with timeout fallback for cross-origin image loading (Safari)
  const qrSize = 100;
  const qrX = CANVAS_WIDTH - PADDING - qrSize;
  const qrY = footerY + (FOOTER_BG_HEIGHT - 3 - qrSize) / 2;

  ctx.fillStyle = '#ffffff';
  roundRect(ctx, qrX - 5, qrY - 5, qrSize + 10, qrSize + 10, 6);
  ctx.fill();

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize * 2}x${qrSize * 2}&data=${encodeURIComponent(WEBSITE_URL)}&margin=5&format=png`;
  try {
    const qrImg = new Image();
    qrImg.crossOrigin = 'anonymous';
    await Promise.race([
      new Promise<void>((resolve, reject) => {
        qrImg.onload = () => resolve();
        qrImg.onerror = () => reject(new Error('QR image load failed'));
        qrImg.src = qrUrl;
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('QR image load timeout')), 5000)
      ),
    ]);
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
  } catch {
    // Fallback: draw a placeholder box
    ctx.fillStyle = '#0a0a1a';
    roundRect(ctx, qrX, qrY, qrSize, qrSize, 4);
    ctx.fill();
    ctx.fillStyle = '#404060';
    ctx.font = `11px ${fontFamily}`;
    ctx.fillText('扫码', qrX + qrSize / 2 - 15, qrY + qrSize / 2 - 5);
    ctx.fillText('访问', qrX + qrSize / 2 - 15, qrY + qrSize / 2 + 10);
  }
}

function drawUserMessage(
  ctx: CanvasRenderingContext2D,
  content: string,
  yPos: number,
  msgHeight: number
) {
  const bubbleX = CANVAS_WIDTH / 2 + 10;
  const bubbleWidth = CANVAS_WIDTH / 2 - PADDING - 10;
  const fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  ctx.fillStyle = '#1e3a5f';
  roundRect(ctx, bubbleX, yPos, bubbleWidth, msgHeight - 10, 12);
  ctx.fill();

  ctx.fillStyle = '#60a5fa';
  ctx.font = `bold 13px ${fontFamily}`;
  ctx.fillText('👤 你', CANVAS_WIDTH - PADDING - 40, yPos + 22);

  ctx.fillStyle = '#e0e8f0';
  ctx.font = `15px ${fontFamily}`;
  const lines = wrapTextToLines(ctx, content, bubbleWidth - 30);
  for (let j = 0; j < lines.length; j++) {
    ctx.fillText(lines[j], bubbleX + 15, yPos + 48 + j * LINE_HEIGHT);
  }
}

function drawSystemMessage(
  ctx: CanvasRenderingContext2D,
  content: string,
  yPos: number,
  msgHeight: number
) {
  const contentLines = content.split('\n').filter(l => l.trim());
  const fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  ctx.fillStyle = '#2a1f4a';
  roundRect(ctx, PADDING, yPos, CONTENT_WIDTH, msgHeight, 12);
  ctx.fill();

  ctx.fillStyle = '#c77dff';
  ctx.font = `bold 14px ${fontFamily}`;
  ctx.fillText(contentLines[0]?.slice(0, 40) || '系统', PADDING + 15, yPos + 24);

  ctx.fillStyle = '#c0b0d8';
  ctx.font = `14px ${fontFamily}`;
  for (let j = 1; j < contentLines.length; j++) {
    const lines = wrapTextToLines(ctx, contentLines[j], CONTENT_WIDTH - 40);
    for (let k = 0; k < lines.length; k++) {
      ctx.fillText(lines[k], PADDING + 15, yPos + 48 + (j - 1) * LINE_HEIGHT + k * LINE_HEIGHT);
    }
  }
}

function drawAgentMessage(
  ctx: CanvasRenderingContext2D,
  content: string,
  yPos: number,
  msgHeight: number,
  persona: any
) {
  const speakerName = persona?.nameZh || 'AI';
  const fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  // Avatar
  ctx.fillStyle = persona?.gradientFrom || '#4d96ff';
  ctx.beginPath();
  ctx.arc(PADDING + AVATAR_SIZE / 2, yPos + AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 16px ${fontFamily}`;
  ctx.fillText(speakerName.charAt(0), PADDING + AVATAR_SIZE / 2 - 6, yPos + AVATAR_SIZE / 2 + 5);

  // Speaker name
  ctx.fillStyle = persona?.accentColor || '#4d96ff';
  ctx.font = `bold 14px ${fontFamily}`;
  ctx.fillText(speakerName, PADDING + AVATAR_SIZE + 12, yPos + 16);

  // Content
  ctx.fillStyle = '#e8e8f0';
  ctx.font = `15px ${fontFamily}`;
  const lines = wrapTextToLines(ctx, content, CONTENT_WIDTH - AVATAR_SIZE - 20);
  for (let j = 0; j < lines.length; j++) {
    ctx.fillText(lines[j], PADDING + AVATAR_SIZE + 12, yPos + 40 + j * LINE_HEIGHT);
  }
}

/**
 * Cross-platform download:
 * - Image: POST dataUrl → get server URL → location.href navigation (WeChat allows this)
 * - Text: link.click() with blob URL
 */
function triggerDownload(href: string, filename: string, isImage: boolean): void {
  if (isImage) {
    // POST to server → get download URL → navigate (location.href works in WeChat)
    fetch('/api/export/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl: href, filename }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Server error');
        return res.json() as Promise<{ downloadUrl: string }>;
      })
      .then(({ downloadUrl }) => {
        // location.href navigates to the server URL; server responds with
        // Content-Disposition: attachment → triggers download in WeChat WebView
        location.href = downloadUrl;
      })
      .catch((e) => {
        console.warn('[Export] Server download failed, falling back:', e);
        triggerDownloadDirect(href, filename);
      });
  } else {
    triggerDownloadDirect(href, filename);
  }
}

function triggerDownloadDirect(href: string, filename: string): void {
  // Strategy 1: link.click() with data/blob URL
  try {
    const link = document.createElement('a');
    link.download = filename;
    link.href = href;
    link.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => document.body.removeChild(link), 100);
    return;
  } catch (e) {
    console.warn('[Export] click failed:', e);
  }

  // Strategy 2: dispatchEvent
  try {
    const link = document.createElement('a');
    link.download = filename;
    link.href = href;
    document.body.appendChild(link);
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    setTimeout(() => document.body.removeChild(link), 100);
    return;
  } catch (e) {
    console.warn('[Export] dispatchEvent failed:', e);
  }

  // Strategy 3: window.open
  try {
    const win = window.open(href, '_blank');
    if (win) setTimeout(() => win.close(), 300);
  } catch (e) {
    console.warn('[Export] window.open failed:', e);
  }
}

function downloadCanvas(canvas: HTMLCanvasElement): void {
  const filename = `棱镜对话_${formatDateForFile(new Date())}.jpg`;
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  triggerDownload(dataUrl, filename, true);
}


// ─── Text Export (unlimited) ─────────────────────────────────────────────────

// Returns text content string for caller to handle (enables server-API download on Android)
export async function generateChatText(
  messages: AgentMessage[],
  selectedPersonaIds: string[],
  mode: Mode,
): Promise<string> {
  const personas = getPersonasByIds(selectedPersonaIds);
  const modeName = getModeName(mode);
  const personaNames = personas.map(p => p.nameZh).join('、');

  let content = `═══════════════════════════════════════\n`;
  content += `         棱镜对话记录\n`;
  content += `═══════════════════════════════════════\n\n`;
  content += `📌 对话模式：${modeName}\n`;
  content += `👥 参与人物：${personaNames}\n`;
  content += `💬 消息数量：${messages.length} 条\n`;
  content += `📅 导出时间：${formatDate(new Date())}\n\n`;
  content += `═══════════════════════════════════════\n\n`;

  for (const msg of messages) {
    if (msg.role === 'user') {
      content += `┌──────────────────────────────┐\n`;
      content += `│ 👤 你\n`;
      content += `│ ${msg.content.split('\n').join('\n│ ')}\n`;
      content += `└──────────────────────────────┘\n\n`;
    } else if (msg.role === 'system') {
      content += `═══════════════════════════════════════\n`;
      content += `${msg.content}\n`;
      content += `═══════════════════════════════════════\n\n`;
    } else {
      const persona = personas.find(p => p.id === msg.personaId);
      const speakerName = persona?.nameZh || 'AI';
      content += `┌──────────────────────────────┐\n`;
      content += `│ 💬 ${speakerName}\n`;
      content += `│ ${msg.content.split('\n').join('\n│ ')}\n`;
      content += `└──────────────────────────────┘\n\n`;
    }
  }

  content += `═══════════════════════════════════════\n`;
  content += `✨ 由「棱镜」导出\n`;
  content += `🌐 ${WEBSITE_URL}\n`;
  content += `═══════════════════════════════════════\n`;

  return content;
}

// Downloads text content via server API (works reliably on Android WeChat)
export async function downloadTextViaAPI(content: string, filename: string): Promise<void> {
  const safeFilename = filename.replace(/[^a-zA-Z0-9_\u4e00-\u9fff.-]/g, '_');
  const res = await fetch('/api/export/text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, filename: safeFilename }),
  });
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  const { id, filename: serverFilename } = await res.json() as { id: string; filename: string };

  // Detect Android WeChat (X5 browser) — use preview page with copy button
  const ua = navigator.userAgent.toLowerCase();
  const isAndroid = ua.includes('android');
  const isWeChat = /MicroMessenger/i.test(navigator.userAgent);

  const baseUrl = `/api/export/text?id=${encodeURIComponent(id)}&filename=${encodeURIComponent(serverFilename)}`;

  if (isAndroid && isWeChat) {
    // X5 browser blocks all downloads — open preview page with clipboard copy
    location.href = baseUrl + '&preview=1';
  } else {
    // Normal direct download for desktop/iOS/other browsers
    location.href = baseUrl;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapTextToLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const cleanText = text.replace(/[*_`#\[\]()>]/g, '');
  const paragraphs = cleanText.split('\n');
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) { lines.push(''); continue; }

    let currentLine = '';
    const chars = paragraph.split('');
    for (const char of chars) {
      const testLine = currentLine + char;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [''];
}

function formatDateForFile(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
