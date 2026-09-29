// ══════════════════════════════════════════════════════════════════════════════
// useDashboardConfig.js
// User-facing visibility config for the EmotionFlowDashboard panels.
//
// Persists in localStorage so the user's choice survives page reloads.
//
// Three presets are exposed (Minimal / Standard / Pro). Toggling any individual
// panel switches the active preset to "custom" so the UI can show that the
// layout no longer matches a named preset.
// ══════════════════════════════════════════════════════════════════════════════
import { useState, useCallback } from "react";
import { lsGetJSON, lsSetJSON } from "../utils/storage.js";

const STORAGE_KEY_CONFIG = "araea_dashboard_config";
const STORAGE_KEY_PRESET = "araea_dashboard_preset";

// Each panel has a stable key (used in storage), a human label, and a column
// hint so the settings popover can show which side of the layout it lives on.
export const PANELS = [
  { key: "manualGrid",    label: "Manual emotion grid",  group: "left"  },
  { key: "textInput",     label: "Text input",            group: "left"  },
  { key: "webcamCard",    label: "Webcam status card",    group: "left"  },
  { key: "flowStepper",   label: "Flow stepper",          group: "left"  },
  { key: "audioAnalysis", label: "Audio analysis bars",   group: "left"  },
  { key: "trackList",     label: "Track recommendations", group: "right" },
  { key: "searchTab",     label: "Search tab",            group: "right" },
  { key: "queueTab",      label: "Queue tab",             group: "right" },
];

export const PRESETS = {
  minimal: {
    label: "Minimal",
    description: "Just emotion + visualizer + player",
    config: {
      manualGrid: true,  textInput: false, webcamCard: false,
      flowStepper: false, audioAnalysis: false,
      trackList: false,  searchTab: false, queueTab: false,
    },
  },
  standard: {
    label: "Standard",
    description: "Balanced — recommended",
    config: {
      manualGrid: true,  textInput: true,  webcamCard: true,
      flowStepper: false, audioAnalysis: false,
      trackList: true,   searchTab: true,  queueTab: false,
    },
  },
  pro: {
    label: "Pro",
    description: "Everything including diagnostics",
    config: {
      manualGrid: true,  textInput: true,  webcamCard: true,
      flowStepper: true, audioAnalysis: true,
      trackList: true,   searchTab: true,  queueTab: true,
    },
  },
};

const DEFAULT_CONFIG = PRESETS.standard.config;

export function useDashboardConfig() {
  const [config, setConfig] = useState(() => {
    const stored = lsGetJSON(STORAGE_KEY_CONFIG, null);
    // Merge over defaults so newly-added panels default to visible when older
    // saved configs are loaded.
    return stored && typeof stored === "object"
      ? { ...DEFAULT_CONFIG, ...stored }
      : DEFAULT_CONFIG;
  });

  const [preset, setPresetState] = useState(() => {
    const stored = lsGetJSON(STORAGE_KEY_PRESET, "standard");
    return PRESETS[stored] || stored === "custom" ? stored : "standard";
  });

  const setPanel = useCallback((key, visible) => {
    setConfig(prev => {
      const next = { ...prev, [key]: !!visible };
      lsSetJSON(STORAGE_KEY_CONFIG, next);
      return next;
    });
    // Toggling any individual panel breaks the preset match — reflect that.
    setPresetState("custom");
    lsSetJSON(STORAGE_KEY_PRESET, "custom");
  }, []);

  const applyPreset = useCallback((name) => {
    const p = PRESETS[name];
    if (!p) return;
    setConfig(p.config);
    setPresetState(name);
    lsSetJSON(STORAGE_KEY_CONFIG, p.config);
    lsSetJSON(STORAGE_KEY_PRESET, name);
  }, []);

  return { config, preset, setPanel, applyPreset };
}
