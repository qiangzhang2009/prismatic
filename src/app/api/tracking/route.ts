/**
 * Prismatic 前端追踪事件接收端点
 * 接收前端 SDK 发送的事件，存储到 backend-admin Neon 数据库
 */

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_ADMIN_URL || 'https://backend-admin-gold.vercel.app'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 确保 tenant_slug 为 prismatic（即使前端 SDK 没有传递）
    const tenantSlug = body.tenant_slug || body.tenant || 'prismatic'

    // 转发到 backend-admin 的追踪 API
    const response = await fetch(`${BACKEND_URL}/api/tracking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...body,
        tenant_slug: tenantSlug,
      }),
    })

    if (!response.ok) {
      console.error('Forward to backend failed:', response.status)
    }

    return new NextResponse(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('Tracking API error:', error)
    return new NextResponse(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
