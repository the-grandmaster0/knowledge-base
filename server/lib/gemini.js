import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const EMBED_MODEL = 'gemini-embedding-001'; // outputs 3072 dims (text-embedding-004 unavailable on this key)
const CHAT_MODEL = 'gemini-2.5-flash';
const VISION_MODEL = 'gemini-2.5-flash'; // same model — supports multimodal input
const MAX_RETRIES = 3;

/**
 * Exponential backoff retry wrapper.
 * Retries on 429 (rate limit) and 5xx (server errors).
 */
async function withRetry(fn, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err?.status ?? err?.httpErrorCode ?? 0;
      const isRetryable = status === 429 || status >= 500;

      if (isRetryable && attempt < retries) {
        const delay = 2 ** attempt * 500; // 1s, 2s, 4s
        console.warn(`Gemini attempt ${attempt} failed (${status}). Retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
}

/**
 * Embeds a string using text-embedding-004.
 * Returns a number[] of length 768.
 */
export async function embedText(text) {
  return withRetry(async () => {
    const model = genAI.getGenerativeModel({ model: EMBED_MODEL });
    const result = await model.embedContent(text);
    // SDK shape: result.embedding.values
    const values = result?.embedding?.values;
    if (!Array.isArray(values)) {
      throw new Error(`Unexpected embedding response shape: ${JSON.stringify(result)}`);
    }
    return values;
  });
}

/**
 * Extracts text content from an image buffer using Gemini vision.
 * Useful for OCR, diagram descriptions, and handwritten notes.
 *
 * @param {Buffer} imageBuffer  - Raw image bytes
 * @param {string} mimeType     - e.g. 'image/png', 'image/jpeg', 'image/webp'
 * @returns {Promise<string>}   - Extracted / described text
 */
export async function extractTextFromImage(imageBuffer, mimeType) {
  return withRetry(async () => {
    const model = genAI.getGenerativeModel({ model: VISION_MODEL });

    const imagePart = {
      inlineData: {
        mimeType,
        data: imageBuffer.toString('base64'),
      },
    };

    const prompt =
      'You are an OCR and document-analysis assistant. ' +
      'Extract ALL text visible in this image exactly as written. ' +
      'If the image contains diagrams, charts, or illustrations with no readable text, ' +
      'write a detailed description of what is shown so it can be searched later. ' +
      'Do not add commentary — output only the extracted text or description.';

    const result = await model.generateContent([imagePart, prompt]);
    return result.response.text();
  });
}

/**
 * Generates a grounded answer using gemini-2.5-flash.
 * @param {string} question
 * @param {Array<{index: number, text: string}>} contextChunks
 * @returns {Promise<string>}
 */
export async function generateAnswer(question, contextChunks) {
  return withRetry(async () => {
    const model = genAI.getGenerativeModel({ model: CHAT_MODEL });

    const contextBlock = contextChunks
      .map((c) => `[Chunk ${c.index}]: ${c.text}`)
      .join('\n\n');

    const prompt = `You are a helpful assistant. Answer the user's question using ONLY the context chunks provided below.

FORMATTING RULES — follow these strictly:
- Use markdown formatting in your response.
- When listing items (topics, subjects, steps, features, etc.), ALWAYS use a markdown bullet list (- item) or numbered list (1. item), never a comma-separated sentence.
- Use **bold** for key terms or important phrases.
- Use headings (## or ###) when the answer has multiple distinct sections.
- Keep answers concise and well-structured.
- Do NOT include chunk citations or references like "(Chunk 1)" in your answer.
- If the context does not contain enough information to answer the question, respond with exactly: "I don't have enough information to answer that based on the provided documents."
- Do not use any outside knowledge.

CONTEXT:
${contextBlock}

QUESTION: ${question}

ANSWER:`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  });
}
