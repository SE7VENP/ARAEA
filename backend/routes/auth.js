/**
 * /auth routes
 * Thin wrappers around the OAuthServer helpers.
 */
import { Router } from "express";
import { getValidToken, clearTokens } from "../oauthServer.js";
import { CONFIG } from "../config/index.js";

const router = Router();

router.get("/login", (_req, res) => {
  const params = new URLSearchParams({
    response_type: "code",
    client_id:     CONFIG.SPOTIFY_CLIENT_ID,
    scope:         CONFIG.SPOTIFY_SCOPE,
    redirect_uri:  CONFIG.SPOTIFY_REDIRECT_URI,
  });
  res.json({ url: `https://accounts.spotify.com/authorize?${params}` });
});

router.get("/status", async (_req, res) => {
  const token = await getValidToken(CONFIG.SPOTIFY_CLIENT_ID, CONFIG.SPOTIFY_CLIENT_SECRET).catch(() => null);
  res.json({ logged_in: !!token });
});

router.get("/token", async (_req, res) => {
  const token = await getValidToken(CONFIG.SPOTIFY_CLIENT_ID, CONFIG.SPOTIFY_CLIENT_SECRET).catch(() => null);
  res.json({ access_token: token ?? null });
});

router.get("/logout", (_req, res) => {
  clearTokens();
  res.json({ ok: true });
});

/**
 * GET /auth/me
 * Proxies Spotify /me to give the frontend the user's country (market)
 * without exposing the access token. Used to fix 400 errors on search.
 */
router.get("/me", async (_req, res) => {
  const token = await getValidToken(CONFIG.SPOTIFY_CLIENT_ID, CONFIG.SPOTIFY_CLIENT_SECRET).catch(() => null);
  if (!token) return res.status(401).json({ error: "no_token" });
  try {
    const r = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return res.status(r.status).json({ error: "spotify_error" });
    const d = await r.json();
    // Only forward safe, non-sensitive fields
    res.json({ country: d.country, product: d.product, display_name: d.display_name });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
