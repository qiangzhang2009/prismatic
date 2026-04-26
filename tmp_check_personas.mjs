import { neon } from '@neondatabase/serverless';

const DATABASE_URL = "postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require";
const sql = neon(DATABASE_URL);

async function main() {
  // Check if ni-haixia and wang-dongyue exist in distilled_personas table
  const personas = await sql`SELECT slug, name, "nameZh", "nameEn", domain, "systemPromptTemplate", "identityPrompt", strengths, blindspots FROM distilled_personas WHERE slug IN ('ni-haixia', 'wang-dongyue')`;
  console.log('Distilled personas found:', personas.length);
  for (const p of personas) {
    console.log('\n=== ' + p.slug + ' ===');
    console.log('name:', p.name);
    console.log('nameZh:', p.namezh);
    console.log('nameEn:', p.nameen);
    console.log('domain:', p.domain);
    console.log('systemPromptTemplate:', (p.systemPromptTemplate || '').slice(0, 300));
    console.log('identityPrompt:', (p.identityPrompt || '').slice(0, 300));
    console.log('strengths:', JSON.stringify(p.strengths || []).slice(0, 200));
    console.log('blindspots:', JSON.stringify(p.blindspots || []).slice(0, 200));
  }

  if (personas.length < 2) {
    console.log('\n!!! One or both personas NOT found in DB');
  }

  // Also check the conversations table for any records with these persona IDs
  const convs = await sql`SELECT id, "userId", "personaIds", mode FROM conversations WHERE $1 = ANY("personaIds") OR $2 = ANY("personaIds") LIMIT 5`;
  console.log('\nConversations using these personas:', convs.length);
  for (const c of convs) {
    console.log('  conv:', c.id, 'personas:', JSON.stringify(c.personaIds));
  }
}

main().catch(console.error);
