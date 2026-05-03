/**
 * GET /api/tcm/conversations/[id]
 * Load a specific TCM conversation's messages.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/user-management';
import { Pool } from '@neondatabase/serverless';

function getPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  return new Pool({ connectionString: url });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const userId = await authenticateRequest(_req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pool = getPool();
    try {
      // Verify ownership
      const convResult = await pool.query(
        `SELECT id, title, mode, participants, "messageCount", "totalTokens", "totalCost", "createdAt", "updatedAt"
         FROM conversations WHERE id = $1 AND "userId" = $2 AND type = 'TCM'`,
        [id, userId]
      );

      if (convResult.rows.length === 0) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }

      const conv = convResult.rows[0];

      const messagesResult = await pool.query(`
        SELECT
          id,
          role,
          content,
          "personaId",
          "modelUsed",
          "tokensInput",
          "tokensOutput",
          "apiCost",
          metadata,
          "createdAt"
        FROM messages
        WHERE "conversationId" = $1
        ORDER BY "createdAt" ASC
      `, [id]);

      return NextResponse.json({
        conversation: {
          id: conv.id,
          title: conv.title,
          mode: conv.mode,
          participants: conv.participants,
          messageCount: conv.messageCount,
          totalTokens: conv.totalTokens,
          totalCost: conv.totalCost ? parseFloat(String(conv.totalCost)) : 0,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
        },
        messages: messagesResult.rows.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          personaId: msg.personaId,
          modelUsed: msg.modelUsed,
          tokensInput: msg.tokensInput,
          tokensOutput: msg.tokensOutput,
          apiCost: msg.apiCost ? parseFloat(String(msg.apiCost)) : null,
          metadata: msg.metadata,
          createdAt: msg.createdAt,
        })),
      });
    } finally {
      await pool.end();
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[TCM Conversation] Error:', errMsg);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
