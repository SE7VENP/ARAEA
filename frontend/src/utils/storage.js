/**
 * Safe localStorage helpers.
 * All operations are wrapped in try/catch to handle Private Browsing mode
 * (Safari/Firefox throw SecurityError) and storage quota exceeded.
 */

/** Read a value or return fallback. */
export function lsGet(key, fallback = null) {
  try {
    const v = localStorage.getItem(key);
    return v != null ? v : fallback;
  } catch {
    return fallback;
  }
}

/** Write a value. Returns true on success. */
export function lsSet(key, value) {
  try {
    localStorage.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}

/** Read and JSON-parse a value. Returns fallback on any error. */
export function lsGetJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw != null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/** JSON-serialize and write a value. */
export function lsSetJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
