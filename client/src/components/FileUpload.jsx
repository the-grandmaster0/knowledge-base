import { useState, useRef } from 'react';
import { ingestFile } from '../api.js';

const ACCEPTED = '.pdf,.txt,.jpg,.jpeg,.png,.webp,.gif';
const ACCEPTED_LABEL = 'PDF, TXT, JPEG, PNG, WebP, GIF';

export default function FileUpload({ onIngested }) {
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [message, setMessage] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  async function handleFile(file) {
    if (!file) return;
    setStatus('loading');
    setMessage('');
    try {
      const result = await ingestFile(file);
      setStatus('success');
      setMessage(`✓ "${result.filename}" indexed — ${result.chunksIndexed} chunks stored.`);
      onIngested?.({ filename: result.filename, chunksIndexed: result.chunksIndexed });
    } catch (err) {
      setStatus('error');
      setMessage(err.message ?? 'Upload failed. Please try again.');
    }
  }

  function onInputChange(e) {
    handleFile(e.target.files?.[0]);
    // reset input so the same file can be re-uploaded
    e.target.value = '';
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  }

  return (
    <section className="upload-section" aria-label="Document upload">
      <h2>Upload Document</h2>
      <p className="upload-hint">Accepted: {ACCEPTED_LABEL} · Max 10 MB</p>

      {/* Drop zone */}
      <div
        className={`drop-zone ${dragOver ? 'drop-zone--over' : ''} ${status === 'loading' ? 'drop-zone--loading' : ''}`}
        role="button"
        tabIndex={0}
        aria-label="Drop a file here or click to browse"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {status === 'loading' ? (
          <span className="spinner" aria-label="Uploading…" />
        ) : (
          <>
            <span className="drop-icon" aria-hidden="true">📄</span>
            <span>Drop a file here, or <strong>click to browse</strong></span>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        onChange={onInputChange}
        className="visually-hidden"
        aria-hidden="true"
        tabIndex={-1}
      />

      {message && (
        <p
          className={`upload-status upload-status--${status}`}
          role={status === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {message}
        </p>
      )}
    </section>
  );
}
