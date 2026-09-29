// BiometricPanel.jsx — Stage 3: Real-time biometric monitoring
import { useState, useEffect } from "react";

import { therapy as therapyAPI } from "../services/backendAPI.js";


function SparkBar({ values = [], color = "#3B82F6", height = 40 }) {
  if (values.length < 2) return <div style={{ height }} />;
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * 100},${height - ((v - min) / range) * (height - 4) - 2}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 100 ${height}`} style={{ width: "100%", height }} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function CoherenceOrb({ value = 0.5, color = "#06B6D4" }) {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      {[28, 20, 12].map((r, i) => (
        <circle key={i} cx="36" cy="36" r={r} fill="none"
          stroke={color} strokeWidth="1" opacity={value * (0.8 - i * 0.2)}
          style={{ animation: `pulse-ring ${1.5 + i * 0.4}s ease-in-out infinite` }} />
      ))}
      <circle cx="36" cy="36" r="12" fill={color} opacity="0.15" />
      <circle cx="36" cy="36" r="8"  fill={color} opacity={0.4 + value * 0.5} />
      <text x="36" y="40" textAnchor="middle" fill={color} fontSize="9" fontWeight="700" fontFamily="monospace">
        {Math.round(value * 100)}%
      </text>
    </svg>
  );
}

export default function BiometricPanel({ T, bio, onRequestSim }) {
  const [history,        setHistory]        = useState({ hr: [], stress: [], hrv: [] });
  const [therapyHistory, setTherapyHistory] = useState([]);
  const [error,          setError]          = useState(null);

  // Accumulate rolling history from live bio updates
  useEffect(() => {
    if (!bio) return;
    setHistory(h => ({
      hr:     [...h.hr.slice(-40),     bio.heartRate    ?? 72],
      stress: [...h.stress.slice(-40), bio.stressScore  ?? 30],
      hrv:    [...h.hrv.slice(-40),    bio.hrv          ?? 45],
    }));
  }, [bio]);

  // Therapy history — load once
  useEffect(() => {
    let mounted = true;
    therapyAPI.getHistory()
      .then(({data}) => { if (mounted) setTherapyHistory(data?.data ?? []); })
      .catch(() => { if (mounted) setError("Could not load therapy history"); });
    return () => { mounted = false; };
  }, []);

  const hr        = bio?.heartRate    ?? 72;
  const stress    = bio?.stressScore  ?? 30;
  const hrv       = bio?.hrv          ?? 45;
  const coherence = bio?.coherence    ?? 0.68;
  const trend     = bio?.trend        ?? "stable";

  const stressColor = stress > 70 ? "#EF4444" : stress > 45 ? "#F59E0B" : "#10B981";
  const hrColor     = hr > 100 ? "#EF4444" : hr < 55 ? "#8B5CF6" : "#10B981";
  const trendIcon   = { elevated: "↑", relaxed: "↓", stable: "→" }[trend] ?? "→";
  const trendColor  = { elevated: "#EF4444", relaxed: "#10B981", stable: "#94A3B8" }[trend] ?? "#94A3B8";

  return (
    <div style={{ padding: 9, overflowY: "auto", height: "100%", boxSizing: "border-box" }}>
      <style>{`@keyframes pulse-ring{0%,100%{transform:scale(1);opacity:0.6}50%{transform:scale(1.08);opacity:1}}`}</style>

      {/* Top metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 10 }}>
        {[
          { label: "Heart Rate", val: `${Math.round(hr)}`,                    unit: "bpm",  color: hrColor,     spark: history.hr,     icon: "❤️" },
          { label: "HRV",        val: `${Math.round(hrv)}`,                   unit: "ms",   color: "#A78BFA",   spark: history.hrv,    icon: "〰️" },
          { label: "Stress",     val: `${Math.round(stress)}`,                unit: "%",    color: stressColor, spark: history.stress, icon: "🧠" },
          { label: "Breath",     val: `${(bio?.breathRate ?? 16).toFixed(1)}`,unit: "/min", color: "#06B6D4",   spark: [],             icon: "🌬" },
        ].map(m => (
          <div key={m.label} style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 10px 7px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
              <span style={{ fontSize: 9, color: T.muted, letterSpacing: 1, textTransform: "uppercase", fontFamily: "monospace" }}>{m.label}</span>
              <span style={{ fontSize: 11 }}>{m.icon}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: m.color, fontFamily: "monospace", lineHeight: 1 }}>
              {m.val}<span style={{ fontSize: 10, color: T.muted, fontWeight: 400, marginLeft: 2 }}>{m.unit}</span>
            </div>
            {m.spark.length > 3 && <SparkBar values={m.spark} color={m.color} height={22} />}
          </div>
        ))}
      </div>

      {/* Coherence + State */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 12, display: "flex", alignItems: "center", gap: 12 }}>
          <CoherenceOrb value={coherence} color="#06B6D4" />
          <div>
            <div style={{ fontSize: 9, color: T.muted, letterSpacing: 1, textTransform: "uppercase", fontFamily: "monospace", marginBottom: 3 }}>HRV Coherence</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#06B6D4", fontFamily: "monospace" }}>{Math.round(coherence * 100)}%</div>
            <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>
              {coherence > 0.7 ? "High — Peak state" : coherence > 0.4 ? "Medium" : "Low — Stressed"}
            </div>
          </div>
        </div>

        <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 9, color: T.muted, letterSpacing: 1, textTransform: "uppercase", fontFamily: "monospace", marginBottom: 8 }}>Physiological State</div>
          {[
            { label: "Trend",    val: `${trendIcon} ${trend}`,                                             color: trendColor },
            { label: "SC Level", val: `${((bio?.skinConductance ?? 0.3) * 100).toFixed(1)}μS`,             color: T.text     },
            { label: "Source",   val: bio?.source === "hardware" ? "🔗 Hardware" : "🔵 Simulated",        color: T.muted    },
          ].map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 10, color: T.muted }}>{r.label}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: r.color, fontFamily: "monospace" }}>{r.val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stress gauge */}
      <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 9, color: T.muted, letterSpacing: 1, textTransform: "uppercase", fontFamily: "monospace" }}>Stress Index</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: stressColor, fontFamily: "monospace" }}>{Math.round(stress)}/100</span>
        </div>
        <div style={{ height: 8, background: T.bg4, borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
          <div style={{
            height: "100%",
            width: `${Math.min(100, Math.max(0, stress))}%`,
            background: "linear-gradient(90deg,#10B981,#F59E0B,#EF4444)",
            backgroundSize: "200% 100%",
            backgroundPosition: `${stress}% 0`,
            borderRadius: 4,
            transition: "width 0.8s ease",
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          {["Relaxed", "Focused", "Elevated", "High", "Critical"].map((l, i) => (
            <span key={l} style={{ fontSize: 8, color: stress >= (i * 20 + 5) ? stressColor : T.muted, fontWeight: stress >= (i * 20 + 5) ? 700 : 400 }}>{l}</span>
          ))}
        </div>
      </div>

      {/* Hardware integration */}
      <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 9, color: T.muted, letterSpacing: 1, textTransform: "uppercase", fontFamily: "monospace", marginBottom: 8 }}>Hardware Integration</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { icon: "⌚", name: "Heart Rate Band",  note: "Polar H10 / Apple Watch via BLE" },
            { icon: "🧪", name: "GSR Sensor",       note: "Grove GSR → ESP32 ADC pin" },
            { icon: "🫁", name: "Breath Sensor",    note: "Piezo belt → ESP32 GPIO" },
            { icon: "📡", name: "API Endpoint",     note: "POST /api/biometric" },
          ].map(hw => (
            <div key={hw.name} style={{ background: T.bg3, borderRadius: 8, padding: "8px 10px", border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 14, marginBottom: 3 }}>{hw.icon}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: T.text }}>{hw.name}</div>
              <div style={{ fontSize: 9, color: T.muted, marginTop: 1 }}>{hw.note}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Therapy history */}
      {therapyHistory.length > 0 && (
        <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 9, color: T.muted, letterSpacing: 1, textTransform: "uppercase", fontFamily: "monospace", marginBottom: 8 }}>Therapy Session History</div>
          {therapyHistory.slice(0, 5).map((s, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: i < therapyHistory.length - 1 ? `1px solid ${T.border}` : "none" }}>
              <span style={{ fontSize: 11, color: T.text, fontWeight: 600 }}>{(s.mode ?? "—").replace(/_/g, " ")}</span>
              <span style={{ fontSize: 10, color: "#10B981", fontFamily: "monospace" }}>-{s.stressReduction ?? 0}% stress</span>
              <span style={{ fontSize: 9, color: T.muted }}>{Math.round((s.duration ?? 0) / 60)}m</span>
            </div>
          ))}
        </div>
      )}

      {error && <div style={{ fontSize: 9, color: T.danger, marginTop: 8, textAlign: "center" }}>{error}</div>}
    </div>
  );
}
