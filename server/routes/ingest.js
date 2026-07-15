import { Router } from 'express';
import multer from 'multer';
import { PDFParse } from 'pdf-parse';
import { randomUUID } from 'crypto';
import { chunkByParagraph } from '../lib/chunker.js';
import { embedText, extractTextFromImage } from '../lib/gemini.js';
import { getIndex } from '../lib/pinecone.js';

const router = Router();

// ---------------------------------------------------------------------------
// Multer — memory storage, 10 MB limit, pdf / txt / image only
// ---------------------------------------------------------------------------
const ALLOWED_MIMETYPES = new Set([
  'application/pdf',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const FILE_TYPE_LABEL = 'PDF, plain-text, JPEG, PNG, WebP, or GIF';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIMETYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        Object.assign(
          new Error(`Unsupported file type "${file.mimetype}". Only ${FILE_TYPE_LABEL} files are accepted.`),
          { code: 'UNSUPPORTED_TYPE', statusCode: 400 }
        )
      );
    }
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function extractText(file) {
  if (file.mimetype === 'application/pdf') {
    const parser = new PDFParse({ data: new Uint8Array(file.buffer) });
    const result = await parser.getText();
    return result.text ?? '';
  }
  if (file.mimetype.startsWith('image/')) {
    return extractTextFromImage(file.buffer, file.mimetype);
  }
  return file.buffer.toString('utf-8');
}

async function batchUpsert(index, vectors, batchSize = 100) {
  for (let i = 0; i < vectors.length; i += batchSize) {
    await index.upsert({ records: vectors.slice(i, i + batchSize) });
  }
}

// ---------------------------------------------------------------------------
// POST /api/ingest
// ---------------------------------------------------------------------------
router.post(
  '/',
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(Object.assign(new Error('File too large. Maximum size is 10 MB.'), {
          code: 'LIMIT_FILE_SIZE', statusCode: 413,
          clientMessage: 'File too large. Maximum size is 10 MB.',
        }));
      }
      return next(err);
    });
  },

  async (req, res, next) => {
    // ── Session ID ──────────────────────────────────────────────────────────
    const sessionId = req.headers['x-session-id'];
    if (!sessionId || sessionId.trim().length === 0) {
      return next(Object.assign(new Error('Missing X-Session-Id header.'), {
        code: 'VALIDATION', statusCode: 400,
        clientMessage: 'Missing X-Session-Id header.',
      }));
    }

    if (!req.file) {
      return next(Object.assign(new Error('No file provided.'), {
        code: 'NO_FILE', statusCode: 400,
        clientMessage: `No file provided. Send a ${FILE_TYPE_LABEL} file as form-data with field name "file".`,
      }));
    }

    const filename = req.file.originalname;

    // 1. Extract text
    let rawText;
    try {
      rawText = await extractText(req.file);
    } catch (err) {
      return next(Object.assign(err, {
        code: 'EXTRACTION_FAILED', statusCode: 422,
        clientMessage: `Failed to extract text from "${filename}": ${err.message}`,
      }));
    }

    if (!rawText.trim()) {
      return next(Object.assign(new Error(`No text content found in "${filename}".`), {
        code: 'EMPTY_DOCUMENT', statusCode: 422,
        clientMessage: `No text content found in "${filename}". The file may be empty or image-only.`,
      }));
    }

    // 2. Chunk
    const chunks = chunkByParagraph(rawText);
    if (chunks.length === 0) {
      return next(Object.assign(new Error('Document produced no chunks.'), {
        code: 'EMPTY_DOCUMENT', statusCode: 422,
        clientMessage: 'Document produced no text chunks after processing.',
      }));
    }

    // 3. Embed each chunk
    const vectors = [];
    for (const chunk of chunks) {
      let embedding;
      try {
        embedding = await embedText(chunk.text);
      } catch (err) {
        return next(Object.assign(err, {
          code: 'EMBEDDING_FAILED', statusCode: 502,
          clientMessage: `Embedding service error on chunk ${chunk.index}: ${err.message}. Please retry.`,
        }));
      }

      vectors.push({
        id: randomUUID(),
        values: embedding,
        metadata: {
          text: chunk.text,
          source: filename,
          chunkIndex: chunk.index,
          sessionId,          // ← scope every vector to this session
        },
      });
    }

    // 4. Upsert into Pinecone
    try {
      const index = getIndex();
      await batchUpsert(index, vectors, 100);
    } catch (err) {
      return next(Object.assign(err, {
        code: 'UPSERT_FAILED', statusCode: 502,
        clientMessage: `Failed to store vectors: ${err.message}. Please retry.`,
      }));
    }

    return res.json({ success: true, chunksIndexed: vectors.length, filename });
  }
);

export default router;
