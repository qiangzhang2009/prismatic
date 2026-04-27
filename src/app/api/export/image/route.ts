import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface ImageEntry {
  imageData: Buffer;
  filename: string;
  contentType: string;
  createdAt: number;
}

const imageStore = new Map<string, ImageEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of imageStore.entries()) {
    if (now - entry.createdAt > 5 * 60 * 1000) imageStore.delete(id);
  }
}, 5 * 60 * 1000);

// POST: receives image data, stores it, returns { id, filename } as JSON
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { dataUrl, filename } = body as { dataUrl: string; filename: string };

    if (!dataUrl || !filename) {
      return NextResponse.json({ error: 'Missing dataUrl or filename' }, { status: 400 });
    }

    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const safeFilename = filename.replace(/[^a-zA-Z0-9_\u4e00-\u9fff.-]/g, '_');
    const isJpeg = dataUrl.startsWith('data:image/jpeg');
    const contentType = isJpeg ? 'image/jpeg' : 'image/png';

    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    imageStore.set(id, { imageData: buffer, filename: safeFilename, contentType, createdAt: Date.now() });

    return NextResponse.json({ id, filename: safeFilename, contentType });
  } catch (err) {
    console.error('[/api/export/image POST] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET: serves the stored image as a direct download (Content-Disposition: attachment)
// When ?preview=1, returns an HTML page that displays the image inline.
// WeChat / mobile browsers will show the image directly — user can long-press to save.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  const filename = req.nextUrl.searchParams.get('filename');
  const preview = req.nextUrl.searchParams.get('preview');

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const entry = imageStore.get(id);
  if (!entry) {
    return NextResponse.json({ error: 'Image not found or expired' }, { status: 404 });
  }

  const safeFilename = (filename || entry.filename).replace(/[^a-zA-Z0-9_\u4e00-\u9fff.-]/g, '_');

  // Default: direct download — triggers browser/OS download prompt
  if (preview !== '1') {
    return new NextResponse(entry.imageData, {
      status: 200,
      headers: {
        'Content-Type': entry.contentType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(safeFilename)}`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  // HTML preview page — WeChat can long-press to save from here
  const base64 = entry.imageData.toString('base64');
  const dataUri = `data:${entry.contentType};base64,${base64}`;
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
  <title>棱镜 · 对话导出</title>
  <style>
    * { margin: 0; padding: 0; }
    body {
      background: #0a0a12;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 16px;
    }
    img {
      max-width: 100%;
      max-height: 85vh;
      border-radius: 8px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.5);
    }
    .hint {
      margin-top: 12px;
      font-size: 13px;
      color: rgba(255,255,255,0.4);
      text-align: center;
    }
    .brand {
      margin-top: 6px;
      font-size: 11px;
      color: rgba(255,255,255,0.18);
      text-align: center;
    }
  </style>
</head>
<body>
  <img src="${dataUri}" alt="导出图片" />
  <p class="hint">长按图片可保存到相册或转发</p>
  <p class="brand">由棱镜导出 · prism.chat</p>
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
