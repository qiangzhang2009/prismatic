import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface TextEntry {
  content: string;
  filename: string;
  createdAt: number;
}

const textStore = new Map<string, TextEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of textStore.entries()) {
    if (now - entry.createdAt > 10 * 60 * 1000) textStore.delete(id);
  }
}, 5 * 60 * 1000);

// POST: receives text content, stores it, returns { id, filename }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { content, filename } = body as { content: string; filename: string };

    if (!content || !filename) {
      return NextResponse.json({ error: 'Missing content or filename' }, { status: 400 });
    }

    const safeFilename = filename.replace(/[^a-zA-Z0-9_\u4e00-\u9fff.-]/g, '_');
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    textStore.set(id, { content, filename: safeFilename, createdAt: Date.now() });

    return NextResponse.json({ id, filename: safeFilename });
  } catch (err) {
    console.error('[/api/export/text POST] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET: serves the stored text as a direct download or HTML preview page
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  const filename = req.nextUrl.searchParams.get('filename');
  const preview = req.nextUrl.searchParams.get('preview');

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const entry = textStore.get(id);
  if (!entry) {
    return NextResponse.json({ error: 'Text not found or expired' }, { status: 404 });
  }

  const safeFilename = (filename || entry.filename).replace(/[^a-zA-Z0-9_\u4e00-\u9fff.-]/g, '_');

  // Preview page: shows text with a copy-to-clipboard button (works on Android WeChat)
  if (preview === '1') {
    const escapedContent = entry.content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
  <title>棱镜 · 对话导出</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0a0a12;
      color: #c8c8d8;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 20px 16px 100px;
      min-height: 100vh;
      font-size: 14px;
      line-height: 1.8;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    .header h1 {
      font-size: 18px;
      color: #fff;
      margin-bottom: 4px;
    }
    .header p {
      font-size: 12px;
      color: #6060a0;
    }
    .copy-btn {
      position: fixed;
      bottom: 24px;
      left: 16px;
      right: 16px;
      background: linear-gradient(135deg, #4d96ff, #9b6dff);
      color: #fff;
      border: none;
      border-radius: 12px;
      padding: 14px 0;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      z-index: 10;
    }
    .copy-btn:active {
      opacity: 0.85;
    }
    .content {
      white-space: pre-wrap;
      word-break: break-all;
      background: #12121e;
      border-radius: 12px;
      padding: 16px;
      border: 1px solid #2a2a4a;
      overflow-x: auto;
    }
    .hint {
      text-align: center;
      margin: 12px 0;
      font-size: 12px;
      color: #404060;
    }
    .brand {
      text-align: center;
      margin-top: 24px;
      font-size: 11px;
      color: #303050;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>棱镜对话记录</h1>
    <p>${safeFilename}</p>
  </div>
  <div class="hint">长按文字可选择复制部分内容</div>
  <div class="content" id="text-content">${escapedContent}</div>
  <button class="copy-btn" id="copy-btn">一键复制全部内容</button>
  <div class="brand">由棱镜导出 · prism.chat</div>
  <script>
    var btn = document.getElementById('copy-btn');
    var content = document.getElementById('text-content').innerText;
    var copied = false;

    function doCopy(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
          showCopied();
        }).catch(function() {
          fallbackCopy(text);
        });
      } else {
        fallbackCopy(text);
      }
    }

    function fallbackCopy(text) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        var ok = document.execCommand('copy');
        if (ok) showCopied();
        else btn.textContent = '复制失败，请长按内容手动复制';
      } catch(e) {
        btn.textContent = '复制失败，请长按内容手动复制';
      }
      document.body.removeChild(ta);
    }

    function showCopied() {
      btn.textContent = '已复制！去粘贴吧';
      btn.style.background = '#1a5a3a';
      setTimeout(function() {
        btn.textContent = '一键复制全部内容';
        btn.style.background = '';
      }, 3000);
    }

    btn.addEventListener('click', function() {
      doCopy(content);
    });
  </script>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }

  // Default: direct download
  return new NextResponse(entry.content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(safeFilename)}`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
