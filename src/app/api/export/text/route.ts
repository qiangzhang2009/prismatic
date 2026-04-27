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

// GET: serves the stored text as a direct download (Content-Disposition: attachment)
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  const filename = req.nextUrl.searchParams.get('filename');

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const entry = textStore.get(id);
  if (!entry) {
    return NextResponse.json({ error: 'Text not found or expired' }, { status: 404 });
  }

  const safeFilename = (filename || entry.filename).replace(/[^a-zA-Z0-9_\u4e00-\u9fff.-]/g, '_');

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
