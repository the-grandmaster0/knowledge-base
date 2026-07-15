# 📚 Knowledge Base Assistant

> **Final Submission — BharatCares IBM SkillsBuild Generative AI and Cloud Internship**

A RAG (Retrieval-Augmented Generation) powered chat assistant. Upload PDFs, plain-text files, or images — then ask questions and get answers grounded in your documents, with source citations.

**Stack:** Node.js · Express · React · Vite · Gemini API · Pinecone · Framer Motion

---

## Features

- **Multi-format ingestion** — PDF, plain text (`.txt`), and images (JPEG, PNG, WebP, GIF)
- **Vision support** — images are processed through Gemini's vision API for OCR and description
- **RAG pipeline** — documents are chunked, embedded with Gemini, stored in Pinecone, and retrieved by semantic similarity at query time
- **Session isolation** — each browser gets a unique persistent session ID; users only see and query their own documents
- **Persistent uploads** — document list survives page refreshes; same browser = same knowledge base
- **Delete documents** — remove individual files or clear the entire session from Pinecone
- **Markdown responses** — assistant answers render full markdown: headings, lists, tables, code blocks, blockquotes
- **Source citations** — every answer shows which document chunks it came from, with relevance scores
- **Copy response** — one-click copy button on every assistant message
- **Character limit** — input capped at 1000 chars with a live counter that turns orange (900+) then red (1000)
- **Multi-color UI** — indigo/violet/pink/orange gradient theme with Framer Motion animations throughout
- **Auto-dismiss** — success messages disappear after 4 seconds

---

## Project Structure

```
ibm-final/
├── client/                         # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatPanel.jsx       # Message list, markdown rendering, sources, copy button
│   │   │   ├── UploadPanel.jsx     # Drag-and-drop upload with animated button
│   │   │   ├── ChatArea.jsx        # (legacy, unused)
│   │   │   └── FileUpload.jsx      # (legacy, unused)
│   │   ├── api.js                  # All fetch calls + session ID + localStorage persistence
│   │   ├── App.jsx                 # Layout, document list, delete handlers
│   │   ├── App.css                 # Component styles
│   │   ├── index.css               # Design tokens, global resets, shared utilities
│   │   └── main.jsx
│   ├── public/
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
└── server/                         # Node.js + Express backend
    ├── lib/
    │   ├── chunker.js              # Paragraph-based chunking with overlap
    │   ├── gemini.js               # Embeddings, answer generation, image OCR
    │   └── pinecone.js             # Pinecone client singleton + ensureIndex
    ├── middleware/
    │   ├── errorHandler.js         # Centralised error response format
    │   └── requestLogger.js        # Per-request timing logs
    ├── routes/
    │   ├── ingest.js               # POST /api/ingest — upload, chunk, embed, upsert
    │   ├── query.js                # POST /api/query — embed question, vector search, generate
    │   └── delete.js               # DELETE /api/documents/:filename and DELETE /api/documents
    ├── scripts/
    │   ├── init-index.js           # One-off Pinecone index bootstrap
    │   ├── clear-index.js          # Wipe all vectors (free-tier cleanup utility)
    │   └── make-test-pdf.js        # Generate a test PDF for manual QA
    ├── tests/
    │   └── chunker.test.js         # Unit tests for chunking logic
    ├── server.js
    ├── .env.example
    └── package.json
```

---

## Setup

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd ibm-final

# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

### 2. Configure environment variables

```bash
cd server
copy .env.example .env    # Windows
# cp .env.example .env    # macOS / Linux
```

Edit `server/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
PINECONE_API_KEY=your_pinecone_api_key_here
PORT=3001
```

- **Gemini API key** → [Google AI Studio](https://aistudio.google.com/app/apikey)
- **Pinecone API key** → [Pinecone Console](https://app.pinecone.io) → API Keys

### 3. Initialise the Pinecone index

Run once to create the `knowledge-base` index (dimension 3072, cosine metric, AWS us-east-1):

```bash
cd server
npm run init-index
```

Safe to run again — exits cleanly if the index already exists.

### 4. Start both servers

```bash
# Terminal 1 — backend
cd server
npm run dev        # nodemon, auto-restarts on changes

# Terminal 2 — frontend
cd client
npm run dev        # Vite dev server with HMR
```

| Service  | URL                    |
|----------|------------------------|
| Backend  | http://localhost:3001  |
| Frontend | http://localhost:5173  |

---

## API Reference

All endpoints require the `X-Session-Id` header (sent automatically by the client). This scopes all Pinecone operations to the current user's session.

| Method   | Path                          | Description                                              |
|----------|-------------------------------|----------------------------------------------------------|
| `GET`    | `/health`                     | Health check → `{ status: "ok" }`                       |
| `POST`   | `/api/ingest`                 | Upload & index a document (`multipart/form-data`, field `file`) |
| `POST`   | `/api/query`                  | Ask a question → body `{ question: string }`            |
| `DELETE` | `/api/documents/:filename`    | Delete all vectors for a specific file in this session  |
| `DELETE` | `/api/documents`              | Delete **all** vectors for this session                 |

### Supported file types

| Type        | Extensions                      | Processing                          |
|-------------|---------------------------------|-------------------------------------|
| PDF         | `.pdf`                          | Text extracted via `pdf-parse`      |
| Plain text  | `.txt`                          | Read as UTF-8                       |
| Images      | `.jpg` `.jpeg` `.png` `.webp` `.gif` | OCR + description via Gemini vision |

**Max file size:** 10 MB

### Response shape — `/api/query`

```json
{
  "answer": "The document states that...",
  "sources": [
    {
      "filename": "report.pdf",
      "chunkIndex": 3,
      "score": 0.847,
      "snippet": "First 200 characters of the matching chunk..."
    }
  ]
}
```

If no relevant chunks are found above the 0.5 similarity threshold:

```json
{
  "answer": "I don't have relevant information in your documents to answer that.",
  "sources": []
}
```

---

## Session & Persistence Model

| Concern              | Mechanism                                                                 |
|----------------------|---------------------------------------------------------------------------|
| User identity        | UUID stored in `localStorage` (`kb_session_id`) — survives refreshes     |
| Document list        | Stored in `localStorage` (`kb_session_files`) — restored on page load    |
| Vector isolation     | Every Pinecone vector tagged with `sessionId` metadata; all queries filter by it |
| New browser / incognito | Fresh UUID = fresh session, empty knowledge base                     |
| Clearing data        | Delete individual files or "Clear all" removes vectors from Pinecone and localStorage |

---

## Utility Scripts

```bash
# Wipe all vectors from the Pinecone index (useful on free tier to reclaim space)
cd server
node scripts/clear-index.js

# Initialise / recreate the Pinecone index
npm run init-index
```

---

## Running Tests

```bash
cd server
npm test
```

Unit tests for the chunking logic using Node's built-in test runner — no extra dependencies.

---

## Deployment

### Architecture

```
Browser → Vercel (React SPA) → Elastic Beanstalk (Express API) → Pinecone / Gemini
```

---

### Deploy the Server → AWS Elastic Beanstalk

#### 1. Create the zip

Include everything inside `server/` **except** `node_modules/` and `.env`.

On Windows (PowerShell from the `server/` directory):

```powershell
# From inside the server/ folder — selects everything except node_modules and .env
Compress-Archive -Path (Get-ChildItem -Path . -Exclude node_modules,.env | Select-Object -ExpandProperty FullName) -DestinationPath ..\server-deploy.zip -Force
```

The zip must contain `server.js`, `package.json`, `Procfile`, `.ebextensions/`, `routes/`, `lib/`, `middleware/` etc. at the **root level** of the archive (not nested inside a folder).

#### 2. Create an Elastic Beanstalk environment

1. AWS Console → Elastic Beanstalk → **Create application**
2. Platform: **Node.js** (Node.js 20 recommended)
3. Upload your `server-deploy.zip` as the application code

#### 3. Set environment variables

In EB Console → **Configuration → Software → Environment properties**, add:

| Key | Value |
|-----|-------|
| `GEMINI_API_KEY` | your Gemini API key |
| `PINECONE_API_KEY` | your Pinecone API key |
| `ALLOWED_ORIGIN` | your Vercel frontend URL, e.g. `https://your-app.vercel.app` |
| `NODE_ENV` | `production` |

> Do **not** set `PORT` — Elastic Beanstalk injects it automatically as `8080`.

#### 4. Verify

Once the environment turns green, hit:

```
https://your-env.elasticbeanstalk.com/health
```

Expected response: `{ "status": "ok" }`

---

### Deploy the Client → Vercel

#### 1. Push the `client/` folder to a GitHub repository

You can either push the whole `ibm-final` monorepo or just the `client/` folder.

#### 2. Import into Vercel

1. [vercel.com](https://vercel.com) → **Add New Project** → import your repo
2. If using the monorepo, set **Root Directory** to `client`
3. Framework preset: **Vite** (auto-detected)
4. Build command: `npm run build`
5. Output directory: `dist`

#### 3. Set the environment variable

In Vercel → Project → **Settings → Environment Variables**:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | your EB URL, e.g. `https://your-env.elasticbeanstalk.com` |

> No trailing slash. This is baked into the JS bundle at build time by Vite.

#### 4. Redeploy

After setting the env variable, trigger a redeploy so the new value is compiled in.

#### 5. Verify

Open your Vercel URL, upload a document, and ask a question. Check the browser Network tab — requests should go to `https://your-env.elasticbeanstalk.com/api/...` with a `200` response.

---

### Environment variable summary

| Variable | Where set | Purpose |
|----------|-----------|---------|
| `GEMINI_API_KEY` | EB env vars | Gemini embeddings + generation |
| `PINECONE_API_KEY` | EB env vars | Pinecone vector DB |
| `ALLOWED_ORIGIN` | EB env vars | CORS — your Vercel frontend URL |
| `NODE_ENV` | EB env vars | Enables production error handling |
| `VITE_API_URL` | Vercel env vars | Points client to the EB backend |

---

## Changes & Improvements Log

### UI & Design

| Area | Change |
|------|--------|
| Theme | Replaced default purple/blue with a multi-color aurora theme — indigo → violet → pink → orange gradients throughout |
| Header | Gradient text title, frosted-glass backdrop blur on scroll |
| Chat bubbles | User bubbles: gradient pill (indigo→pink). Assistant bubbles: card with border, proper padding and shadow |
| Markdown rendering | Installed `react-markdown` + `remark-gfm`. Responses now render headings (properly sized h1/h2/h3), lists, tables, code blocks, blockquotes, strikethrough, task lists |
| Response typography | Body 14.5px / line-height 1.8. h1 18px gradient, h2 15.5px gradient, h3 14px bold |
| Thinking indicator | Three colored bouncing dots (indigo, violet, pink) with "Thinking…" label inside the bubble |
| Empty state | Animated entry with wobble emoji and staggered suggestion chips that pre-fill the input |
| Copy button | Per-assistant-message copy button with animated check icon, auto-resets after 2s |
| Timestamp | Each message shows send time in the meta row |
| Source cards | Left border cycles through palette colors; gradient relevance bar with spring animation; percentage label outside track |
| Tables in responses | Fully styled with gradient header, zebra rows, hover highlight |
| Blockquotes | Tinted background panel with thick colored left border |

### Upload Panel

| Area | Change |
|------|--------|
| Upload button | Replaced plain button with gradient (indigo→violet→pink) fancy button with shimmer sweep on hover, SVG upload icon, animated label swap (idle ↔ loading) |
| Success message | Auto-dismisses after 4 seconds via `useEffect` timeout |
| Drop zone | Spring animations on hover/drag-over/tap via Framer Motion |
| File info | Shows file name and size in the drop zone after selection |

### Framer Motion Animations

| Element | Animation |
|---------|-----------|
| App header | Slides down on mount |
| Chat messages | Spring up from below on entry, fade-exit |
| Upload drop zone | Scale spring on hover and drag-over |
| Upload button | Spring scale + shimmer, animated icon swap |
| Upload status message | Height + opacity animate in/out |
| Document list items | Slide in from left, exit to right with `AnimatePresence` |
| Source cards | Staggered x-offset entry |
| Source chevron | Rotates 90° on open/close |
| Sources list | Height accordion open/close |
| Suggestion chips | Staggered fade-up entry, scale on hover/tap |
| Send button | Scale on hover/tap |
| Clear button | Scale fade in/out with `AnimatePresence` |
| Avatars | Scale on hover |

### Chat Input

| Area | Change |
|------|--------|
| Character counter | Always visible (`0/1000`). Turns orange at 900+, red + bold at 1000. Input border follows same color states |
| Send button | Circular gradient button with paper-plane SVG icon; spinner while loading |

### Session & Data

| Area | Change |
|------|--------|
| Session isolation | Every API call sends `X-Session-Id` header. Server tags all Pinecone vectors with `sessionId` metadata and filters all queries/deletes by it — users never see each other's documents |
| Persistent session | `sessionId` stored in `localStorage` instead of in-memory — same browser always gets the same ID and can re-query previously uploaded documents after a refresh |
| Persistent file list | Uploaded file list stored in `localStorage` and restored on page load |
| Delete single document | `DELETE /api/documents/:filename` — filters by both `sessionId` and `source` |
| Delete all documents | `DELETE /api/documents` — deletes only the current session's vectors, not everyone's |
| Clear-index script | `server/scripts/clear-index.js` — wipes all vectors, useful for free-tier quota management |

### Bug Fixes

| Bug | Fix |
|-----|-----|
| `api.js` broken JSDoc comment caused syntax error | Fixed malformed comment block |
| Success (green) message persisted after deleting a document | Auto-dismiss via `useEffect` with 4s timeout |
| Upload button remained after file was deleted from the list | Button visibility now tied to `selectedFile || isLoading` state |
| Duplicate file entries when re-uploading same filename | `handleIngested` filters out the old entry before prepending the new one |
| `UploadPanel.jsx` had duplicated function body after a bad str_replace | Rewrote file from scratch |

---

## Manual QA Checklist

### Setup

- [ ] `cd server && npm install` — no errors
- [ ] `cd client && npm install` — no errors
- [ ] `server/.env` filled in with valid Gemini and Pinecone keys
- [ ] `npm run init-index` — logs success or "already exists"
- [ ] Both dev servers start cleanly
- [ ] `GET http://localhost:3001/health` → `{ "status": "ok" }`
- [ ] App loads at http://localhost:5173

### Upload

- [ ] Drag a file onto the drop zone — zone highlights, file name/size shown
- [ ] Click to browse and select a PDF — same result
- [ ] Upload button appears; clicking it shows spinner and "Indexing…" label
- [ ] Success message appears and disappears after ~4 seconds
- [ ] File appears in "Your documents" list with chunk count badge
- [ ] Uploading an unsupported type shows an error message
- [ ] Re-uploading the same filename replaces the existing entry (no duplicate)

### Persistence

- [ ] Refresh the page — "Your documents" list is still populated
- [ ] Ask a question after refresh without re-uploading — Pinecone returns results
- [ ] Open a new tab — same document list visible (same `localStorage`)
- [ ] Open in a different browser or incognito — empty document list (new session)

### Chat

- [ ] Ask a question about an uploaded document — answer references actual content
- [ ] Ask an off-topic question — returns "I don't have relevant information…"
- [ ] Sources section toggles open/closed with chevron rotation
- [ ] Relevance bar animates to correct percentage
- [ ] Copy button on assistant response works; shows checkmark for 2s then resets
- [ ] Timestamp shown on each message
- [ ] Suggestion chips in empty state pre-fill the input on click
- [ ] Typing 900+ characters turns the counter orange; 1000 turns it red
- [ ] Send button disabled while loading; spinner shown
- [ ] "Clear" button clears conversation history

### Delete

- [ ] Delete icon (🗑️) on a document item — item animates out, Pinecone vectors removed
- [ ] "Clear all" button with confirmation dialog — all items removed from list and Pinecone
- [ ] After deleting a document, asking about it returns no relevant sources

### Error handling

- [ ] Stop the backend; ask a question — error bubble shown in chat, no crash
- [ ] Restart backend — queries work again without page refresh
