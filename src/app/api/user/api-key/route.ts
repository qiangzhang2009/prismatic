/**
 * User API Key Management
 * POST   — set / update API Key
 * GET    — get masked status
 * DELETE — remove API Key
 */
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/user-management';
import { encryptApiKey, maskApiKey, hashApiKey } from '@/lib/encryption';
import { prisma } from '@/lib/prisma';
import { validateDeepSeekKey } from '@/lib/billing/validators/deepseek';
import { validateOpenAIKey } from '@/lib/billing/validators/openai';
import { validateAnthropicKey } from '@/lib/billing/validators/anthropic';

const VALIDATORS = {
  deepseek: validateDeepSeekKey,
  openai: validateOpenAIKey,
  anthropic: validateAnthropicKey,
} as const;

// POST — set or update API Key
export async function POST(request: NextRequest) {
  const userId = await authenticateRequest(request);
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { key, provider } = body as { key?: string; provider?: string };

  if (!key || typeof key !== 'string' || !key.trim()) {
    return NextResponse.json({ error: '请提供有效的 API Key' }, { status: 400 });
  }

  const normalizedProvider = (provider || 'deepseek').toLowerCase();
  if (!['deepseek', 'openai', 'anthropic'].includes(normalizedProvider)) {
    return NextResponse.json(
      { error: 'provider 必须是 deepseek / openai / anthropic' },
      { status: 400 }
    );
  }

  const validator = VALIDATORS[normalizedProvider as keyof typeof VALIDATORS];
  const result = await validator(key.trim());

  if (!result.valid) {
    return NextResponse.json(
      { error: result.error || 'API Key 验证失败' },
      { status: 400 }
    );
  }

  const { encrypted, iv } = encryptApiKey(key.trim());
  const hash = hashApiKey(key.trim());

  await prisma.user.update({
    where: { id: userId },
    data: {
      apiKeyEncrypted: encrypted,
      apiKeyIv: iv,
      apiKeyHash: hash,
      apiKeySetAt: new Date(),
      apiKeyProvider: normalizedProvider,
      apiKeyStatus: 'valid',
    },
  });

  return NextResponse.json({
    maskedKey: maskApiKey(key.trim()),
    provider: normalizedProvider,
    setAt: new Date().toISOString(),
  });
}

// GET — get masked API Key status
export async function GET(request: NextRequest) {
  const userId = await authenticateRequest(request);
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      apiKeyEncrypted: true,
      apiKeyProvider: true,
      apiKeySetAt: true,
      apiKeyStatus: true,
    },
  });

  if (!user?.apiKeyEncrypted) {
    return NextResponse.json({ hasKey: false, provider: null, setAt: null, status: null });
  }

  return NextResponse.json({
    hasKey: true,
    provider: user.apiKeyProvider,
    setAt: user.apiKeySetAt?.toISOString() ?? null,
    status: user.apiKeyStatus,
  });
}

// DELETE — remove API Key
export async function DELETE(request: NextRequest) {
  const userId = await authenticateRequest(request);
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      apiKeyEncrypted: null,
      apiKeyIv: null,
      apiKeyHash: null,
      apiKeySetAt: null,
      apiKeyProvider: null,
      apiKeyStatus: null,
    },
  });

  return NextResponse.json({ success: true });
}
