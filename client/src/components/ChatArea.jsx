import { useState, useRef, useEffect } from 'react';
import { askQuestion } from '../api.js';

export default function ChatArea() {
  const [messages, setMessages] = useState([]); // { role: 'user'|'assistant'|'error', text, sources? }
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function submit(e) {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    setLoading(true);

    try {
      const data = await askQuestion(question);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: data.answer, sources: data.sources },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'error', text: err.message ?? 'Something went wrong. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="chat-section" aria-label="Question and answer">
      <h2>Ask a Question</h2>

      <div className="chat-window" aria-live="polite" aria-label="Conversation">
        {messages.length === 0 && (
          <p className="chat-empty">Upload a document above, then ask anything about it.</p>
        )}

        {messages.map((msg, i) => (
          <article
            key={i}
            className={`chat-bubble chat-bubble--${msg.role}`}
            aria-label={msg.role === 'user' ? 'Your question' : msg.role === 'error' ? 'Error' : 'Answer'}
          >
            <p>{msg.text}</p>

            {/* Source citations */}
            {msg.sources?.length > 0 && (
              <details className="sources">
                <summary>{msg.sources.length} source{msg.sources.length !== 1 ? 's' : ''}</summary>
                <ul>
                  {msg.sources.map((src, j) => (
                    <li key={j}>
                      <strong>{src.filename}</strong>
                      {' · chunk '}{src.chunkIndex}
                      {' · score '}{src.score}
                      {src.snippet && <blockquote className="snippet">"{src.snippet}…"</blockquote>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </article>
        ))}

        {loading && (
          <div className="chat-bubble chat-bubble--assistant chat-bubble--thinking" aria-label="Thinking…">
            <span className="dot-flashing" aria-hidden="true" />
            <span className="visually-hidden">Generating answer…</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form className="chat-form" onSubmit={submit}>
        <label htmlFor="question-input" className="visually-hidden">Type your question</label>
        <input
          id="question-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask something about your documents…"
          disabled={loading}
          maxLength={1000}
          autoComplete="off"
        />
        <button type="submit" disabled={loading || !input.trim()} aria-label="Send question">
          {loading ? '…' : 'Send'}
        </button>
      </form>
    </section>
  );
}
