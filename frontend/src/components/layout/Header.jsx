// ── Top header bar (40px) ─────────────────────────────────────────────────────
import React from "react";
import { useTheme } from "../../theme.jsx";
import { MOODS } from "../../constants.js";

const PIPELINE_BADGE = {
  idle:        null,
  searching:   { label: "SEARCHING", col: "#f59e0b" },
  selected:    { label: "LOADING",   col: "#6366f1" },
  initiating:  { label: "STARTING",  col: "#6366f1" },
  playing:     { label: "PLAYING",   col: "#10b981" },
  paused:      { label: "PAUSED",    col: "#94a3b8" },
  error:       { label: "ERROR",     col: "#ef4444" },
  no_spotify:  { label: "NO SPOTIFY",col: "#f59e0b" },
};

export default function Header({
  appState, authStatus, isLoggedIn, playerReady,
  onLogin, onLogout, micMode, pageName,
  aiEnabled, aiBlend, setAiBlend, setAiEnabled,
  milkdrop, setMilkdrop,
  pipelineStatus,
}) {
  const { T } = useTheme();
  const m      = MOODS[appState.mood] ?? MOODS.neutral;
  const bio    = appState.biometric;
  const sensor = appState.sensor;

  return (
    <div style={{
      height: 44, display: "flex", alignItems: "center",
      padding: "0 16px", gap: 10,
      background: T.bg2, flexShrink: 0,
    }}>

      {/* current page */}
      <span style={{
        fontSize: 15, fontWeight: 700,
        color: T.bright, letterSpacing: 0.2,
        fontFamily: "'Outfit', sans-serif",
        flexShrink: 0,
      }}>{pageName}</span>

      <div style={{ flex: 1 }} />

      {/* Pipeline status badge */}
      {pipelineStatus && PIPELINE_BADGE[pipelineStatus] && (
        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "4px 10px", borderRadius: 8,
          border: `1px solid ${PIPELINE_BADGE[pipelineStatus].col}44`,
          background: `${PIPELINE_BADGE[pipelineStatus].col}10`,
        }}>
          <div style={{
            width: 5, height: 5, borderRadius: "50%",
            background: PIPELINE_BADGE[pipelineStatus].col,
            animation: (pipelineStatus === "searching" || pipelineStatus === "initiating") ? "pulse-dot 1s ease-in-out infinite" : undefined,
          }} />
          <span style={{ fontSize: 9, fontWeight: 700, color: PIPELINE_BADGE[pipelineStatus].col, fontFamily: "monospace", letterSpacing: .5 }}>
            {PIPELINE_BADGE[pipelineStatus].label}
          </span>
        </div>
      )}

      {/* Biometric quick badge */}
      {bio && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "4px 10px", background: T.bg3,
          borderRadius: 8, border: `1px solid ${T.border}`,
        }}>
          <span style={{ fontSize: 10 }}>❤</span>
          <span style={{ fontSize: 10, fontFamily: "monospace", fontWeight: 500, color: T.text }}>
            {Math.round(bio.heartRate ?? 72)}
          </span>
          <div style={{ width: 1, height: 12, background: T.border }} />
          <span style={{
            fontSize: 10, fontFamily: "monospace", fontWeight: 700,
            color: (bio.stressScore ?? 0) > 60 ? T.danger : (bio.stressScore ?? 0) > 40 ? T.warning : T.success,
          }}>
            {Math.round(bio.stressScore ?? 30)}%
          </span>
        </div>
      )}

      {/* Sensor dot */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 9px", background: T.bg3, borderRadius: 8, border: `1px solid ${T.border}` }}>
        <div style={{ width: 5, height: 5, borderRadius: "50%", background: sensor?.simulated ? T.warning : T.success, flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontFamily: "monospace", fontWeight: 500, color: T.muted }}>
          {sensor?.simulated ? "SIM" : "HW"} {(sensor?.temperature ?? 22).toFixed(0)}°C
        </span>
      </div>

      {/* Milkdrop toggle */}
      <button
        onClick={() => setMilkdrop?.(v => !v)}
        title="Butterchurn Milkdrop visualizer"
        style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "5px 10px", borderRadius: 7,
          border: `1px solid ${milkdrop ? "#d97706" : "rgba(217,119,6,.25)"}`,
          background: milkdrop ? "rgba(217,119,6,.12)" : "rgba(217,119,6,.05)",
          cursor: "pointer", flexShrink: 0,
        }}
      >
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: milkdrop ? "#d97706" : "#cbd5e1", flexShrink: 0 }} />
        <span style={{ fontSize: 9, fontWeight: 600, color: milkdrop ? "#d97706" : "#64748b", fontFamily: "monospace", letterSpacing: .5 }}>
          MILK
        </span>
      </button>

      {/* AI Visuals toggle */}
      <button
        onClick={() => setAiEnabled?.(v => !v)}
        title="Toggle Generative AI Visuals (requires python ai_visual_server.py)"
        style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "5px 10px", borderRadius: 7,
          border: `1px solid ${aiEnabled ? "#a855f7" : "rgba(168,85,247,.25)"}`,
          background: aiEnabled ? "rgba(168,85,247,.12)" : "rgba(168,85,247,.05)",
          cursor: "pointer", flexShrink: 0,
        }}
      >
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: aiEnabled ? "#a855f7" : "#cbd5e1", boxShadow: aiEnabled ? "0 0 6px #a855f766" : undefined, flexShrink: 0 }} />
        <span style={{ fontSize: 9, fontWeight: 600, color: aiEnabled ? "#a855f7" : "#64748b", fontFamily: "monospace", letterSpacing: .5 }}>
          AI VISUALS
        </span>
        {aiEnabled && (
          <select
            value={aiBlend}
            onChange={e => setAiBlend?.(e.target.value)}
            onClick={e => e.stopPropagation()}
            style={{ fontSize: 8, border: "none", background: "transparent", color: "#a855f7", fontFamily: "monospace", cursor: "pointer", outline: "none", padding: 0 }}
          >
            {["screen","overlay","lighten","color-dodge","hard-light"].map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        )}
      </button>

      {/* Spotify status */}
      <div style={{
        display: "flex", alignItems: "center", gap: 7,
        padding: "5px 12px", borderRadius: 8,
        border: `1px solid ${isLoggedIn ? "#1DB95433" : T.border}`,
        background: T.bg3,
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
          background: isLoggedIn ? (playerReady ? "#1DB954" : T.warning) : "#cbd5e1",
          boxShadow: isLoggedIn && playerReady ? "0 0 6px #1DB95466" : undefined,
        }} />
        <span style={{ fontSize: 9, fontWeight: 600, color: isLoggedIn ? "#16a34a" : T.muted, fontFamily: "monospace", letterSpacing: .5 }}>
          {authStatus === "checking" ? "CONNECTING…" : isLoggedIn ? (playerReady ? "SPOTIFY ON" : "SPOTIFY ~") : "SPOTIFY OFF"}
        </span>
        {isLoggedIn ? (
          <button onClick={onLogout} style={{ fontSize: 9, fontWeight: 700, color: T.danger, background: "rgba(239,68,68,.08)", border: `1px solid ${T.danger}33`, borderRadius: 5, padding: "2px 8px", cursor: "pointer" }}>
            Disconnect
          </button>
        ) : (
          <button onClick={onLogin} disabled={authStatus === "checking"} style={{ fontSize: 9, fontWeight: 800, color: "#fff", background: "#1DB954", border: "none", borderRadius: 5, padding: "3px 10px", cursor: "pointer", opacity: authStatus === "checking" ? .6 : 1 }}>
            Connect
          </button>
        )}
      </div>
    </div>
  );
}
