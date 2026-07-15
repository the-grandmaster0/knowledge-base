/**
 * clear-index.js
 * Deletes ALL vectors from the "knowledge-base" Pinecone index.
 * Run once to free up free-tier vector space used by test ingestions.
 *
 * Usage:
 *   node --env-file=.env scripts/clear-index.js
 *   -- or, from the server directory --
 *   node scripts/clear-index.js   (if dotenv is loaded via package.json script)
 */

import 'dotenv/config';
import { Pinecone } from '@pinecone-database/pinecone';

const INDEX_NAME = 'knowledge-base';

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

console.log(`Connecting to Pinecone index "${INDEX_NAME}"...`);

try {
  const index = pinecone.index(INDEX_NAME);
  const stats = await index.describeIndexStats();
  const totalVectors = stats.totalRecordCount ?? stats.totalVectorCount ?? 0;

  if (totalVectors === 0) {
    console.log('Index is already empty. Nothing to delete.');
    process.exit(0);
  }

  console.log(`Found ${totalVectors} vector(s). Deleting all...`);
  await index.deleteAll();
  console.log('✓ All vectors deleted successfully.');
  console.log('Your free-tier vector count has been reset to 0.');
} catch (err) {
  console.error('Failed to clear index:', err.message);
  process.exit(1);
}
