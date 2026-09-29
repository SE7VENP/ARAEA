/** /api/therapy routes */
import { Router }   from "express";
import { sanitizeStr } from "../middleware/validate.js";
import { getState }   from "../services/StateService.js";
import { getPrograms, start, stop, getHistory } from "../services/TherapyService.js";

const router = Router();

router.get("/programs", (_req, res) => res.json({ programs: getPrograms() }));
router.get("/history",  (_req, res) => res.json({ data: getHistory() }));
router.get("/state",    (_req, res) => res.json(getState().therapy));

router.post("/start", (req, res) => {
  const mode = sanitizeStr(req.body?.mode, Object.keys(getPrograms()), null);
  if (!mode) return res.status(400).json({ error: "Unknown therapy mode" });
  try {
    const program = start(mode);
    res.json({ ok: true, program });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/stop", (_req, res) => { stop(); res.json({ ok: true }); });

export default router;
