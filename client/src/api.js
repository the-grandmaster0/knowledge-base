/**
 * API layer — all backend calls go through here.
 *
 * ROUTING
 * -------
 * All requests use the relative path /api/*.
 *
 * In development:  Vite's dev server proxy forwards /api/* → http://localhost:3001
 * In production:   Vercel's rewrite rule in vercel.json forwards /api/* → the EB
 *                  backend (HTTP). The browser only ever sees HTTPS — Vercel handles
 *                  the HTTP hop server-side, so there's no mixed-content issue.
 *
 * SESSION PERSISTENCE
 * -------------------
 * sessionId is stored in localStorage so the same browser always gets the same ID.
 * Vectors in Pinecone are scoped to this ID — returning users see their own documents.
 */

const API_BASE = '/api';

const SESSION_KEY  = 'kb_session_id';
const FILES_KEY    = 'kb_session_files'; // persisted file list

// ── Session ID ────────────────────────────────────────────────
function getOrCreateSessionId() {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export const SESSION_ID = getOrCreateSessionId();

// ── Persisted file list ───────────────────────────────────────
/**
 * Load the saved file list for this session from localStorage.
 * Returns an array of { filename, chunksIndexed } objects.
 */
export function loadPersistedFiles() {
  try {
    const raw = localStorage.getItem(FILES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Save the current file list to localStorage.
 * @param {Array<{ filename: string, chunksIndexed: number }>} files
 */
export function savePersistedFiles(files) {
  try {
    localStorage.setItem(FILES_KEY, JSON.stringify(files));
  } catch {
    // storage quota exceeded — silently ignore
  }
}

// ── Shared headers ────────────────────────────────────────────
function sessionHeaders(extra = {}) {
  return { 'X-Session-Id': SESSION_ID, ...extra };
}

// ── API Error ─────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name   = 'ApiError';
    this.status = status;
    this.code   = code;
  }
}

async function parseError(res) {
  let message = `Request failed with status ${res.status}`;
  let code    = 'REQUEST_ERROR';
  try {
    const body = await res.json();
    if (body?.error?.message) {
      message = body.error.message;
      code    = body.error.code ?? code;
    } else if (typeof body?.error === 'string') {
      message = body.error;
    }
  } catch { /* non-JSON body */ }
  return new ApiError(message, res.status, code);
}

// ── API calls ─────────────────────────────────────────────────

export async function ingestFile(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/ingest`, {
    method: 'POST',
    headers: sessionHeaders(),
    body: formData,
  });

  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function deleteDocument(filename) {
  const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
    headers: sessionHeaders(),
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function deleteAllDocuments() {
  const res = await fetch(`${API_BASE}/documents`, {
    method: 'DELETE',
    headers: sessionHeaders(),
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function askQuestion(question) {
  const res = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: sessionHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ question }),
  });

  if (!res.ok) throw await parseError(res);
  return res.json();
}
