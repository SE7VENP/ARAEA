/**
 * useBackendSync
 *
 * Owns the Socket.IO connection and merges server-pushed events
 * into a single `appState` object.
 *
 * Separating this from App.jsx means:
 *  - Socket lifecycle has one clear home
 *  - Any component can `import { useBackendSync }` if needed
 *  - App.jsx doesn't need to know which events the backend emits
 */
import { useState, useEffect, useRef } from "react";
import { io }                          from "socket.io-client";
import { API }                         from "../constants/index.js";

const DEFAULT_STATE = {
  mood:        "neutral",
  intensity:    0.5,
  lighting:    { hex: "#3b82f6" },
  sensor:      { temperature: 22, humidity: 55, light: 300, motion: false, context: "default", simulated: true },
  emotion:     { label: "neutral", confidence: 1, source: "manual" },
  spotify:     null,
  recommendations: [],
  activeScene: null,
  fusedParams: null,
  timeMood:    'morning',  // will be overwritten by first socket update
  simRunning:  true,
  biometric:   { heartRate: 72, hrv: 45, stressScore: 32, coherence: 0.68, source: "simulated", trend: "stable" },
  therapy:     { active: false, mode: null, phase: "idle" },
  multisensory: null,
};

/**
 * @param {{ liveRef: React.MutableRefObject, onTherapyComplete?: (data:any)=>void, onToast?: (msg:string)=>void }} opts
 */
export function useBackendSync({ liveRef, onTherapyComplete, onToast } = {}) {
  const [appState, setAppState] = useState(DEFAULT_STATE);
  const appStateRef = useRef(DEFAULT_STATE);
  const connectedRef = useRef(false);

  // Keep appStateRef in sync for hooks that read state without React re-renders
  useEffect(() => { appStateRef.current = appState; }, [appState]);

  useEffect(() => {
    const socket = io(API, {
      transports:           ["polling", "websocket"],
      reconnectionDelay:    2000,
      reconnectionDelayMax: 10000,
      timeout:              8000,
      upgrade:              true,
    });

    socket.on("connect",       () => { connectedRef.current = true; });
    socket.on("disconnect",    () => { connectedRef.current = false; });
    socket.on("connect_error", () => { connectedRef.current = false; }); // suppress unhandled error logs

    // ── Merge strategies per event ───────────────────────
    socket.on("state_update", d => {
      const { _moodCandidate, ...clean } = d ?? {};
      setAppState(prev => ({ ...prev, ...clean }));
      // Mirror audio-relevant values into liveRef (no React re-render)
      if (clean.mood                  && liveRef) liveRef.current.mood   = clean.mood;
      if (clean.fusedParams?.energy  != null && liveRef) liveRef.current.energy = clean.fusedParams.energy;
      if (clean.spotify?.bpm          && liveRef) liveRef.current.bpm    = clean.spotify.bpm;
      if (clean.activeScene  != null  && liveRef) liveRef.current.scene  = clean.activeScene;
    });

    socket.on("track_update",        d => {
      if (d.bpm && liveRef) liveRef.current.bpm = d.bpm;
      setAppState(p => ({ ...p, spotify: d }));
    });
    socket.on("emotion_update",      d => setAppState(p => ({ ...p, emotion: d })));
    socket.on("sensor_update",       d => setAppState(p => ({ ...p, sensor: d })));
    socket.on("biometric_update",    d => setAppState(p => ({ ...p, biometric: d })));
    socket.on("therapy_update",      d => setAppState(p => ({ ...p, therapy: d })));
    socket.on("therapy_complete",    d => onTherapyComplete?.(d));
    socket.on("scene_change",        d => {
      setAppState(p => ({ ...p, activeScene: d.scene }));
      if (liveRef) liveRef.current.scene = d.scene;
    });
    socket.on("multisensory_update", d => { if (d.all) setAppState(p => ({ ...p, multisensory: d.all })); });
    socket.on("voice_command",       d => { if (d.recognized) onToast?.(`Voice: "${d.transcript}" → ${d.action}`); });
    socket.on("gesture_detected",    d => { if (d.lastGesture) onToast?.(`Gesture: ${d.lastGesture}`); });

    return () => socket.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // stable — all refs

  return { appState, appStateRef, isConnected: connectedRef };
}
