
// @ts-nocheck
import { distillZero } from './src/lib/zero/engine.ts';
async function main() {
  try {
    const result = await distillZero({
      personaId: 'ni-haixia',
      corpusDir: '/Users/john/蒸馏2/corpus/ni-haixia/texts',
      budget: 3,
      promptVariant: 'default',
    });
    console.log('===ZERO_OUTPUT===');
    console.log(JSON.stringify(result));
  } catch(err) {
    console.error('DISTILL_ERROR:', err.message);
    console.error('DISTILL_STACK:', err.stack?.split('\n').slice(0,10).join('\n'));
    process.exit(1);
  }
}
main();
