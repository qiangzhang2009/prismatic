/**
 * Debug route for testing database connectivity
 */
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: ['error', 'warn'] });

export async function GET() {
  try {
    const comments = await prisma.comment.findMany({
      where: { status: 'published', parentId: null },
      take: 3,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      count: comments.length,
      first: comments[0]?.nickname,
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return NextResponse.json({
      success: false,
      error: error.message,
      code: (err as any)?.code,
      name: error.name,
    }, { status: 500 });
  }
}
