/**
 * rateLimit.js
 *
 * Lightweight in-process sliding-window rate limiter.
 * No external dependencies — uses a Map<ip, timestamps[]>.
 *
 * Usage:
 *   app.use("/api/emotion", rateLimit({ max: 60, windowMs: 60_000 }));
 *
 * Automatically cleans up expired entries to prevent memory growth.
 */

/**
 * @param {{ max: number, windowMs: number, message?: string }} opts
 */
export function rateLimit({ max = 100, windowMs = 60_000, message = "Too many requests — slow down" } = {}) {
  const hits = new Map(); // Map<ip, number[]> — timestamps of recent requests

  // Prune stale IPs every 5 minutes so the map doesn't grow forever
  const cleanup = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [ip, times] of hits) {
      const fresh = times.filter(t => t > cutoff);
      if (fresh.length === 0) hits.delete(ip);
      else                    hits.set(ip, fresh);
    }
  }, 5 * 60_000);
  // Allow Node to exit even if this interval is still pending
  if (cleanup.unref) cleanup.unref();

  return function rateLimitMiddleware(req, res, next) {
    const ip     = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const now    = Date.now();
    const cutoff = now - windowMs;

    const times = (hits.get(ip) ?? []).filter(t => t > cutoff);
    if (times.length >= max) {
      res.set("Retry-After", Math.ceil(windowMs / 1000));
      return res.status(429).json({ error: message });
    }
    times.push(now);
    hits.set(ip, times);
    next();
  };
}
