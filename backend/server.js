/**
 * ARAEA Stage 3 — Backend Entry Point
 *
 * This file wires together the application.
 * Business logic lives in services/, data models in data/,
 * route handlers in routes/, validation in middleware/.
 */
import express          from "express";
import { createServer } from "http";
import { Server }       from "socket.io";
import cors             from "cors";

import { CONFIG, IS_DEV }  from "./config/index.js";
import { errorHandler }    from "./middleware/errors.js";
import { rateLimit }       from "./middleware/rateLimit.js";

import { connectDB, isReady }              from "./services/DatabaseService.js";
import { setIO, emitInitialState, getState } from "./services/StateService.js";
import { startSensors, startBiometrics, stopSensors, isRunning } from "./services/SimulationService.js";
import { isActive as therapyActive }                              from "./services/TherapyService.js";

import { startOAuthServer, seedFromRefreshToken } from "./oauthServer.js";

// ── Route modules ─────────────────────────────────────────
import authRouter         from "./routes/auth.js";
import sensorsRouter      from "./routes/sensors.js";      // /api/state /api/sensors /api/simulation
import emotionRouter      from "./routes/emotion.js";      // /api/emotion/*
import spotifyRouter      from "./routes/spotify.js";      // /api/spotify/*
import historyRouter      from "./routes/history.js";      // /api/mood/history /api/songs/history /api/search
import therapyRouter      from "./routes/therapy.js";      // /api/therapy/*
import biometricRouter    from "./routes/biometric.js";    // /api/biometric/*
import multisensoryRouter from "./routes/multisensory.js"; // /api/multisensory/*
import voiceRouter        from "./routes/voice.js";        // /api/voice
import gestureRouter      from "./routes/gesture.js";      // /api/gesture
import communityRouter    from "./routes/community.js";    // /api/community/*
import insightsRouter     from "./routes/insights.js";     // /api/insights /api/scene /api/activity etc.
import debugRouter        from "./routes/debug.js";        // /api/debug/* (dev only)
import lyricsRouter       from "./routes/lyrics.js";       // /api/lyrics

// ── HTTP + Socket.IO ──────────────────────────────────────
const app  = express();
const http = createServer(app);
const io   = new Server(http, {
  cors: { origin: IS_DEV ? "*" : CONFIG.ALLOWED_ORIGINS },
});

setIO(io); // share io with StateService

// ── Global middleware ─────────────────────────────────────
app.use(cors({
  origin:         IS_DEV ? "*" : CONFIG.ALLOWED_ORIGINS,
  methods:        ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json({ limit: CONFIG.BODY_LIMIT }));

// ── Rate limiting ────────────────────────────────────────
// Generous limits for local development; tighten in production.
const generalLimit  = rateLimit({ max: 300, windowMs: 60_000 });
const emotionLimit  = rateLimit({ max:  60, windowMs: 60_000, message: "Emotion updates limited to 60/min" });
const webcamLimit   = rateLimit({ max:  40, windowMs: 60_000, message: "Webcam detection limited to 40/min" });

app.use("/api",               generalLimit);
app.use("/api/emotion",       emotionLimit);
app.use("/api/emotion/webcam",webcamLimit);

// ── Route mounting ────────────────────────────────────────
//    Prefix          Router            Handles
app.use("/auth",              authRouter);          // /auth/login /auth/token …
app.use("/api",               sensorsRouter);       // /api/state /api/sensors /api/simulation
app.use("/api/emotion",       emotionRouter);       // /api/emotion /api/emotion/manual …
app.use("/api/spotify",       spotifyRouter);       // /api/spotify/track-notify /api/spotify/queue …
app.use("/api",               historyRouter);       // /api/mood/history /api/songs/history /api/search
app.use("/api/therapy",       therapyRouter);       // /api/therapy/programs /api/therapy/start …
app.use("/api/biometric",     biometricRouter);     // /api/biometric /api/biometric/history
app.use("/api/multisensory",  multisensoryRouter);  // /api/multisensory /api/multisensory/:device
app.use("/api/voice",         voiceRouter);         // /api/voice
app.use("/api/gesture",       gestureRouter);       // /api/gesture
app.use("/api/community",     communityRouter);     // /api/community/profiles /api/community/share …
app.use("/api",               insightsRouter);      // /api/insights /api/scene /api/activity …

app.use("/api/lyrics",      lyricsRouter);      // /api/lyrics

if (IS_DEV) app.use("/api/debug", debugRouter);

// ── Health ────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  try {
    const s = getState();
    res.json({
      status:        "ok",
      version:       "stage3",
      mood:          s.mood,
      mongodb:       isReady(),
      spotify:       !!s.spotify,
      simRunning:    isRunning(),
      therapyActive: therapyActive(),
      clients:       io.engine.clientsCount,
      uptime:        `${Math.round(process.uptime())}s`,
      stage3: { biometrics:true, therapy:true, community:true, gesture:true, voice:true, multisensory:true },
    });
  } catch (e) {
    console.error("[Health] error:", e.message);
    res.status(500).json({ status: "error", error: e.message });
  }
});

// ── 404 + error handlers (always last) ───────────────────
app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use(errorHandler);

// ── Socket.IO ─────────────────────────────────────────────
io.on("connection", socket => emitInitialState(socket));

// ── Bootstrap ─────────────────────────────────────────────
async function bootstrap() {
  await connectDB();

  if (!CONFIG.SPOTIFY_CLIENT_ID || !CONFIG.SPOTIFY_CLIENT_SECRET) {
    console.warn("⚠  Spotify credentials missing — set them in backend/.env");
  }
  startOAuthServer(CONFIG.SPOTIFY_CLIENT_ID, CONFIG.SPOTIFY_CLIENT_SECRET);
  if (CONFIG.SPOTIFY_REFRESH_TOKEN) {
    seedFromRefreshToken(CONFIG.SPOTIFY_CLIENT_ID, CONFIG.SPOTIFY_CLIENT_SECRET, CONFIG.SPOTIFY_REFRESH_TOKEN);
  }

  startSensors();
  startBiometrics();

  http.listen(CONFIG.PORT, () => {
    console.log(`\n🎵  ARAEA Stage 3 Backend\n📡  http://127.0.0.1:${CONFIG.PORT}\n🔧  Mode: ${CONFIG.NODE_ENV}\n✅  All APIs active\n`);
  });
}

bootstrap();

// ── Graceful shutdown ─────────────────────────────────────
function shutdown(signal) {
  console.log(`[ARAEA] ${signal} — shutting down`);
  stopSensors();
  http.close(() => process.exit(0));
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
