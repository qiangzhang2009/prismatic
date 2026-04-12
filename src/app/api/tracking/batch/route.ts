/**
 * Prismatic 批量追踪事件接收端点
 * 接收前端 SDK 批量发送的事件，存储到 backend-admin Neon 数据库
 */

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_ADMIN_URL || 'https://backend-admin-gold.vercel.app'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { events } = body

    if (!Array.isArray(events) || events.length === 0) {
      return new NextResponse(JSON.stringify({ success: true, processed: 0 }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    // 逐个转发事件到 backend-admin
    let successCount = 0
    for (const event of events) {
      try {
        const tenantSlug = event.tenant_slug || event.tenant || 'prismatic'
        
        const response = await fetch(`${BACKEND_URL}/api/tracking`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...event,
            tenant_slug: tenantSlug,
          }),
        })

        if (response.ok) {
          successCount++
        }
      } catch (error) {
        console.error('Failed to forward batch event:', error)
      }
    }

    return new NextResponse(JSON.stringify({ success: true, processed: successCount }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('Batch tracking API error:', error)
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
