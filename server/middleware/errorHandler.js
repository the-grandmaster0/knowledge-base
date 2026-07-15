/**
 * Centralised Express error handler.
 *
 * All routes should call next(err) for unexpected errors.
 * Client-facing errors (4xx) should be thrown with err.statusCode set.
 *
 * Response shape: { error: { message, code } }
 * Stack traces are NEVER sent to the client.
 */

// Map of known error codes → HTTP status
const CODE_STATUS = {
  VALIDATION: 400,
  UNSUPPORTED_TYPE: 400,
  LIMIT_FILE_SIZE: 413,
  NO_FILE: 400,
  EXTRACTION_FAILED: 422,
  EMPTY_DOCUMENT: 422,
  EMBEDDING_FAILED: 502,
  UPSERT_FAILED: 502,
  QUERY_FAILED: 502,
  GENERATION_FAILED: 502,
  DELETE_FAILED: 502,
};

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  const ts = new Date().toISOString();

  // Determine HTTP status
  const status =
    err.statusCode ??
    err.status ??
    CODE_STATUS[err.code] ??
    500;

  // Determine the client-safe message
  // For 5xx errors caused by third-party services, use a generic message
  // to avoid leaking internal details.
  const isServerError = status >= 500;
  const clientMessage = isServerError
    ? 'An unexpected error occurred. Please try again.'
    : (err.clientMessage ?? err.message ?? 'Bad request.');

  const code = err.code ?? (isServerError ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');

  // Always log full details server-side (including stack for unexpected errors)
  console.error(
    `[${ts}] ERROR ${status} ${req.method} ${req.originalUrl} — ${err.message}` +
    (isServerError && err.stack ? `\n${err.stack}` : '')
  );

  res.status(status).json({
    error: {
      message: clientMessage,
      code,
    },
  });
}
