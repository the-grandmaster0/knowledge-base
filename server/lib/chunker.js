/**
 * Splits text into overlapping word-count-based chunks.
 *
 * @param {string} text       - Input text to chunk
 * @param {number} chunkSize  - Max words per chunk (default 500)
 * @param {number} overlap    - Words to overlap between chunks (default 50)
 * @returns {{ text: string, index: number }[]}
 */
export function chunkText(text, chunkSize = 500, overlap = 50) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const chunks = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    const chunkWords = words.slice(start, end);
    chunks.push({
      text: chunkWords.join(' '),
      index: chunks.length,
    });

    // If we've reached the end, stop
    if (end === words.length) break;

    // Advance by (chunkSize - overlap), minimum 1 to avoid infinite loop
    start += Math.max(chunkSize - overlap, 1);
  }

  return chunks;
}

/**
 * Splits text by double newlines (paragraphs) first, then falls back to
 * chunkText for any paragraph that exceeds chunkSize words.
 *
 * @param {string} text       - Input text to chunk
 * @param {number} chunkSize  - Max words per chunk (default 500)
 * @param {number} overlap    - Words to overlap when falling back to chunkText
 * @returns {{ text: string, index: number }[]}
 */
export function chunkByParagraph(text, chunkSize = 500, overlap = 50) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks = [];

  for (const para of paragraphs) {
    const wordCount = para.split(/\s+/).filter(Boolean).length;

    if (wordCount <= chunkSize) {
      // Paragraph fits in one chunk as-is
      chunks.push({
        text: para,
        index: chunks.length,
      });
    } else {
      // Paragraph too long — split it with overlap, re-index relative to output
      const subChunks = chunkText(para, chunkSize, overlap);
      for (const sub of subChunks) {
        chunks.push({
          text: sub.text,
          index: chunks.length,
        });
      }
    }
  }

  return chunks;
}
