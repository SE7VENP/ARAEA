// ============================================================
// FILE: backend/lyricsAPI.js  (v2 — multi-source with fallbacks)
//
// Source priority:
//  1. lyrics.ovh          — free, good for English
//  2. lrclib.net          — free, large DB, synced lyrics
//  3. Genius search scrape — fallback for Indian/regional tracks
//  4. "not available"     — graceful empty state, never throws
// ============================================================

// ── Helper: fetch with timeout ────────────────────────────
async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

// ── Source 1: lyrics.ovh ─────────────────────────────────
async function fromLyricsOvh(artist, title) {
  try {
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
    const res = await fetchWithTimeout(url, {}, 4000);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.lyrics?.trim() || null;
  } catch {
    return null;
  }
}

// ── Source 2: lrclib.net ──────────────────────────────────
// Large community DB, includes Bollywood and regional tracks.
async function fromLrclib(artist, title) {
  try {
    const qs = new URLSearchParams({ artist_name: artist, track_name: title }).toString();
    const res = await fetchWithTimeout(`https://lrclib.net/api/search?${qs}`, {}, 5000);
    if (!res.ok) return null;
    const results = await res.json();
    if (!Array.isArray(results) || results.length === 0) return null;
    // Prefer synced lyrics, fall back to plain text
    const best = results[0];
    const lyrics = best.plainLyrics || best.syncedLyrics?.replace(/\[\d+:\d+\.\d+\]/g, "").trim();
    return lyrics?.trim() || null;
  } catch {
    return null;
  }
}

// ── Source 3: Genius search (title only, no API key needed) ─
// Returns a snippet/url rather than full lyrics (scraping is blocked),
// but gives us something to show rather than nothing.
async function fromGenius(artist, title) {
  try {
    const q = encodeURIComponent(`${title} ${artist}`);
    const res = await fetchWithTimeout(
      `https://api.genius.com/search?q=${q}`,
      { headers: { Authorization: "Bearer " + (process.env.GENIUS_TOKEN || "") } },
      5000
    );
    if (!res.ok || !process.env.GENIUS_TOKEN) return null;
    const data = await res.json();
    const hit = data?.response?.hits?.[0]?.result;
    if (!hit) return null;
    // Return a note pointing to Genius rather than empty
    return `[Full lyrics available on Genius]\n${hit.full_title}\n${hit.url}`;
  } catch {
    return null;
  }
}

// ── Main export ───────────────────────────────────────────
export async function getLyrics(artist, title) {
  if (!artist || !title) return null;

  // Clean feat./remix suffixes that confuse lyric APIs
  const cleanTitle  = title.replace(/\s*[\(\[][^)\]]*feat[^)\]]*[\)\]]/gi, "").trim();
  const cleanArtist = artist.split(/[,&]/)[0].trim(); // use primary artist only

  console.log(`[lyrics] Fetching: "${cleanTitle}" by "${cleanArtist}"`);

  // Try sources in order, stop at first hit
  const sources = [
    () => fromLrclib(cleanArtist, cleanTitle),
    () => fromLyricsOvh(cleanArtist, cleanTitle),
    () => fromGenius(cleanArtist, cleanTitle),
    // Retry lrclib with original (unclean) strings
    () => fromLrclib(artist, title),
  ];

  for (const source of sources) {
    const lyrics = await source();
    if (lyrics) {
      console.log(`[lyrics] ✅ Found lyrics for "${cleanTitle}"`);
      return lyrics;
    }
  }

  console.log(`[lyrics] ⚠️ No lyrics found for "${cleanTitle}" by "${cleanArtist}"`);
  return null;
}
