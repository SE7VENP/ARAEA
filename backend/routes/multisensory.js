/** /api/multisensory routes */
import { Router } from "express";
import { getState, emit } from "../services/StateService.js";
import { runPipeline }    from "../services/PipelineService.js";

const router = Router();

router.get("/", (_req, res) => res.json(getState().multisensory));

router.post("/:device", (req, res) => {
  const { device } = req.params;
  const ms = getState().multisensory;
  if (!ms[device]) return res.status(400).json({ error: `Unknown device: ${device}` });
  ms[device] = { ...ms[device], ...req.body };
  emit("multisensory_update", { device, data: ms[device] });
  runPipeline();
  res.json({ ok: true, device: ms[device] });
});

router.post("/", (req, res) => {
  const ms = getState().multisensory;
  Object.keys(req.body ?? {}).forEach(k => {
    if (ms[k]) ms[k] = { ...ms[k], ...req.body[k] };
  });
  emit("multisensory_update", { all: ms });
  res.json({ ok: true });
});

export default router;
