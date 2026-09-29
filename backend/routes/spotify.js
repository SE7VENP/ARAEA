/**
 * /api/spotify routes
 *
 * Spotify-specific endpoints:
 *   POST /api/spotify/track-notify    Log a playing track to DB
 *   GET  /api/spotify/recommendations AI-mood recommendations
 *   GET  /api/spotify/queue           Current player queue
 */
import { Router }           from "express";
import { getValidToken }    from "../oauthServer.js";
import { getRecommendations } from "../spotifyService.js";
import { getState }         from "../services/StateService.js";
import { sanitizeText, isSpotifyUri } from "../middleware/validate.js";
import { saveRecord }       from "../services/DatabaseService.js";
import { fuseAllSources }   from "../contextEngine.js";
import { CONFIG }           from "../config/index.js";

const router = Router();

router.post("/track-notify", (req, res) => {
  const { trackId, title, artist, image, uri } = req.body ?? {};
  // Basic ID validation — Spotify track IDs are 22-char base62
  if (!trackId || typeof trackId !== "string" || !/^[A-Za-z0-9]{22}$/.test(trackId))
    return res.json({ ok: true }); // silently ignore invalid IDs
  if (uri && !isSpotifyUri(uri)) return res.json({ ok: true });
  const state = getState();
  saveRecord("song", {
    trackId,
    title:  sanitizeText(title,  200),
    artist: sanitizeText(artist, 200),
    image:  typeof image === "string" ? image.slice(0, 512) : null,
    uri:    uri ?? null,
    mood:   state.mood,
  });
  res.json({ ok: true });
});

router.get("/recommendations", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "")
      ?? await getValidToken(CONFIG.SPOTIFY_CLIENT_ID, CONFIG.SPOTIFY_CLIENT_SECRET);
    if (!token) return res.status(401).json({ tracks: [], error: "no_token" });
    const state = getState();
    const fused = fuseAllSources(state.emotion.label, state.sensor.context, state.activeScene);
    if (!fused.genres?.length) fused.genres = ["pop", "indie", "chill"];
    fused.mood = state.mood ?? "neutral";
    const recs = await getRecommendations(token, fused);
    state.recommendations = recs ?? [];
    res.json({ tracks: recs ?? [], mood: state.mood, genres: fused.genres });
  } catch (e) {
    console.error("[Recs]", e.message);
    res.json({ tracks: [] });
  }
});

router.get("/queue", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.json({ queue: [] });
    const r = await fetch("https://api.spotify.com/v1/me/player/queue", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return res.json({ queue: [] });
    const d = await r.json();
    const queue = (d.queue ?? []).slice(0, 5).map(t => ({
      uri: t.uri, id: t.id, name: t.name,
      artist:     t.artists?.map(a => a.name).join(", ") ?? "",
      image:      t.album?.images?.[2]?.url ?? t.album?.images?.[0]?.url,
      duration_ms: t.duration_ms,
      spotifyUrl:  `https://open.spotify.com/track/${t.id}`,
    }));
    res.json({ queue, currently_playing: d.currently_playing?.name ?? null });
  } catch { res.json({ queue: [] }); }
});

export default router;
