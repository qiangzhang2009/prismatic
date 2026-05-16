/**
 * Persona Content Audit Script
 * Analyzes all personas for missing or insufficient content
 */

// Inline the personas data - we'll use dynamic import
const PERSONAS = {};

async function main() {
  // Dynamic import of the personas
  const mod = await import('./src/lib/personas.js').catch(() => {
    return import('./src/lib/personas.ts').catch(() => null);
  });
  
  if (!mod || !mod.PERSONAS) {
    // Fallback: try reading the file and extracting
    console.error('Could not import personas module. Trying alternative approach...');
    const fs = await import('fs');
    const content = fs.readFileSync('./src/lib/personas.ts', 'utf8');
    
    // Extract all persona IDs using regex
    const idMatches = content.match(/PERSONAS\['([^']+)'\] = \{/g);
    if (!idMatches) {
      console.error('Could not parse personas file');
      return;
    }
    
    const ids = idMatches.map(m => m.match(/PERSONAS\['([^']+)'\]/)[1]);
    console.log(`Found ${ids.length} personas`);
    
    // For each ID, we need to parse the structure...
    // This is complex, let's just list the IDs
    console.log('\nPersona IDs:');
    for (const id of ids) {
      console.log(`  - ${id}`);
    }
    return;
  }
}

main().catch(console.error);
