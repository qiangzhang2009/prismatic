/**
 * Comments Report API - POST (report a comment)
 */
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

const REPORT_REASONS = [
  { id: 'spam', label: '垃圾广告' },
  { id: 'hate', label: '仇恨言论' },
  { id: 'harassment', label: '人身攻击' },
  { id: 'misinformation', label: '虚假信息' },
  { id: 'offensive', label: '不当内容' },
  { id: 'other', label: '其他' },
];

async function getVisitorId(): Promise<string> {
  const cookieStore = await cookies();
  return cookieStore.get('prismatic-visitor')?.value || 'anonymous';
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await req.json();
    const { reason, details } = body;

    if (!REPORT_REASONS.find(r => r.id === reason)) {
      return NextResponse.json({ error: 'Invalid report reason' }, { status: 400 });
    }

    const visitorId = await getVisitorId();

    // Check comment exists
    const comment = await prisma.comment.findUnique({ where: { id } });
    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    console.log(`Report submitted: comment=${id}, reason=${reason}, visitor=${visitorId}, details=${details}`);

    return NextResponse.json({
      success: true,
      message: '感谢您的反馈，我们会尽快审核'
    });
  } catch (error) {
    console.error('Failed to submit report:', error);
    return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ reasons: REPORT_REASONS });
}
