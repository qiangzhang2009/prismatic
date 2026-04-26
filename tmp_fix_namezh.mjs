import { neon } from '@neondatabase/serverless';

const DATABASE_URL = "postgresql://neondb_owner:npg_2BnRgIy4qtmG@ep-wild-haze-an17vdce-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require";
const sql = neon(DATABASE_URL);

async function main() {
  // Fix nameZh for ni-haixia and wang-dongyue
  const fixes = [
    { slug: 'ni-haixia', name: '倪海厦', nameZh: '倪海厦', nameEn: 'Ni Haixia' },
    { slug: 'wang-dongyue', name: '王东岳', nameZh: '王东岳', nameEn: 'Wang Dongyue (Ziyi)' },
  ];

  for (const fix of fixes) {
    const result = await sql`
      UPDATE distilled_personas
      SET "nameZh" = ${fix.nameZh}, "nameEn" = ${fix.nameEn}
      WHERE slug = ${fix.slug}
      RETURNING slug, "nameZh", "nameEn"
    `;
    console.log('Updated', fix.slug, '→', JSON.stringify(result[0]));
  }

  // Also check for any other personas with undefined nameZh
  const allPersonas = await sql`SELECT slug, name, "nameZh", "nameEn" FROM distilled_personas WHERE "nameZh" IS NULL OR "nameZh" = 'undefined'`;
  console.log('\nPersonas with null/undefined nameZh:', allPersonas.length);
  for (const p of allPersonas) {
    console.log('  ', p.slug, 'name=', p.name, 'nameZh=', p.nameZh, 'nameEn=', p.nameEn);
  }
}

main().catch(console.error);
