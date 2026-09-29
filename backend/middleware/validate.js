/**
 * validate.js
 *
 * Pure input-sanitisation helpers used in route handlers.
 * All functions are side-effect-free and never throw.
 */

/** Clamp a numeric value to [lo, hi]; return fallback if not finite. */
export function clampNum(v, lo, hi, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
}

/** Return v only if it exists in the allowed array, otherwise fallback. */
export function sanitizeStr(v, allowed, fallback) {
  return allowed.includes(v) ? v : fallback;
}

/**
 * Sanitize a free-text string:
 * - Strips null bytes and ASCII control characters (except \n \t)
 * - Trims whitespace
 * - Truncates to maxLen
 */
export function sanitizeText(v, maxLen = 200) {
  if (typeof v !== "string") return "";
  return v
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLen);
}

/** Return true if v is a valid CSS hex colour string. */
export function isHexColor(v) {
  return typeof v === "string" && /^#[0-9A-Fa-f]{3,8}$/.test(v);
}

/**
 * Return true if v looks like a valid Spotify URI.
 * Format: spotify:track:<base62 id>
 */
export function isSpotifyUri(v) {
  return typeof v === "string" && /^spotify:[a-z]+:[A-Za-z0-9]{22}$/.test(v);
}

/**
 * Express middleware — requires req.body to be a non-null object.
 * Prevents null-dereference errors in handlers that use req.body.x.
 */
export function requireBody(req, res, next) {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({ error: "Request body must be a JSON object" });
  }
  next();
}
