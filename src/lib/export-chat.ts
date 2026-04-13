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

  // 构建文本内容用于计算高度
  const padding = 50;
  const contentWidth = 620;
  const qrSize = 180;
  const headerHeight = 140;
  const footerHeight = 120;
  const messageSpacing = 30;
  const lineHeight = 26;
  const avatarSize = 36;

  // 过滤并准备消息
  const chatMessages = messages.filter(msg => msg.content && msg.content.trim());

  // 计算每条消息的高度
  const messageHeights: number[] = [];
  for (const msg of chatMessages) {
    const lines = countLines(msg.content, contentWidth - avatarSize - 20);
    const baseHeight = 50 + lines * lineHeight; // 头像 + 行数
    messageHeights.push(Math.max(baseHeight, 70));
  }

  const totalMessagesHeight = messageHeights.reduce((a, b) => a + b, 0);
  const canvasHeight = Math.max(700, headerHeight + totalMessagesHeight + footerHeight + padding * 2);

  // 创建画布
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = 720;
  canvas.height = canvasHeight;

  // 绘制背景
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 绘制顶部渐变装饰条
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
  gradient.addColorStop(0, '#4d96ff');
  gradient.addColorStop(0.5, '#9b6dff');
  gradient.addColorStop(1, '#c77dff');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, 5);

  // 绘制标题
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('棱镜对话记录', padding, 60);

  // 绘制元信息背景
  ctx.fillStyle = '#1a1a30';
  roundRect(ctx, padding, 75, canvas.width - padding * 2, 55, 10);
  ctx.fill();

  // 绘制元信息
  ctx.font = '15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#a0a0c0';
  ctx.fillText(`📌 ${modeName}`, padding + 15, 100);
  ctx.fillText(`👥 ${personaNames}`, padding + 200, 100);
  ctx.fillText(`💬 ${chatMessages.length} 条消息`, padding + 420, 100);

  // 绘制分隔线
  ctx.strokeStyle = '#2a2a4a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, headerHeight);
  ctx.lineTo(canvas.width - padding, headerHeight);
  ctx.stroke();

  // 绘制消息
  let yPos = headerHeight + 25;

  for (let i = 0; i < chatMessages.length; i++) {
    const msg = chatMessages[i];
    const msgHeight = messageHeights[i];

    if (msg.role === 'user') {
      // 用户消息 - 右对齐浅蓝色背景
      ctx.fillStyle = '#1e3a5f';
      roundRect(ctx, canvas.width / 2 + 10, yPos, canvas.width / 2 - padding - 10, msgHeight - 10, 12);
      ctx.fill();

      ctx.fillStyle = '#60a5fa';
      ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('👤 你', canvas.width - padding - 40, yPos + 22);

      ctx.fillStyle = '#e0e8f0';
      ctx.font = '15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const lines = wrapText(ctx, msg.content, contentWidth / 2 - 30);
      for (let j = 0; j < lines.length; j++) {
        ctx.fillText(lines[j], canvas.width - padding - contentWidth / 2 + 15, yPos + 48 + j * lineHeight);
      }
    } else if (msg.role === 'system') {
      // 系统消息 - 居中背景
      const contentLines = msg.content.split('\n').filter(l => l.trim());
      const totalHeight = contentLines.length * lineHeight + 35;

      ctx.fillStyle = '#2a1f4a';
      roundRect(ctx, padding, yPos, canvas.width - padding * 2, totalHeight, 12);
      ctx.fill();

      ctx.fillStyle = '#c77dff';
      ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const title = contentLines[0] || '系统';
      ctx.fillText(title.slice(0, 40), padding + 15, yPos + 24);

      ctx.fillStyle = '#c0b0d8';
      ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      for (let j = 1; j < contentLines.length; j++) {
        const lines = wrapText(ctx, contentLines[j], canvas.width - padding * 2 - 40);
        for (let k = 0; k < lines.length; k++) {
          ctx.fillText(lines[k], padding + 15, yPos + 48 + (j - 1) * lineHeight + k * lineHeight);
        }
      }
    } else {
      // AI 消息 - 左对齐
      const persona = personas.find(p => p.id === msg.personaId);
      const speakerName = persona?.nameZh || 'AI';

      // 绘制头像背景
      ctx.fillStyle = persona?.gradientFrom || '#4d96ff';
      ctx.beginPath();
      ctx.arc(padding + avatarSize / 2, yPos + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.fill();

      // 绘制头像文字
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(speakerName.charAt(0), padding + avatarSize / 2 - 6, yPos + avatarSize / 2 + 5);

      // 绘制名字
      ctx.fillStyle = persona?.accentColor || '#4d96ff';
      ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(speakerName, padding + avatarSize + 12, yPos + 16);

      // 绘制消息内容
      ctx.fillStyle = '#e8e8f0';
      ctx.font = '15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const lines = wrapText(ctx, msg.content, contentWidth - avatarSize - 20);
      for (let j = 0; j < lines.length; j++) {
        ctx.fillText(lines[j], padding + avatarSize + 12, yPos + 40 + j * lineHeight);
      }
    }

    yPos += msgHeight + messageSpacing;
  }

  // 绘制底部区域
  const footerY = canvasHeight - footerHeight;

  // 绘制分隔线
  ctx.strokeStyle = '#2a2a4a';
  ctx.beginPath();
  ctx.moveTo(padding, footerY - 15);
  ctx.lineTo(canvas.width - padding, footerY - 15);
  ctx.stroke();

  // 绘制品牌信息
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('✨ 由「棱镜」导出', padding, footerY + 10);

  ctx.fillStyle = '#8080a0';
  ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(WEBSITE_URL, padding, footerY + 35);

  // 绘制二维码
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(WEBSITE_URL)}&margin=5&format=png`;
  try {
    const qrImage = new Image();
    qrImage.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      qrImage.onload = () => resolve();
      qrImage.onerror = reject;
      qrImage.src = qrCodeUrl;
    });

    const qrX = canvas.width - padding - qrSize;
    const qrY = footerY - 40;

    // 二维码白色边框
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 8);
    ctx.fill();

    // 绘制二维码
    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
  } catch {
    // 如果二维码加载失败，绘制占位符
    ctx.fillStyle = '#ffffff';
    const qrX = canvas.width - padding - qrSize;
    const qrY = footerY - 40;
    roundRect(ctx, qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 8);
    ctx.fill();

    ctx.fillStyle = '#0a0a1a';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('扫码访问', qrX + qrSize / 2 - 30, qrY + qrSize / 2 - 10);
    ctx.fillText(WEBSITE_URL.slice(8), qrX + 10, qrY + qrSize / 2 + 10);
  }

  // 下载图片
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
  content += `         🔮 棱镜对话记录\n`;
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
 * 辅助函数：自动换行
 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  // 移除 markdown 格式符号以获得真实宽度
  const cleanText = text.replace(/[*_`#\[\]()]/g, '');
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
 * 辅助函数：计算文本行数
 */
function countLines(text: string, maxWidth: number): number {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return 3;

  ctx.font = '15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const lines = wrapText(ctx, text, maxWidth);
  return Math.max(lines.length, 1);
}

/**
 * 格式化日期用于文件名
 */
function formatDateForFile(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
