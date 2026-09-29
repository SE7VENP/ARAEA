// ============================================================
// FILE: backend/models/index.js
// PURPOSE: Mongoose schemas for MongoDB persistence
// ============================================================
import mongoose from "mongoose";

// ── Sensor Reading ────────────────────────────────────────
const SensorSchema = new mongoose.Schema({
  temperature: { type: Number, default: null },
  humidity:    { type: Number, default: null },
  light:       { type: Number, default: null },
  motion:      { type: Boolean, default: false },
  context:     { type: String, default: "unknown" },
  source:      { type: String, default: "esp32" },
  simulated:   { type: Boolean, default: true },
  timestamp:   { type: Date, default: Date.now },
});

// ── Mood History ──────────────────────────────────────────
const MoodHistorySchema = new mongoose.Schema({
  mood:      { type: String, required: true },
  emotion:   { type: String, default: "neutral" },
  intensity: { type: Number, default: 0 },
  valence:   { type: Number, default: 0 },
  energy:    { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now },
});

// ── Song Play Log ─────────────────────────────────────────
const SongPlaySchema = new mongoose.Schema({
  trackId:   { type: String, required: true },
  title:     { type: String, default: "" },
  artist:    { type: String, default: "" },
  mood:      { type: String, default: "neutral" },
  context:   { type: String, default: "default" },
  valence:   { type: Number, default: 0 },
  energy:    { type: Number, default: 0 },
  bpm:       { type: Number, default: 120 },
  timestamp: { type: Date, default: Date.now },
});

export const SensorData  = mongoose.model("SensorData",  SensorSchema);
export const MoodHistory = mongoose.model("MoodHistory", MoodHistorySchema);
export const SongPlayLog = mongoose.model("SongPlayLog", SongPlaySchema);
