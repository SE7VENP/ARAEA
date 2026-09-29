/** /api/gesture routes */
import { Router }  from "express";
import { sanitizeStr } from "../middleware/validate.js";
import { getState, emit, emitState } from "../services/StateService.js";

const VALID_GESTURES = ["swipe_right","swipe_left","thumbs_up","thumbs_down","open_palm","fist"];

// All available scenes in cycle order (fixes: was always returning 'party')
const SCENES = ["party", "focus", "relax", "sleep", "wakeup", "workout", "cosmic", "jazz"];

const router = Router();

router.post("/", (req, res) => {
  const { gesture, confidence = 0 } = req.body ?? {};
  const action = sanitizeStr(gesture, VALID_GESTURES, null);
  if (!action) return res.status(400).json({ error: "Unknown gesture" });

  const state = getState();
  state.gestures = { lastGesture: action, confidence, history: [{ gesture: action, confidence, timestamp: new Date() }, ...state.gestures.history.slice(0, 19)] };
  emit("gesture_detected", state.gestures);

  const ms = state.multisensory;

  if (action === "swipe_right") {
    // Cycle FORWARD through all scenes
    const currentIndex = SCENES.indexOf(state.activeScene ?? "");
    state.activeScene = SCENES[(currentIndex + 1) % SCENES.length];
  }
  if (action === "swipe_left") {
    // Clear the active scene — UI label says "Clear scene"; null lets emotion/time pick music
    state.activeScene = null;
  }
  if (action === "thumbs_up")    ms.ledStrip.brightness = Math.min(100, ms.ledStrip.brightness + 20);
  if (action === "thumbs_down")  ms.ledStrip.brightness = Math.max(10,  ms.ledStrip.brightness - 20);
  if (action === "open_palm")    Object.keys(ms).forEach(k => { if (ms[k].active !== undefined) ms[k].active = true; });
  if (action === "fist")         Object.keys(ms).forEach(k => { if (ms[k].active !== undefined) ms[k].active = false; });

  emitState({ activeScene: state.activeScene, multisensory: ms });
  res.json({ ok: true, action, activeScene: state.activeScene });
});

export default router;
