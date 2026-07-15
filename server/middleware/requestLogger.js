/**
 * Request logger middleware.
 * Logs: timestamp, method, path, status code, and response time (ms).
 */
export function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const ms = Date.now() - start;
    const ts = new Date().toISOString();
    console.log(`[${ts}] ${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`);
  });

  next();
}
