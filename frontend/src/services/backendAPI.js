/**
 * backendAPI.js
 *
 * Every call to the ARAEA Node.js backend goes through this module.
 * No component or hook should use fetch() for backend calls directly.
 *
 * All functions return { data, error } — never throw.
 */
import { API } from "../constants/index.js";

async function request(method, path, body, signal) {
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
    const json = res.headers.get("content-type")?.includes("json")
      ? await res.json()
      : null;
    if (!res.ok) return { data: json, error: json?.error ?? `HTTP ${res.status}`, status: res.status };
    return { data: json, error: null, status: res.status };
  } catch (e) {
    if (e.name === "AbortError") return { data: null, error: "aborted" };
    return { data: null, error: e.message };
  }
}

const get    = (path, signal)        => request("GET",    path, undefined, signal);
const post   = (path, body, signal)  => request("POST",   path, body,      signal);

// ── Auth ──────────────────────────────────────────────────
export const auth = {
  getLoginUrl:  () => get("/auth/login"),
  getStatus:    () => get("/auth/status"),
  getToken:     () => get("/auth/token"),
  logout:       () => get("/auth/logout"),
};

// ── Emotion ───────────────────────────────────────────────
export const emotion = {
  setManual:   (emotion)           => post("/api/emotion/manual", { emotion }),
  setAuto:     (label, confidence, source) => post("/api/emotion", { label, confidence, source }),
  sendWebcam:  (frame, signal)     => post("/api/emotion/webcam", { frame }, signal),
};

// ── Scene ─────────────────────────────────────────────────
export const scenes = {
  set:   (scene) => post("/api/scene", { scene }),
  clear: ()      => post("/api/scene", { scene: null }),
};

// ── Sensors ───────────────────────────────────────────────
export const sensors = {
  push:     (data) => post("/api/sensors", data),
  simulate: (action) => post("/api/simulation", { action }),
};

// ── Biometrics ────────────────────────────────────────────
export const biometric = {
  push:       (data) => post("/api/biometric", data),
  getHistory: ()     => get("/api/biometric/history"),
};

// ── Therapy ───────────────────────────────────────────────
export const therapy = {
  getPrograms: ()     => get("/api/therapy/programs"),
  getHistory:  ()     => get("/api/therapy/history"),
  start:       (mode) => post("/api/therapy/start", { mode }),
  stop:        ()     => post("/api/therapy/stop"),
};

// ── Multi-sensory ─────────────────────────────────────────
export const multisensory = {
  get:       ()             => get("/api/multisensory"),
  updateDevice: (device, patch) => post(`/api/multisensory/${device}`, patch),
  updateAll: (patch)        => post("/api/multisensory", patch),
};

// ── Spotify pass-through ──────────────────────────────────
export const spotify = {
  notifyTrack:   (data)         => post("/api/spotify/track-notify", data),
  getQueue:      (token)        => get("/api/spotify/queue"),
  search:        (q, signal)    => get(`/api/search?q=${encodeURIComponent(q)}`, signal),
  getMoodHistory:()             => get("/api/mood/history"),
  getSongHistory:()             => get("/api/songs/history"),
};

// ── Community ─────────────────────────────────────────────
export const community = {
  getProfiles: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return get(`/api/community/profiles${qs ? "?" + qs : ""}`);
  },
  share:  (data)     => post("/api/community/share", data),
  like:   (id, delta)=> post(`/api/community/like/${id}`, { delta }),
  apply:  (id)       => post(`/api/community/apply/${id}`),
};

// ── Insights ──────────────────────────────────────────────
export const insights = {
  get:                ()        => get("/api/insights"),
  getActivityPresets: ()        => get("/api/activity/presets"),
  startActivity:      (id)      => post("/api/activity/start", { presetId: id }),
  getPresentationMoments: ()    => get("/api/presentation/moments"),
  applyMoment:        (id)      => post("/api/presentation/moment", { momentId: id }),
  getRoomPresets:     ()        => get("/api/room/presets"),
  applyRoom:          (id)      => post("/api/room/apply", { presetId: id }),
};

// ── Voice / Gesture ───────────────────────────────────────
export const voice   = { send: (transcript) => post("/api/voice",   { transcript }) };
export const gesture = { send: (gesture, confidence) => post("/api/gesture", { gesture, confidence }) };

// ── Health ────────────────────────────────────────────────
export const health  = { ping: () => get("/health") };
