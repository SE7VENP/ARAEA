// AIInsights.jsx — Stage 3: ML pattern analysis, recommendations, trends
import { useState, useEffect } from "react";

import { insights as insightsAPI, spotify as spotifyAPI, therapy as therapyAPI, biometric as biometricAPI } from "../services/backendAPI.js";

import { API } from "../constants/index.js";

function MiniBar({ value = 0, max = 100, color = "#3B82F6", T }) {
  // FIX: clamp to [0,1] — avoids bar overflow
  const pct = Math.min(100, Math.max(0, max > 0 ? (value / max) * 100 : 0));
  return (
    <div style={{ height: 4, background: T?.bg4 ?? "rgba(100,116,139,.15)", borderRadius: 2, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width .8s ease" }} />
    </div>
  );
}

const MOOD_COLORS = { euphoric:"#FF4500", happy:"#F59E0B", calm:"#06B6D4", melancholic:"#8B5CF6", tense:"#EF4444", sad:"#3B82F6", neutral:"#64748B" };
const MOOD_EMOJIS = { euphoric:"🔥", happy:"✨", calm:"🌊", melancholic:"🌧", tense:"⚡", sad:"💧", neutral:"◎" };

export default function AIInsights({ T, appState, bio }) {
  const [insights,       setInsights]       = useState(null);
  const [moodHistory,    setMoodHistory]    = useState([]);
  const [therapyHistory, setTherapyHistory] = useState([]);
  const [bioHistory,     setBioHistory]     = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [iRes, mRes, tRes, bRes] = await Promise.allSettled([
          insightsAPI.get(),
          spotifyAPI.getMoodHistory(),
          therapyAPI.getHistory(),
          biometricAPI.getHistory(),
        ]);
        if (!mounted) return;
        if (iRes.status === "fulfilled" && !iRes.value.error) setInsights(iRes.value.data);
        if (mRes.status === "fulfilled" && !mRes.value.error && mRes.value.data?.data) setMoodHistory(mRes.value.data.data);
        if (tRes.status === "fulfilled" && !tRes.value.error && tRes.value.data?.data) setTherapyHistory(tRes.value.data.data);
        if (bRes.status === "fulfilled" && !bRes.value.error && bRes.value.data?.data) setBioHistory(bRes.value.data.data);
        setError(null);
      } catch {
        if (mounted) setError("Could not load insights — backend may be offline");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 20000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  const moodCounts = moodHistory.reduce((a, h) => ({ ...a, [h.mood]: (a[h.mood] ?? 0) + 1 }), {});
  const totalMoods = Math.max(1, moodHistory.length); // FIX: avoid divide-by-zero

  // FIX: guard dominant access — was crashing when moodHistory is empty
  const dominantEntry  = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0];
  const dominantMood   = dominantEntry?.[0] ?? null;
  const dominantCount  = dominantEntry?.[1] ?? 0;

  const avgStressReduction = therapyHistory.length > 0
    ? Math.round(therapyHistory.reduce((a, t) => a + (t.stressReduction ?? 0), 0) / therapyHistory.length)
    : 0;

  const hourlyStress = bioHistory.slice(0, 24).map(b => ({ time: b.time, v: b.stressScore ?? 30 }));

  if (loading && moodHistory.length === 0) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: T.muted, fontSize: 11 }}>Loading insights…</div>;
  }

  return (
    <div style={{ padding: 9, overflowY: "auto", height: "100%", boxSizing: "border-box" }}>

      {error && (
        <div style={{ padding: "8px 12px", background: "#fef2f2", border: `1px solid ${T.danger}22`, borderRadius: 8, marginBottom: 10, fontSize: 10, color: T.danger }}>{error}</div>
      )}

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 10 }}>
        {[
          {
            label:  "Dominant Mood",
            val:    dominantMood ? `${MOOD_EMOJIS[dominantMood] ?? "◎"} ${dominantMood}` : "—",
            color:  dominantMood ? (MOOD_COLORS[dominantMood] ?? "#64748B") : "#64748B",
          },
          { label: "Therapy Sessions", val: String(therapyHistory.length),                  color: "#8B5CF6" },
          { label: "Avg Stress Drop",  val: avgStressReduction > 0 ? `-${avgStressReduction}%` : "—", color: "#10B981" },
          { label: "Current Coherence", val: `${Math.round((bio?.coherence ?? 0.68) * 100)}%`, color: "#06B6D4" },
        ].map(m => (
          <div key={m.label} style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 11px" }}>
            <div style={{ fontSize: 9, color: T.muted, letterSpacing: 1, textTransform: "uppercase", fontFamily: "monospace", marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: m.color, fontFamily: "monospace", lineHeight: 1.1 }}>{m.val}</div>
          </div>
        ))}
      </div>

      {/* AI Narrative */}
      <div style={{ background: T.bg2, border: `1px solid ${T.acc}33`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `${T.acc}18`, border: `1px solid ${T.acc}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🧠</div>
          <div>
            <div style={{ fontSize: 9, color: T.acc, letterSpacing: 1.2, textTransform: "uppercase", fontFamily: "monospace" }}>AI Pattern Analysis</div>
            <div style={{ fontSize: 11, color: T.text, marginTop: 2, fontWeight: 600, lineHeight: 1.5 }}>
              {moodHistory.length > 5 && dominantMood
                ? `${dominantMood} mood dominates ${Math.round((dominantCount / totalMoods) * 100)}% of sessions. ${avgStressReduction > 0 ? `Therapy reduces stress by avg ${avgStressReduction}%.` : "Start therapy sessions for stress tracking."}`
                : "Interact with ARAEA to build your personal mood profile."}
            </div>
          </div>
        </div>
        {insights?.recommendation && (
          <div style={{ fontSize: 10, color: T.muted, padding: "6px 8px", background: T.bg3, borderRadius: 6, border: `1px solid ${T.border}` }}>
            {insights.recommendation}
          </div>
        )}
      </div>

      {/* Mood distribution */}
      <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 9, color: T.muted, letterSpacing: 1, textTransform: "uppercase", fontFamily: "monospace", marginBottom: 8 }}>Mood Distribution</div>
        {Object.entries(MOOD_COLORS).map(([mood, color]) => {
          const count = moodCounts[mood] ?? 0;
          const pct   = Math.round((count / totalMoods) * 100);
          return (
            <div key={mood} style={{ marginBottom: 7 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                <span style={{ fontSize: 10, color: pct > 0 ? color : T.muted, fontWeight: pct > 0 ? 700 : 400 }}>
                  {MOOD_EMOJIS[mood] ?? "◎"} {mood}
                </span>
                <span style={{ fontSize: 9, color: T.muted, fontFamily: "monospace" }}>{count}× {pct}%</span>
              </div>
              <MiniBar value={count} max={totalMoods} color={color} T={T} />
            </div>
          );
        })}
        {moodHistory.length === 0 && <div style={{ textAlign: "center", padding: 9, color: T.muted, fontSize: 11 }}>Interact with the system to see mood analysis</div>}
      </div>

      {/* Stress timeline */}
      {hourlyStress.length > 2 && (
        <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
          <div style={{ fontSize: 9, color: T.muted, letterSpacing: 1, textTransform: "uppercase", fontFamily: "monospace", marginBottom: 8 }}>24-Hour Stress Pattern</div>
          <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 50 }}>
            {hourlyStress.map((p, i) => {
              const h = (Math.max(0, Math.min(100, p.v)) / 100) * 46;
              const color = p.v > 70 ? "#EF4444" : p.v > 45 ? "#F59E0B" : "#10B981";
              return <div key={i} style={{ flex: 1, height: `${h}px`, borderRadius: "2px 2px 0 0", background: color, opacity: 0.7 + 0.3 * (i / hourlyStress.length), transition: "height .5s ease" }} />;
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 8, color: T.muted }}>24h ago</span>
            <span style={{ fontSize: 8, color: T.muted }}>Now</span>
          </div>
        </div>
      )}

      {/* Therapy effectiveness */}
      {therapyHistory.length > 0 && (
        <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
          <div style={{ fontSize: 9, color: T.muted, letterSpacing: 1, textTransform: "uppercase", fontFamily: "monospace", marginBottom: 8 }}>Therapy Effectiveness</div>
          {["breathwork", "stress_relief", "focus_session", "sleep_prep"].map(mode => {
            const sessions = therapyHistory.filter(s => s.mode === mode);
            if (sessions.length === 0) return null;
            const avg = Math.round(sessions.reduce((a, s) => a + (s.stressReduction ?? 0), 0) / sessions.length);
            return (
              <div key={mode} style={{ marginBottom: 7 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: T.text }}>{mode.replace(/_/g, " ")}</span>
                  <span style={{ fontSize: 9, color: "#10B981", fontFamily: "monospace", fontWeight: 700 }}>-{avg}% avg · {sessions.length}×</span>
                </div>
                <MiniBar value={avg} max={50} color="#10B981" T={T} />
              </div>
            );
          })}
        </div>
      )}

      {/* AI fusion status */}
      <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 12 }}>
        <div style={{ fontSize: 9, color: T.muted, letterSpacing: 1, textTransform: "uppercase", fontFamily: "monospace", marginBottom: 8 }}>AI Fusion Model — Stage 3 Inputs</div>
        {[
          { label: "Music Analysis",     status: "active",   detail: `${appState?.spotify?.bpm ?? "—"} BPM · ${appState?.mood ?? "neutral"}`,  color: "#F59E0B" },
          { label: "Biometric Sensors",  status: bio?.source === "hardware" ? "hardware" : "simulated", detail: `HR:${Math.round(bio?.heartRate ?? 72)} · Stress:${Math.round(bio?.stressScore ?? 30)}%`, color: "#EF4444" },
          { label: "IoT Environment",    status: "active",   detail: `${appState?.sensor?.temperature ?? 22}°C · ${appState?.sensor?.context ?? "default"}`, color: "#10B981" },
          { label: "Emotion Detection",  status: appState?.emotion?.source ?? "manual", detail: `${appState?.emotion?.label ?? "neutral"} · ${Math.round((appState?.emotion?.confidence ?? 1) * 100)}%`, color: "#A78BFA" },
          { label: "Time Context",       status: "active",   detail: (appState?.timeMood ?? "—").replace(/_/g, " "), color: "#06B6D4" },
          { label: "Community Profiles", status: "available",detail: "8 profiles · 2300+ downloads", color: "#64748B" },
        ].map(r => (
          <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: (r.status === "active" || r.status === "hardware") ? "#10B981" : r.status === "simulated" ? "#F59E0B" : "#64748B", flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: T.text }}>{r.label}</span>
            </div>
            <span style={{ fontSize: 9, color: T.muted, fontFamily: "monospace" }}>{r.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
