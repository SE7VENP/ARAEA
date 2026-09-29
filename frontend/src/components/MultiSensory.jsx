// MultiSensory.jsx — Stage 3: Full IoT multi-sensory control
import { useState, useEffect, useCallback } from "react";
import { multisensory as msAPI } from "../services/backendAPI.js";


// FIX: safe localStorage helpers — throws in Private Browsing
function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v != null ? v : fallback; }
  catch { return fallback; }
}
function lsSet(key, val) { try { localStorage.setItem(key, val); } catch {} }

// FIX: replace AbortSignal.timeout (not supported in Firefox<90, Safari<15.4)
//      with standard AbortController + setTimeout
function fetchWithTimeout(url, opts = {}, timeoutMs = 3000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

const DEFAULT_MS = {
  diffuser: { active: false, scent: "lavender", intensity: 50 },
  fan:      { active: false, speed: 2, mode: "auto" },
  blinds:   { position: 100, mode: "auto" },
  temp:     { target: 22, current: 22, mode: "auto" },
  curtain:  { position: 100 },
  speaker:  { volume: 70, bass: 50, treble: 50 },
  ledStrip: { active: true,  color: "#00e5ff", brightness: 80, mode: "reactive" },
  hueGroup: { active: true,  scene: "concentrate", brightness: 75 },
};

const LED_MODES  = ["reactive","static","breathe","rainbow","strobe"];
const HUE_SCENES = ["relax","read","concentrate","energize","dimmed","nightlight"];
const SCENTS     = ["lavender","peppermint","citrus","eucalyptus","vanilla","rose","sandalwood","cedar"];

function Toggle({ on, onChange, color = "#10B981" }) {
  return (
    <div onClick={onChange} style={{ width: 34, height: 18, borderRadius: 9, border: `1px solid ${on ? color : color + "44"}`, background: on ? `${color}22` : "transparent", position: "relative", cursor: "pointer", transition: "all .2s", flexShrink: 0 }}>
      <div style={{ position: "absolute", width: 12, height: 12, borderRadius: "50%", background: on ? color : "#94a3b8", top: 2, left: on ? 18 : 2, transition: "left .2s", boxShadow: on ? `0 0 5px ${color}88` : undefined }} />
    </div>
  );
}

function Slider({ value = 50, min = 0, max = 100, onChange, color = "#06B6D4", label = "" }) {
  return (
    <div>
      {label && (
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
          <span style={{ fontSize: 9, color: "#64748b", letterSpacing: 1, textTransform: "uppercase", fontFamily: "monospace" }}>{label}</span>
          <span style={{ fontSize: 9, color, fontFamily: "monospace", fontWeight: 700 }}>{value}</span>
        </div>
      )}
      <input type="range" min={min} max={max} value={value} onChange={e => onChange?.(Number(e.target.value))}
        style={{ width: "100%", accentColor: color, cursor: "pointer", height: 3 }} />
    </div>
  );
}

function SectionHeader({ title, sub, color, active, onToggle, T }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{title}</div>
        {sub && <div style={{ fontSize: 9, color: T.muted }}>{sub}</div>}
      </div>
      <Toggle on={!!active} onChange={onToggle} color={color} />
    </div>
  );
}

function IPConfig({ label, placeholder, value, onChange, onTest, status, T }) {
  return (
    <div style={{ marginTop: 8, padding: "8px 10px", background: T.bg3, borderRadius: 8, border: `1px solid ${T.border}` }}>
      <div style={{ fontSize: 9, color: T.muted, fontFamily: "monospace", letterSpacing: 1, marginBottom: 5, textTransform: "uppercase" }}>{label}</div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ flex: 1, padding: "5px 8px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.bg2, color: T.text, fontSize: 10, outline: "none", fontFamily: "monospace" }} />
        <button onClick={onTest} style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${T.acc}44`, background: T.accBg, color: T.acc, fontSize: 9, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
          Test
        </button>
      </div>
      {status && (
        <div style={{ fontSize: 9, marginTop: 4, color: status === "ok" ? "#10b981" : status === "fail" ? "#ef4444" : T.muted }}>
          {status === "ok" ? "✓ Connected" : status === "fail" ? "✗ Could not reach device" : "Connecting…"}
        </div>
      )}
    </div>
  );
}

export default function MultiSensory({ T, ms, onToast }) {
  // FIX: safe localStorage read — throws in Private Browsing
  const savedIPs = (() => { try { return JSON.parse(lsGet("araea_hw_ips", "{}")); } catch { return {}; } })();

  // FIX: initialize local state from ms prop with DEFAULT_MS fallback
  const [local, setLocal] = useState(() => ({
    ...DEFAULT_MS,
    ...(ms ?? {}),
  }));

  // FIX: sync local state when ms prop changes from server (was never updating)
  useEffect(() => {
    if (!ms) return;
    setLocal(prev => ({ ...prev, ...ms }));
  }, [ms]);

  const [hueIP,       setHueIP]       = useState(savedIPs.hueIP  ?? "");
  const [hueKey,      setHueKey]      = useState(savedIPs.hueKey ?? "");
  const [wledIP,      setWledIP]      = useState(savedIPs.wledIP ?? "");
  const [hueStatus,   setHueStatus]   = useState(null);
  const [wledStatus,  setWledStatus]  = useState(null);
  const [showConfig,  setShowConfig]  = useState(false);
  const [updating,    setUpdating]    = useState(false); // FIX: show feedback on network ops

  const saveIPs = useCallback(() => {
    lsSet("araea_hw_ips", JSON.stringify({ hueIP, hueKey, wledIP }));
    onToast?.("Hardware IPs saved");
  }, [hueIP, hueKey, wledIP, onToast]);

  // FIX: use fetchWithTimeout instead of AbortSignal.timeout (browser compat)
  const testHue = useCallback(async () => {
    if (!hueIP) { onToast?.("Enter Hue Bridge IP first"); return; }
    setHueStatus("testing");
    try {
      const r = await fetchWithTimeout(`http://${hueIP}/api/${hueKey || "test"}/lights`, {}, 3000);
      setHueStatus(r.ok ? "ok" : "fail");
    } catch { setHueStatus("fail"); }
  }, [hueIP, hueKey, onToast]);

  const testWled = useCallback(async () => {
    if (!wledIP) { onToast?.("Enter WLED IP first"); return; }
    setWledStatus("testing");
    try {
      const r = await fetchWithTimeout(`http://${wledIP}/json`, {}, 3000);
      setWledStatus(r.ok ? "ok" : "fail");
    } catch { setWledStatus("fail"); }
  }, [wledIP, onToast]);

  // FIX: update function with error feedback
  const update = useCallback(async (device, patch) => {
    setLocal(l => ({ ...l, [device]: { ...l[device], ...patch } }));
    setUpdating(true);
    try {
      const { error } = await msAPI.updateDevice(device, patch);
      if (error) {
        onToast?.("Device update failed — check connection");
        setLocal(l => ({ ...l, [device]: { ...l[device] } }));
      }
    } catch {
      onToast?.("Backend not reachable — check connection");
    } finally {
      setUpdating(false);
    }
  }, [onToast]);

  const allOff = useCallback(async () => {
    const patch = { ledStrip: { active: false }, hueGroup: { active: false }, diffuser: { active: false }, fan: { active: false } };
    setLocal(l => ({ ...l, ...patch }));
    try {
      await msAPI.updateAll(patch);
      onToast?.("All devices turned off");
    } catch { onToast?.("Backend not reachable"); }
  }, [onToast]);

  const resetDefaults = useCallback(async () => {
    const patch = { ledStrip: { active: true, brightness: 80 }, hueGroup: { active: true, brightness: 75 }, fan: { active: false } };
    setLocal(l => ({ ...l, ...patch }));
    try {
      await msAPI.updateAll(patch);
      onToast?.("Reset to defaults");
    } catch { onToast?.("Backend not reachable"); }
  }, [onToast]);

  return (
    <div style={{ padding: 9, overflowY: "auto", height: "100%", boxSizing: "border-box" }}>
      {/* Hardware config toggle */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, padding: "8px 10px", background: T.bg2, borderRadius: 8, border: `1px solid ${T.border}` }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 700, color: T.text }}>Hardware Configuration</span>
          <div style={{ fontSize: 9, color: T.muted }}>Hue Bridge IP · WLED IP · API keys</div>
        </div>
        <button onClick={() => setShowConfig(v => !v)}
          style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${T.border}`, background: showConfig ? T.bg4 : T.bg3, color: T.muted, fontSize: 10, cursor: "pointer" }}>
          {showConfig ? "Hide" : "Configure"}
        </button>
      </div>

      {/* Hardware IP Config */}
      {showConfig && (
        <div style={{ background: T.bg2, border: `1px solid ${T.acc}33`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
          <div style={{ fontSize: 9, color: T.acc, letterSpacing: 1.2, textTransform: "uppercase", fontFamily: "monospace", marginBottom: 8 }}>Hardware IPs & Keys</div>
          <IPConfig label="Philips Hue Bridge IP" placeholder="192.168.1.X"
            value={hueIP} onChange={setHueIP} onTest={testHue} status={hueStatus} T={T} />
          <div style={{ marginTop: 6, padding: "0 10px" }}>
            <div style={{ fontSize: 9, color: T.muted, marginBottom: 3 }}>Hue Username / API Key</div>
            <input type="text" value={hueKey} onChange={e => setHueKey(e.target.value)}
              placeholder="Get from: http://BRIDGE_IP/debug/clip.html"
              style={{ width: "100%", padding: "5px 8px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.bg3, color: T.text, fontSize: 10, outline: "none", fontFamily: "monospace", boxSizing: "border-box" }} />
          </div>
          <IPConfig label="WLED Strip IP" placeholder="192.168.1.X"
            value={wledIP} onChange={setWledIP} onTest={testWled} status={wledStatus} T={T} />
          <div style={{ display: "flex", gap: 7, marginTop: 10 }}>
            <button onClick={saveIPs}
              style={{ flex: 1, padding: "7px", borderRadius: 7, border: `1px solid ${T.acc}44`, background: T.accBg, color: T.acc, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
              Save Configuration
            </button>
          </div>
          <div style={{ fontSize: 9, color: T.dim, marginTop: 8, lineHeight: 1.7 }}>
            <strong style={{ color: T.muted }}>Hue:</strong> Hue app → Settings → My Hue system → Bridge → IP address<br />
            <strong style={{ color: T.muted }}>WLED:</strong> Connect to WLED hotspot → 4.3.2.1 → Config → WiFi → get IP
          </div>
        </div>
      )}

      {/* LED Strip */}
      <div style={{ background: T.bg2, border: `1px solid ${local.ledStrip?.active ? "#00e5ff33" : T.border}`, borderRadius: 10, padding: 12, marginBottom: 8 }}>
        <SectionHeader title="LED Strip" sub={`${wledIP || "No IP set"} · ${local.ledStrip?.mode ?? "reactive"}`} color="#00e5ff"
          active={local.ledStrip?.active} onToggle={() => update("ledStrip", { active: !local.ledStrip?.active })} T={T} />
        {!wledIP && <div style={{ fontSize: 9, color: "#f59e0b", marginBottom: 8, padding: "3px 7px", background: "#fefce8", borderRadius: 5, border: "1px solid #f59e0b33" }}>⚠ No WLED IP — click Configure above</div>}
        {local.ledStrip?.active && (
          <>
            <Slider label="Brightness" value={local.ledStrip?.brightness ?? 80} onChange={v => update("ledStrip", { brightness: v })} color="#00e5ff" />
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 9, color: T.muted, letterSpacing: 1, marginBottom: 5, textTransform: "uppercase", fontFamily: "monospace" }}>Mode</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {LED_MODES.map(m => (
                  <button key={m} onClick={() => update("ledStrip", { mode: m })} style={{ padding: "4px 9px", borderRadius: 5, border: `1px solid ${local.ledStrip?.mode === m ? "#00e5ff44" : T.border}`, background: local.ledStrip?.mode === m ? "rgba(0,229,255,.1)" : "transparent", color: local.ledStrip?.mode === m ? "#00e5ff" : T.muted, fontSize: 9, cursor: "pointer", fontWeight: 600 }}>{m}</button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Philips Hue */}
      <div style={{ background: T.bg2, border: `1px solid ${local.hueGroup?.active ? "#F59E0B33" : T.border}`, borderRadius: 10, padding: 12, marginBottom: 8 }}>
        <SectionHeader title="Philips Hue Group" sub={`${hueIP || "No IP set"} · All rooms`} color="#F59E0B"
          active={local.hueGroup?.active} onToggle={() => update("hueGroup", { active: !local.hueGroup?.active })} T={T} />
        {!hueIP && <div style={{ fontSize: 9, color: "#f59e0b", marginBottom: 8, padding: "3px 7px", background: "#fefce8", borderRadius: 5, border: "1px solid #f59e0b33" }}>⚠ No Hue Bridge IP — click Configure above</div>}
        {local.hueGroup?.active && (
          <>
            <Slider label="Brightness" value={local.hueGroup?.brightness ?? 75} onChange={v => update("hueGroup", { brightness: v })} color="#F59E0B" />
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 9, color: T.muted, letterSpacing: 1, marginBottom: 5, textTransform: "uppercase", fontFamily: "monospace" }}>Scene</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {HUE_SCENES.map(s => (
                  <button key={s} onClick={() => update("hueGroup", { scene: s })} style={{ padding: "4px 9px", borderRadius: 5, border: `1px solid ${local.hueGroup?.scene === s ? "#F59E0B44" : T.border}`, background: local.hueGroup?.scene === s ? "rgba(245,158,11,.1)" : "transparent", color: local.hueGroup?.scene === s ? "#F59E0B" : T.muted, fontSize: 9, cursor: "pointer", fontWeight: 600 }}>{s}</button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Aroma Diffuser */}
      <div style={{ background: T.bg2, border: `1px solid ${local.diffuser?.active ? "#10B98133" : T.border}`, borderRadius: 10, padding: 12, marginBottom: 8 }}>
        <SectionHeader title="Aroma Diffuser" sub={`Smart MQTT · ${local.diffuser?.scent ?? "lavender"}`} color="#10B981"
          active={local.diffuser?.active} onToggle={() => update("diffuser", { active: !local.diffuser?.active })} T={T} />
        {local.diffuser?.active && (
          <>
            <Slider label="Intensity" value={local.diffuser?.intensity ?? 50} onChange={v => update("diffuser", { intensity: v })} color="#10B981" />
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 9, color: T.muted, marginBottom: 5, textTransform: "uppercase", fontFamily: "monospace" }}>Scent</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {SCENTS.map(s => (
                  <button key={s} onClick={() => update("diffuser", { scent: s })} style={{ padding: "4px 8px", borderRadius: 5, border: `1px solid ${local.diffuser?.scent === s ? "#10B98144" : T.border}`, background: local.diffuser?.scent === s ? "rgba(16,185,129,.1)" : "transparent", color: local.diffuser?.scent === s ? "#10B981" : T.muted, fontSize: 9, cursor: "pointer", fontWeight: 600 }}>{s}</button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 2-col grid: fan / thermostat / blinds / speaker */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        {/* Smart Fan */}
        <div style={{ background: T.bg2, border: `1px solid ${local.fan?.active ? "#06B6D433" : T.border}`, borderRadius: 10, padding: 11 }}>
          <SectionHeader title="Smart Fan" sub="ESP32 relay" color="#06B6D4"
            active={local.fan?.active} onToggle={() => update("fan", { active: !local.fan?.active })} T={T} />
          {local.fan?.active && (
            <>
              <Slider label="Speed" value={(local.fan?.speed ?? 2) * 25} min={0} max={100} onChange={v => update("fan", { speed: Math.round(v / 25) })} color="#06B6D4" />
              <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                {["manual", "auto"].map(m => (
                  <button key={m} onClick={() => update("fan", { mode: m })} style={{ flex: 1, padding: "4px", borderRadius: 5, border: `1px solid ${local.fan?.mode === m ? "#06B6D444" : T.border}`, background: local.fan?.mode === m ? "rgba(6,182,212,.1)" : "transparent", color: local.fan?.mode === m ? "#06B6D4" : T.muted, fontSize: 9, cursor: "pointer", fontWeight: 600 }}>{m}</button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Thermostat */}
        <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 11 }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.text }}>AC / Thermostat</div>
            <div style={{ fontSize: 9, color: T.muted }}>Current: {local.temp?.current ?? 22}°C</div>
          </div>
          <Slider label="Target °C" value={local.temp?.target ?? 22} min={16} max={30} onChange={v => update("temp", { target: v })} color="#EF4444" />
          <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
            {["manual", "auto"].map(m => (
              <button key={m} onClick={() => update("temp", { mode: m })} style={{ flex: 1, padding: "4px", borderRadius: 5, border: `1px solid ${local.temp?.mode === m ? "#EF444444" : T.border}`, background: local.temp?.mode === m ? "rgba(239,68,68,.1)" : "transparent", color: local.temp?.mode === m ? "#EF4444" : T.muted, fontSize: 9, cursor: "pointer", fontWeight: 600 }}>{m}</button>
            ))}
          </div>
        </div>

        {/* Smart Blinds */}
        <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 11 }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.text }}>Smart Blinds</div>
            <div style={{ fontSize: 9, color: T.muted }}>SwitchBot / Soma</div>
          </div>
          <Slider label="Position %" value={local.blinds?.position ?? 100} onChange={v => update("blinds", { position: v })} color="#A78BFA" />
          <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
            {[0, 50, 100].map(v => (
              <button key={v} onClick={() => update("blinds", { position: v })} style={{ flex: 1, padding: "4px", borderRadius: 5, border: `1px solid ${T.border}`, background: T.bg3, color: T.muted, fontSize: 9, cursor: "pointer" }}>
                {v === 0 ? "Closed" : v === 50 ? "Half" : "Open"}
              </button>
            ))}
          </div>
        </div>

        {/* Speaker EQ */}
        <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 11 }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.text }}>Speaker EQ</div>
            <div style={{ fontSize: 9, color: T.muted }}>Sonos / BT Speaker</div>
          </div>
          <Slider label="Volume" value={local.speaker?.volume ?? 70} onChange={v => update("speaker", { volume: v })} color="#F59E0B" />
          <div style={{ marginTop: 5 }}><Slider label="Bass"   value={local.speaker?.bass   ?? 50} onChange={v => update("speaker", { bass:   v })} color="#EF4444" /></div>
          <div style={{ marginTop: 5 }}><Slider label="Treble" value={local.speaker?.treble ?? 50} onChange={v => update("speaker", { treble: v })} color="#06B6D4" /></div>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={allOff} disabled={updating} style={{ flex: 1, padding: "8px", borderRadius: 7, border: "1px solid #EF4444", background: "rgba(239,68,68,.08)", color: "#EF4444", fontSize: 11, fontWeight: 700, cursor: "pointer", opacity: updating ? .6 : 1 }}>
          All Devices OFF
        </button>
        <button onClick={resetDefaults} disabled={updating} style={{ flex: 1, padding: "8px", borderRadius: 7, border: `1px solid ${T.border}`, background: T.bg3, color: T.muted, fontSize: 11, fontWeight: 700, cursor: "pointer", opacity: updating ? .6 : 1 }}>
          Reset Defaults
        </button>
      </div>
    </div>
  );
}
