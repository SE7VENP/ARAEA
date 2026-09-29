// ── Arctic design-token system ────────────────────────────────────────────────
// buildT produces a flat token object for any hue/sat/mode/bgDepth combination.
// ThemeContext + useTheme give React components access without prop drilling.
// ThemeProvider holds the single mutable reference and re-renders on change.

import React, { createContext, useContext, useState, useCallback } from "react";

export function buildT(hue = 210, sat = 70, mode = "light", bgDepth = 55) {
  const bd   = bgDepth / 100;
  const accL = mode === "dark" ? 62 : 50;
  const acc  = `hsl(${hue},${sat}%,${accL}%)`;
  const acc2 = `hsl(${(hue + 30) % 360},${sat}%,${accL - 2}%)`;

  if (mode === "dark") {
    const ds = 10 + sat * 0.28 * bd;
    const DL = [9, 12, 15, 18, 25];
    return {
      bg: `hsl(${hue},${ds+2}%,${DL[0]}%)`,  bg1:`hsl(${hue},${ds+4}%,${DL[1]}%)`,
      bg2:`hsl(${hue},${ds}%,${DL[2]}%)`,    bg3:`hsl(${hue},${ds+2}%,${DL[3]}%)`,
      bg4:`hsl(${hue},${ds+7}%,${DL[4]}%)`,
      border:`hsla(${hue},40%,80%,0.10)`,     borderHi:`hsla(${hue},40%,80%,0.22)`,
      text:"#e2e8f0", muted:"#94a3b8", bright:"#f8fafc", dim:"#4b5563",
      acc, acc2,
      accBg:`hsl(${hue},${sat}%,18%)`,        acc2Bg:`hsl(${(hue+30)%360},${sat}%,18%)`,
      success:"#10b981", danger:"#ef4444", warning:"#f59e0b",
      sh:"0 1px 4px rgba(0,0,0,.4)", shMd:"0 4px 16px rgba(0,0,0,.5)",
      mode, bgDepth,
    };
  }

  if (mode === "warm") {
    const wh = (hue + 16) % 360;
    const ws = sat * bd * 0.55;
    const cs = sat * bd * 0.38;
    const pL = 96 - ws * 0.08;
    const cL = 99 - cs * 0.06;
    return {
      bg: `hsl(${wh},${ws}%,${pL.toFixed(1)}%)`,        bg1:`hsl(${wh},${ws+6}%,${(pL-3).toFixed(1)}%)`,
      bg2:`hsl(${wh},${cs}%,${cL.toFixed(1)}%)`,        bg3:`hsl(${wh},${ws}%,${(pL+1).toFixed(1)}%)`,
      bg4:`hsl(${wh},${ws+10}%,${(pL-7).toFixed(1)}%)`,
      border:`hsla(${wh},${ws+15}%,25%,0.12)`,          borderHi:`hsla(${wh},${ws+15}%,25%,0.24)`,
      text:"#1c1917", muted:"#78716c", bright:"#0c0a09", dim:"#a8a29e",
      acc, acc2,
      accBg:`hsl(${hue},${sat}%,95%)`,                  acc2Bg:`hsl(${(hue+30)%360},${sat}%,95%)`,
      success:"#10b981", danger:"#ef4444", warning:"#f59e0b",
      sh:`0 1px 3px hsla(${wh},30%,20%,.09)`,           shMd:`0 4px 14px hsla(${wh},30%,20%,.12)`,
      mode, bgDepth,
    };
  }

  // Light mode
  const ps = sat * bd * 0.54;
  const cs = sat * bd * 0.36;
  const pL = 96 - ps * 0.06;
  const cL = 99 - cs * 0.04;
  return {
    bg: `hsl(${hue},${ps.toFixed(1)}%,${pL.toFixed(1)}%)`,
    bg1:`hsl(${hue},${(ps+5).toFixed(1)}%,${(pL-3).toFixed(1)}%)`,
    bg2:`hsl(${hue},${cs.toFixed(1)}%,${cL.toFixed(1)}%)`,
    bg3:`hsl(${hue},${ps.toFixed(1)}%,${(pL+1).toFixed(1)}%)`,
    bg4:`hsl(${hue},${(ps+8).toFixed(1)}%,${(pL-7).toFixed(1)}%)`,
    border:`hsla(${hue},${ps+12}%,25%,0.11)`,
    borderHi:`hsla(${hue},${ps+12}%,25%,0.22)`,
    text:"#1e293b", muted:"#64748b", bright:"#0f172a", dim:"#94a3b8",
    acc, acc2,
    accBg:`hsl(${hue},${sat}%,95.5%)`,
    acc2Bg:`hsl(${(hue+30)%360},${sat}%,95.5%)`,
    success:"#10b981", danger:"#ef4444", warning:"#f59e0b",
    sh:`0 1px 3px hsla(${hue},${ps+10}%,20%,.08)`,
    shMd:`0 4px 14px hsla(${hue},${ps+10}%,20%,.10)`,
    mode, bgDepth,
  };
}

// ── Helpers to apply theme to document ───────────────────
function applyToDom(t) {
  if (typeof document === "undefined") return;
  document.body.style.background = t.bg;
  document.body.style.color      = t.text;
  document.documentElement.style.setProperty("--sb-color",    t.bg4);
  document.documentElement.style.setProperty("--sb-bg",       t.bg1);
  document.documentElement.style.setProperty("--body-bg",     t.bg);
  document.documentElement.style.setProperty("--body-color",  t.text);
}

// ── Safe localStorage wrapper ─────────────────────────────
function loadSavedTheme() {
  try {
    const raw = localStorage.getItem("araea_theme_hsl");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ── Context ───────────────────────────────────────────────
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const saved = loadSavedTheme();
  const [T, setT] = useState(() => {
    const t = buildT(saved?.hue ?? 210, saved?.sat ?? 70, saved?.mode ?? "light", saved?.bgDepth ?? 55);
    applyToDom(t);
    return t;
  });

  const updateTheme = useCallback((data) => {
    if (data?.hue == null || data?.sat == null) return;
    const newT = buildT(data.hue, data.sat, data.mode ?? "light", data.bgDepth ?? 55);
    applyToDom(newT);
    try {
      localStorage.setItem("araea_theme_hsl", JSON.stringify({
        hue: data.hue, sat: data.sat,
        mode: data.mode ?? "light", bgDepth: data.bgDepth ?? 55,
      }));
    } catch {}
    setT(newT);
  }, []);

  return (
    <ThemeContext.Provider value={{ T, updateTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
