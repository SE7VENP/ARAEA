/**
 * PipelineService
 *
 * Runs the AI mood-fusion pipeline:
 *   sensor context × emotion × scene → mood → lighting → emit
 *
 * Uses hysteresis to avoid rapid mood flickering:
 * a new mood must be detected twice in a row before it replaces the current one.
 */
import {
  fuseAllSources, valenceEnergyToMood, moodToLight, getTimeMood,
} from "../contextEngine.js";
import { getValidToken } from "../oauthServer.js";
import { getCurrentTrack, estimateAudioFeatures } from "../spotifyService.js";
import { getState, mergeState, emitState, emit, setState } from "./StateService.js";
import { saveRecord } from "./DatabaseService.js";
import { CONFIG } from "../config/index.js";

let _busy = false;

const MOOD_SCENT_MAP = {
  calm:"lavender", focus:"peppermint", euphoric:"citrus",
  tense:"eucalyptus", happy:"vanilla", sad:"rose",
  melancholic:"sandalwood", neutral:"cedar",
};

function autoAdjustMultisensory(mood, biometric) {
  const state = getState();
  const ms    = state.multisensory;
  if (ms.fan.mode === "auto")    ms.fan.speed    = biometric.stressScore > 70 ? 3 : biometric.stressScore > 45 ? 2 : 1;
  if (ms.blinds.mode === "auto") ms.blinds.position = (new Date().getHours() >= 7 && new Date().getHours() < 19)
    ? (mood === "focus" ? 80 : 60) : 0;
  if (ms.diffuser.active) ms.diffuser.scent = MOOD_SCENT_MAP[mood] ?? "cedar";
  if (ms.temp.mode === "auto")   ms.temp.target = mood === "focus" ? 20 : mood === "sleep" ? 19 : mood === "workout" ? 18 : 22;
}

export async function runPipeline() {
  if (_busy) return;
  _busy = true;
  try {
    const state  = getState();
    const fused  = fuseAllSources(state.emotion.label, state.sensor.context, state.activeScene);
    const mood   = valenceEnergyToMood(fused.valence, fused.energy);
    const range  = Math.SQRT2 / 2;
    const intensity = Math.min(1, Math.sqrt((fused.valence - 0.5) ** 2 + (fused.energy - 0.5) ** 2) / range);
    const lighting  = moodToLight(mood);

    // Hysteresis: only accept a mood change when seen twice in a row
    if (mood !== state.mood) {
      if (state._moodCandidate === mood) {
        state.mood           = mood;
        state._moodCandidate = null;
      } else {
        state._moodCandidate = mood;
      }
    } else {
      state._moodCandidate = null;
    }

    mergeState({ intensity: parseFloat(intensity.toFixed(3)), lighting, fusedParams: fused, timeMood: getTimeMood() });
    autoAdjustMultisensory(state.mood, state.biometric);

    // Optionally pull Spotify track data for richer fused params
    const token = await getValidToken(CONFIG.SPOTIFY_CLIENT_ID, CONFIG.SPOTIFY_CLIENT_SECRET).catch(() => null);
    if (token) {
      try {
        const track = await getCurrentTrack(token);
        if (track) {
          const features = estimateAudioFeatures(fused);
          setState("spotify", { ...track, ...features });
          emit("track_update", state.spotify);
        }
      } catch {}
    }

    // Emit changed fields only (never _moodCandidate)
    emitState({ mood: state.mood, intensity: state.intensity, lighting: state.lighting, fusedParams: fused, timeMood: state.timeMood, activeScene: state.activeScene, sensor: state.sensor, emotion: state.emotion });

    // Persist mood snapshot
    const row = { mood: state.mood, emotion: state.emotion.label, intensity: state.intensity };
    await saveRecord("mood", row);

  } finally {
    _busy = false;
  }
}
