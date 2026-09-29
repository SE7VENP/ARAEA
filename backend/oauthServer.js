// ============================================================
// FILE: backend/oauthServer.js
// PURPOSE: Spotify OAuth 2.0 — clean rewrite
//
// FIX: 400 token exchange error caused by:
//   1. redirect_uri mismatch (localhost vs 127.0.0.1)
//   2. Port 8888 EADDRINUSE if server restarts
//   3. No logging of actual Spotify error message
// ============================================================
import express  from "express";
import { createServer } from "http";
import axios    from "axios";

export const tokenStore = { access_token:null, refresh_token:null, expires_at:0 };

// Try both redirect_uri variants — Spotify requires EXACT match with what's in your app
// User may have registered either http://localhost:8888/callback or http://127.0.0.1:8888/callback
const REDIRECT_URIS = [
  "http://127.0.0.1:8888/callback",
  "http://localhost:8888/callback",
];

// ── Token exchange (tries both redirect_uri variants) ────
async function exchangeAuthCode(clientId, clientSecret, code) {
  for (const redirectUri of REDIRECT_URIS) {
    try {
      const r = await axios.post(
        "https://accounts.spotify.com/api/token",
        new URLSearchParams({
          grant_type:   "authorization_code",
          code,
          redirect_uri: redirectUri,
        }),
        {
          auth:    { username: clientId, password: clientSecret },
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          validateStatus: () => true, // don't throw on 4xx
        }
      );

      if (r.status === 200 && r.data.access_token) {
        tokenStore.access_token  = r.data.access_token;
        tokenStore.refresh_token = r.data.refresh_token;
        tokenStore.expires_at    = Date.now() + (r.data.expires_in - 60) * 1000;
        console.log(`[OAuth] ✅ Tokens stored (redirect_uri: ${redirectUri})`);
        return { ok: true, token: r.data.access_token };
      }

      // Log the actual Spotify error for debugging
      const errMsg = r.data?.error_description || r.data?.error || `HTTP ${r.status}`;
      console.warn(`[OAuth] ⚠ ${redirectUri} → ${errMsg}`);

      // If it's a redirect_uri mismatch, try next one
      if (r.data?.error === "invalid_grant" && r.data?.error_description?.includes("redirect")) continue;
      // For other errors, still try next URI
    } catch (e) {
      console.warn(`[OAuth] Network error with ${redirectUri}: ${e.message}`);
    }
  }
  return { ok: false, error: "Token exchange failed — check Client ID / Secret in backend/.env and ensure Redirect URI is set in Spotify Dashboard" };
}

// ── OAuth callback server on :8888 ───────────────────────
let oauthServerInstance = null;

export function startOAuthServer(clientId, clientSecret) {
  if (!clientId) {
    console.warn("[OAuth] No CLIENT_ID — Spotify login disabled. Set it in backend/.env");
    return;
  }

  const app = express();

  app.get("/callback", async (req, res) => {
    const { code, error, error_description } = req.query;

    if (error || !code) {
      const msg = error_description || error || "No code received";
      console.error("[OAuth] ❌ Auth denied:", msg);
      return res.send(`<html><body style="font:16px sans-serif;padding:40px;background:#1a1a2e;color:#fff">
        <h2>❌ Spotify Auth Failed</h2>
        <p style="color:#f87171">${msg}</p>
        <p style="color:#94a3b8;font-size:14px">Close this tab and try again.</p>
      </body></html>`);
    }

    const result = await exchangeAuthCode(clientId, clientSecret, code);

    if (!result.ok) {
      console.error("[OAuth] ❌ Token exchange failed:", result.error);
      return res.send(`<html><body style="font:16px sans-serif;padding:40px;background:#1a1a2e;color:#fff">
        <h2>❌ Token Exchange Failed</h2>
        <p style="color:#f87171;font-size:14px">${result.error}</p>
        <hr style="border-color:#334155;margin:20px 0">
        <p style="color:#94a3b8;font-size:13px">
          <strong style="color:#fff">Checklist:</strong><br>
          1. Client ID and Secret in <code style="color:#60a5fa">backend/.env</code> are correct<br>
          2. Redirect URI in <a href="https://developer.spotify.com/dashboard" style="color:#1DB954">Spotify Dashboard</a> 
             is set to: <code style="color:#60a5fa">http://127.0.0.1:8888/callback</code><br>
          3. Also add: <code style="color:#60a5fa">http://localhost:8888/callback</code> (as a second URI)<br>
          4. Restart the backend after editing .env
        </p>
        <p style="margin-top:20px"><a href="#" onclick="window.close()" 
           style="padding:8px 16px;background:#334155;color:#fff;border-radius:6px;text-decoration:none">Close Tab</a></p>
      </body></html>`);
    }

    res.send(`<html><body style="font:16px sans-serif;padding:40px;background:#1a1a2e;color:#fff">
      <h2 style="color:#1DB954">✅ Connected to Spotify!</h2>
      <p style="color:#94a3b8">Close this tab and return to the ARAEA dashboard.</p>
      <script>
        if(window.opener){
          window.opener.postMessage({type:'spotify_token',token:'${result.token}'},'*');
          setTimeout(()=>window.close(),800);
        } else {
          window.location.href='http://localhost:5173#spotify_token=${result.token}';
        }
      </script>
    </body></html>`);
  });

  // Prevent EADDRINUSE crash if port is already in use (e.g. backend restart)
  const server = createServer(app);
  server.on("error", (e) => {
    if (e.code === "EADDRINUSE") {
      console.warn("[OAuth] Port 8888 already in use — OAuth server not restarted (existing one still works)");
    } else {
      console.error("[OAuth] Server error:", e.message);
    }
  });
  server.listen(8888, "0.0.0.0", () => {
    // Listen on 0.0.0.0 so BOTH localhost and 127.0.0.1 requests are caught
    console.log("[OAuth] ✅ Callback server on :8888 (accepts localhost + 127.0.0.1)");
  });
  oauthServerInstance = server;
}

// ── Public helpers ───────────────────────────────────────
export async function exchangeCode(clientId, clientSecret, code) {
  const result = await exchangeAuthCode(clientId, clientSecret, code);
  return result.ok;
}

export async function getValidToken(clientId, clientSecret) {
  if (!tokenStore.access_token) return null;
  if (Date.now() < tokenStore.expires_at) return tokenStore.access_token;
  if (!tokenStore.refresh_token) return null;
  try {
    const r = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({ grant_type:"refresh_token", refresh_token:tokenStore.refresh_token }),
      {
        auth:    { username:clientId, password:clientSecret },
        headers: { "Content-Type":"application/x-www-form-urlencoded" },
        validateStatus: () => true,
      }
    );
    if (r.status !== 200) {
      console.warn("[OAuth] Token refresh failed:", r.data?.error_description || r.status);
      tokenStore.access_token = null;
      return null;
    }
    tokenStore.access_token = r.data.access_token;
    tokenStore.expires_at   = Date.now() + (r.data.expires_in - 60) * 1000;
    if (r.data.refresh_token) tokenStore.refresh_token = r.data.refresh_token;
    console.log("[OAuth] 🔄 Token refreshed");
    return tokenStore.access_token;
  } catch (e) {
    console.error("[OAuth] Refresh error:", e.message);
    tokenStore.access_token = null;
    return null;
  }
}

export async function seedFromRefreshToken(clientId, clientSecret, refreshToken) {
  if (!refreshToken) return;
  tokenStore.refresh_token = refreshToken;
  tokenStore.expires_at    = 0;
  await getValidToken(clientId, clientSecret);
}

export function clearTokens() {
  tokenStore.access_token = tokenStore.refresh_token = null;
  tokenStore.expires_at   = 0;
  console.log("[OAuth] Tokens cleared");
}
