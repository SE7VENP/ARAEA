/**
 * /api/lyrics — proxy route that delegates to the multi-source lyricsAPI.
 * Centralises lyrics fetching on the backend so the frontend has a single,
 * consistent endpoint regardless of which external service is used.
 *
 * Fix 2.3 — corrected: import name is getLyrics (not fetchLyrics), and
 * argument order is (artist, title) to match backend/lyricsAPI.js signature.
 */
import { Router } from "express";
import { getLyrics } from "../lyricsAPI.js"; // backend exports getLyrics, not fetchLyrics

const router = Router();

router.get("/", async (req, res) => {
  const { title, artist } = req.query;
  if (!title || !artist) {
    return res.status(400).json({ error: "Missing required query params: title, artist" });
  }
  try {
    const lyrics = await getLyrics(artist, title); // (artist, title) — matches lyricsAPI.js signature
    res.json({ lyrics: lyrics ?? null, found: !!lyrics });
  } catch (error) {
    console.error("[lyrics route] fetch failed:", error.message);
    res.status(500).json({ error: "Lyrics fetch failed", lyrics: null });
  }
});

export default router;
