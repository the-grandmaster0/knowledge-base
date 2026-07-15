import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import ingestRouter from './routes/ingest.js';
import queryRouter from './routes/query.js';
import deleteRouter from './routes/delete.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ---------------------------------------------------------------------------
// CORS
// In production, ALLOWED_ORIGIN must be set to your Vercel frontend URL,
// e.g. https://your-app.vercel.app
// In development it falls back to localhost:5173.
// ---------------------------------------------------------------------------
const ALLOWED_ORIGINS = [
  process.env.ALLOWED_ORIGIN,          // production Vercel URL (set in EB env vars)
  'http://localhost:5173',             // Vite dev server
  'http://localhost:4173',             // Vite preview
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no origin (e.g. curl, Postman, same-origin)
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin "${origin}" not allowed`));
    },
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Session-Id'],
    credentials: true,
  })
);

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------
app.use(express.json());
app.use(requestLogger);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/ingest', ingestRouter);
app.use('/api/query', queryRouter);
app.use('/api/documents', deleteRouter);

// ---------------------------------------------------------------------------
// Centralised error handler — MUST be registered after all routes
// ---------------------------------------------------------------------------
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
