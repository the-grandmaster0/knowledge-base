import 'dotenv/config';
import { Pinecone } from '@pinecone-database/pinecone';

const INDEX_NAME = 'knowledge-base';
const DIMENSION = 3072; // gemini-embedding-001

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

console.log('Bootstrapping Pinecone index...');

try {
  const { indexes } = await pinecone.listIndexes();
  const existing = indexes?.find((idx) => idx.name === INDEX_NAME);

  if (existing) {
    const existingDim = existing.dimension;
    if (existingDim && existingDim !== DIMENSION) {
      console.log(`Existing index has dimension ${existingDim}, need ${DIMENSION}. Deleting and recreating...`);
      await pinecone.deleteIndex(INDEX_NAME);
      console.log('Old index deleted.');
    } else {
      console.log(`Index "${INDEX_NAME}" already exists with correct dimension (${existingDim ?? 'unknown'}).`);
      process.exit(0);
    }
  }

  console.log(`Creating index "${INDEX_NAME}" with dimension ${DIMENSION}...`);
  await pinecone.createIndex({
    name: INDEX_NAME,
    dimension: DIMENSION,
    metric: 'cosine',
    spec: {
      serverless: {
        cloud: 'aws',
        region: 'us-east-1',
      },
    },
    waitUntilReady: true,
  });

  console.log(`✓ Index "${INDEX_NAME}" created successfully (dim=${DIMENSION}).`);
  console.log('Check your Pinecone console to confirm.');
} catch (err) {
  console.error('Failed:', err.message);
  process.exit(1);
}
