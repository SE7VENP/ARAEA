/**
 * DatabaseService
 *
 * Wraps MongoDB access.  Falls back to an in-memory ring buffer when the
 * database is unavailable.  All callers use the same async interface so
 * the storage layer can be swapped without touching route code.
 */
import { CONFIG } from "../config/index.js";

// In-memory fallback store
const mem = {
  sensors:   [],
  moods:     [],
  songs:     [],
  therapy:   [],
  community: [],
};

const MAX_MEM_ITEMS = 200;

function memPush(arr, item) {
  arr.unshift(item);
  if (arr.length > MAX_MEM_ITEMS) arr.pop();
}

// Mongoose models (resolved after async connect)
let dbReady    = false;
let SensorData = null;
let MoodHistory = null;
let SongPlayLog = null;

export async function connectDB() {
  try {
    const mongoose = await import("mongoose");
    await mongoose.default.connect(CONFIG.MONGO_URI, { serverSelectionTimeoutMS: 3000 });
    const models = await import("../models/index.js");
    SensorData  = models.SensorData;
    MoodHistory = models.MoodHistory;
    SongPlayLog = models.SongPlayLog;
    dbReady = true;
    console.log("[DB] ✅ MongoDB connected");
  } catch {
    console.warn("[DB] MongoDB offline — using in-memory fallback");
  }
}

export function isReady() { return dbReady; }
export function getMemory() { return mem; }

export async function saveRecord(type, data) {
  const row = { ...data, timestamp: new Date() };
  const ModelMap = { sensor: SensorData, mood: MoodHistory, song: SongPlayLog };
  const ArrMap   = { sensor: mem.sensors, mood: mem.moods, song: mem.songs };

  memPush(ArrMap[type] ?? mem.moods, row);
  if (dbReady && ModelMap[type]) {
    try { await ModelMap[type].create(row); } catch {}
  }
}

export async function fetchRecords(type, limit = 50) {
  const ModelMap = { mood: MoodHistory, song: SongPlayLog, sensor: SensorData };
  const ArrMap   = { mood: mem.moods,   song: mem.songs,   sensor: mem.sensors };

  if (dbReady && ModelMap[type]) {
    try { return await ModelMap[type].find().sort({ timestamp: -1 }).limit(limit); }
    catch {}
  }
  return (ArrMap[type] ?? []).slice(0, limit);
}
