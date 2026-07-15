import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import UploadPanel from './components/UploadPanel.jsx';
import ChatPanel from './components/ChatPanel.jsx';
import {
  deleteDocument,
  deleteAllDocuments,
  loadPersistedFiles,
  savePersistedFiles,
} from './api.js';
import './App.css';

const listItemVariants = {
  hidden:  { opacity: 0, x: -16, scale: 0.97 },
  visible: { opacity: 1, x: 0,   scale: 1,
    transition: { type: 'spring', stiffness: 400, damping: 30 } },
  exit:    { opacity: 0, x: 16,  scale: 0.94,
    transition: { duration: 0.18 } },
};

export default function App() {
  const [ingestedFiles, setIngestedFiles] = useState(() => loadPersistedFiles());
  const [deletingFiles, setDeletingFiles] = useState(new Set());
  const [deleteAllState, setDeleteAllState] = useState('idle');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { savePersistedFiles(ingestedFiles); }, [ingestedFiles]);

  // Close on Escape
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setSidebarOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sidebarOpen]);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  function handleIngested(fileInfo) {
    setIngestedFiles((prev) => {
      const without = prev.filter((f) => f.filename !== fileInfo.filename);
      return [fileInfo, ...without];
    });
    setSidebarOpen(false); // close drawer on mobile after upload
  }

  async function handleDeleteFile(filename) {
    setDeletingFiles((prev) => new Set(prev).add(filename));
    try {
      await deleteDocument(filename);
      setIngestedFiles((prev) => prev.filter((f) => f.filename !== filename));
    } catch (err) {
      alert(`Failed to delete "${filename}": ${err.message}`);
    } finally {
      setDeletingFiles((prev) => {
        const next = new Set(prev);
        next.delete(filename);
        return next;
      });
    }
  }

  async function handleDeleteAll() {
    if (!window.confirm('Delete ALL documents from the knowledge base? This cannot be undone.')) return;
    setDeleteAllState('loading');
    try {
      await deleteAllDocuments();
      setIngestedFiles([]);
      setDeleteAllState('idle');
    } catch (err) {
      setDeleteAllState('error');
      alert(`Failed to delete all documents: ${err.message}`);
    }
  }

  return (
    <div className="app">
      {/* ── Header ──────────────────────────────────────────────── */}
      <motion.header
        className="app-header"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className="app-header-inner">
          {/* Hamburger — visible only on mobile via CSS */}
          <motion.button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            aria-expanded={sidebarOpen}
            type="button"
            whileTap={{ scale: 0.9 }}
          >
            <span className="sidebar-toggle__icon">{sidebarOpen ? '✕' : '☰'}</span>
            {ingestedFiles.length > 0 && !sidebarOpen && (
              <span className="sidebar-toggle__badge">{ingestedFiles.length}</span>
            )}
          </motion.button>

          <div className="app-header-text">
            <h1>📚 Knowledge Base Assistant</h1>
            <p className="app-subtitle">Upload documents, then ask questions about them.</p>
          </div>
        </div>
      </motion.header>

      <main className="app-layout">

        {/* ── Single sidebar — always mounted, never duplicated ── */}
        <motion.aside
          className="sidebar"
          aria-label="Documents sidebar"
          animate={{ x: 0 }}
          data-open={sidebarOpen}
        >
          {/* Mobile drawer header */}
          <div className="sidebar-mobile-header">
            <span className="sidebar-mobile-title">Documents</span>
            <button
              className="sidebar-mobile-close"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
              type="button"
            >✕</button>
          </div>

            <UploadPanel onIngested={handleIngested} />

            <AnimatePresence>
              {ingestedFiles.length > 0 && (
                <motion.section
                  className="indexed-list"
                  aria-label="Indexed documents"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                >
                  <div className="indexed-list__header">
                    <h3 className="indexed-list__title">Your documents</h3>
                    <motion.button
                      className="btn btn--danger btn--sm"
                      onClick={handleDeleteAll}
                      disabled={deleteAllState === 'loading'}
                      type="button"
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {deleteAllState === 'loading' ? 'Clearing…' : 'Clear all'}
                    </motion.button>
                  </div>

                  <ul className="indexed-list__items">
                    <AnimatePresence initial={false}>
                      {ingestedFiles.map((f) => {
                        const isImage    = /\.(jpe?g|png|webp|gif)$/i.test(f.filename);
                        const isDeleting = deletingFiles.has(f.filename);
                        return (
                          <motion.li
                            key={f.filename}
                            className={`indexed-item${isDeleting ? ' indexed-item--deleting' : ''}`}
                            variants={listItemVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            layout
                          >
                            <span className="indexed-item__icon" aria-hidden="true">
                              {isImage ? '🖼️' : '📄'}
                            </span>
                            <span className="indexed-item__name" title={f.filename}>
                              {f.filename}
                            </span>
                            <span className="indexed-item__chunks">
                              {f.chunksIndexed}&nbsp;chunks
                            </span>
                            <motion.button
                              className="indexed-item__delete"
                              onClick={() => handleDeleteFile(f.filename)}
                              disabled={isDeleting}
                              aria-label={`Delete ${f.filename}`}
                              type="button"
                              whileHover={{ scale: 1.2 }}
                              whileTap={{ scale: 0.88 }}
                            >
                              {isDeleting
                                ? <span className="spinner spinner--sm" aria-label="Deleting" />
                                : '🗑️'}
                            </motion.button>
                          </motion.li>
                        );
                      })}
                    </AnimatePresence>
                  </ul>
                </motion.section>
              )}
            </AnimatePresence>
          </motion.aside>

        {/* Backdrop — outside sidebar, covers chat when drawer is open */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              className="sidebar-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
          )}
        </AnimatePresence>

        {/* ── Chat area ────────────────────────────────────────── */}
        <ChatPanel />
      </main>
    </div>
  );
}
