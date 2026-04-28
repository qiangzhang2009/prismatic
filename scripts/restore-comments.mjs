/**
 * Restore comments from backup CSV
 *
 * Usage: node scripts/restore-comments.mjs
 *
 * What it does:
 * 1. Reads the backup CSV at backups/pre-restore-20260428-013615/comments.csv
 * 2. Re-inserts comments with status='published' that are missing from the DB
 * 3. Restores guardian reply fields (mentionedGuardianReply, mentionedGuardianRepliedAt)
 * 4. Restores replies (published status only)
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

// Parse CSV manually (simple RFC-4180 compliant parser)
function parseCSV(content) {
  const lines = content.split('\n');
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);

  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const record = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = values[j] !== undefined ? values[j] : '';
    }
    records.push(record);
  }
  return records;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          current += '"';
          i++; // skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current);
  return result;
}

// Parse CSV
const csvPath = '/Users/john/蒸馏2/backups/pre-restore-20260428-013615/comments.csv';
const csvContent = readFileSync(csvPath, 'utf-8');
const records = parseCSV(csvContent);

console.log(`Loaded ${records.length} records from backup CSV\n`);

// Check which comments exist in DB
const existingIds = await sql`
  SELECT id FROM comments
`;

const existingIdSet = new Set(existingIds.map((r) => r.id));
console.log(`Existing comments in DB: ${existingIdSet.size}\n`);

// Separate into: new root comments, new replies, and records to update
const newRootComments = [];
const newReplies = [];
const toUpdate = [];

for (const row of records) {
  const status = row.status?.trim();
  const parentId = row.parentId?.trim();
  const id = row.id?.trim();

  // Parse reactions JSON (stored as "[]" string in CSV)
  let reactions = [];
  try {
    if (row.reactions && row.reactions.trim() !== '') {
      reactions = JSON.parse(row.reactions.trim());
    }
  } catch (e) {
    // ignore parse errors
  }

  const record = {
    id,
    content: row.content,
    userId: row.userId || null,
    nickname: row.nickname || null,
    gender: row.gender || null,
    avatarSeed: row.avatarSeed || null,
    ipHash: row.ipHash || null,
    geoCountryCode: row.geoCountryCode || null,
    geoCountry: row.geoCountry || null,
    geoRegion: row.geoRegion || null,
    geoCity: row.geoCity || null,
    parentId: parentId || null,
    type: row.type || 'comment',
    reactions,
    status,
    personaSlug: row.personaSlug || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    mentionedGuardianId: row.mentionedGuardianId || null,
    mentionedGuardianRepliedAt: row.mentionedGuardianRepliedAt || null,
    mentionedGuardianReply: row.mentionedGuardianReply || null,
  };

  // Check if guardian reply fields need updating
  if (existingIdSet.has(id) && status === 'published') {
    if (row.mentionedGuardianReply || row.mentionedGuardianRepliedAt) {
      toUpdate.push(record);
    }
    continue;
  }

  if (!existingIdSet.has(id) && status === 'published') {
    if (parentId) {
      // It's a reply — only insert if parent exists in DB
      newReplies.push(record);
    } else {
      newRootComments.push(record);
    }
  }
}

console.log(`Root comments to restore: ${newRootComments.length}`);
console.log(`Replies to restore: ${newReplies.length}`);
console.log(`Guardian replies to update: ${toUpdate.length}\n`);

// Restore root comments
let rootRestored = 0;
for (const c of newRootComments) {
  try {
    await sql`
      INSERT INTO comments (
        id, content, "userId", nickname, gender, "avatarSeed", "ipHash",
        "geoCountryCode", "geoCountry", "geoRegion", "geoCity",
        "parentId", type, reactions, status, "personaSlug",
        "createdAt", "updatedAt",
        "mentionedGuardianId", "mentionedGuardianRepliedAt", "mentionedGuardianReply"
      ) VALUES (
        ${c.id}, ${c.content}, ${c.userId}, ${c.nickname}, ${c.gender}, ${c.avatarSeed}, ${c.ipHash},
        ${c.geoCountryCode}, ${c.geoCountry}, ${c.geoRegion}, ${c.geoCity},
        NULL, ${c.type}, ${JSON.stringify(c.reactions)}, ${c.status}, ${c.personaSlug},
        ${new Date(c.createdAt)}, ${new Date(c.updatedAt)},
        ${c.mentionedGuardianId},
        ${c.mentionedGuardianRepliedAt ? new Date(c.mentionedGuardianRepliedAt) : null},
        ${c.mentionedGuardianReply}
      )
    `;
    rootRestored++;
  } catch (e) {
    console.error(`  FAILED to restore root comment ${c.id}: ${e.message}`);
  }
}
console.log(`Restored ${rootRestored}/${newRootComments.length} root comments`);

// Restore replies (only those whose parent exists in DB)
let replyRestored = 0;
for (const c of newReplies) {
  // Check if parent exists
  const parentExists = existingIdSet.has(c.parentId);
  if (!parentExists) {
    // Try to find parent in new root comments we're about to restore
    const parentInBatch = newRootComments.find(r => r.id === c.parentId);
    if (!parentInBatch) {
      console.log(`  SKIP reply ${c.id}: parent ${c.parentId} not in DB`);
      continue;
    }
  }

  try {
    await sql`
      INSERT INTO comments (
        id, content, "userId", nickname, gender, "avatarSeed", "ipHash",
        "geoCountryCode", "geoCountry", "geoRegion", "geoCity",
        "parentId", type, reactions, status, "personaSlug",
        "createdAt", "updatedAt"
      ) VALUES (
        ${c.id}, ${c.content}, ${c.userId}, ${c.nickname}, ${c.gender}, ${c.avatarSeed}, ${c.ipHash},
        ${c.geoCountryCode}, ${c.geoCountry}, ${c.geoRegion}, ${c.geoCity},
        ${c.parentId}, ${c.type}, ${JSON.stringify(c.reactions)}, ${c.status}, ${c.personaSlug},
        ${new Date(c.createdAt)}, ${new Date(c.updatedAt)}
      )
    `;
    replyRestored++;
  } catch (e) {
    console.error(`  FAILED to restore reply ${c.id}: ${e.message}`);
  }
}
console.log(`Restored ${replyRestored}/${newReplies.length} replies`);

// Update guardian reply fields
let updated = 0;
for (const c of toUpdate) {
  try {
    await sql`
      UPDATE comments SET
        "mentionedGuardianReply" = COALESCE(
          ${c.mentionedGuardianReply},
          (SELECT "mentionedGuardianReply" FROM comments WHERE id = ${c.id})
        ),
        "mentionedGuardianRepliedAt" = COALESCE(
          ${c.mentionedGuardianRepliedAt ? new Date(c.mentionedGuardianRepliedAt) : null},
          (SELECT "mentionedGuardianRepliedAt" FROM comments WHERE id = ${c.id})
        )
      WHERE id = ${c.id}
    `;
    updated++;
  } catch (e) {
    console.error(`  FAILED to update guardian reply for ${c.id}: ${e.message}`);
  }
}
console.log(`Updated ${updated}/${toUpdate.length} guardian reply fields`);

// Summary
console.log('\n--- Restoration Complete ---');
console.log(`Root comments restored: ${rootRestored}/${newRootComments.length}`);
console.log(`Replies restored: ${replyRestored}/${newReplies.length}`);
console.log(`Guardian replies updated: ${updated}/${toUpdate.length}`);

// Verify final counts
const counts = await sql`
  SELECT
    COUNT(*) FILTER (WHERE status = 'published' AND "parentId" IS NULL) as root_count,
    COUNT(*) FILTER (WHERE status = 'published' AND "parentId" IS NOT NULL) as reply_count,
    COUNT(*) FILTER (WHERE status = 'deleted') as deleted_count,
    COUNT(*) as total
  FROM comments
`;

console.log(`\nDB now has: ${counts[0].root_count} published root comments, ${counts[0].reply_count} published replies, ${counts[0].deleted_count} deleted, ${counts[0].total} total`);
