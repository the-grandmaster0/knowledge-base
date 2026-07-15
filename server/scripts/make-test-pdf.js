/**
 * Creates a plain-text test file for ingestion testing.
 * (Avoids needing a real PDF for the smoke test.)
 */
import { writeFileSync } from 'fs';

const paragraphs = Array.from({ length: 20 }, (_, i) =>
  `Paragraph ${i + 1}: ` +
  Array.from({ length: 60 }, (_, j) => `word${i * 60 + j + 1}`).join(' ')
);

writeFileSync('scripts/test-doc.txt', paragraphs.join('\n\n'), 'utf-8');
console.log('Created scripts/test-doc.txt (20 paragraphs, ~1200 words)');
