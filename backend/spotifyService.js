// ============================================================
// FILE: backend/spotifyService.js   (v6)
//
// CHANGES:
//  - No market bias: searches globally (no market param) so
//    English, Indian, and all songs are returned equally.
//  - Dev-mode cap fix: Spotify dev apps get ~5 results per call.
//    We now fire multiple parallel queries and merge results to
//    reach the target track count, instead of relying on limit=.
//  - limit param removed from search: "no-limit" is the only
//    strategy that returns 200. Limit param causes 400 always in
//    this app's current Spotify permission tier.
// ============================================================
import axios from "axios";

const BASE = "https://api.spotify.com/v1";

// ── Shared axios helper (non-search endpoints) ────────────
async function api(method, path, token, data = null) {
  try {
    const headers = { Authorization: `Bearer ${token}` };
    if (data) headers["Content-Type"] = "application/json";
    const r = await axios({
      method,
      url: BASE + path,
      headers,
      data: data || undefined,
      validateStatus: s => s < 500,
    });
    return r.status === 204
      ? { ok: true, data: null }
      : { ok: r.status < 400, status: r.status, data: r.data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ── Raw search — native fetch, NO limit param ─────────────
// Spotify dev-mode apps reject limit= with 400 "Invalid limit".
// Omitting it returns Spotify's server default (~5 tracks) with 200.
// We compensate by running multiple queries and merging results.
async function spotifySearch(token, query) {
  const qs = new URLSearchParams({ q: query, type: "track" }).toString();
  const url = `${BASE}/search?${qs}`;
  let res;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch (e) {
    console.error(`[spotifySearch] network error: ${e.message}`);
    return [];
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.warn(`[spotifySearch] ${res.status} "${query}" — ${JSON.stringify(body?.error ?? body)}`);
    return [];
  }
  const data = await res.json();
  return data?.tracks?.items ?? [];
}

// ── Search tracks — multi-query merge to overcome 5-track cap ─
export async function searchTracks(token, query, targetCount = 20) {
  if (!query?.trim()) return [];

  // Single query is enough for small requests (avoids unnecessary API calls)
  if (targetCount <= 5) {
    const items = await spotifySearch(token, query);
    return items.slice(0, targetCount).map(normaliseTrack);
  }

  // For larger requests: spin up query variants in parallel to beat the ~5-result dev cap
  const variants = [
    query,
    `${query} songs`,
    `best ${query}`,
    `${query} playlist`,
  ];

  // allSettled instead of Promise.all — one failing variant won't kill the whole search
  // Each query races against a 3-second timeout to prevent slow responses blocking the UI
  const TIMEOUT_MS = 3000;
  const settled = await Promise.allSettled(
    variants.map(q =>
      Promise.race([
        spotifySearch(token, q),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)
        ),
      ])
    )
  );

  const seen   = new Set();
  const tracks = [];

  for (const r of settled) {
    if (r.status !== "fulfilled") continue; // skip timed-out or errored variants
    for (const t of r.value) {
      if (!t.uri || !t.name || seen.has(t.id)) continue;
      seen.add(t.id);
      tracks.push(normaliseTrack(t));
      if (tracks.length >= targetCount) break;
    }
    if (tracks.length >= targetCount) break;
  }

  console.log(`[searchTracks] "${query}" → ${tracks.length} merged tracks`);
  return tracks
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, targetCount);
}

function normaliseTrack(t) {
  return {
    uri:         t.uri,
    id:          t.id,
    name:        t.name,
    artist:      t.artists.map(a => a.name).join(", "),
    image:       t.album?.images?.[1]?.url || t.album?.images?.[0]?.url,
    popularity:  t.popularity || 0,
    duration_ms: t.duration_ms || 0,
    preview_url: t.preview_url,
    spotifyUrl:  `https://open.spotify.com/track/${t.id}`,
  };
}

// ── Audio features — REMOVED (Spotify deprecated Nov 2024) ──
export async function getAudioFeatures(_token, _trackId) { return null; }

// ── Estimated audio features from mood params ─────────────
export function estimateAudioFeatures(fusedParams) {
  if (!fusedParams) return null;
  const { valence = 0.5, energy = 0.5, minTempo = 90, maxTempo = 130 } = fusedParams;
  return {
    bpm:          Math.round((minTempo + maxTempo) / 2),
    energy:       parseFloat(energy.toFixed(2)),
    valence:      parseFloat(Math.max(0, Math.min(1, valence)).toFixed(2)),
    danceability: parseFloat(Math.min(1, energy * 0.75 + valence * 0.25).toFixed(2)),
    acousticness: parseFloat(Math.max(0, 1 - energy * 0.85).toFixed(2)),
    loudness:     parseFloat((-30 + energy * 25).toFixed(1)),
    key:          0,
    mode:         valence > 0.5 ? 1 : 0,
    estimated:    true,
  };
}

// ── Genre → search query mapping ──────────────────────────
const GENRE_QUERIES = {
  "happy":       ["happy hits", "feel good pop", "upbeat songs"],
  "sad":         ["sad songs", "emotional ballads", "heartbreak music"],
  "angry":       ["intense rock", "high energy metal", "aggressive beats"],
  "calm":        ["calm relaxing music", "peaceful instrumental", "acoustic chill"],
  "energetic":   ["high energy workout", "pump up songs", "energetic dance"],
  "surprised":   ["indie alternative", "eclectic music mix", "quirky indie"],
  "fearful":     ["dark ambient", "moody electronic", "atmospheric"],
  "neutral":     ["top hits", "popular songs", "trending music"],
  "focus":       ["focus study music", "deep work instrumental", "concentration"],
  "instrumental":["instrumental music", "classical study", "piano ambient"],
  "classical":   ["classical piano", "orchestra", "classical relaxation"],
  "ambient":     ["ambient chill", "atmospheric sounds", "ambient electronic"],
  "sleep":       ["sleep music", "sleep instrumental", "calm sleep"],
  "lo-fi":       ["lofi hip hop", "lofi study", "lofi chill"],
  "chill":       ["chill vibes", "chill out music", "relaxed chill"],
  "acoustic":    ["acoustic songs", "singer songwriter", "acoustic pop"],
  "folk":        ["folk music", "indie folk", "folk acoustic"],
  "pop":         ["popular pop songs", "top pop hits", "pop music"],
  "indie":       ["indie pop", "indie rock", "indie alternative"],
  "indie pop":   ["indie pop hits", "best indie pop", "indie pop songs"],
  "alternative": ["alternative rock", "alt rock hits", "alternative music"],
  "rock":        ["rock hits", "classic rock", "rock music"],
  "metal":       ["metal songs", "heavy metal", "metal rock"],
  "jazz":        ["jazz music", "smooth jazz", "jazz classics"],
  "r&b":         ["rnb songs", "r and b hits", "soul rnb"],
  "soul":        ["soul music", "classic soul", "neo soul"],
  "funk":        ["funk music", "funky songs", "classic funk"],
  "disco":       ["disco hits", "classic disco", "dance disco"],
  "dance":       ["dance music", "dance hits", "electronic dance"],
  "edm":         ["edm music", "electronic dance music", "edm bangers"],
  "electronic":  ["electronic music", "electronic hits", "synth electronic"],
  "hip-hop":     ["hip hop", "rap hits", "hip hop songs"],
  "latin":       ["latin hits", "latin pop", "reggaeton"],
  "tropical":    ["tropical house", "summer tropical", "tropical pop"],
  "summer":      ["summer hits", "summer songs", "best summer music"],
  "workout":     ["workout music", "gym motivation", "exercise hits"],
  "party":       ["party songs", "party hits", "party music"],
  "morning":     ["morning songs", "morning energy", "upbeat morning"],
  "upbeat":      ["upbeat pop", "happy upbeat music", "feel good hits"],
  "ballad":      ["beautiful ballads", "slow love songs", "emotional ballads"],
  "emotional":   ["emotional songs", "moving music", "deep emotional hits"],
  "dark":        ["dark music", "dark alternative", "dark electronic"],
  "nature":      ["nature sounds music", "relaxing nature", "forest ambient"],
  "soft pop":    ["soft pop songs", "mellow pop", "easy listening pop"],
  "eclectic":    ["eclectic music", "varied music mix", "diverse songs"],
};

function genreToQuery(genre) {
  const g = (genre || "pop").toLowerCase().trim();
  const queries = GENRE_QUERIES[g] || GENRE_QUERIES["neutral"];
  return queries[Math.floor(Math.random() * queries.length)];
}

// ── Recommendations ───────────────────────────────────────
export async function getRecommendations(token, params) {
  const { genres = ["pop"] } = params;
  const selectedGenres = [...new Set(genres)].slice(0, 3);

  // Build a rich pool of query terms mixing genres + mood
  const queries = [
    ...selectedGenres.map(g => genreToQuery(g)).filter(Boolean),
    `${params.mood || "popular"} music`,
    "top hits",
    "popular songs",
  ];

  const seen = new Set();
  const tracks = [];

  // Run all queries in parallel for speed
  const allResults = await Promise.all(
    queries.map(q => searchTracks(token, q, 10))
  );

  for (const results of allResults) {
    for (const t of results) {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        tracks.push(t);
      }
    }
  }

  return tracks.sort((a, b) => b.popularity - a.popularity).slice(0, 20);
}

// ── Current playback ──────────────────────────────────────
export async function getCurrentTrack(token) {
  const r = await api("GET", "/me/player/currently-playing", token);
  if (!r.ok || !r.data?.item) return null;
  const item = r.data.item;
  return {
    track_id:    item.id,
    title:       item.name,
    artist:      item.artists.map(a => a.name).join(", "),
    album:       item.album.name,
    album_art:   item.album.images?.[0]?.url,
    uri:         item.uri,
    is_playing:  r.data.is_playing,
    progress_ms: r.data.progress_ms,
    duration_ms: item.duration_ms,
  };
}

// ── Playback controls ─────────────────────────────────────
export async function transferPlayback(token, deviceId, play = false) {
  return api("PUT", "/me/player", token, { device_ids: [deviceId], play });
}
export async function playTrack(token, deviceId, uri) {
  return api("PUT", `/me/player/play?device_id=${deviceId}`, token, { uris: [uri] });
}
export async function getDevices(token) {
  const r = await api("GET", "/me/player/devices", token);
  return r.ok ? (r.data?.devices || []) : [];
}
export async function getAudioAnalysis(token, trackId) {
  const r = await api("GET", `/audio-analysis/${trackId}`, token);
  return r.ok ? r.data : null;
}
export async function getUserProfile(token) {
  const r = await api("GET", "/me", token);
  return r.ok ? r.data : null;
}