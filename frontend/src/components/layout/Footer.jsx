// ── Status footer bar (24px) ──────────────────────────────────────────────────
import React from "react";
import { useTheme } from "../../theme.jsx";
import { MOODS } from "../../constants.js";

export default function Footer({ appState, isLoggedIn, playerReady, micMode, onInjectMood }) {
  const { T } = useTheme();

  const statusItems = [
    { label: "SPOTIFY",  ok: isLoggedIn },
    { label: "PLAYER",   ok: playerReady },
    { label: "BACKEND",  ok: true },
    { label: appState.sensor?.simulated ? "SIM" : "ESP32", ok: !appState.sensor?.simulated },
    { label: "THERAPY",  ok: appState.therapy?.active, val: appState.therapy?.mode?.replace(/_/g," ") },
    { label: appState.activeScene?.toUpperCase() ?? "", ok: !!appState.activeScene, skip: !appState.activeScene },
  ].filter(s => !s.skip);

  return (
    <div style={{
      height: 24, display: "flex", alignItems: "center",
      padding: "0 16px", justifyContent: "space-between",
      borderTop: `1px solid ${T.border}`,
      background: T.bg2, flexShrink: 0,
      fontSize: 9, color: T.muted, fontFamily: "monospace", letterSpacing: .8,
    }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {statusItems.map((s, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: s.ok ? "#10b981" : "#cbd5e1", display: "inline-block" }} />
            <span>{s.val ?? s.label}</span>
          </span>
        ))}
      </div>

      {/* Mood test buttons */}
      <div style={{ display: "flex", gap: 1, alignItems: "center" }}>
        <span style={{ color: T.dim, marginRight: 5, fontSize: 8 }}>test mood:</span>
        {Object.entries(MOODS).map(([k, v]) => (
          <button
            key={k}
            onClick={() => onInjectMood?.(k)}
            title={k}
            style={{ background: "none", border: "none", fontSize: 10, cursor: "pointer", opacity: .5, padding: "0 1px", transition: "opacity .15s" }}
            onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = ".5"; }}
          >
            {v.emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
