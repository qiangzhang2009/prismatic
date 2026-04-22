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
    solo: '深度对话',
    prism: '多维折射',
    roundtable: '圆桌辩论',
    mission: '协作任务',
    epoch: '关公战秦琼',
    council: '顾问团',
    oracle: '预言家',
    fiction: '共创故事',
  };
  return names[mode] || mode;
}

/**
 * 导出聊天记录为图片
 */
export async function exportChatAsImage(
  messages: AgentMessage[],
  selectedPersonaIds: string[],
  mode: Mode,
  conversationTitle?: string
): Promise<void> {
  const personas = getPersonasByIds(selectedPersonaIds);
  const modeName = getModeName(mode);
  const personaNames = personas.map(p => p.nameZh).join('、');

  // ─── Layout Constants ───────────────────────────────────────────────
  const canvasWidth = 720;
  const padding = 50;
  const contentWidth = canvasWidth - padding * 2; // 620px

  const headerHeight = 140;
  const footerHeight = 140; // 固定 footer 高度，避免被遮挡
  const messageSpacing = 28;
  const lineHeight = 26;
  const avatarSize = 36;

  // ─── Filter Messages ───────────────────────────────────────────────
  const chatMessages = messages.filter(msg => msg.content && msg.content.trim());

  // ─── Calculate Message Heights ──────────────────────────────────────
  // Use a temporary canvas context for accurate text measurement
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  const fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  measureCtx!.font = `15px ${fontFamily}`;

  const messageHeights: number[] = [];
  for (const msg of chatMessages) {
    if (msg.role === 'user') {
      const lines = wrapTextToLines(measureCtx!, msg.content, contentWidth / 2 - 35);
      const textHeight = lines.length * lineHeight;
      messageHeights.push(Math.max(textHeight + 50, 70));
    } else if (msg.role === 'system') {
      const lines = msg.content.split('\n').filter(l => l.trim());
      const textHeight = Math.max(lines.length - 1, 0) * lineHeight;
      messageHeights.push(textHeight + 50);
    } else {
      const lines = wrapTextToLines(measureCtx!, msg.content, contentWidth - avatarSize - 20);
      const textHeight = lines.length * lineHeight;
      messageHeights.push(Math.max(textHeight + 50, 70));
    }
  }

  const totalMessagesHeight = messageHeights.reduce((a, b) => a + b, 0);
  const totalContentHeight = headerHeight + totalMessagesHeight;
  const minCanvasHeight = 700;

  // 关键修复：canvas 高度必须同时容纳 header + 消息 + footer，三段相加
  const canvasHeight = Math.max(
    minCanvasHeight,
    totalContentHeight + footerHeight + padding * 2
  );

  // ─── Create Canvas ─────────────────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Measure context for actual rendering
  ctx.font = `15px ${fontFamily}`;

  // ─── Draw Background ────────────────────────────────────────────────
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // ─── Draw Top Gradient Bar ──────────────────────────────────────────
  const gradient = ctx.createLinearGradient(0, 0, canvasWidth, 0);
  gradient.addColorStop(0, '#4d96ff');
  gradient.addColorStop(0.5, '#9b6dff');
  gradient.addColorStop(1, '#c77dff');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvasWidth, 5);

  // ─── Draw Header ───────────────────────────────────────────────────
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 32px ${fontFamily}`;
  ctx.fillText('棱镜对话记录', padding, 60);

  // Header meta box
  ctx.fillStyle = '#1a1a30';
  roundRect(ctx, padding, 75, canvasWidth - padding * 2, 55, 10);
  ctx.fill();

  ctx.font = `15px ${fontFamily}`;
  ctx.fillStyle = '#a0a0c0';
  ctx.fillText(`📌 ${modeName}`, padding + 15, 100);
  ctx.fillText(`👥 ${personaNames}`, padding + 200, 100);
  ctx.fillText(`💬 ${chatMessages.length} 条消息`, padding + 420, 100);

  // Header divider
  ctx.strokeStyle = '#2a2a4a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, headerHeight);
  ctx.lineTo(canvasWidth - padding, headerHeight);
  ctx.stroke();

  // ─── Draw Messages ──────────────────────────────────────────────────
  let yPos = headerHeight + 25;

  for (let i = 0; i < chatMessages.length; i++) {
    const msg = chatMessages[i];
    const msgHeight = messageHeights[i];

    // Safety check: if we're too close to the footer area, stop drawing
    if (yPos + msgHeight > canvasHeight - footerHeight - padding) {
      // Draw a "truncated" notice and stop
      ctx.fillStyle = '#2a2a4a';
      roundRect(ctx, padding, yPos, contentWidth, 40, 8);
      ctx.fill();
      ctx.fillStyle = '#8080a0';
      ctx.font = `14px ${fontFamily}`;
      ctx.fillText('... 对话记录过长，已截断', padding + 15, yPos + 26);
      break;
    }

    if (msg.role === 'user') {
      // User message — right-aligned light blue bubble
      const bubbleX = canvasWidth / 2 + 10;
      const bubbleWidth = canvasWidth / 2 - padding - 10;

      ctx.fillStyle = '#1e3a5f';
      roundRect(ctx, bubbleX, yPos, bubbleWidth, msgHeight - 10, 12);
      ctx.fill();

      ctx.fillStyle = '#60a5fa';
      ctx.font = `bold 13px ${fontFamily}`;
      ctx.fillText('👤 你', canvasWidth - padding - 40, yPos + 22);

      ctx.fillStyle = '#e0e8f0';
      ctx.font = `15px ${fontFamily}`;
      const lines = wrapTextToLines(ctx, msg.content, bubbleWidth - 30);
      for (let j = 0; j < lines.length; j++) {
        ctx.fillText(lines[j], bubbleX + 15, yPos + 48 + j * lineHeight);
      }
    } else if (msg.role === 'system') {
      // System message — centered purple box
      const contentLines = msg.content.split('\n').filter(l => l.trim());
      const totalHeight = contentLines.length * lineHeight + 40;

      ctx.fillStyle = '#2a1f4a';
      roundRect(ctx, padding, yPos, contentWidth, totalHeight, 12);
      ctx.fill();

      ctx.fillStyle = '#c77dff';
      ctx.font = `bold 14px ${fontFamily}`;
      ctx.fillText(contentLines[0]?.slice(0, 40) || '系统', padding + 15, yPos + 24);

      ctx.fillStyle = '#c0b0d8';
      ctx.font = `14px ${fontFamily}`;
      for (let j = 1; j < contentLines.length; j++) {
        const lines = wrapTextToLines(ctx, contentLines[j], contentWidth - 40);
        for (let k = 0; k < lines.length; k++) {
          ctx.fillText(lines[k], padding + 15, yPos + 48 + (j - 1) * lineHeight + k * lineHeight);
        }
      }
    } else {
      // AI agent message — left-aligned with avatar
      const persona = personas.find(p => p.id === msg.personaId);
      const speakerName = persona?.nameZh || 'AI';

      // Avatar circle
      ctx.fillStyle = persona?.gradientFrom || '#4d96ff';
      ctx.beginPath();
      ctx.arc(padding + avatarSize / 2, yPos + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 16px ${fontFamily}`;
      ctx.fillText(speakerName.charAt(0), padding + avatarSize / 2 - 6, yPos + avatarSize / 2 + 5);

      // Speaker name
      ctx.fillStyle = persona?.accentColor || '#4d96ff';
      ctx.font = `bold 14px ${fontFamily}`;
      ctx.fillText(speakerName, padding + avatarSize + 12, yPos + 16);

      // Message content
      ctx.fillStyle = '#e8e8f0';
      ctx.font = `15px ${fontFamily}`;
      const lines = wrapTextToLines(ctx, msg.content, contentWidth - avatarSize - 20);
      for (let j = 0; j < lines.length; j++) {
        ctx.fillText(lines[j], padding + avatarSize + 12, yPos + 40 + j * lineHeight);
      }
    }

    yPos += msgHeight + messageSpacing;
  }

  // ─── Draw Footer ───────────────────────────────────────────────────
  const footerY = canvasHeight - footerHeight;

  // Footer background
  ctx.fillStyle = '#0d0d20';
  ctx.fillRect(0, footerY, canvasWidth, footerHeight);

  // Footer top border
  ctx.strokeStyle = '#2a2a4a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, footerY);
  ctx.lineTo(canvasWidth, footerY);
  ctx.stroke();

  // ── Brand info (left side of footer) ──
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 16px ${fontFamily}`;
  ctx.fillText('✨ 由「棱镜」导出', padding, footerY + 32);

  ctx.fillStyle = '#6060a0';
  ctx.font = `13px ${fontFamily}`;
  ctx.fillText(WEBSITE_URL, padding, footerY + 55);

  ctx.fillStyle = '#404060';
  ctx.font = `12px ${fontFamily}`;
  ctx.fillText(`对话时间：${formatDate(new Date())}`, padding, footerY + 76);

  // ── QR Code (right side of footer) ──
  const qrSize = 100;
  const qrX = canvasWidth - padding - qrSize;
  const qrY = footerY + (footerHeight - qrSize) / 2; // vertically centered in footer

  // White QR border / background
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, qrX - 6, qrY - 6, qrSize + 12, qrSize + 12, 6);
  ctx.fill();

  // Load and draw QR code
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize * 2}x${qrSize * 2}&data=${encodeURIComponent(WEBSITE_URL)}&margin=5&format=png`;
  try {
    const qrImage = new Image();
    qrImage.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      qrImage.onload = () => resolve();
      qrImage.onerror = reject;
      qrImage.src = qrCodeUrl;
    });
    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
  } catch {
    // Fallback: placeholder if QR loading fails
    ctx.fillStyle = '#0a0a1a';
    roundRect(ctx, qrX, qrY, qrSize, qrSize, 4);
    ctx.fill();
    ctx.fillStyle = '#404060';
    ctx.font = `11px ${fontFamily}`;
    ctx.fillText('扫码', qrX + qrSize / 2 - 15, qrY + qrSize / 2 - 5);
    ctx.fillText('访问', qrX + qrSize / 2 - 15, qrY + qrSize / 2 + 10);
  }

  // ─── Download ───────────────────────────────────────────────────────
  const link = document.createElement('a');
  link.download = `棱镜对话_${formatDateForFile(new Date())}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

/**
 * 导出聊天记录为文本
 */
export function exportChatAsText(
  messages: AgentMessage[],
  selectedPersonaIds: string[],
  mode: Mode
): void {
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

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  link.download = `棱镜对话_${formatDateForFile(new Date())}.txt`;
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * 辅助函数：绘制圆角矩形
 */
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

/**
 * 辅助函数：自动换行（返回行数组）
 */
function wrapTextToLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const cleanText = text.replace(/[*_`#\[\]()>]/g, '');
  const paragraphs = cleanText.split('\n');
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push('');
      continue;
    }

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
    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines.length > 0 ? lines : [''];
}

/**
 * 格式化日期用于文件名
 */
function formatDateForFile(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
