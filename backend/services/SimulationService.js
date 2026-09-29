/**
 * SimulationService
 *
 * Generates synthetic sensor and biometric data for demo purposes.
 * Real hardware overrides via POST /api/sensors and POST /api/biometric.
 */
import { getState, mergeState, emit } from "./StateService.js";
import { saveRecord } from "./DatabaseService.js";
import { detectEnvironmentalContext } from "../contextEngine.js";
import { runPipeline } from "./PipelineService.js";

const SENSOR_PROFILES = [
  { temperature:20, humidity:60, light:520, motion:true  },
  { temperature:24, humidity:50, light:380, motion:false },
  { temperature:26, humidity:55, light:75,  motion:true  },
  { temperature:21, humidity:58, light:8,   motion:false },
];

const MOOD_BASE_HR = { euphoric:95, happy:80, calm:65, melancholic:72, tense:105, sad:68, neutral:72 };

let _sensorTimer    = null;
let _bioTimer       = null;
let _sensorIdx      = 0;
let _isRunning      = false;

// ── Sensor simulation ──────────────────────────────────────

export function startSensors() {
  if (_sensorTimer) return;
  _isRunning = true;
  _sensorTimer = setInterval(_tickSensor, 45_000);
}

export function stopSensors() {
  clearInterval(_sensorTimer);
  _sensorTimer = null;
  _isRunning   = false;
}

export function cycleSensors() {
  _sensorIdx++;
  stopSensors();
  startSensors();
}

export function isRunning() { return _isRunning; }

export function updateSensor(data) {
  const state = getState();
  state.sensor = { ...state.sensor, ...data };
  state.sensor.context = detectEnvironmentalContext(state.sensor);
  emit("sensor_update", state.sensor);
  runPipeline();
  saveRecord("sensor", { ...state.sensor });
}

function _tickSensor() {
  const p = SENSOR_PROFILES[_sensorIdx % SENSOR_PROFILES.length];
  _sensorIdx++;
  updateSensor({
    temperature: p.temperature + (Math.random() - 0.5) * 2,
    humidity:    p.humidity    + (Math.random() - 0.5) * 4,
    light:       Math.max(0, p.light + (Math.random() - 0.5) * 40),
    motion:      p.motion,
    simulated:   true,
  });
}

// ── Biometric simulation ───────────────────────────────────

export function startBiometrics() {
  if (_bioTimer) return;
  _bioTimer = setInterval(_tickBio, 2_000);
}

function _tickBio() {
  const state    = getState();
  const baseHR   = MOOD_BASE_HR[state.mood] ?? 72;
  const newHR    = Math.max(50, Math.min(140, baseHR + (Math.random() - 0.5) * 6));
  const stress   = state.therapy.active
    ? Math.max(5, state.biometric.stressScore - 2)
    : state.mood === "tense" ? Math.min(90, state.biometric.stressScore + 1)
    : state.mood === "calm"  ? Math.max(10, state.biometric.stressScore - 1)
    : state.biometric.stressScore + (Math.random() - 0.5) * 3;

  mergeState({
    biometric: {
      heartRate:       parseFloat(newHR.toFixed(1)),
      hrv:             parseFloat((30 + (100 - Math.min(100, stress)) * 0.4 + Math.random() * 5).toFixed(1)),
      stressScore:     parseFloat(Math.max(0, Math.min(100, stress)).toFixed(1)),
      coherence:       parseFloat(Math.max(0.1, Math.min(1, 1 - stress / 120 + Math.random() * 0.05)).toFixed(2)),
      breathRate:      parseFloat((14 + (stress / 50) + Math.random()).toFixed(1)),
      skinConductance: parseFloat((0.1 + stress / 200 + Math.random() * 0.05).toFixed(3)),
      source:          "simulated",
      trend:           stress > 60 ? "elevated" : stress < 30 ? "relaxed" : "stable",
    },
  });
  emit("biometric_update", state.biometric);
}
