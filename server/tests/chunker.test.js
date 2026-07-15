import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunkText, chunkByParagraph } from '../lib/chunker.js';

// --- helpers ----------------------------------------------------------------

/** Generate a deterministic N-word string: "word1 word2 word3 ..." */
function makeWords(n) {
  return Array.from({ length: n }, (_, i) => `word${i + 1}`).join(' ');
}

// ---------------------------------------------------------------------------
// chunkText tests
// ---------------------------------------------------------------------------

test('chunkText: empty string returns empty array', () => {
  assert.deepEqual(chunkText(''), []);
});

test('chunkText: text shorter than chunkSize returns one chunk', () => {
  const text = makeWords(100);
  const chunks = chunkText(text, 500, 50);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].index, 0);
  assert.equal(chunks[0].text.split(' ').length, 100);
});

test('chunkText: 2000-word string with chunkSize=500, overlap=50', () => {
  const text = makeWords(2000);
  const chunks = chunkText(text, 500, 50);

  // Expected chunk count:
  // stride = 500 - 50 = 450
  // starts: 0, 450, 900, 1350, 1800  → last chunk [1800..2000] = 200 words
  // total: 5 chunks
  assert.equal(chunks.length, 5, `expected 5 chunks, got ${chunks.length}`);

  // Indices should be sequential 0-based
  chunks.forEach((c, i) => assert.equal(c.index, i));

  // Chunk 0: words 1-500
  assert.equal(chunks[0].text.split(' ').length, 500);

  // Overlap check: last `overlap` words of chunk[n] === first `overlap` words of chunk[n+1]
  const OVERLAP = 50;
  for (let i = 0; i < chunks.length - 1; i++) {
    const tailWords = chunks[i].text.split(' ').slice(-OVERLAP);
    const headWords = chunks[i + 1].text.split(' ').slice(0, OVERLAP);
    assert.deepEqual(
      tailWords,
      headWords,
      `overlap mismatch between chunk ${i} and chunk ${i + 1}`
    );
  }
});

test('chunkText: exact multiple of stride produces correct count', () => {
  // 900 words, chunkSize=300, overlap=0 → 3 chunks with no overlap
  const text = makeWords(900);
  const chunks = chunkText(text, 300, 0);
  assert.equal(chunks.length, 3);
  chunks.forEach((c) => assert.equal(c.text.split(' ').length, 300));
});

test('chunkText: all chunks have word count <= chunkSize', () => {
  const text = makeWords(2000);
  const chunks = chunkText(text, 500, 50);
  chunks.forEach((c) => {
    const wc = c.text.split(' ').length;
    assert.ok(wc <= 500, `chunk ${c.index} has ${wc} words > 500`);
  });
});

// ---------------------------------------------------------------------------
// chunkByParagraph tests
// ---------------------------------------------------------------------------

test('chunkByParagraph: short paragraphs kept as individual chunks', () => {
  const paras = ['One two three.', 'Four five six.', 'Seven eight nine.'];
  const text = paras.join('\n\n');
  const chunks = chunkByParagraph(text, 500, 50);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].text, 'One two three.');
  assert.equal(chunks[1].text, 'Four five six.');
  assert.equal(chunks[2].text, 'Seven eight nine.');
});

test('chunkByParagraph: long paragraph falls back to chunkText', () => {
  // Single paragraph of 1100 words → chunkSize=500, overlap=50
  // stride = 450 → starts: 0, 450, 900 → 3 sub-chunks
  const longPara = makeWords(1100);
  const chunks = chunkByParagraph(longPara, 500, 50);
  assert.equal(chunks.length, 3);
  chunks.forEach((c, i) => assert.equal(c.index, i));
});

test('chunkByParagraph: mix of short and long paragraphs', () => {
  const shortPara = makeWords(100);                // fits → 1 chunk
  const longPara  = makeWords(1100);               // too long → 3 chunks
  const text = shortPara + '\n\n' + longPara + '\n\n' + shortPara;

  const chunks = chunkByParagraph(text, 500, 50);
  // 1 + 3 + 1 = 5 chunks
  assert.equal(chunks.length, 5);
  // All indices sequential
  chunks.forEach((c, i) => assert.equal(c.index, i));
});

test('chunkByParagraph: empty string returns empty array', () => {
  assert.deepEqual(chunkByParagraph(''), []);
});
