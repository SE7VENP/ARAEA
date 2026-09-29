// ── Icon sidebar navigation ───────────────────────────────────────────────────
import React, { useState, useRef } from "react";
import { useTheme } from "../../theme.jsx";
import { NAV } from "../../constants.js";
import {
  IconDashboard, IconVisualizer, IconBiometrics, IconTherapy,
  IconMicrophone, IconMultiSensory, IconCommunity, IconInsights,
  IconSensors, IconHistory, IconSettings, IconCamera, IconActivity,
} from "../Icons.jsx";

const NAV_COLORS = {
  dashboard:    "#1DB954",
  visualizer:   "#a855f7",
  biometrics:   "#ef4444",
  therapy:      "#06b6d4",
  voice:        "#f59e0b",
  multisensory: "#8b5cf6",
  community:    "#ec4899",
  insights:     "#3b82f6",
  sensors:      "#10b981",
  history:      "#94a3b8",
  settings:     "#64748b",
  theme:        "#f97316",
  about:        "#6366f1",
};

const ICON_MAP = {
  dashboard:    IconDashboard,
  visualizer:   IconVisualizer,
  biometrics:   IconBiometrics,
  therapy:      IconTherapy,
  voice:        IconMicrophone,
  multisensory: IconMultiSensory,
  community:    IconCommunity,
  insights:     IconInsights,
  sensors:      IconSensors,
  history:      IconHistory,
  settings:     IconSettings,
  theme:        IconInsights,
  about:        IconActivity,
};

function Tooltip({ label, desc, anchorRect, T }) {
  if (!anchorRect) return null;
  return (
    <div style={{
      position: "fixed",
      top:  anchorRect.top + anchorRect.height / 2,
      left: anchorRect.right + 10,
      transform: "translateY(-50%)",
      background: T.bg1 ?? "#1e293b",
      color: T.text,
      padding: "6px 12px",
      borderRadius: 8,
      fontSize: 12,
      fontWeight: 500,
      fontFamily: "'Outfit', sans-serif",
      whiteSpace: "nowrap",
      border: `1px solid ${T.border}`,
      boxShadow: "0 4px 20px rgba(0,0,0,.5)",
      zIndex: 99999,
      pointerEvents: "none",
      lineHeight: 1.5,
    }}>
      {label}
      {desc && <div style={{ fontSize: 9, color: T.muted, fontWeight: 400, marginTop: 1 }}>{desc}</div>}
      <span style={{
        position: "absolute", left: -4, top: "50%",
        transform: "translateY(-50%) rotate(45deg)",
        width: 8, height: 8,
        background: T.bg1 ?? "#1e293b",
        borderLeft: `1px solid ${T.border}`,
        borderBottom: `1px solid ${T.border}`,
      }} />
    </div>
  );
}

function NavButton({ n, active, alert, T, onNavigate }) {
  const IC  = ICON_MAP[n.id];
  const col = NAV_COLORS[n.id] ?? T.acc;
  const [hov,  setHov]  = useState(false);
  const [rect, setRect] = useState(null);
  const ref = useRef(null);

  return (
    <>
      <button
        ref={ref}
        onClick={() => onNavigate(n.id)}
        onMouseEnter={() => { setRect(ref.current?.getBoundingClientRect()); setHov(true); }}
        onMouseLeave={() => { setHov(false); setRect(null); }}
        aria-label={n.label}
        style={{
          width: "100%", height: 38,
          borderRadius: 8,
          border: "none",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative",
          // active = solid tinted bg, hover = lighter tint, idle = transparent
          background: active ? `${col}28` : hov ? `${col}14` : "transparent",
          transition: "background .12s",
          flexShrink: 0,
          outline: "none",
        }}
      >
        {IC && (
          <IC
            size={18}
            color={active ? col : hov ? col : T.muted}
            style={!active && !hov ? { opacity: 0.85 } : {}}
          />
        )}

        {/* left-edge active bar */}
        {active && (
          <div style={{
            position: "absolute", left: 0, top: "22%", bottom: "22%",
            width: 3, borderRadius: "0 3px 3px 0",
            background: col,
            boxShadow: `0 0 6px ${col}99`,
          }} />
        )}

        {alert && (
          <div style={{
            position: "absolute", top: 6, right: 6,
            width: 6, height: 6, borderRadius: "50%",
            background: "#ef4444",
            boxShadow: "0 0 5px #ef4444aa",
            animation: "pulse-dot 1.4s ease-in-out infinite",
          }} />
        )}
      </button>
      {hov && <Tooltip label={n.label} desc={n.desc} anchorRect={rect} T={T} />}
    </>
  );
}

function ToggleButton({ id, label, active, colorOn, Icon, onClick, T }) {
  const [hov,  setHov]  = useState(false);
  const [rect, setRect] = useState(null);
  const ref = useRef(null);
  const isCam = id === "_cam";

  return (
    <>
      <button
        ref={ref}
        onClick={onClick}
        onMouseEnter={() => { setRect(ref.current?.getBoundingClientRect()); setHov(true); }}
        onMouseLeave={() => { setHov(false); setRect(null); }}
        aria-label={label}
        style={{
          width: "100%", height: 38,
          borderRadius: 8,
          border: `1px solid ${active ? colorOn + "55" : T.border}`,
          cursor: "pointer",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 3,
          background: active ? `${colorOn}1a` : hov ? `${colorOn}0d` : "transparent",
          color: active ? colorOn : hov ? colorOn : T.muted,
          transition: "all .14s",
          flexShrink: 0,
          outline: "none",
        }}
      >
        <div style={{ position: "relative" }}>
          <Icon size={15} color="currentColor" />
          {active && (
            <div style={{
              position: "absolute", top: -2, right: -2,
              width: 5, height: 5, borderRadius: "50%",
              background: colorOn,
              animation: "pulse-dot 1.4s ease-in-out infinite",
            }} />
          )}
        </div>
        <span style={{
          fontSize: 7, fontFamily: "monospace",
          fontWeight: 600, letterSpacing: .8, lineHeight: 1,
        }}>
          {isCam ? (active ? "CAM ON" : "CAM") : (active ? "MIC ON" : "MIC")}
        </span>
      </button>
      {hov && <Tooltip label={label} anchorRect={rect} T={T} />}
    </>
  );
}

export default function IconSidebar({ page, setPage, therapyActive, micMode, cameraOn, onMic, onCamera }) {
  const { T } = useTheme();

  return (
    <div style={{
      width: 58,
      height: "100%",
      background: T.bg2,
      borderRight: `1px solid ${T.border}`,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "0 6px 8px",
      flexShrink: 0,
    }}>

      {/* ── ARAEA Logo — same height zone as header (44px) ── */}
      <div style={{
        width: "100%", height: 44,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
        marginBottom: 8,
      }}>
        <div style={{
          width: 36, height: 36,
          borderRadius: 12,
          background: "linear-gradient(145deg, #1DB954 0%, #1565c0 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 10px rgba(29,185,84,.28)",
          userSelect: "none", flexShrink: 0,
        }}>
          <span style={{
            fontSize: 9, fontWeight: 700, color: "#fff",
            letterSpacing: 1, lineHeight: 1,
            fontFamily: "'Playfair Display', serif",
          }}>ARAEA</span>
        </div>
      </div>

      {/* ── Nav buttons ── */}
      <div style={{
        flex: 1,
        display: "flex", flexDirection: "column",
        gap: 3,
        width: "100%",
        overflowY: "auto", overflowX: "visible",
        scrollbarWidth: "none",
        minHeight: 0,
      }}>
        {NAV.map(n => (
          <NavButton
            key={n.id} n={n}
            active={page === n.id}
            alert={n.id === "therapy" && therapyActive}
            T={T} onNavigate={setPage}
          />
        ))}
      </div>

      {/* ── Divider ── */}
      <div style={{
        width: 34, height: 1,
        background: T.border,
        margin: "8px 0",
        flexShrink: 0,
      }} />

      {/* ── Cam + Mic ── */}
      <div style={{
        display: "flex", flexDirection: "column",
        gap: 4, width: "100%", flexShrink: 0,
      }}>
        <ToggleButton
          id="_cam"
          label={cameraOn ? "Camera ON — click to disable" : "Camera OFF — click to enable"}
          active={cameraOn} colorOn="#10b981"
          Icon={IconCamera} onClick={onCamera} T={T}
        />
        <ToggleButton
          id="_mic"
          label={micMode ? "Microphone LIVE — click to disable" : "Microphone OFF — click to enable"}
          active={micMode} colorOn="#ef4444"
          Icon={IconMicrophone} onClick={onMic} T={T}
        />
      </div>
    </div>
  );
}
