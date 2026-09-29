/**
 * TherapyService
 *
 * Drives the therapy session state machine.
 * Encapsulates the 1-second tick loop and phase transitions.
 * Callers just call start(mode) / stop() and subscribe to events
 * through the shared StateService.
 */
import { THERAPY_PROGRAMS } from "../data/therapyPrograms.js";
import { getState, mergeState, emit } from "./StateService.js";
import { getMemory } from "./DatabaseService.js";

let _timer     = null;
let _phaseIdx  = 0;
let _phaseTime = 0;

export function getPrograms() { return THERAPY_PROGRAMS; }

export function start(mode) {
  if (_timer) clearInterval(_timer);
  const program = THERAPY_PROGRAMS[mode];
  if (!program) throw new Error(`Unknown therapy mode: ${mode}`);

  _phaseIdx  = 0;
  _phaseTime = 0;

  const therapy = {
    active: true, mode, sessionStart: Date.now(), program,
    phase: program.phases[0].name, instruction: program.phases[0].instruction,
    breathPhase: "inhale", breathProgress: 0, sessionDuration: 0,
  };
  mergeState({ therapy, activeScene: program.scene });
  emit("therapy_update",  getState().therapy);
  emit("scene_change",    { scene: program.scene });

  _timer = setInterval(_tick, 1000);
  return program;
}

export function stop() {
  if (_timer) { clearInterval(_timer); _timer = null; }
  const state    = getState();
  const duration = state.therapy.sessionDuration ?? 0;
  const mode     = state.therapy.mode;

  mergeState({ therapy: { active:false, mode:null, phase:"idle", sessionStart:null, breathProgress:0, sessionDuration:0 } });
  emit("therapy_update", getState().therapy);

  if (duration > 30) {
    const base      = getState().biometric.stressScore;
    const reduction = Math.round(Math.max(5, Math.min(40, (100 - base) * 0.3 + 8)));
    const record    = { mode, duration, stressReduction: reduction };
    getMemory().therapy.unshift(record);
    emit("therapy_complete", record);
  }
}

export function isActive() { return !!_timer; }
export function getHistory() { return getMemory().therapy; }

function _tick() {
  const state   = getState();
  if (!state.therapy.active) { clearInterval(_timer); return; }
  const program = THERAPY_PROGRAMS[state.therapy.mode];
  if (!program) { stop(); return; }

  _phaseTime++;
  state.therapy.sessionDuration++;

  const phase = program.phases[_phaseIdx];
  if (!phase) { stop(); return; }

  // Breath circle progress
  state.therapy.breathProgress = _phaseTime / phase.duration;

  if (state.therapy.mode === "breathwork") {
    const cycle = _phaseTime % 19;
    if (cycle < 4)       { state.therapy.breathPhase = "inhale"; state.therapy.breathProgress = cycle / 4; }
    else if (cycle < 11) { state.therapy.breathPhase = "hold";   state.therapy.breathProgress = (cycle - 4) / 7; }
    else                 { state.therapy.breathPhase = "exhale"; state.therapy.breathProgress = (cycle - 11) / 8; }
  }

  if (_phaseTime >= phase.duration) {
    _phaseIdx++;
    _phaseTime = 0;
    if (_phaseIdx >= program.phases.length) { stop(); return; }
    const next = program.phases[_phaseIdx];
    state.therapy.phase       = next.name;
    state.therapy.instruction = next.instruction;
  }

  emit("therapy_update", state.therapy);
}
