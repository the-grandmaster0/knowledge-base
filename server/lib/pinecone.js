import 'dotenv/config';
import { Pinecone } from '@pinecone-database/pinecone';

const INDEX_NAME = 'knowledge-base';
const DIMENSION = 3072; // gemini-embedding-001 output dimension
const METRIC = 'cosine';

// Singleton client
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

/**
 * Ensures the "knowledge-base" index exists.
 * Creates it as a serverless index if it doesn't.
 */
export async function ensureIndex() {
  const { indexes } = await pinecone.listIndexes();
  const exists = indexes?.some((idx) => idx.name === INDEX_NAME);

  if (exists) {
    console.log(`Index "${INDEX_NAME}" already exists.`);
    return;
  }

  console.log(`Creating index "${INDEX_NAME}"...`);
  await pinecone.createIndex({
    name: INDEX_NAME,
    dimension: DIMENSION,
    metric: METRIC,
    spec: {
      serverless: {
        cloud: 'aws',
        region: 'us-east-1',
      },
    },
    waitUntilReady: true, // blocks until index is ready to accept vectors
  });

  console.log(`Index "${INDEX_NAME}" created successfully.`);
}

/**
 * Returns the Pinecone index client for "knowledge-base".
 */
export function getIndex() {
  return pinecone.index(INDEX_NAME);
}
