import { Router } from 'express';
import { getIndex } from '../lib/pinecone.js';

const router = Router();

// ---------------------------------------------------------------------------
// DELETE /api/documents/:filename
// Deletes vectors matching both sessionId AND source filename
// ---------------------------------------------------------------------------
router.delete('/:filename', async (req, res, next) => {
  const { filename } = req.params;

  const sessionId = req.headers['x-session-id'];
  if (!sessionId || sessionId.trim().length === 0) {
    return next(Object.assign(new Error('Missing X-Session-Id header.'), {
      code: 'VALIDATION', statusCode: 400,
      clientMessage: 'Missing X-Session-Id header.',
    }));
  }

  if (!filename || filename.trim().length === 0) {
    return next(Object.assign(new Error('filename is required.'), {
      code: 'VALIDATION', statusCode: 400,
      clientMessage: 'filename is required.',
    }));
  }

  try {
    const index = getIndex();
    await index.deleteMany({
      filter: {
        sessionId: { $eq: sessionId },   // ← only this session's vectors
        source:    { $eq: filename },
      },
    });
  } catch (err) {
    return next(Object.assign(err, {
      code: 'DELETE_FAILED', statusCode: 502,
      clientMessage: `Failed to delete vectors for "${filename}": ${err.message}. Please retry.`,
    }));
  }

  return res.json({ success: true, deleted: filename });
});

// ---------------------------------------------------------------------------
// DELETE /api/documents
// Deletes ALL vectors belonging to this session
// ---------------------------------------------------------------------------
router.delete('/', async (req, res, next) => {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId || sessionId.trim().length === 0) {
    return next(Object.assign(new Error('Missing X-Session-Id header.'), {
      code: 'VALIDATION', statusCode: 400,
      clientMessage: 'Missing X-Session-Id header.',
    }));
  }

  try {
    const index = getIndex();
    await index.deleteMany({
      filter: { sessionId: { $eq: sessionId } },   // ← only this session
    });
  } catch (err) {
    return next(Object.assign(err, {
      code: 'DELETE_FAILED', statusCode: 502,
      clientMessage: `Failed to delete session vectors: ${err.message}. Please retry.`,
    }));
  }

  return res.json({ success: true, deleted: 'session' });
});

export default router;
