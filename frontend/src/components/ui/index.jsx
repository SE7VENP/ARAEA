// ── Shared UI primitives ──────────────────────────────────────────────────────
// All components read theme via useTheme() — no prop-threading required.

import React from "react";
import { useTheme } from "../../theme.jsx";

export function Card({ children, style = {}, onClick, glow }) {
  const { T } = useTheme();
  return (
    <div
      onClick={onClick}
      style={{
        background: T.bg2,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        padding: "14px 16px",
        boxShadow: glow ? `0 0 0 2px ${glow}33,${T.sh}` : T.sh,
        cursor: onClick ? "pointer" : undefined,
        transition: "box-shadow .2s",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function SLabel({ children, style = {} }) {
  const { T } = useTheme();
  return (
    <div style={{
      fontSize: 10, letterSpacing: 1, color: T.muted,
      textTransform: "uppercase", fontWeight: 600, marginBottom: 8,
      fontFamily: "monospace",
      ...style,
    }}>
      {children}
    </div>
  );
}

export function Bar({ value = 0, color, height = 4 }) {
  const { T } = useTheme();
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div style={{ height, background: T.bg4, borderRadius: height, overflow: "hidden" }}>
      <div style={{
        height: "100%", width: `${pct}%`,
        background: color ?? T.acc,
        borderRadius: height, transition: "width .4s ease",
      }} />
    </div>
  );
}

export function Pill({ children, color, active = false, onClick, style = {} }) {
  const { T } = useTheme();
  const c = color ?? T.acc;
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 12px", borderRadius: 20,
        border: `1px solid ${active ? c : T.border}`,
        background: active ? c : T.bg3,
        color: active ? "#fff" : T.muted,
        fontSize: 11, fontWeight: 600, cursor: "pointer",
        transition: "all .15s", whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Metric({ label, value, unit = "", color, sub = "" }) {
  const { T } = useTheme();
  return (
    <div style={{ background: T.bg3, borderRadius: 10, padding: "10px 12px", border: `1px solid ${T.border}` }}>
      <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'Outfit', sans-serif", fontWeight: 600, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color: color ?? T.acc, fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 }}>
        {value}
        <span style={{ fontSize: 11, fontWeight: 400, color: T.muted, marginLeft: 2 }}>{unit}</span>
      </div>
      {sub && <div style={{ fontSize: 10, color: T.muted, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export function Sparkline({ data = [], color, height = 24 }) {
  const { T } = useTheme();
  if (data.length < 2) return <div style={{ height }} />;
  const mn  = Math.min(...data);
  const mx  = Math.max(...data);
  const rng = mx - mn || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * 100},${height - ((v - mn) / rng) * (height - 4) - 2}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 100 ${height}`} style={{ width: "100%", height }} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color ?? T.acc} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function TrackCard({ track, playing, onClick, moodCol }) {
  const { T } = useTheme();
  const col = moodCol ?? T.acc;
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", gap: 10, alignItems: "center",
        padding: "8px 10px", borderRadius: 10, cursor: "pointer",
        background: playing ? `${col}0d` : T.bg3,
        border: `1px solid ${playing ? col + "33" : T.border}`,
        transition: "all .2s",
        boxShadow: playing ? `0 2px 8px ${col}22` : undefined,
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 8, overflow: "hidden",
        flexShrink: 0, background: T.bg4, position: "relative",
        boxShadow: playing ? `0 0 0 2px ${col}66` : undefined,
      }}>
        {track.image && <img src={track.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
        {playing && (
          <div style={{ position: "absolute", inset: 0, background: `${col}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff" }}>▶</div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: playing ? T.bright : T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {track.name}
        </div>
        <div style={{ fontSize: 10, color: T.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>
          {track.artist}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
        {track.spotifyUrl && (
          <a href={track.spotifyUrl} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ fontSize: 9, color: "#1DB954", padding: "2px 6px", borderRadius: 4, border: "1px solid #1DB95433" }}>↗</a>
        )}
        {track.popularity > 0 && (
          <div style={{ display: "flex", gap: 1 }}>
            {[0, 1, 2, 3, 4].map(d => (
              <div key={d} style={{ width: 2, height: 2, borderRadius: "50%", background: d < Math.round(track.popularity / 20) ? col : T.bg4 }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page error boundary — recoverable per-page crashes ───
export class PageErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(e) { return { err: e }; }
  render() {
    const { err } = this.state;
    if (!err) return this.props.children;
    // Note: can't use useTheme() in class component — use sensible fallbacks
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#ef4444" }}>
        <div style={{ fontSize: 20, marginBottom: 8 }}>⚠</div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#1e293b" }}>
          Something went wrong on this page
        </div>
        <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace", marginBottom: 12 }}>
          {err.message}
        </div>
        <button
          onClick={() => this.setState({ err: null })}
          style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid #cbd5e1", background: "#f8fafc", fontSize: 11, cursor: "pointer" }}
        >
          Try again
        </button>
      </div>
    );
  }
}
