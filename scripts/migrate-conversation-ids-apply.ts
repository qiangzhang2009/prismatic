/**
 * migrate-conversation-ids-apply.ts
 *
 * Apply the deterministic conversation ID migration.
 * Run: DATABASE_URL="..." npx tsx scripts/migrate-conversation-ids-apply.ts
 */
import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

function buildConversationId(userId: string, personaIds: string[]): string {
  const sorted = [...personaIds].sort().join(':');
  const payload = `u:${userId}:${sorted}`;
  const hash = crypto.createHash('sha256').update(payload).digest('base64url').slice(0, 16);
  return `conv_${hash}`;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) { console.error('DATABASE_URL not set'); process.exit(1); }

  const sql = neon(databaseUrl);

  console.log('=== LIVE MIGRATION ===\n');

  const conversations = await sql`
    SELECT id, "userId", title, mode, "personaIds", "messageCount", "createdAt"
    FROM conversations
    ORDER BY "createdAt" DESC
    LIMIT 200
  `;

  console.log(`Found ${conversations.length} conversations\n`);

  let migrate = 0, already = 0, skip = 0, error = 0;

  for (const conv of conversations) {
    const ids = conv.personaIds || [];
    if (ids.length === 0) {
      console.log(`  SKIP | ${conv.id} | No personas — keeping cuid ID`);
      skip++;
      continue;
    }

    const newId = buildConversationId(conv.userId, ids);

    if (newId === conv.id) {
      console.log(`  OK   | ${conv.id} | Already deterministic`);
      already++;
      continue;
    }

    // Check for collision
    const existing = await sql`SELECT id FROM conversations WHERE id = ${newId} LIMIT 1`;
    if (existing.length > 0) {
      console.log(`  COLLISION | ${conv.id} -> ${newId} | Merging ${conv.messageCount} msgs into existing`);
      // Move messages to existing conversation
      await sql`UPDATE messages SET "conversationId" = ${newId} WHERE "conversationId" = ${conv.id}`;
      // Count new total
      const cnt = await sql`SELECT COUNT(*) as c FROM messages WHERE "conversationId" = ${newId}`;
      await sql`UPDATE conversations SET "messageCount" = ${Number(cnt[0].c)}, "updatedAt" = NOW() WHERE id = ${newId}`;
      // Delete old
      await sql`DELETE FROM conversations WHERE id = ${conv.id}`;
      // Update local_conversations
      await sql`UPDATE local_conversations SET "syncedConversationId" = ${newId} WHERE "syncedConversationId" = ${conv.id}`;
      migrate++;
    } else {
      // Safe rename
      await sql`UPDATE conversations SET id = ${newId} WHERE id = ${conv.id}`;
      await sql`UPDATE local_conversations SET "syncedConversationId" = ${newId} WHERE "syncedConversationId" = ${conv.id}`;
      console.log(`  DONE | ${conv.id} -> ${newId}`);
      migrate++;
    }
  }

  console.log(`\nMigrated=${migrate}  Already=${already}  Skip=${skip}  Error=${error}`);

  // Verify
  const newFormat = await sql`SELECT COUNT(*) as c FROM conversations WHERE id LIKE 'conv_%'`;
  const total = await sql`SELECT COUNT(*) as c FROM conversations`;
  console.log(`\nConversations with deterministic IDs: ${newFormat[0].c} / ${total[0].c}`);

  const orphaned = await sql`
    SELECT COUNT(*) as c FROM messages m
    WHERE NOT EXISTS (SELECT 1 FROM conversations c WHERE c.id = m."conversationId")
  `;
  console.log(`Orphaned messages: ${orphaned[0].c}`);

  console.log('\nDone.');
}

main().catch(err => { console.error('FAILED:', err); process.exit(1); });
