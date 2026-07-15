import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ingestFile } from '../api.js';

const ACCEPTED_EXTENSIONS = '.pdf,.txt,.jpg,.jpeg,.png,.webp,.gif';
const ACCEPTED_LABEL = 'PDF · TXT · JPEG · PNG · WebP · GIF';

function fileIcon(name = '') {
  const ext = name.split('.').pop().toLowerCase();
  if (ext === 'pdf') return '📄';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return '🖼️';
  return '📝';
}

function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function UploadButton({ onClick, isLoading }) {
  return (
    <motion.button
      className="upload-btn-fancy"
      onClick={onClick}
      type="button"
      disabled={isLoading}
      initial={{ opacity: 0, y: 10, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.94 }}
      whileHover={!isLoading ? { scale: 1.03, y: -1 } : {}}
      whileTap={!isLoading ? { scale: 0.96 } : {}}
      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
      aria-label={isLoading ? 'Indexing document…' : 'Upload and index document'}
    >
      <span className="upload-btn-fancy__shimmer" aria-hidden="true" />

      <AnimatePresence mode="wait" initial={false}>
        {isLoading ? (
          <motion.span
            key="loading"
            className="upload-btn-fancy__content"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            <span className="upload-btn-fancy__spinner" aria-hidden="true" />
            Indexing…
          </motion.span>
        ) : (
          <motion.span
            key="idle"
            className="upload-btn-fancy__content"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            <UploadIcon />
            Upload &amp; Index
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export default function UploadPanel({ onIngested }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [status, setStatus]             = useState('idle');
  const [message, setMessage]           = useState('');
  const [dragOver, setDragOver]         = useState(false);
  const inputRef = useRef(null);

  // Auto-dismiss success message after 4 s
  useEffect(() => {
    if (status !== 'success') return;
    const t = setTimeout(() => { setMessage(''); setStatus('idle'); }, 4000);
    return () => clearTimeout(t);
  }, [status]);

  function selectFile(file) {
    if (!file) return;
    setSelectedFile(file);
    setStatus('idle');
    setMessage('');
  }

  function onInputChange(e) {
    selectFile(e.target.files?.[0]);
    e.target.value = '';
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    selectFile(e.dataTransfer.files?.[0]);
  }

  function clearFile(e) {
    e.stopPropagation();
    setSelectedFile(null);
    setStatus('idle');
    setMessage('');
  }

  async function handleUpload() {
    if (!selectedFile || status === 'loading') return;
    setStatus('loading');
    setMessage('');

    try {
      const result = await ingestFile(selectedFile);
      setStatus('success');
      setMessage(
        `Indexed ${result.chunksIndexed} chunk${result.chunksIndexed !== 1 ? 's' : ''} from "${result.filename}".`
      );
      onIngested?.({ filename: result.filename, chunksIndexed: result.chunksIndexed });
      setSelectedFile(null);
    } catch (err) {
      setStatus('error');
      setMessage(err.message ?? 'Upload failed. Please try again.');
    }
  }

  const isLoading = status === 'loading';

  return (
    <section className="panel upload-panel" aria-label="Document upload">
      <h2 className="panel-title">Upload Document</h2>
      <p className="panel-hint">{ACCEPTED_LABEL} · Max 10 MB</p>

      {/* Drop zone */}
      <motion.div
        className={[
          'drop-zone',
          dragOver     ? 'drop-zone--over'    : '',
          isLoading    ? 'drop-zone--loading' : '',
          selectedFile ? 'drop-zone--has-file' : '',
        ].filter(Boolean).join(' ')}
        role="button"
        tabIndex={0}
        aria-label={
          selectedFile
            ? `Selected: ${selectedFile.name}. Click to change.`
            : 'Drop a file here or click to browse'
        }
        onClick={() => !isLoading && inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && !isLoading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        whileHover={!isLoading ? { scale: 1.01 } : {}}
        whileTap={!isLoading ? { scale: 0.99 } : {}}
        animate={dragOver ? { scale: 1.03 } : { scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      >
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
            >
              <span className="spinner" aria-label="Uploading" />
              <span className="drop-label">Indexing…</span>
            </motion.div>
          ) : selectedFile ? (
            <motion.div
              key="file"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
            >
              <span className="drop-icon" aria-hidden="true">{fileIcon(selectedFile.name)}</span>
              <span className="drop-filename">{selectedFile.name}</span>
              <span className="drop-filesize">{(selectedFile.size / 1024).toFixed(1)} KB</span>
              <button
                className="drop-clear"
                onClick={clearFile}
                aria-label="Remove selected file"
                type="button"
              >
                ✕
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
            >
              <span className="drop-icon" aria-hidden="true">⬆️</span>
              <span className="drop-label">Drop a file or <strong>click to browse</strong></span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        onChange={onInputChange}
        className="visually-hidden"
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Upload & Index button */}
      <AnimatePresence>
        {(selectedFile || isLoading) && (
          <UploadButton onClick={handleUpload} isLoading={isLoading} />
        )}
      </AnimatePresence>

      {/* Status message */}
      <AnimatePresence>
        {message && (
          <motion.p
            className={`status-msg status-msg--${status}`}
            role={status === 'error' ? 'alert' : 'status'}
            aria-live="polite"
            initial={{ opacity: 0, y: 6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            {status === 'success'
              ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><CheckIcon />{message}</span>
              : <span>⚠️ {message}</span>
            }
          </motion.p>
        )}
      </AnimatePresence>
    </section>
  );
}
