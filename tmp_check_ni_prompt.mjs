import { neon } from '@neondatabase/serverless';

const DATABASE_URL = "postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require";
const sql = neon(DATABASE_URL);

async function main() {
  // Full prompt data for ni-haixia
  const p = await sql`SELECT slug, "systemPromptTemplate", "identityPrompt", "mentalModels", "decisionHeuristics", "expressionDNA", "values", "strengths" FROM distilled_personas WHERE slug = 'ni-haixia'`;

  if (p.length > 0) {
    const row = p[0];
    console.log('=== ni-haixia FULL PROMPT ===\n');
    console.log('systemPromptTemplate:');
    console.log(row.systemPromptTemplate);
    console.log('\n=== identityPrompt ===');
    console.log(row.identityPrompt);
    console.log('\n=== mentalModels ===');
    console.log(row.mentalModels);
    console.log('\n=== decisionHeuristics ===');
    console.log(row.decisionHeuristics);
    console.log('\n=== expressionDNA ===');
    console.log(row.expressionDNA);
    console.log('\n=== values ===');
    console.log(row.values);
  }
}

main().catch(console.error);
