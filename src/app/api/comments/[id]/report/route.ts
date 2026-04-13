/**
 * Comments Report API - POST (report a comment)
 */

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { cookies } from 'next/headers';

const PRISMATIC_TENANT_ID = '97e7123c-a201-4cbf-a483-b6d777433818';

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
    const sql = neon(process.env.DATABASE_URL!);
    
    // Increment report count
    await sql`
      UPDATE public.prismatic_comments 
      SET report_count = report_count + 1, updated_at = NOW()
      WHERE id = ${id} AND tenant_id = ${PRISMATIC_TENANT_ID}
    `;
    
    // Log the report (in production, store in a separate reports table)
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
