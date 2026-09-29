/**
 * errors.js — Global Express error handler
 *
 * This is the ONE file permitted to read process.env directly.
 * It cannot import from config/index.js because config/ imports dotenv,
 * which would create a circular dependency during startup.
 */

export function errorHandler(err, _req, res, _next) {
  const status  = err.status ?? err.statusCode ?? 500;
  const message = err.message ?? "Internal server error";
  const body    = { error: message };

  if (process.env.NODE_ENV !== "production") {
    body.stack = err.stack;
  }

  console.error(`[Error] ${status} – ${message}`);
  res.status(status).json(body);
}

/** Wrap an async route handler so unhandled promise rejections reach errorHandler. */
export const asyncRoute = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
