/**
 * lyricsAPI.js — Unified lyrics client.
 *
 * Strategy (in order):
 *   1. Backend proxy  (/api/lyrics) — single source of truth, uses lrclib.net
 *   2. Direct lrclib  (CORS-friendly fallback if backend is down)
 *
 * The backend proxy was added (Fix 2.3) to centralise lyrics logic and ensure
 * consistent behaviour regardless of which external service is available.
 */

const BACKEND = "http://127.0.0.1:3001";

function cleanTitle(title = "") {
  return title
    .replace(/\(.*?\)/g, "")          // remove (feat. ...), (remix), etc.
    .replace(/[&]/g, "and")
    .trim();
}

function primaryArtist(artist = "") {
  return artist.split(",")[0].trim().replace(/&/g, "and");
}

/** Try the backend proxy first — centralised, consistent, no CORS issues */
async function fromBackend(artist, title, signal) {
  try {
    const qs = new URLSearchParams({ title, artist }).toString();
    const res = await fetch(`${BACKEND}/api/lyrics?${qs}`, { signal });
    if (!res.ok) return null;
    const data = await res.json();
    return data.lyrics ?? null;
  } catch {
    return null; // backend offline → fall through to direct fetch
  }
}

/** Direct lrclib.net — CORS-friendly fallback when backend is unavailable */
async function fromLrclib(artist, title, signal) {
  try {
    const qs = new URLSearchParams({ artist_name: artist, track_name: title }).toString();
    const res = await fetch(`https://lrclib.net/api/search?${qs}`, { signal });
    if (!res.ok) return null;
    const results = await res.json();
    if (!Array.isArray(results) || results.length === 0) return null;
    const best = results[0];
    const lyrics =
      best.plainLyrics ||
      best.syncedLyrics?.replace(/\[\d+:\d+\.\d+\]/g, "").trim();
    return lyrics?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Fetch lyrics for a track.
 * @param {string} artist
 * @param {string} title
 * @param {AbortSignal} [signal]
 * @returns {Promise<string|null>}
 */
export async function fetchLyrics(artist, title, signal) {
  const pa = primaryArtist(artist);
  const ct = cleanTitle(title);

  // 1. Backend proxy (preferred)
  const backendResult = await fromBackend(pa, ct, signal);
  if (backendResult) return backendResult;

  // 2. Direct lrclib (fallback — backend may be offline)
  return (
    (await fromLrclib(pa, ct, signal)) ??
    (await fromLrclib(pa, title, signal)) ??
    (await fromLrclib(artist, ct, signal)) ??
    null
  );
}
