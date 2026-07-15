import { Router } from 'express';
import { embedText, generateAnswer } from '../lib/gemini.js';
import { getIndex } from '../lib/pinecone.js';

const router = Router();

const MAX_QUESTION_LENGTH = 1000;
const TOP_K = 5;
const MIN_SCORE = 0.5;

const NO_INFO_RESPONSE = {
  answer: "I don't have relevant information in your documents to answer that.",
  sources: [],
};

// ---------------------------------------------------------------------------
// POST /api/query
// Body: { question: string }
// Header: X-Session-Id
// ---------------------------------------------------------------------------
router.post('/', async (req, res, next) => {
  // ── Session ID ────────────────────────────────────────────────────────────
  const sessionId = req.headers['x-session-id'];
  if (!sessionId || sessionId.trim().length === 0) {
    return next(Object.assign(new Error('Missing X-Session-Id header.'), {
      code: 'VALIDATION', statusCode: 400,
      clientMessage: 'Missing X-Session-Id header.',
    }));
  }

  const { question } = req.body ?? {};

  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return next(Object.assign(new Error('question is required and must be a non-empty string.'), {
      code: 'VALIDATION', statusCode: 400,
      clientMessage: 'question is required and must be a non-empty string.',
    }));
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return next(Object.assign(new Error(`question too long: ${question.length} chars`), {
      code: 'VALIDATION', statusCode: 400,
      clientMessage: `question must be ${MAX_QUESTION_LENGTH} characters or fewer (got ${question.length}).`,
    }));
  }

  const trimmed = question.trim();

  // --- Embed the question ---
  let queryVector;
  try {
    queryVector = await embedText(trimmed);
  } catch (err) {
    return next(Object.assign(err, {
      code: 'EMBEDDING_FAILED', statusCode: 502,
      clientMessage: `Embedding service error: ${err.message}. Please retry.`,
    }));
  }

  // --- Query Pinecone — filter to this session only ---
  let matches;
  try {
    const index = getIndex();
    const result = await index.query({
      vector: queryVector,
      topK: TOP_K,
      includeMetadata: true,
      filter: { sessionId: { $eq: sessionId } },   // ← session isolation
    });
    matches = result.matches ?? [];
  } catch (err) {
    return next(Object.assign(err, {
      code: 'QUERY_FAILED', statusCode: 502,
      clientMessage: `Vector search failed: ${err.message}. Please retry.`,
    }));
  }

  // --- Threshold check ---
  const relevantMatches = matches.filter((m) => (m.score ?? 0) >= MIN_SCORE);
  if (relevantMatches.length === 0) return res.json(NO_INFO_RESPONSE);

  // --- Build context chunks ---
  const contextChunks = relevantMatches.map((m, i) => ({
    index: i + 1,
    text: m.metadata?.text ?? '',
    filename: m.metadata?.source ?? 'unknown',
    chunkIndex: m.metadata?.chunkIndex ?? 0,
  }));

  // --- Generate answer ---
  let answer;
  try {
    answer = await generateAnswer(trimmed, contextChunks);
  } catch (err) {
    return next(Object.assign(err, {
      code: 'GENERATION_FAILED', statusCode: 502,
      clientMessage: `Answer generation failed: ${err.message}. Please retry.`,
    }));
  }

  const sources = relevantMatches.map((m) => ({
    filename:   m.metadata?.source ?? 'unknown',
    chunkIndex: m.metadata?.chunkIndex ?? 0,
    score:      Math.round((m.score ?? 0) * 1000) / 1000,
    snippet:    (m.metadata?.text ?? '').slice(0, 200),
  }));

  return res.json({ answer, sources });
});

export default router;
