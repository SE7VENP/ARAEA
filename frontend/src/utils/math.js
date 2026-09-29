/**
 * General-purpose numeric helpers.
 */

/** Clamp n to [lo, hi]. */
export function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n ?? lo));
}

/** Linear interpolation. */
export function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/** Normalise n from [lo,hi] to [0,1]. */
export function normalise(n, lo, hi) {
  const range = hi - lo;
  return range === 0 ? 0 : clamp((n - lo) / range, 0, 1);
}

/** Round to d decimal places. */
export function round(n, d = 0) {
  const p = 10 ** d;
  return Math.round((n ?? 0) * p) / p;
}

/** Convert 0-1 fraction to 0-100 percentage string ("42%"). */
export function pct(n) {
  return `${Math.round(clamp(n, 0, 1) * 100)}%`;
}
