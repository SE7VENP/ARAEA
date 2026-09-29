/**
 * /api/sensors, /api/simulation, /api/state routes
 */
import { Router } from "express";
import { clampNum, sanitizeStr } from "../middleware/validate.js";
import { getState, emitState }   from "../services/StateService.js";
import { updateSensor, isRunning, startSensors, stopSensors, cycleSensors } from "../services/SimulationService.js";

const router = Router();

router.get("/state", (_req, res) => {
  const { _moodCandidate, ...clean } = getState();
  res.json(clean);
});

router.post("/sensors", (req, res) => {
  const { temperature, humidity, light, motion, simulated = false } = req.body ?? {};
  const state = getState();
  updateSensor({
    temperature: clampNum(temperature, -40,  85,    state.sensor.temperature),
    humidity:    clampNum(humidity,    0,    100,   state.sensor.humidity),
    light:       clampNum(light,       0,    100000,state.sensor.light),
    motion:      !!motion,
    simulated:   !!simulated,
  });
  res.json({ ok: true });
});

router.post("/simulation", (req, res) => {
  const action = sanitizeStr(req.body?.action, ["start","stop","cycle"], null);
  if (!action) return res.status(400).json({ error: "Invalid action — use start|stop|cycle" });
  if (action === "start")  startSensors();
  if (action === "stop")   stopSensors();
  if (action === "cycle")  cycleSensors();
  const state = getState();
  state.simRunning = isRunning();
  emitState({ simRunning: state.simRunning });
  res.json({ ok: true, simRunning: state.simRunning });
});

export default router;
