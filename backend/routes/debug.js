/**
 * /api/debug routes — DEVELOPMENT ONLY
 * Never mounted in production (see server.js).
 */
import { Router }  from "express";
import { sanitizeStr } from "../middleware/validate.js";
import { getState, emit } from "../services/StateService.js";

const VALID_MOODS = ["euphoric","happy","calm","melancholic","tense","sad","neutral"];

const router = Router();

router.get("/mood", (req, res) => {
  const mood = sanitizeStr(req.query.mood, VALID_MOODS, "neutral");
  getState().mood = mood;
  emit("state_update", { mood });
  res.json({ ok: true, mood });
});

export default router;
