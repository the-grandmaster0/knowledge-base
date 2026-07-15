import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
} from 'framer-motion';
import { askQuestion } from '../api.js';

// ─── Animation variants ──────────────────────────────────────────────────────

const msgVariants = {
  hidden:  { opacity: 0, y: 16, scale: 0.97 },
  visible: { opacity: 1, y: 0,  scale: 1,
    transition: { type: 'spring', stiffness: 400, damping: 32 } },
  exit:    { opacity: 0, y: -8, scale: 0.96,
    transition: { duration: 0.15 } },
};

const sourcesVariants = {
  hidden:  { opacity: 0, height: 0, overflow: 'hidden' },
  visible: { opacity: 1, height: 'auto',
    transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] } },
  exit:    { opacity: 0, height: 0,
    transition: { duration: 0.18 } },
};

const cardVariants = {
  hidden:  { opacity: 0, x: -10 },
  visible: (i) => ({
    opacity: 1, x: 0,
    transition: { delay: i * 0.07, type: 'spring', stiffness: 380, damping: 28 },
  }),
};

const chipVariants = {
  hidden:  { opacity: 0, y: 12 },
  visible: (i) => ({
    opacity: 1, y: 0,
    transition: { delay: 0.2 + i * 0.08, type: 'spring', stiffness: 400, damping: 28 },
  }),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Copy button ─────────────────────────────────────────────────────────────

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available — silently ignore
    }
  }

  return (
    <motion.button
      className="copy-btn"
      onClick={handleCopy}
      type="button"
      title={copied ? 'Copied!' : 'Copy response'}
      aria-label={copied ? 'Copied to clipboard' : 'Copy response to clipboard'}
      whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span key="check"
            initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }} transition={{ duration: 0.15 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </motion.span>
        ) : (
          <motion.span key="copy"
            initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }} transition={{ duration: 0.15 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </motion.span>
        )}
      </AnimatePresence>
      <span className="copy-btn__label">{copied ? 'Copied' : 'Copy'}</span>
    </motion.button>
  );
}

// ─── Relevance bar ────────────────────────────────────────────────────────────

function RelevanceBar({ pct }) {
  const raw    = useMotionValue(0);
  const smooth = useSpring(raw, { stiffness: 100, damping: 18 });

  useEffect(() => {
    const timer = setTimeout(() => raw.set(pct), 80);
    return () => clearTimeout(timer);
  }, [pct, raw]);

  // Renders just the inner fill — parent provides the track
  return <motion.div className="src-card__bar" style={{ width: smooth }} />;
}

// ─── Source card ────────────────────────────────────────────────────────────

function SourceCard({ src, index }) {
  const isImage = /\.(jpe?g|png|webp|gif)$/i.test(src.filename);
  const pct = Math.min(100, Math.max(0, Math.round((src.score ?? 0) * 100)));

  return (
    <motion.li
      className="src-card"
      variants={cardVariants}
      custom={index}
      initial="hidden"
      animate="visible"
      layout
    >
      {/* Header: number · filename · chunk badge */}
      <div className="src-card__header">
        <span className="src-card__num">{index + 1}</span>
        <span className="src-card__filename">
          {isImage ? '🖼️' : '📄'} {src.filename}
        </span>
        <span className="src-card__chunk-badge">chunk {src.chunkIndex}</span>
      </div>

      {/* Relevance bar */}
      <div className="src-card__relevance">
        <span className="src-card__relevance-label">Relevance</span>
        <div className="src-card__bar-track">
          <RelevanceBar pct={pct} />
        </div>
        <span className="src-card__pct">{pct}%</span>
      </div>

      {/* Snippet */}
      {src.snippet && (
        <p className="src-card__snippet">
          {src.snippet.trim()}{src.snippet.length >= 200 ? '…' : ''}
        </p>
      )}
    </motion.li>
  );
}

// ─── Message bubble ──────────────────────────────────────────────────────────

function Message({ msg, isLatestAssistant }) {
  const isUser      = msg.role === 'user';
  const isAssistant = msg.role === 'assistant';
  const isError     = msg.role === 'error';

  const [sourcesOpen, setSourcesOpen] = useState(false);
  useEffect(() => { if (isLatestAssistant) setSourcesOpen(false); }, [isLatestAssistant]);

  return (
    <motion.article
      className={`msg msg--${msg.role}`}
      variants={msgVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout="position"
      aria-label={isUser ? 'Your question' : isError ? 'Error' : 'Answer'}
    >
      {/* Avatar */}
      <motion.div
        className="msg__avatar"
        whileHover={{ scale: 1.08 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        aria-hidden="true"
      >
        {isUser ? '🧑' : isError ? '⚠️' : '✨'}
      </motion.div>

      <div className="msg__body">
        {/* Role row + timestamp + copy */}
        <div className="msg__meta-row">
          <span className="msg__role">
            {isUser ? 'You' : isError ? 'Error' : 'Assistant'}
          </span>
          <span className="msg__time">{formatTime(msg.ts)}</span>
          {isAssistant && <CopyButton text={msg.text} />}
        </div>

        {/* Content */}
        {isUser ? (
          <p className="msg__text">{msg.text}</p>
        ) : (
          <div className={`msg__markdown${isError ? ' msg__markdown--error' : ''}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
          </div>
        )}

        {/* Sources */}
        {isAssistant && msg.sources?.length > 0 && (
          <div className="msg__sources">
            <motion.button
              className="sources-toggle"
              onClick={() => setSourcesOpen((o) => !o)}
              aria-expanded={sourcesOpen}
              type="button"
              whileTap={{ scale: 0.95 }}
            >
              <motion.span
                className="sources-toggle__chevron"
                animate={{ rotate: sourcesOpen ? 90 : 0 }}
                transition={{ type: 'spring', stiffness: 350, damping: 24 }}
              >▸</motion.span>
              <span className="sources-toggle__count">{msg.sources.length}</span>
              Source{msg.sources.length !== 1 ? 's' : ''}
            </motion.button>

            <AnimatePresence initial={false}>
              {sourcesOpen && (
                <motion.ul
                  className="src-list"
                  variants={sourcesVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  {msg.sources.map((src, i) => (
                    <SourceCard key={i} src={src} index={i} />
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        )}

        {isAssistant && msg.sources?.length === 0 && (
          <p className="msg__no-sources">No matching sources above threshold.</p>
        )}
      </div>
    </motion.article>
  );
}

// ─── Thinking indicator ───────────────────────────────────────────────────────

function ThinkingBubble() {
  return (
    <motion.div
      className="msg msg--assistant"
      variants={msgVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      aria-label="Generating answer"
    >
      <div className="msg__avatar" aria-hidden="true">✨</div>
      <div className="msg__body">
        <div className="msg__meta-row">
          <span className="msg__role">Assistant</span>
        </div>
        <div className="msg__markdown thinking-wrap">
          <div className="thinking-dots" aria-hidden="true">
            <span /><span /><span />
          </div>
          <span className="thinking-label">Thinking…</span>
        </div>
        <span className="visually-hidden">Generating answer…</span>
      </div>
    </motion.div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'Summarise this document',
  'What are the key findings?',
  'List the main topics covered',
];

function EmptyState({ onSuggestion }) {
  return (
    <motion.div
      className="chat-empty"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
    >
      <motion.div
        className="chat-empty__icon"
        animate={{ rotate: [0, -8, 8, -4, 4, 0] }}
        transition={{ delay: 0.5, duration: 0.8, ease: 'easeInOut' }}
      >
        💬
      </motion.div>
      <p className="chat-empty__heading">Start a conversation</p>
      <p className="chat-empty__hint">
        Upload a document in the sidebar, then ask anything about its contents.
      </p>
      <div className="chat-empty__suggestions">
        {SUGGESTIONS.map((s, i) => (
          <motion.span
            key={s}
            className="chat-empty__chip"
            role="button"
            tabIndex={0}
            variants={chipVariants}
            initial="hidden"
            animate="visible"
            custom={i}
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onSuggestion?.(s)}
            onKeyDown={(e) => e.key === 'Enter' && onSuggestion?.(s)}
          >
            {s}
          </motion.span>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function ChatPanel() {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const lastAssistantIdx = messages.reduce(
    (acc, m, i) => (m.role === 'assistant' ? i : acc), -1
  );

  async function submit(e) {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: question, ts: new Date() }]);
    setLoading(true);

    try {
      const data = await askQuestion(question);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: data.answer, sources: data.sources ?? [], ts: new Date() },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'error', text: err.message ?? 'Something went wrong. Please try again.', ts: new Date() },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="chat-panel" aria-label="Question and answer">

      {/* Header */}
      <div className="chat-header">
        <h2 className="chat-header__title">Ask a Question</h2>
        <AnimatePresence>
          {messages.length > 0 && (
            <motion.button
              className="btn btn--ghost btn--sm"
              onClick={() => setMessages([])}
              type="button"
              title="Clear conversation"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              whileTap={{ scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 400, damping: 24 }}
            >
              Clear
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Message list */}
      <div className="msg-list" aria-live="polite" aria-label="Conversation">
        <AnimatePresence mode="wait">
          {messages.length === 0 && !loading && (
            <EmptyState key="empty" onSuggestion={(s) => setInput(s)} />
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <Message key={i} msg={msg} isLatestAssistant={i === lastAssistantIdx} />
          ))}
          {loading && <ThinkingBubble key="thinking" />}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form className="chat-form" onSubmit={submit} aria-label="Ask a question">
        <label htmlFor="chat-input" className="visually-hidden">Type your question</label>
        <div className="chat-input-wrap">
          <input
            id="chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask something about your documents…"
            disabled={loading}
            maxLength={1000}
            autoComplete="off"
            aria-describedby="char-count"
            className={
              input.length >= 1000 ? 'input--at-limit'
              : input.length >= 900 ? 'input--near-limit'
              : ''
            }
          />
          <span
            id="char-count"
            className={[
              'char-count',
              input.length >= 1000 ? 'char-count--danger'
              : input.length >= 900 ? 'char-count--warn'
              : '',
            ].filter(Boolean).join(' ')}
            aria-live="polite"
          >
            {input.length}/1000
          </span>
        </div>

        <motion.button
          type="submit"
          className="send-btn"
          disabled={loading || !input.trim()}
          aria-label="Send question"
          whileHover={!loading && input.trim() ? { scale: 1.1 } : {}}
          whileTap={!loading && input.trim() ? { scale: 0.92 } : {}}
          transition={{ type: 'spring', stiffness: 420, damping: 22 }}
        >
          {loading ? (
            <span className="spinner spinner--sm" aria-hidden="true" />
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </motion.button>
      </form>
    </section>
  );
}
