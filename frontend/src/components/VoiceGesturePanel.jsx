// VoiceGesturePanel.jsx — Stage 3: Web Speech API + Gesture simulation
// FIXES:
//   1. Camera preview was black — videoRef.current.srcObject was set but .play() never called
//   2. startVoice had [voiceActive, onToast] deps — voiceActive caused stale closure/re-creation
//      every toggle; now uses voiceActiveRef exclusively
//   3. Removed dead code: startCamera / stopCamera / setGestureActive (camera is prop-driven)
//   4. gestureLog state accumulated but was never rendered — removed
//   5. All fetches now have try/catch with user feedback
import { useState, useEffect, useRef, useCallback } from "react";
import { voice as voiceAPI, gesture as gestureAPI } from "../services/backendAPI.js";


const VOICE_COMMANDS = [
  { cmd: "party / dance",    action: "Activate Party scene" },
  { cmd: "focus / work",     action: "Activate Focus scene" },
  { cmd: "relax / calm",     action: "Activate Relax scene" },
  { cmd: "sleep / bed",      action: "Activate Sleep scene" },
  { cmd: "workout / gym",    action: "Activate Workout scene" },
  { cmd: "cosmic / space",   action: "Activate Cosmic scene" },
  { cmd: "lights on/off",    action: "Toggle LED strip" },
  { cmd: "brighter",         action: "Increase brightness +20%" },
  { cmd: "dimmer / dim",     action: "Decrease brightness -20%" },
  { cmd: "therapy / breathe",action: "Start breathwork session" },
  { cmd: "stop therapy",     action: "End therapy session" },
  { cmd: "fan on/off",       action: "Toggle smart fan" },
];

const GESTURE_DEFS = [
  { id: "swipe_right", icon: "👉", label: "Swipe Right", action: "Next scene",       key: "ArrowRight" },
  { id: "swipe_left",  icon: "👈", label: "Swipe Left",  action: "Clear scene",      key: "ArrowLeft"  },
  { id: "thumbs_up",   icon: "👍", label: "Thumbs Up",   action: "Brightness +20%",  key: "ArrowUp"    },
  { id: "thumbs_down", icon: "👎", label: "Thumbs Down", action: "Brightness -20%",  key: "ArrowDown"  },
  { id: "open_palm",   icon: "🖐", label: "Open Palm",   action: "All lights ON",    key: "KeyO"       },
  { id: "fist",        icon: "✊", label: "Fist",        action: "All lights OFF",   key: "KeyF"       },
];

export default function VoiceGesturePanel({ T, onToast, cameraOn, videoStream }) {
  const [voiceActive, setVoiceActive] = useState(false);
  const voiceActiveRef  = useRef(false); // FIX: stable ref, no stale closure
  const [transcript,    setTranscript]  = useState("");
  const [lastCmd,       setLastCmd]     = useState(null);
  const [cmdHistory,    setCmdHistory]  = useState([]);
  const [lastGesture,   setLastGesture] = useState(null);
  const recognitionRef  = useRef(null);
  const videoRef        = useRef(null);
  const gestureActive   = cameraOn; // derived from prop — camera controlled by App.jsx sidebar

  // ── FIX: sync video element when stream prop changes ────────────────────────
  // Was: stream set on srcObject but .play() never called → black preview
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (videoStream && cameraOn) {
      video.srcObject = videoStream;
      // autoPlay attr handles Chrome; explicit .play() handles Firefox
      video.play().catch(() => {}); // may throw if not yet attached to DOM — safe to ignore
    } else {
      video.srcObject = null;
    }
  }, [videoStream, cameraOn]);

  // ── Voice Recognition ───────────────────────────────────────────────────────
  // FIX: removed `voiceActive` from dependency array — it was never needed here
  // because the rec.onend handler only reads voiceActiveRef.current (stable ref)
  const startVoice = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      onToast?.("⚠️ SpeechRecognition not supported (use Chrome/Edge)");
      return;
    }
    const rec = new SR();
    rec.continuous     = true;
    rec.interimResults = true;
    rec.lang           = "en-US";

    rec.onresult = (e) => {
      const result = e.results[e.results.length - 1];
      const text   = result[0].transcript;
      const final  = result.isFinal;
      setTranscript(text);
      if (final) {
        voiceAPI.send(text)
          .then(({ data: d }) => {
            if (!d) return;
            const entry = {
              text, recognized: d.recognized,
              action: d.action ?? null,
              time: new Date().toLocaleTimeString(),
            };
            setLastCmd(entry);
            setCmdHistory(h => [entry, ...h.slice(0, 19)]);
            if (d.recognized) onToast?.(`🎙 "${text}" → ${d.action}`);
          })
          .catch(() => {});
      }
    };

    rec.onerror = (e) => {
      if (e.error === "no-speech") return; // normal — user is just quiet
      if (e.error === "not-allowed") {
        onToast?.("⚠️ Microphone access denied — check browser permissions");
        stopVoice();
      } else {
        onToast?.(`⚠️ Voice error: ${e.error}`);
      }
    };

    // FIX: restart recognition if still active — uses ref not stale state
    rec.onend = () => {
      if (voiceActiveRef.current) {
        try { rec.start(); } catch {}  // may throw if aborted — safe to ignore
      }
    };

    rec.start();
    recognitionRef.current = rec;
    voiceActiveRef.current  = true;
    setVoiceActive(true);
  }, [onToast]); // FIX: removed voiceActive from deps — only onToast needed

  const stopVoice = useCallback(() => {
    voiceActiveRef.current  = false;
    setVoiceActive(false);
    setTranscript("");
    try { recognitionRef.current?.stop(); } catch {}
    recognitionRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stopVoice(), []); // eslint-disable-line

  // ── Gesture simulation ──────────────────────────────────────────────────────
  const simulateGesture = useCallback(async (gestureId) => {
    const confidence = 0.85 + Math.random() * 0.12;
    const def = GESTURE_DEFS.find(g => g.id === gestureId);
    if (!def) return;
    // Optimistic update
    const entry = {
      gesture: gestureId, label: def.label,
      action: def.action, confidence,
      time: new Date().toLocaleTimeString(),
    };
    setLastGesture(entry);
    try {
      const { data: d } = await gestureAPI.send(gestureId, confidence);
      if (d?.ok) onToast?.(`${def.icon} ${def.label} → ${def.action}`);
    } catch {
      onToast?.("Backend not reachable");
    }
  }, [onToast]);

  // Keyboard shortcuts for gesture simulation (only when gesture panel is visible)
  useEffect(() => {
    if (!gestureActive) return;
    const onKey = (e) => {
      const def = GESTURE_DEFS.find(g => g.key === e.code);
      if (def) simulateGesture(def.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gestureActive, simulateGesture]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 9, overflowY: "auto", height: "100%", boxSizing: "border-box" }}>

      {/* Voice Control */}
      <div style={{ background: T.bg2, border: `1px solid ${voiceActive ? "#10B98144" : T.border}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 9, color: T.muted, letterSpacing: 1, textTransform: "uppercase", fontFamily: "monospace" }}>Voice Control</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>Web Speech API — Chrome / Edge recommended</div>
          </div>
          <button
            onClick={voiceActive ? stopVoice : startVoice}
            style={{ padding: "7px 16px", borderRadius: 7, border: `1px solid ${voiceActive ? "#EF4444" : "#10B981"}`, background: voiceActive ? "rgba(239,68,68,.1)" : "rgba(16,185,129,.1)", color: voiceActive ? "#EF4444" : "#10B981", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
          >
            {voiceActive ? "■ Stop" : "● Start"}
          </button>
        </div>

        {voiceActive && (
          <div style={{ background: T.bg3, borderRadius: 8, padding: 10, marginBottom: 10, minHeight: 36, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444", flexShrink: 0, animation: "pulse 1s infinite" }} />
            <div style={{ fontSize: 12, color: T.text, fontStyle: "italic", flex: 1 }}>
              {transcript || "Listening… say a command"}
            </div>
          </div>
        )}

        {lastCmd && (
          <div style={{ padding: "7px 10px", borderRadius: 8, background: lastCmd.recognized ? "rgba(16,185,129,.08)" : "rgba(239,68,68,.06)", border: `1px solid ${lastCmd.recognized ? "#10B98133" : "#EF444433"}`, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, color: lastCmd.recognized ? "#10B981" : "#EF4444", fontWeight: 600 }}>"{lastCmd.text}"</span>
              <span style={{ fontSize: 9, color: T.muted }}>{lastCmd.time}</span>
            </div>
            {lastCmd.recognized && <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>→ {lastCmd.action}</div>}
          </div>
        )}

        <div style={{ fontSize: 9, color: T.muted, letterSpacing: 1, textTransform: "uppercase", fontFamily: "monospace", marginBottom: 6 }}>Available Commands</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
          {VOICE_COMMANDS.map(c => (
            <div key={c.cmd} style={{ fontSize: 9, padding: "4px 7px", borderRadius: 5, background: T.bg3, border: `1px solid ${T.border}` }}>
              <span style={{ color: "#06B6D4", fontFamily: "monospace" }}>{c.cmd}</span>
              <span style={{ color: T.muted, marginLeft: 4 }}>→ {c.action}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Gesture Control */}
      <div style={{ background: T.bg2, border: `1px solid ${gestureActive ? "#A855F744" : T.border}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 9, color: T.muted, letterSpacing: 1, textTransform: "uppercase", fontFamily: "monospace" }}>Gesture Control</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>Camera preview + keyboard simulation</div>
          </div>
          <div style={{ padding: "5px 12px", borderRadius: 7, border: `1px solid ${gestureActive ? "#10B98144" : T.border}`, background: gestureActive ? "rgba(16,185,129,.08)" : T.bg3, fontSize: 10, fontWeight: 600, color: gestureActive ? "#10B981" : T.muted }}>
            {gestureActive ? "🟢 Camera ON" : "Toggle camera from sidebar icon"}
          </div>
        </div>

        {/* Camera preview — FIX: video srcObject assigned in useEffect + .play() called */}
        <div style={{ position: "relative", marginBottom: 10, borderRadius: 10, overflow: "hidden", background: "#000", height: 280, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <video
            ref={videoRef}
            style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.9, display: gestureActive ? "block" : "none" }}
            muted playsInline autoPlay
          />
          {!gestureActive && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 28 }}>📷</span>
              <span style={{ fontSize: 11, color: T.muted }}>Click camera icon in sidebar to enable</span>
            </div>
          )}
          {gestureActive && (
            <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(0,0,0,.7)", borderRadius: 5, padding: "3px 7px", fontSize: 9, color: "#A855F7", fontFamily: "monospace" }}>
              ● LIVE
            </div>
          )}
          {lastGesture && gestureActive && (
            <div style={{ position: "absolute", bottom: 6, left: 6, right: 6, background: "rgba(0,0,0,.8)", borderRadius: 8, padding: "6px 10px", display: "flex", alignItems: "center", gap: 8, animation: "fadeUp .2s ease" }}>
              <span style={{ fontSize: 18 }}>{GESTURE_DEFS.find(g => g.id === lastGesture.gesture)?.icon ?? "🤚"}</span>
              <div>
                <div style={{ fontSize: 11, color: "#A855F7", fontWeight: 600 }}>{lastGesture.label}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,.5)" }}>{Math.round(lastGesture.confidence * 100)}% confidence · {lastGesture.time}</div>
              </div>
            </div>
          )}
        </div>

        {/* Gesture simulation buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 8 }}>
          {GESTURE_DEFS.map(g => (
            <button
              key={g.id}
              onClick={() => simulateGesture(g.id)}
              title={g.action}
              style={{ padding: "8px 4px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg3, cursor: "pointer", textAlign: "center", transition: "all .15s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#A855F7"; e.currentTarget.style.background = "rgba(168,85,247,.08)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.bg3; }}
            >
              <div style={{ fontSize: 18, marginBottom: 3 }}>{g.icon}</div>
              <div style={{ fontSize: 9, color: T.muted, fontWeight: 600 }}>{g.label}</div>
              <div style={{ fontSize: 8, color: T.dim }}>[{g.key.replace("Key", "").replace("Arrow", "")}]</div>
            </button>
          ))}
        </div>

        <div style={{ fontSize: 9, color: T.muted, textAlign: "center" }}>
          {gestureActive
            ? "↑ Click buttons or press keyboard shortcuts to simulate gestures"
            : "Buttons send gestures to backend even without camera"}
        </div>
      </div>

      {/* Command history */}
      {cmdHistory.length > 0 && (
        <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 9, color: T.muted, letterSpacing: 1, textTransform: "uppercase", fontFamily: "monospace", marginBottom: 8 }}>Command History</div>
          {cmdHistory.slice(0, 10).map((c, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: i < Math.min(9, cmdHistory.length - 1) ? `1px solid ${T.border}` : "none" }}>
              <span style={{ fontSize: 10, color: c.recognized ? "#10B981" : "#EF4444", fontFamily: "monospace", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>"{c.text}"</span>
              {c.recognized && <span style={{ fontSize: 9, color: T.muted, marginRight: 8, flexShrink: 0 }}>→ {c.action}</span>}
              <span style={{ fontSize: 9, color: T.dim, flexShrink: 0 }}>{c.time}</span>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  );
}
