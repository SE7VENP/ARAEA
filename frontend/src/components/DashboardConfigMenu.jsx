// ══════════════════════════════════════════════════════════════════════════════
// DashboardConfigMenu.jsx
// Floating popover triggered by the ⚙ gear button on EmotionFlowDashboard.
// Shows three preset buttons + per-panel checkboxes.
// ══════════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef } from "react";
import { useTheme } from "../theme.jsx";
import { PANELS, PRESETS } from "../hooks/useDashboardConfig.js";

export default function DashboardConfigMenu({ config, preset, setPanel, applyPreset, onClose }) {
  const { T } = useTheme();
  const ref = useRef(null);

  // Close on outside click and on Escape
  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose?.(); };
    const onKey  = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown",   onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown",   onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position:   "absolute",
        top:        46,
        right:      10,
        zIndex:     100,
        width:      290,
        background: T.bg2,
        border:     `1px solid ${T.border}`,
        borderRadius: 12,
        boxShadow:  T.shLg ?? "0 14px 40px rgba(0,0,0,.4)",
        padding:    14,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <span style={{ fontSize:10, color:T.muted, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"monospace" }}>
          Dashboard layout
        </span>
        <button
          onClick={onClose}
          style={{ background:"none", border:"none", color:T.dim, fontSize:18, cursor:"pointer", lineHeight:1, padding:0 }}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Preset buttons */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:8, color:T.muted, letterSpacing:1, textTransform:"uppercase", fontFamily:"monospace", marginBottom:6 }}>
          Preset
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:5 }}>
          {Object.entries(PRESETS).map(([key, p]) => {
            const active = preset === key;
            return (
              <button
                key={key}
                onClick={() => applyPreset(key)}
                title={p.description}
                style={{
                  padding:    "8px 4px",
                  borderRadius: 7,
                  cursor:     "pointer",
                  border:     `1px solid ${active ? T.acc + "55" : T.border}`,
                  background: active ? `${T.acc}15` : T.bg3,
                  color:      active ? T.acc : T.dim,
                  fontSize:   10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                  transition: "all .15s",
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize:8, color:T.muted, marginTop:5, minHeight:10 }}>
          {preset === "custom"
            ? "Custom — your own combination"
            : PRESETS[preset]?.description}
        </div>
      </div>

      {/* Per-panel toggles */}
      <div>
        <div style={{ fontSize:8, color:T.muted, letterSpacing:1, textTransform:"uppercase", fontFamily:"monospace", marginBottom:6 }}>
          Show panels
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
          {PANELS.map(p => (
            <label
              key={p.key}
              style={{
                display:    "flex",
                alignItems: "center",
                gap:        9,
                padding:    "7px 9px",
                borderRadius: 6,
                cursor:     "pointer",
                background: T.bg3,
                border:     `1px solid ${T.border}`,
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={!!config[p.key]}
                onChange={(e) => setPanel(p.key, e.target.checked)}
                style={{ accentColor: T.acc, cursor:"pointer", margin:0 }}
              />
              <span style={{ fontSize:10, color:T.text, flex:1 }}>{p.label}</span>
              <span style={{
                fontSize: 7,
                color:    p.group === "left" ? "#8b5cf6" : "#10b981",
                textTransform: "uppercase",
                letterSpacing: 0.6,
                fontFamily: "monospace",
                opacity: 0.85,
              }}>
                {p.group}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
