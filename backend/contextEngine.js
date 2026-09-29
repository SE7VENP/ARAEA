// ============================================================
// FILE: backend/contextEngine.js
// PURPOSE: Fuse sensor data + time + emotion into a context
//          then map context → Spotify audio feature targets
// ============================================================

// ── Environmental context rules ───────────────────────────
export function detectEnvironmentalContext(sensor) {
  const { temperature = 22, light = 300, motion = false } = sensor;
  const hour = new Date().getHours();

  // Night (22-6)
  if (hour >= 22 || hour < 6) {
    return light < 20 ? "night_sleep" : "night_active";
  }
  // Morning (6-11)
  if (hour >= 6 && hour < 11) {
    if (light > 200) return motion ? "morning_active" : "morning_calm";
    return "morning_calm";
  }
  // Afternoon (11-17)
  if (hour >= 11 && hour < 17) {
    if (temperature > 28) return "afternoon_hot";
    return motion ? "afternoon_work" : "afternoon_relax";
  }
  // Evening (17-22)
  if (hour >= 17 && hour < 22) {
    if (light < 50) return "evening_relax";
    return motion ? "evening_social" : "evening_relax";
  }
  return "default";
}

// ── Time-based mood (no sensors needed) ──────────────────
export function getTimeMood() {
  const h = new Date().getHours();
  if (h >= 6  && h < 9)  return "morning_energetic";
  if (h >= 9  && h < 12) return "work_focus";
  if (h >= 12 && h < 14) return "lunch_casual";
  if (h >= 14 && h < 17) return "afternoon_productive";
  if (h >= 17 && h < 20) return "evening_relax";
  if (h >= 20 && h < 22) return "evening_wind_down";
  return "night_sleep";
}

// ── Context → Spotify audio feature targets ───────────────
export const CONTEXT_MUSIC_MAP = {
  morning_active:       { valence:0.75, energy:0.75, minTempo:110, maxTempo:145, genres:["pop","indie pop","morning"] },
  morning_calm:         { valence:0.60, energy:0.45, minTempo:80,  maxTempo:115, genres:["acoustic","folk","soft pop"] },
  afternoon_work:       { valence:0.55, energy:0.55, minTempo:90,  maxTempo:130, genres:["indie","alternative","focus"] },
  afternoon_hot:        { valence:0.65, energy:0.60, minTempo:100, maxTempo:135, genres:["tropical","latin","summer"] },
  afternoon_relax:      { valence:0.55, energy:0.35, minTempo:70,  maxTempo:105, genres:["chill","lo-fi","ambient"] },
  evening_social:       { valence:0.70, energy:0.65, minTempo:100, maxTempo:140, genres:["pop","funk","disco"] },
  evening_relax:        { valence:0.50, energy:0.30, minTempo:65,  maxTempo:100, genres:["chill","jazz","ambient"] },
  evening_wind_down:    { valence:0.45, energy:0.25, minTempo:60,  maxTempo:90,  genres:["acoustic","classical","chill"] },
  night_sleep:          { valence:0.40, energy:0.15, minTempo:50,  maxTempo:80,  genres:["ambient","sleep","classical"] },
  night_active:         { valence:0.60, energy:0.50, minTempo:80,  maxTempo:115, genres:["indie","alternative","chill"] },
  work_focus:           { valence:0.50, energy:0.50, minTempo:85,  maxTempo:120, genres:["focus","instrumental","classical"] },
  morning_energetic:    { valence:0.75, energy:0.80, minTempo:120, maxTempo:150, genres:["pop","dance","energetic"] },
  lunch_casual:         { valence:0.65, energy:0.55, minTempo:95,  maxTempo:130, genres:["pop","r&b","soul"] },
  afternoon_productive: { valence:0.55, energy:0.60, minTempo:90,  maxTempo:130, genres:["indie","electronic","focus"] },
  default:              { valence:0.55, energy:0.50, minTempo:85,  maxTempo:120, genres:["pop","indie"] },
};

// ── Emotion → Spotify feature targets ────────────────────
export const EMOTION_MUSIC_MAP = {
  happy:    { valence:0.80, energy:0.75, minTempo:110, maxTempo:150, genres:["pop","happy","upbeat"] },
  sad:      { valence:0.20, energy:0.25, minTempo:55,  maxTempo:90,  genres:["sad","ballad","emotional"] },
  angry:    { valence:0.25, energy:0.85, minTempo:130, maxTempo:175, genres:["rock","metal","intense"] },
  calm:     { valence:0.55, energy:0.25, minTempo:60,  maxTempo:95,  genres:["ambient","chill","acoustic"] },
  energetic:{ valence:0.75, energy:0.90, minTempo:125, maxTempo:170, genres:["edm","dance","workout"] },
  surprised:{ valence:0.60, energy:0.70, minTempo:105, maxTempo:145, genres:["indie","alternative","eclectic"] },
  fearful:  { valence:0.30, energy:0.55, minTempo:80,  maxTempo:115, genres:["ambient","dark","electronic"] },
  neutral:  { valence:0.55, energy:0.50, minTempo:85,  maxTempo:125, genres:["pop","indie","alternative"] },
};

// ── Scene presets → full feature set ─────────────────────
export const SCENE_PRESETS = {
  focus:  { label:"Focus",  emoji:"🎯", valence:0.50, energy:0.50, minTempo:80,  maxTempo:120, genres:["focus","instrumental","classical","ambient"],  lightHue:200, lightBri:70,  lightSat:40  },
  relax:  { label:"Relax",  emoji:"🌿", valence:0.50, energy:0.30, minTempo:60,  maxTempo:100, genres:["chill","lo-fi","acoustic","ambient"],            lightHue:150, lightBri:50,  lightSat:60  },
  party:  { label:"Party",  emoji:"🎉", valence:0.85, energy:0.90, minTempo:120, maxTempo:180, genres:["dance","edm","pop","party"],                     lightHue:0,   lightBri:90,  lightSat:100 },
  sleep:  { label:"Sleep",  emoji:"🌙", valence:0.40, energy:0.15, minTempo:50,  maxTempo:75,  genres:["sleep","ambient","classical","nature"],           lightHue:25,  lightBri:20,  lightSat:60  },
  wakeup: { label:"Wake Up",emoji:"☀️", valence:0.75, energy:0.75, minTempo:110, maxTempo:150, genres:["morning","pop","energetic","upbeat"],             lightHue:50,  lightBri:90,  lightSat:70  },
  workout:{ label:"Workout",emoji:"💪", valence:0.70, energy:0.95, minTempo:130, maxTempo:180, genres:["workout","hip-hop","edm","rock"],                 lightHue:0,   lightBri:100, lightSat:100 },
  // Added: previously missing scenes (visualizer had them but music targeting didn't)
  jazz:   { label:"Jazz",   emoji:"🎷", valence:0.55, energy:0.45, minTempo:90,  maxTempo:140, genres:["jazz","smooth-jazz","jazz-fusion","bossanova"],    lightHue:35,  lightBri:55,  lightSat:50  },
  cosmic: { label:"Cosmic", emoji:"🌌", valence:0.45, energy:0.65, minTempo:110, maxTempo:150, genres:["ambient","psytrance","space-rock","electronic"],    lightHue:270, lightBri:60,  lightSat:90  },
};

// ── Master fusion: emotion + context + time → params ─────
export function fuseAllSources(userEmotion, envContext, activeScene = null) {
  // If a scene preset is active, it dominates
  if (activeScene && SCENE_PRESETS[activeScene]) {
    const s = SCENE_PRESETS[activeScene];
    return {
      valence:  s.valence,
      energy:   s.energy,
      minTempo: s.minTempo,
      maxTempo: s.maxTempo,
      genres:   s.genres,
      source:   "scene:" + activeScene,
    };
  }

  const emotionParams  = EMOTION_MUSIC_MAP[userEmotion]   || EMOTION_MUSIC_MAP.neutral;
  const contextParams  = CONTEXT_MUSIC_MAP[envContext]    || CONTEXT_MUSIC_MAP.default;
  const timeParams     = CONTEXT_MUSIC_MAP[getTimeMood()] || CONTEXT_MUSIC_MAP.default;

  // Weights: emotion 50%, environment 30%, time 20%
  const valence  = emotionParams.valence  * 0.50 + contextParams.valence  * 0.30 + timeParams.valence  * 0.20;
  const energy   = emotionParams.energy   * 0.50 + contextParams.energy   * 0.30 + timeParams.energy   * 0.20;
  const minTempo = Math.round(emotionParams.minTempo * 0.50 + contextParams.minTempo * 0.30 + timeParams.minTempo * 0.20);
  const maxTempo = Math.round(emotionParams.maxTempo * 0.50 + contextParams.maxTempo * 0.30 + timeParams.maxTempo * 0.20);

  // Merge genres (deduplicated)
  const genres = [...new Set([...emotionParams.genres.slice(0,2), ...contextParams.genres.slice(0,1)])];

  return { valence, energy, minTempo, maxTempo, genres, source: `${userEmotion}+${envContext}` };
}

// ── Mood label from valence+energy ───────────────────────
export function valenceEnergyToMood(valence, energy) {
  if (valence >= 0.65 && energy >= 0.70) return "euphoric";
  if (valence >= 0.55 && energy >= 0.40) return "happy";
  if (valence <= 0.35 && energy <= 0.35) return "sad";
  if (valence <= 0.45 && energy >= 0.55) return "tense";
  if (valence >= 0.40 && energy <= 0.45) return "calm";
  if (valence <= 0.45)                   return "melancholic";
  return "neutral";
}

// ── Light preset from mood ────────────────────────────────
export function moodToLight(mood) {
  const map = {
    euphoric:    { hue:0,     sat:254, bri:254, hex:"#FF4D00" },
    happy:       { hue:8000,  sat:200, bri:220, hex:"#FFD700" },
    calm:        { hue:46920, sat:160, bri:140, hex:"#00C9A7" },
    melancholic: { hue:46920, sat:220, bri:100, hex:"#8B5CF6" },
    tense:       { hue:65535, sat:254, bri:254, hex:"#EF4444" },
    sad:         { hue:43690, sat:180, bri:80,  hex:"#3B82F6" },
    neutral:     { hue:34952, sat:80,  bri:160, hex:"#94A3B8" },
  };
  return map[mood] || map.neutral;
}
