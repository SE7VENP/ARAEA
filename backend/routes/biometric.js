/** /api/biometric routes */
import { Router } from "express";
import { clampNum } from "../middleware/validate.js";
import { getState, mergeState, emit } from "../services/StateService.js";
import { runPipeline } from "../services/PipelineService.js";

const router = Router();

router.get("/", (_req, res) => res.json(getState().biometric));

router.post("/", (req, res) => {
  const { heartRate, hrv, stressScore, coherence, breathRate, skinConductance } = req.body ?? {};
  const bio = getState().biometric;
  const update = {};
  if (heartRate       != null) update.heartRate       = clampNum(heartRate,       30,  250, bio.heartRate);
  if (hrv             != null) update.hrv             = clampNum(hrv,             0,   200, bio.hrv);
  if (stressScore     != null) update.stressScore     = clampNum(stressScore,     0,   100, bio.stressScore);
  if (coherence       != null) update.coherence       = clampNum(coherence,       0,   1,   bio.coherence);
  if (breathRate      != null) update.breathRate      = clampNum(breathRate,      0,   60,  bio.breathRate);
  if (skinConductance != null) update.skinConductance = clampNum(skinConductance, 0,   10,  bio.skinConductance);
  mergeState({ biometric: { ...bio, ...update, source: "hardware" } });
  emit("biometric_update", getState().biometric);

  const s = getState().biometric.stressScore;
  if      (s > 75) { getState().emotion = { label:"tense", confidence:0.8, valence:0.3, arousal:0.8, source:"biometric" }; emit("emotion_update", getState().emotion); runPipeline(); }
  else if (s < 25 && getState().biometric.coherence > 0.7) { getState().emotion = { label:"calm", confidence:0.85, valence:0.7, arousal:0.3, source:"biometric" }; emit("emotion_update", getState().emotion); runPipeline(); }
  res.json({ ok: true });
});

router.get("/history", (_req, res) => {
  const now   = Date.now();
  const trend = Array.from({ length: 24 }, (_, i) => ({
    time:       new Date(now - (23 - i) * 3_600_000).toISOString(),
    heartRate:  65 + Math.round(Math.sin(i / 3) * 10   + Math.random() * 5),
    stressScore:30 + Math.round(Math.sin(i / 4 + 1) * 20 + Math.random() * 10),
    hrv:        40 + Math.round(Math.cos(i / 3) * 8   + Math.random() * 4),
  }));
  res.json({ data: trend });
});

export default router;
