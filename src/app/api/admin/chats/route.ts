/**
 * Admin: Conversation list with billing mode, persona, and content search
 * GET /api/admin/chats
 */
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdminRequest } from '@/lib/user-management';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const adminId = await authenticateAdminRequest(req);
  if (!adminId) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') || '20', 10));
  const search = searchParams.get('search') || '';
  const mode = searchParams.get('mode') || '';
  const billingMode = searchParams.get('billingMode') || '';
  const personaId = searchParams.get('personaId') || '';
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  const userId = searchParams.get('userId') || '';

  const where: any = {};

  if (userId) where.userId = userId;
  if (mode) where.mode = mode;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo + 'T23:59:59Z');
  }

  if (search) {
    where.messages = {
      some: {
        content: { contains: search, mode: 'insensitive' },
      },
    };
  }

  if (personaId) {
    where.OR = [
      { personaIds: { has: personaId } },
      { messages: { some: { personaId } } },
    ];
  }

  if (billingMode) {
    where.user = billingMode === 'A'
      ? { apiKeyEncrypted: { not: null }, apiKeyStatus: 'valid' }
      : {
          OR: [
            { apiKeyEncrypted: null },
            { apiKeyStatus: { not: 'valid' } },
          ],
        };
  }

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, plan: true, apiKeyEncrypted: true, apiKeyStatus: true },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            personaId: true,
            tokensInput: true,
            tokensOutput: true,
            apiCost: true,
            modelUsed: true,
            createdAt: true,
          },
          take: 50,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.conversation.count({ where }),
  ]);

  const result = conversations.map(conv => ({
    ...conv,
    billingMode:
      conv.user?.apiKeyEncrypted && conv.user?.apiKeyStatus === 'valid' ? 'A' : 'B',
  }));

  return NextResponse.json({
    conversations: result,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
