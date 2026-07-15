import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import ingestRouter from './routes/ingest.js';
import queryRouter from './routes/query.js';
import deleteRouter from './routes/delete.js';

// ---------------------------------------------------------------------------
// Startup env check — fail fast with a clear message rather than a cryptic 500
// ---------------------------------------------------------------------------
const REQUIRED_ENV = ['GEMINI_API_KEY', 'PINECONE_API_KEY'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
  console.error('Set these in Elastic Beanstalk > Configuration > Software > Environment properties.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
// In production, requests come from Vercel's edge (proxy), not directly from
// the browser.  Vercel sends requests server-to-server, so the Origin header
// is either absent or set to Vercel's internal domain.
// We allow all origins here because:
//   1. The browser never calls EB directly — it calls Vercel, which proxies.
//   2. Vercel already enforces HTTPS for the browser-facing leg.
//   3. EB is protected by security groups (only Vercel/CloudFront can reach it).
// For local dev, this also allows localhost:5173 via the Vite proxy.
app.use(
  cors({
    origin: true,   // reflect any origin — safe because browser never calls EB directly
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
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
