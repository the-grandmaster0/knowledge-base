import { embedText } from '../lib/gemini.js';

console.log('Testing embedText("hello world")...');

try {
  const vector = await embedText('hello world');
  console.log(`Vector length: ${vector.length}`);         // expected: 3072
  console.log(`First 5 values: ${vector.slice(0, 5)}`);
  if (vector.length !== 3072) {
    console.error(`ERROR: expected 3072, got ${vector.length}`);
    process.exit(1);
  }
  console.log('✓ Embedding dimension correct (3072)');
} catch (err) {
  console.error('Embedding failed:', err.message);
  process.exit(1);
}
