/**
 * Fix polluted accentColor/gradientFrom/gradientTo in distilled_personas
 * and assign correct colors based on domain.
 *
 * Run: node scripts/fix-persona-colors.js
 */

const { Pool } = require('@neondatabase/serverless');
const DB = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require';

const DOMAIN_COLORS = {
  philosophy: { accent: '#4d96ff', from: '#4d96ff', to: '#6bcb77' },
  technology: { accent: '#6bcb77', from: '#6bcb77', to: '#ffd93d' },
  investment: { accent: '#ffd93d', from: '#ffd93d', to: '#ff6b6b' },
  science:   { accent: '#c77dff', from: '#c77dff', to: '#4d96ff' },
  history:   { accent: '#f59e0b', from: '#f59e0b', to: '#ef4444' },
  literature:{ accent: '#ec4899', from: '#ec4899', to: '#f97316' },
  product:   { accent: '#14b8a6', from: '#14b8a6', to: '#06b6d4' },
  strategy:  { accent: '#8b5cf6', from: '#8b5cf6', to: '#c77dff' },
};

async function main() {
  const pool = new Pool({ connectionString: DB });
  try {
    // Get all personas with their domain
    const r = await pool.query(
      `SELECT slug, domain, "accentColor", "gradientFrom", "gradientTo" FROM distilled_personas WHERE "isActive" = true`
    );

    let updated = 0;
    for (const row of r.rows) {
      const domains = (row.domain || '').split(',').map(d => d.trim());
      const primary = domains[0] || 'philosophy';
      const colors = DOMAIN_COLORS[primary] || DOMAIN_COLORS.philosophy;

      const result = await pool.query(
        `UPDATE distilled_personas SET
           "accentColor" = $1,
           "gradientFrom" = $2,
           "gradientTo" = $3
         WHERE slug = $4
         RETURNING slug`,
        [colors.accent, colors.from, colors.to, row.slug]
      );
      if (result.rowCount > 0) {
        updated++;
        console.log(`  ${row.slug.padEnd(25)} domain=${primary.padEnd(15)} → ${colors.from} → ${colors.to}`);
      }
    }
    console.log(`\nUpdated ${updated} personas.`);
  } catch (e) {
    console.error('Error:', e.message);
  }
  await pool.end();
}
main();
