// ── Secondary pages: Visualizer, Sensors, History, Settings ──────────────────
import React, { useState, useEffect } from "react";
import { spotify as spotifyAPI, insights as insightsAPI, health as healthAPI } from "../services/backendAPI.js";
import { useTheme } from "../theme.jsx";
import { MOODS, SCENES, API } from "../constants.js";
import { Card, SLabel, Bar, Sparkline } from "./ui/index.jsx";
import { SyncedVisualizer } from "./visualizer/SyncedVisualizer.jsx";

// ── Visualizer page ───────────────────────────────────────────────────────────
export function VisualizerPage({
  liveRef, state, aiEnabled = false, aiBlend = "screen",
  aiOpacity = 0.62, milkdrop = false, audioEngine = null,
  pipelineStatus = "idle", isPaused = true,
}) {
  const { T } = useTheme();
  const m = MOODS[state?.mood] ?? MOODS.neutral;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <SyncedVisualizer
        pipelineStatus={pipelineStatus}
        liveRef={liveRef}
        audioEngine={audioEngine}
        mood={state?.mood ?? "neutral"}
        scene={state?.activeScene ?? null}
        milkdrop={milkdrop}
        aiEnabled={aiEnabled}
        aiBlend={aiBlend}
        aiOpacity={aiOpacity}
        isExternallyPlaying={!isPaused}
      />

      {/* Mood HUD */}
      <div style={{
        position: "absolute", top: 14, left: 14,
        background: "rgba(255,255,255,.9)", backdropFilter: "blur(12px)",
        borderRadius: 10, padding: "8px 16px",
        border: `1px solid ${T.border}`, boxShadow: T.shMd, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 9, height: 9, borderRadius: "50%", background: m.col, boxShadow: `0 0 6px ${m.col}` }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: T.bright, fontFamily: "'Outfit',sans-serif" }}>{m.emoji} {m.label}</span>
          <span style={{ fontSize: 11, color: m.col, fontFamily: "'JetBrains Mono',monospace", fontWeight: 500 }}>
            {state?.spotify?.bpm ?? "—"} BPM
          </span>
        </div>
      </div>

      {state?.activeScene && (
        <div style={{
          position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
          background: "rgba(255,255,255,.9)", backdropFilter: "blur(12px)",
          borderRadius: 10, padding: "6px 14px",
          border: `1px solid ${SCENES[state.activeScene]?.col ?? "#64748b"}44`,
          boxShadow: T.shMd, zIndex: 10,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: SCENES[state.activeScene]?.col ?? T.acc }}>
            {SCENES[state.activeScene]?.emoji} {SCENES[state.activeScene]?.label?.toUpperCase()}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Sensors page ──────────────────────────────────────────────────────────────
export function SensorsPage({ state, onSimulate }) {
  const { T } = useTheme();
  const [hist, setHist] = useState({ temp: [], hum: [], light: [] });

  useEffect(() => {
    if (!state?.sensor) return;
    setHist(h => ({
      temp:  [...h.temp.slice(-30),  state.sensor.temperature ?? 22],
      hum:   [...h.hum.slice(-30),   state.sensor.humidity    ?? 55],
      light: [...h.light.slice(-30), state.sensor.light       ?? 300],
    }));
  }, [state?.sensor]);

  const sensors = [
    {
      label: "Temperature",
      val: state?.sensor?.temperature ?? 22,
      unit: "°C",  col: "#ef4444",
      hist: hist.temp,
      // FIX: clamp Bar value to [0,1] — temperature in range 0..45°C
      barVal: Math.min(1, Math.max(0, (state?.sensor?.temperature ?? 22) / 45)),
      note: v => v > 28 ? "🔥 Too hot" : v < 18 ? "❄️ Cool" : "✓ Normal",
    },
    {
      label: "Humidity",
      val: state?.sensor?.humidity ?? 55,
      unit: "%",   col: "#3b82f6",
      hist: hist.hum,
      barVal: Math.min(1, Math.max(0, (state?.sensor?.humidity ?? 55) / 100)),
      note: v => v > 70 ? "💦 Humid" : v < 40 ? "🏜️ Dry" : "✓ Good",
    },
    {
      label: "Light Level",
      val: state?.sensor?.light ?? 300,
      unit: " lux", col: T.warning,
      hist: hist.light,
      barVal: Math.min(1, Math.max(0, (state?.sensor?.light ?? 300) / 1000)),
      note: v => v > 500 ? "☀️ Bright" : v < 50 ? "🌑 Dark" : "✓ Normal",
    },
  ];

  return (
    <div style={{ padding: 14, overflowY: "auto", height: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 12 }}>
        {sensors.map(s => (
          <Card key={s.label}>
            <SLabel>{s.label}</SLabel>
            <div style={{ fontSize: 22, fontWeight: 600, color: s.col, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>
              {s.val.toFixed(1)}<span style={{ fontSize: 12, color: T.muted, fontWeight: 400, fontFamily: "'Outfit',sans-serif" }}>{s.unit}</span>
            </div>
            <Bar value={s.barVal} color={s.col} height={5} />
            <Sparkline data={s.hist} color={s.col} height={28} />
            <div style={{ fontSize: 10, color: T.muted, marginTop: 5 }}>{s.note(s.val)}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <Card>
          <SLabel>Motion Sensor</SLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
              background: state?.sensor?.motion ? "#ecfdf5" : T.bg3,
              border: `2px solid ${state?.sensor?.motion ? T.success : T.border}`,
              transition: "all .4s",
            }}>
              {state?.sensor?.motion ? "🚶" : "⬜"}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: state?.sensor?.motion ? T.success : T.muted, fontFamily: "'Outfit',sans-serif" }}>
                {state?.sensor?.motion ? "Motion Detected" : "No Motion"}
              </div>
              <div style={{ fontSize: 9, color: T.muted, marginTop: 2 }}>PIR sensor · GPIO 14</div>
            </div>
          </div>
        </Card>

        <Card>
          <SLabel>Environmental Context</SLabel>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.bright, textTransform: "capitalize", marginBottom: 4, fontFamily: "'Outfit',sans-serif" }}>
            {(state?.sensor?.context ?? "default").replace(/_/g, " ")}
          </div>
          <span style={{
            fontSize: 9, padding: "2px 8px", borderRadius: 10, fontWeight: 600,
            background: state?.sensor?.simulated ? "#fffbeb" : T.accBg,
            color: state?.sensor?.simulated ? T.warning : T.acc,
            border: `1px solid ${state?.sensor?.simulated ? T.warning + "33" : T.acc + "33"}`,
          }}>
            {state?.sensor?.simulated ? "Simulation" : "Hardware"}
          </span>
        </Card>
      </div>

      <Card>
        <SLabel>Simulation Control {state?.simRunning ? "· Running" : ""}</SLabel>
        <div style={{ fontSize: 10, color: T.muted, marginBottom: 10 }}>
          Simulate IoT sensor data without hardware. Real ESP32 overrides automatically.
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {[
            { a: "start", l: "▶ Start",        c: T.success, act: !!state?.simRunning },
            { a: "stop",  l: "■ Stop",          c: T.danger,  act: !state?.simRunning },
            { a: "cycle", l: "↺ Next Profile",  c: T.acc,     act: true },
          ].map(b => (
            <button key={b.a} onClick={() => onSimulate?.(b.a)} style={{
              padding: "7px 14px", borderRadius: 8,
              border: `1px solid ${b.c}44`,
              background: b.act ? `${b.c}15` : "transparent",
              color: b.c, fontSize: 11, fontWeight: 700, cursor: "pointer",
            }}>
              {b.l}
            </button>
          ))}
        </div>
        <div style={{ background: T.bg3, borderRadius: 8, padding: "10px 12px", border: `1px solid ${T.border}`, fontFamily: "monospace", fontSize: 10, lineHeight: 1.8 }}>
          <span style={{ color: T.warning, fontWeight: 700 }}>POST </span>
          <span style={{ color: T.acc }}>http://YOUR_PC_IP:3001/api/sensors</span><br />
          <span style={{ color: T.muted }}>{`{"temperature":24.5,"humidity":58,"light":420,"motion":true}`}</span>
        </div>
      </Card>
    </div>
  );
}

// ── History page ──────────────────────────────────────────────────────────────
export function HistoryPage() {
  const { T } = useTheme();
  const [moodHist, setMoodHist] = useState([]);
  const [songHist, setSongHist] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [mRes, sRes] = await Promise.all([spotifyAPI.getMoodHistory(), spotifyAPI.getSongHistory()]);
        if (!mounted) return;
        if (!mRes.error && mRes.data?.data) setMoodHist(mRes.data.data);
        if (!sRes.error && sRes.data?.data) setSongHist(sRes.data.data);
        setError(null);
      } catch {
        if (mounted) setError("Backend not reachable");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 15000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  const moodCounts = moodHist.reduce((a, h) => ({ ...a, [h.mood]: (a[h.mood] ?? 0) + 1 }), {});
  const total      = moodHist.length || 1;

  if (loading && moodHist.length === 0) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: T.muted, fontSize: 11 }}>Loading history…</div>;
  }
  if (error) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: T.danger, fontSize: 11 }}>{error}</div>;
  }

  return (
    <div style={{ padding: 14, overflowY: "auto", height: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <Card>
          <SLabel>Mood Distribution</SLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {Object.entries(MOODS).map(([mood, cfg]) => (
              <div key={mood}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: cfg.col, fontWeight: 600 }}>{cfg.emoji} {mood}</span>
                  <span style={{ fontSize: 10, color: T.muted, fontFamily: "monospace" }}>{moodCounts[mood] ?? 0}×</span>
                </div>
                <Bar value={(moodCounts[mood] ?? 0) / total} color={cfg.col} height={4} />
              </div>
            ))}
            {moodHist.length === 0 && (
              <div style={{ textAlign: "center", padding: "8px 0", color: T.dim, fontSize: 10 }}>
                Interact with the system to see data
              </div>
            )}
          </div>
        </Card>

        <Card>
          <SLabel>Mood Timeline</SLabel>
          <div style={{ overflowY: "auto", maxHeight: 280 }}>
            {moodHist.slice(0, 20).map((h, i) => {
              const cfg = MOODS[h.mood] ?? MOODS.neutral;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: i < 19 ? `1px solid ${T.border}` : "none" }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{cfg.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: cfg.col }}>{h.mood}</span>
                    {h.emotion && <span style={{ fontSize: 10, color: T.muted, marginLeft: 6 }}>{h.emotion}</span>}
                  </div>
                  <span style={{ fontSize: 9, color: T.dim, fontFamily: "monospace" }}>
                    {new Date(h.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              );
            })}
            {moodHist.length === 0 && <div style={{ textAlign: "center", padding: "20px 0", color: T.dim, fontSize: 10 }}>No history yet</div>}
          </div>
        </Card>
      </div>

      <Card>
        <SLabel>Recently Played</SLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {songHist.slice(0, 12).map((s, i) => {
            const cfg = MOODS[s.mood] ?? MOODS.neutral;
            return (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 10px", borderRadius: 9, background: T.bg3, border: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>{cfg.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: T.text, fontFamily: "'Outfit',sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.title ?? "Unknown"}
                  </div>
                  <div style={{ fontSize: 9, color: T.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.artist ?? ""}
                  </div>
                </div>
              </div>
            );
          })}
          {songHist.length === 0 && (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "18px 0", color: T.dim, fontSize: 10 }}>
              No tracks played yet
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ── Settings page ─────────────────────────────────────────────────────────────
export function SettingsPage({ authStatus, onLogin, onLogout }) {
  const { T } = useTheme();
  const [healthData, setHealthData] = useState(null);
  const [healthError, setHealthError] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = () => {
      healthAPI.ping().then(({ data, error }) => {
        if (!mounted) return;
        if (error) { setHealthData({ status: "offline" }); setHealthError(true); }
        else { setHealthData(data); setHealthError(false); }
      });
    };
    load();
    const id = setInterval(load, 15000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  const isOnline = healthData?.status === "ok";

  return (
    <div style={{ padding: 14, overflowY: "auto", height: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <Card>
          <SLabel>Spotify Connection</SLabel>
          {authStatus === "logged_in" ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#1DB954" }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#16a34a" }}>Connected to Spotify</span>
              </div>
              <div style={{ fontSize: 10, color: T.muted, marginBottom: 12, lineHeight: 1.7 }}>
                OAuth 2.0 authenticated · Full playback scope · Token auto-refreshes every 45 minutes.
              </div>
              <button onClick={onLogout} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.danger}33`, background: "#fef2f2", color: T.danger, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                Disconnect Spotify
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 10, color: T.muted, marginBottom: 12, lineHeight: 1.9 }}>
                1. Visit <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer" style={{ color: T.acc, textDecoration: "underline" }}>developer.spotify.com/dashboard</a><br />
                2. Create app → Redirect URI: <code style={{ background: T.bg3, padding: "1px 5px", borderRadius: 3, color: T.acc, fontSize: 10 }}>http://127.0.0.1:8888/callback</code><br />
                3. Copy Client ID + Secret to <code style={{ background: T.bg3, padding: "1px 5px", borderRadius: 3, color: T.warning, fontSize: 10 }}>backend/.env</code><br />
                4. Restart server → Click Connect
              </div>
              <button onClick={onLogin} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#1DB954", color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer", opacity: authStatus === "checking" ? .6 : 1 }}>
                Connect Spotify
              </button>
            </>
          )}
        </Card>

        <Card>
          <SLabel>System Status</SLabel>
          {healthError && (
            <div style={{ fontSize: 10, color: T.danger, marginBottom: 8, padding: "4px 8px", background: "#fef2f2", borderRadius: 6, border: `1px solid ${T.danger}22` }}>
              ⚠ Backend not reachable — start the server
            </div>
          )}
          {[
            { l: "Backend",     ok: isOnline,                v: healthData?.uptime ? `Up ${healthData.uptime}` : "Offline" },
            { l: "MongoDB",     ok: healthData?.mongodb,         v: healthData?.mongodb ? "Connected" : "In-memory mode" },
            { l: "Spotify API", ok: healthData?.spotify,         v: healthData?.spotify ? "Auth OK" : "Not logged in" },
            { l: "Simulation",  ok: healthData?.simRunning,      v: healthData?.simRunning ? "Running" : "Stopped" },
            { l: "Therapy",     ok: healthData?.therapyActive,   v: healthData?.therapyActive ? "Session active" : "Idle" },
            { l: "Stage 3",     ok: healthData?.stage3?.biometrics, v: "All features active" },
          ].map(({ l, ok, v }) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: ok ? T.success : T.border }} />
                <span style={{ fontSize: 11, color: T.text }}>{l}</span>
              </div>
              <span style={{ fontSize: 10, color: T.muted, fontFamily: "monospace" }}>{v ?? "—"}</span>
            </div>
          ))}
        </Card>
      </div>

      <Card style={{ marginBottom: 12 }}>
        <SLabel>Hardware Setup</SLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          {[
            { t: "ESP32 Sensors",      c: T.success, lines: ["DHT22 → GPIO 4", "BH1750 SDA→21 SCL→22", "PIR → GPIO 14", "POST /api/sensors"] },
            { t: "Biometric Hardware", c: T.danger,  lines: ["Polar H10 BLE band", "Grove GSR → ESP32 ADC", "Piezo belt (breath)", "POST /api/biometric"] },
            { t: "Smart Lights",       c: T.acc,     lines: ["Philips Hue Bridge", "WLED strip (HTTP)", "Govee / Tuya API", "POST /api/multisensory/hueGroup"] },
          ].map(s => (
            <div key={s.t} style={{ background: T.bg3, borderRadius: 9, padding: "10px 12px", border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: s.c, marginBottom: 6, fontFamily: "'Outfit',sans-serif" }}>{s.t}</div>
              {s.lines.map((l, i) => <div key={i} style={{ fontSize: 10, color: T.muted, lineHeight: 1.9 }}>· {l}</div>)}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SLabel>Stage 3 API Reference</SLabel>
        <div style={{ fontFamily: "monospace", fontSize: 10, lineHeight: 2, background: T.bg3, padding: "10px 12px", borderRadius: 8, border: `1px solid ${T.border}` }}>
          {[
            ["POST", "/api/biometric",           "Push HR/HRV/stress from hardware"],
            ["POST", "/api/therapy/start",        "Start therapy {mode}"],
            ["POST", "/api/voice",                "Process voice command transcript"],
            ["POST", "/api/gesture",              "Trigger gesture action"],
            ["GET",  "/api/community/profiles",   "Browse community profiles"],
            ["POST", "/api/community/share",      "Share current environment"],
            ["GET",  "/api/insights",             "AI analysis + recommendations"],
            ["POST", "/api/multisensory/:device", "Control smart device"],
          ].map(([method, path, desc]) => (
            <div key={path} style={{ display: "grid", gridTemplateColumns: "42px 240px 1fr", gap: 12, borderBottom: `1px solid ${T.border}`, padding: "1px 0" }}>
              <span style={{ color: method === "GET" ? T.success : T.warning, fontWeight: 600, fontFamily: "'JetBrains Mono',monospace" }}>{method}</span>
              <span style={{ color: T.acc }}>{path}</span>
              <span style={{ color: T.muted }}>{desc}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
