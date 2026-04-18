/**
 * GET /api/guardian/schedule — Guardian duty schedule
 * Uses Prisma guardian_duties table
 */
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = Math.min(parseInt(searchParams.get('days') || '7'), 30);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + days);

  try {
    const rows = await prisma.guardianDuty.findMany({
      where: {
        dutyDate: {
          gte: today,
          lte: endDate,
        },
      },
      orderBy: { dutyDate: 'asc' },
    });

    return NextResponse.json({
      schedule: rows,
      days,
    });
  } catch (error) {
    console.error('[Guardian Schedule] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch guardian schedule' }, { status: 500 });
  }
}
