/**
 * spotifyAPI.js
 *
 * All Spotify Web API REST calls.  No SDK logic here — that lives in useSpotify.
 * Token is always passed in; this module has no state.
 *
 * All functions return { data, error } — never throw.
 */

const BASE = "https://api.spotify.com/v1";

// ── Market note ───────────────────────────────────────────
// DO NOT pass market= to the search endpoint when using Authorization Code Flow
// tokens (which this app uses). For user-authenticated tokens Spotify automatically
// infers the market from the account's country. Passing market= explicitly with
// user tokens causes "Invalid limit" / 400 errors in restricted regions (e.g. India).
// market= is only needed for Client Credentials tokens (no user context).
//
// resetMarketCache is exported as a no-op for backwards-compat with useSpotify.js
export function resetMarketCache() {}

async function spFetch(method, url, token, body, signal) {
  if (!token) return { data: null, error: "no_token" };
  const full = url.startsWith("http") ? url : `${BASE}${url}`;
  try {
    // Do NOT send Content-Type on GET/DELETE requests — no body present.
    // Spotify's API misparsed query-string params when Content-Type is set
    // on bodyless requests, returning 400 "Invalid limit" even for valid values.
    const headers = { Authorization: `Bearer ${token}` };
    if (body) headers["Content-Type"] = "application/json";
    const res = await fetch(full, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
    if (res.status === 204) return { data: null, error: null, ok: true };
    const ct = res.headers.get("content-type") ?? "";
    const data = ct.includes("json") ? await res.json() : null;
    if (!res.ok) {
      // Log the actual Spotify error message to help with debugging
      if (import.meta.env.DEV) {
        console.warn(`[SpotifyAPI] ${method} ${url} → ${res.status}`, data?.error ?? "");
      }
      return { data: null, error: data?.error?.message ?? null, status: res.status, ok: false };
    }
    return { data, error: null, ok: true };
  } catch (e) {
    if (e.name === "AbortError") return { data: null, error: "aborted" };
    return { data: null, error: e.message, ok: false };
  }
}

const get  = (url, token, signal) => spFetch("GET",  url, token, undefined, signal);
const put  = (url, token, body)   => spFetch("PUT",  url, token, body);
const post = (url, token)         => spFetch("POST", url, token);

// ── Player ────────────────────────────────────────────────
export const player = {
  getState:    (token)              => get("/me/player", token),
  play:        (token, deviceId, body) => put(`/me/player/play${deviceId ? `?device_id=${deviceId}` : ""}`, token, body),
  pause:       (token, deviceId)    => put(`/me/player/pause${deviceId ? `?device_id=${deviceId}` : ""}`, token),
  next:        (token, deviceId)    => post(`/me/player/next${deviceId ? `?device_id=${deviceId}` : ""}`, token),
  prev:        (token, deviceId)    => post(`/me/player/previous${deviceId ? `?device_id=${deviceId}` : ""}`, token),
  setVolume:   (token, vol, deviceId) => put(`/me/player/volume?volume_percent=${vol}${deviceId ? `&device_id=${deviceId}` : ""}`, token),
  setShuffle:  (token, state)       => put(`/me/player/shuffle?state=${state}`, token),
  setRepeat:   (token, state)       => put(`/me/player/repeat?state=${state}`, token),
  transferTo:  (token, deviceId, play) => put("/me/player", token, { device_ids: [deviceId], play: !!play }),
  getQueue:    (token)              => get("/me/player/queue", token),
};

// ── Backend proxy base ────────────────────────────────────
// Search calls go through the ARAEA backend (/api/search) to avoid 400 errors
// that occur when the browser calls Spotify search directly. Spotify's servers
// reject browser-origin search requests for free accounts in some regions (India).
// Server-to-server calls from the backend are not affected.
const BACKEND_BASE = "http://127.0.0.1:3001";

// ── Search ────────────────────────────────────────────────
export const search = {
  /**
   * Search tracks via the backend proxy (/api/search).
   * This avoids the 400 "Invalid limit" error that Spotify returns when
   * the browser calls the search endpoint directly with free-tier tokens
   * in restricted regions (e.g. India).
   */
  tracks: async (token, query, limit = 20, signal) => {
    try {
      const res = await fetch(
        `${BACKEND_BASE}/api/search?q=${encodeURIComponent(query)}`,
        { headers: { Authorization: `Bearer ${token}` }, signal }
      );
      if (!res.ok) return { data: null, error: `HTTP ${res.status}`, ok: false };
      const json = await res.json();
      // Normalise backend response ({ tracks: [...] }) to match Spotify shape
      // ({ tracks: { items: [...] } }) so callers don't need to change
      const items = json?.tracks ?? [];
      return {
        data: { tracks: { items: items } },
        error: null,
        ok: true,
      };
    } catch (e) {
      if (e.name === "AbortError") return { data: null, error: "aborted" };
      return { data: null, error: e.message, ok: false };
    }
  },
};

// ── User ──────────────────────────────────────────────────
export const user = {
  getRecentlyPlayed: (token, limit = 20) => get(`/me/player/recently-played?limit=${limit}`, token),
};

// ── Track helpers ─────────────────────────────────────────

/** Normalise a Spotify track object to a consistent shape.
 *  Handles both /me/player API shape and SDK track_window shape.
 */
export function normaliseTrack(t) {
  if (!t) return null;
  // SDK shape: linked_from may carry the real URI in some markets
  const uri = t.linked_from?.uri ?? t.uri ?? (t.id ? `spotify:track:${t.id}` : null);
  const id  = t.id ?? t.linked_from?.id ?? uri?.split(":")[2] ?? null;
  return {
    id,
    uri,
    name:        t.name ?? "",
    artist:      t.artists?.map(a => a.name).join(", ") ?? "",
    image:       t.album?.images?.[1]?.url ?? t.album?.images?.[0]?.url ?? null,
    duration_ms: t.duration_ms ?? 0,
    popularity:  t.popularity ?? 0,
    spotifyUrl:  id ? `https://open.spotify.com/track/${id}` : "",
  };
}

/** Deduplicate a list of tracks by id. */
export function dedupTracks(tracks) {
  const seen = new Set();
  return tracks.filter(t => t?.id && !seen.has(t.id) && seen.add(t.id));
}