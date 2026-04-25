/**
 * migrate-conversation-ids.ts — Dry run
 *
 * Preview what would happen without making changes.
 * Run: DATABASE_URL="..." npx tsx scripts/migrate-conversation-ids.ts --dry-run
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
  const dryRun = process.argv.includes('--dry-run');

  console.log(dryRun ? '=== DRY RUN MODE (no changes made) ===' : '=== LIVE MODE ===');
  console.log('');

  const conversations = await sql`
    SELECT id, "userId", title, mode, "personaIds", "messageCount", "createdAt"
    FROM conversations
    ORDER BY "createdAt" DESC
    LIMIT 200
  `;

  console.log(`Found ${conversations.length} conversations\n`);

  const results: any[] = [];
  let migrate = 0, already = 0, skip = 0;

  for (const conv of conversations) {
    const ids = conv.personaIds || [];
    if (ids.length === 0) {
      results.push({ old: conv.id, new: conv.id, status: 'skip', reason: 'No personas' });
      skip++;
      continue;
    }

    const newId = buildConversationId(conv.userId, ids);
    if (newId === conv.id) {
      results.push({ old: conv.id, new: newId, status: 'already', reason: 'Already deterministic' });
      already++;
    } else {
      const existing = await sql`SELECT id FROM conversations WHERE id = ${newId} LIMIT 1`;
      if (existing.length > 0) {
        results.push({ old: conv.id, new: newId, status: 'collision', reason: `Merge into ${newId}` });
      } else {
        results.push({ old: conv.id, new: newId, status: 'migrate', reason: 'Rename' });
        migrate++;
      }
    }
  }

  console.log(`Migrate: ${migrate}  Already: ${already}  Skip: ${skip}\n`);
  console.log('Details:');
  for (const r of results) {
    const icon = r.status === 'migrate' ? '→' : r.status === 'skip' ? '·' : r.status === 'collision' ? '⚠' : '✓';
    console.log(`  ${icon} ${r.status.padEnd(10)} | ${r.old} | ${r.new} | ${r.reason}`);
  }

  if (dryRun) {
    console.log('\nTo apply: npx tsx scripts/migrate-conversation-ids.ts --live');
  }
}

main().catch(console.error);
