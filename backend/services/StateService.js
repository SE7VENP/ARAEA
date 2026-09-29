/**
 * StateService
 *
 * Single source of truth for the live application state.
 * All mutations go through this service so the Socket.IO emit
 * logic is in one place (and _moodCandidate is never leaked).
 *
 * Consumers:
 *   - Routes call setState / merge / emitCurrent
 *   - PipelineService calls merge after running the fusion algorithm
 */
import { getTimeMood } from "../contextEngine.js";

// ── Initial state ─────────────────────────────────────────
let _state = {
  sensor:   { temperature:22, humidity:55, light:300, motion:false, context:"default", simulated:true },
  emotion:  { label:"neutral", confidence:1.0, valence:0.5, arousal:0.5, source:"manual" },
  mood:     "neutral",
  intensity: 0.5,
  spotify:  null,
  recommendations: [],
  activeScene: null,
  lighting: { hex:"#64748B" },
  fusedParams: null,
  timeMood: getTimeMood(),
  biometric: {
    heartRate:72, hrv:45, stressScore:32, coherence:0.68,
    breathRate:16, skinConductance:0.3, source:"simulated", trend:"stable",
  },
  therapy: {
    active:false, mode:null, sessionStart:null, phase:"idle",
    breathPhase:"inhale", breathProgress:0, sessionDuration:0,
  },
  gestures:    { lastGesture:null, confidence:0, history:[] },
  multisensory: {
    diffuser: { active:false, scent:"lavender",      intensity:50           },
    fan:      { active:false, speed:2,               mode:"auto"            },
    blinds:   { position:100, mode:"auto"                                   },
    temp:     { target:22,    current:22,            mode:"auto"            },
    curtain:  { position:100                                                 },
    speaker:  { volume:70,    bass:50,               treble:50              },
    ledStrip: { active:true,  color:"#00e5ff",       brightness:80, mode:"reactive" },
    hueGroup: { active:true,  scene:"concentrate",   brightness:75          },
  },
  simRunning: true,
  // Internal — never emitted to clients
  _moodCandidate: null,
};

// Socket.IO instance (injected at server start)
let _io = null;

export function setIO(io) { _io = io; }

/** Read the current state. Returns a reference — do not mutate directly. */
export function getState() { return _state; }

/** Replace a top-level key. */
export function setState(key, value) {
  _state[key] = value;
}

/** Shallow-merge an object into state. */
export function mergeState(patch) {
  Object.assign(_state, patch);
}

/**
 * Emit a state update over Socket.IO.
 * Always strips _moodCandidate and any other internal fields.
 *
 * @param {object|null} patch  If null, emits the full cleaned state.
 *                             Otherwise emits only the given keys.
 */
export function emitState(patch = null) {
  if (!_io) return;
  if (patch) {
    const { _moodCandidate, ...clean } = patch;
    _io.emit("state_update", clean);
  } else {
    const { _moodCandidate, ...clean } = _state;
    _io.emit("state_update", clean);
  }
}

/** Push the full cleaned state to a single newly-connected socket. */
export function emitInitialState(socket) {
  const { _moodCandidate, ...clean } = _state;
  socket.emit("state_update",       clean);
  socket.emit("biometric_update",   _state.biometric);
  socket.emit("therapy_update",     _state.therapy);
  socket.emit("multisensory_update", { all: _state.multisensory });
}

/** Convenience — emit a named event. */
export function emit(event, data) { _io?.emit(event, data); }
