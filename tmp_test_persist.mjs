import { Pool } from '@neondatabase/serverless';
import crypto from 'crypto';

const DATABASE_URL = "postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require";

const USER_ID = "d523fac4-3584-4cb3-8c41-e50fdb7ce69e";
const PERSONA_IDS = ["wang-dongyue"];
const MODE = "solo";
const TYPE = "CHAT";

function buildConversationId(userId, personaIds) {
  const sorted = [...personaIds].sort().join(':');
  const payload = `u:${userId}:${sorted}`;
  const hash = crypto.createHash('sha256').update(payload).digest('base64url').slice(0, 16);
  return `conv_${hash}`;
}

const CONV_ID = buildConversationId(USER_ID, PERSONA_IDS);
console.log('Simulated conversationId:', CONV_ID);
console.log('UserId:', USER_ID);

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    // Step 1: Check if conversationId already exists
    const existingConv = await pool.query(
      `SELECT "userId" FROM conversations WHERE id = $1 LIMIT 1`,
      [CONV_ID]
    );
    console.log('\nStep 1 - Check existing conversation:');
    console.log('  Existing rows:', existingConv.rows.length);
    if (existingConv.rows.length > 0) {
      console.log('  Owner:', existingConv.rows[0].userId);
    }

    const actualConvId = existingConv.rows.length > 0 && existingConv.rows[0].userId !== USER_ID
      ? `new_${CONV_ID}`
      : CONV_ID;
    console.log('  Actual convId to use:', actualConvId);

    // Step 2: Test conversation INSERT
    console.log('\nStep 2 - Testing conversation INSERT...');
    const participantArray = PERSONA_IDS.length > 0
      ? '{' + PERSONA_IDS.map(p => '"' + p.replace(/"/g, '\\"') + '"').join(',') + '}'
      : '{}';
    console.log('  participantArray:', participantArray);

    const insertResult = await pool.query(`
      INSERT INTO conversations (id, "userId", title, type, mode, participants, archived, tags,
                               "messageCount", "totalTokens", "totalCost", "personaIds", "createdAt", "updatedAt")
      VALUES ($1, $2, NULL, $3, $4, $5::text[], false, '{}'::text[],
              1, 100, 0.01, $5::text[], NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        "messageCount" = EXCLUDED."messageCount",
        "updatedAt" = NOW()
      RETURNING id, "userId", mode, "messageCount"
    `, [actualConvId, USER_ID, TYPE, MODE, participantArray]);

    console.log('  INSERT result:', insertResult.rows[0]);

    // Step 3: Test message INSERT
    console.log('\nStep 3 - Testing message INSERT...');
    const msgId = `test_${Date.now()}`;
    const msgInsert = await pool.query(`
      INSERT INTO messages (id, "conversationId", "userId", role, content,
                           "personaId", "createdAt")
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (id) DO NOTHING
      RETURNING id, "conversationId", "userId"
    `, [msgId, actualConvId, USER_ID, 'user', 'Test message from diagnostic script', PERSONA_IDS[0]]);

    console.log('  Message INSERT result:', msgInsert.rows[0]);
    console.log('  Message rowCount:', msgInsert.rowCount);

    // Step 4: Verify the inserts
    console.log('\nStep 4 - Verifying...');
    const verifyConv = await pool.query(`SELECT * FROM conversations WHERE id = $1`, [actualConvId]);
    console.log('  Conversation found:', verifyConv.rows.length > 0);
    if (verifyConv.rows.length > 0) {
      console.log('  Conv:', JSON.stringify({id: verifyConv.rows[0].id, userId: verifyConv.rows[0].userId, messageCount: verifyConv.rows[0].messageCount}));
    }
    const verifyMsg = await pool.query(`SELECT * FROM messages WHERE id = $1`, [msgId]);
    console.log('  Message found:', verifyMsg.rows.length > 0);

    // Step 5: Clean up test data
    console.log('\nStep 5 - Cleaning up test data...');
    await pool.query(`DELETE FROM messages WHERE id = $1`, [msgId]);
    await pool.query(`DELETE FROM conversations WHERE id = $1`, [actualConvId]);
    console.log('  Cleanup done');

  } catch (error) {
    console.error('\nERROR:', error.message);
    console.error('  Code:', error.code);
    console.error('  Detail:', error.detail);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
