/**
 * /api history routes
 *
 * Mounted at /api so these paths resolve to:
 *   GET /api/mood/history
 *   GET /api/songs/history
 *   GET /api/search          ← backend Spotify search proxy
 */
import { Router }    from "express";
import { getValidToken }    from "../oauthServer.js";
import { searchTracks }     from "../spotifyService.js";
import { fetchRecords }     from "../services/DatabaseService.js";
import { CONFIG }           from "../config/index.js";

const router = Router();

router.get("/mood/history", async (_req, res) => {
  const data = await fetchRecords("mood");
  res.json({ data });
});

router.get("/songs/history", async (_req, res) => {
  const data = await fetchRecords("song");
  res.json({ data });
});

router.get("/search", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q?.trim()) return res.json({ tracks: [] });

    const token = req.headers.authorization?.replace("Bearer ", "").trim()
      || await getValidToken(CONFIG.SPOTIFY_CLIENT_ID, CONFIG.SPOTIFY_CLIENT_SECRET);

    if (!token) {
      console.warn("[Search] No token available");
      return res.status(401).json({ tracks: [] });
    }

    console.log(`[Search] Query: "${q}" | token: ${token.slice(0,10)}...`);

    const tracks = await searchTracks(token, String(q).slice(0, 100), 20);

    console.log(`[Search] Results: ${tracks.length} tracks`);
    res.json({ tracks });
  } catch (e) {
    console.error("[Search] Error:", e.message);
    res.json({ tracks: [] });
  }
});

export default router;