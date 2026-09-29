/**
 * ARAEA Backend – Centralised Configuration
 *
 * All env-var access lives here.  No other file should read process.env directly.
 * This makes it trivial to swap to a secrets manager later.
 */
import "dotenv/config";

function requireEnv(name) {
  const v = process.env[name];
  if (!v) console.warn(`[Config] ⚠  ${name} is not set – some features will be disabled`);
  return v ?? "";
}

export const CONFIG = Object.freeze({
  PORT:            Number(process.env.PORT) || 3001,
  NODE_ENV:        process.env.NODE_ENV || "development",

  // Spotify OAuth
  SPOTIFY_CLIENT_ID:     requireEnv("SPOTIFY_CLIENT_ID"),
  SPOTIFY_CLIENT_SECRET: requireEnv("SPOTIFY_CLIENT_SECRET"),
  SPOTIFY_REFRESH_TOKEN: process.env.SPOTIFY_REFRESH_TOKEN || "",
  // Allow override via SPOTIFY_REDIRECT_URI env var.
  // Must EXACTLY match what is registered in the Spotify Dashboard.
  // Default: http://127.0.0.1:8888/callback
  // Override: add SPOTIFY_REDIRECT_URI=http://localhost:8888/callback to backend/.env
  SPOTIFY_REDIRECT_URI:  process.env.SPOTIFY_REDIRECT_URI || "http://127.0.0.1:8888/callback",
  SPOTIFY_SCOPE: [
    "streaming", "user-read-email", "user-read-private",
    "user-read-currently-playing", "user-read-playback-state",
    "user-modify-playback-state", "user-read-recently-played",
    "playlist-read-private", "playlist-read-collaborative",
  ].join(" "),

  // Database
  MONGO_URI: process.env.MONGODB_URI || "mongodb://localhost:27017/araea",

  // CORS – comma-separated origins in production
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map(s => s.trim())
    : ["http://localhost:5173", "http://127.0.0.1:5173"],

  // Body size cap (prevents accidental or malicious large payloads)
  BODY_LIMIT: "50kb",
});

export const IS_PROD = CONFIG.NODE_ENV === "production";
export const IS_DEV  = !IS_PROD;
