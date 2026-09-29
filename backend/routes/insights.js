/** /api/insights, /api/scene, /api/activity, /api/presentation, /api/room routes */
import { Router }   from "express";
import { getState, emit } from "../services/StateService.js";
import { getMemory }      from "../services/DatabaseService.js";
import { runPipeline }    from "../services/PipelineService.js";
import { ACTIVITY_PRESETS }     from "../data/activityPresets.js";
import { PRESENTATION_MOMENTS, ROOM_PRESETS, MOMENT_SCENE_MAP } from "../data/presentationData.js";

const router = Router();

// ── AI insights summary ────────────────────────────────────
router.get("/insights", (_req, res) => {
  const mem     = getMemory();
  const counts  = mem.moods.reduce((a, h) => ({ ...a, [h.mood]: (a[h.mood] ?? 0) + 1 }), {});
  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "neutral";
  const avgStress = mem.therapy.length > 0
    ? Math.round(mem.therapy.reduce((a, t) => a + t.stressReduction, 0) / mem.therapy.length)
    : 0;
  const bio = getState().biometric;
  res.json({
    dominantMood:      dominant,
    totalSessions:     mem.therapy.length,
    avgStressReduction:avgStress,
    moodDistribution:  counts,
    weeklyHighlight:   dominant === "calm" ? "Excellent relaxation week 🌿" : dominant === "euphoric" ? "High energy week 🔥" : "Balanced week ✓",
    recommendation:    bio.stressScore > 60 ? "Consider a therapy session to reduce stress"
                     : bio.hrv < 35         ? "HRV is low — try the breathwork program"
                     : "System is well-calibrated — great work!",
  });
});

// ── Scene ──────────────────────────────────────────────────
router.get("/scene",  (_req, res) => res.json({ active: getState().activeScene }));
router.post("/scene", (req, res) => {
  const VALID = ["focus","relax","party","sleep","wakeup","workout","cosmic","jazz",null];
  const scene  = req.body.scene ?? null;
  if (scene !== null && !VALID.includes(scene)) return res.status(400).json({ error: "Invalid scene" });
  const state = getState();
  state.activeScene = scene;
  emit("scene_change", { scene });
  runPipeline();
  res.json({ ok: true });
});

// ── Activity presets ───────────────────────────────────────
router.get("/activity/presets",  (_req, res) => res.json({ presets: ACTIVITY_PRESETS }));
router.post("/activity/start", (req, res) => {
  const preset = ACTIVITY_PRESETS[req.body?.presetId];
  if (!preset) return res.status(400).json({ error: "Unknown preset" });
  const state = getState();
  state.activeScene = preset.scene;
  emit("scene_change", { scene: preset.scene });
  res.json({ ok: true, preset });
});

// ── Presentation / room ────────────────────────────────────
router.get("/presentation/moments", (_req, res) => res.json({ moments: PRESENTATION_MOMENTS }));
router.post("/presentation/moment", (req, res) => {
  const m = PRESENTATION_MOMENTS[req.body?.momentId];
  if (!m) return res.status(400).json({ error: "Unknown moment" });
  if (m.music) {
    const state = getState();
    state.activeScene = MOMENT_SCENE_MAP[m.music] ?? "relax";
    emit("scene_change", { scene: state.activeScene });
    runPipeline();
  }
  res.json({ ok: true, moment: m });
});

router.get("/room/presets",  (_req, res) => res.json({ presets: ROOM_PRESETS }));
router.post("/room/apply", (req, res) => {
  const r = ROOM_PRESETS[req.body?.presetId];
  if (!r) return res.status(400).json({ error: "Unknown preset" });
  res.json({ ok: true, preset: r });
});

export default router;
