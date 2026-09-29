/**
 * /api/emotion routes
 */
import { Router }        from "express";
import { execFile, spawn } from "child_process";
import { writeFile, unlink, readFile } from "fs/promises";
import { join }          from "path";
import { tmpdir }        from "os";
import { sanitizeStr }   from "../middleware/validate.js";
import { getState, emit } from "../services/StateService.js";
import { runPipeline }   from "../services/PipelineService.js";

const VALID_EMOTIONS = [
  "neutral","happy","sad","angry","calm","energetic",
  "surprised","fearful","euphoric","melancholic","tense",
];

const DEEPFACE_MAP = {
  happy:    "happy",
  sad:      "sad",
  angry:    "angry",
  fear:     "tense",
  surprise: "surprised",
  disgust:  "tense",
  neutral:  "neutral",
  calm:     "calm",
  energetic:"energetic",
};

const router = Router();

function normaliseEmotionBody(raw) {
  const body = { ...raw };
  if (body.emotion_label !== undefined && body.label === undefined)
    body.label = body.emotion_label;
  if (body.valence_score !== undefined && body.valence === undefined)
    body.valence = body.valence_score;
  if (body.arousal_score !== undefined && body.arousal === undefined)
    body.arousal = body.arousal_score;
  return body;
}

// POST /api/emotion — used by Python emotion_detector.py AND frontend manual
// When browser webcam is active, ignore posts from the Python script to avoid conflict
router.post("/", (req, res) => {
  const body = normaliseEmotionBody(req.body ?? {});

  if (body.label && !VALID_EMOTIONS.includes(body.label))
    return res.status(400).json({ error: "Invalid emotion label" });

  // If source is from Python script (mock or webcam) and browser webcam was recently
  // active (within last 10s), ignore it to prevent conflict
  const state = getState();
  const lastWebcamTime = state.emotion?.lastWebcamTime ?? 0;
  const isFromPython = body.source === "mock" || body.source === "webcam";
  if (isFromPython && Date.now() - lastWebcamTime < 10000) {
    // Browser webcam is active — silently ignore Python script posts
    return res.json({ ok: true, mood: state.emotion.label ?? "neutral", ignored: true });
  }

  state.emotion = { ...state.emotion, ...body };
  emit("emotion_update", state.emotion);
  runPipeline();

  res.json({ ok: true, mood: state.emotion.label ?? "neutral" });
});

// POST /api/emotion/manual
router.post("/manual", (req, res) => {
  const label = sanitizeStr(req.body.emotion, VALID_EMOTIONS, "neutral");
  const state = getState();
  state.emotion = { label, confidence: 1, valence: 0.5, arousal: 0.5, source: "manual" };
  emit("emotion_update", state.emotion);
  runPipeline();
  res.json({ ok: true });
});

// Python script written to temp file — reads frame path from argv[1], outputs JSON
const DEEPFACE_SCRIPT = `
import sys, base64, json, os
try:
    import numpy as np
    from deepface import DeepFace
    import cv2

    frame_path = sys.argv[1]
    out_path   = sys.argv[2]

    with open(frame_path, 'r') as f:
        b64 = f.read().strip()

    img_bytes = base64.b64decode(b64)
    arr   = np.frombuffer(img_bytes, np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)

    if frame is None:
        result = {"emotion": None, "confidence": 0}
    else:
        r    = DeepFace.analyze(img_path=frame, actions=["emotion"],
                   enforce_detection=False, detector_backend="opencv", silent=True)
        face  = r[0] if isinstance(r, list) else r
        label = face.get("dominant_emotion", "neutral").lower()
        conf  = face.get("emotion", {}).get(label, 50) / 100.0
        result = {"emotion": label, "confidence": round(float(conf), 3)}
except Exception as e:
    result = {"emotion": None, "confidence": 0, "error": str(e)}

with open(out_path, 'w') as f:
    json.dump(result, f)
`;


// ── Direct stdin processing (Unix only) ──────────────────────────────────────
// Avoids temp-file overhead on Linux/macOS. Windows keeps temp-file approach.
async function processDirectly(base64Frame) {
  const SCRIPT = `
import sys, base64, json
try:
    import numpy as np
    from deepface import DeepFace
    import cv2
    b64 = sys.stdin.read().strip()
    img_bytes = base64.b64decode(b64)
    arr   = np.frombuffer(img_bytes, np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if frame is None:
        print(json.dumps({"emotion": None, "confidence": 0}))
    else:
        r    = DeepFace.analyze(img_path=frame, actions=["emotion"],
                   enforce_detection=False, detector_backend="opencv", silent=True)
        face  = r[0] if isinstance(r, list) else r
        label = face.get("dominant_emotion", "neutral").lower()
        conf  = face.get("emotion", {}).get(label, 50) / 100.0
        print(json.dumps({"emotion": label, "confidence": round(float(conf), 3)}))
except Exception as e:
    print(json.dumps({"emotion": None, "confidence": 0, "error": str(e)}))
`;
  return new Promise((resolve, reject) => {
    const proc = spawn("python3", ["-c", SCRIPT]);
    let stdout = "";
    proc.stdout.on("data", d => { stdout += d; });
    proc.on("close", code => {
      try {
        const result = JSON.parse(stdout.trim());
        resolve(result);
      } catch {
        reject(new Error("Failed to parse DeepFace output"));
      }
    });
    proc.on("error", reject);
    proc.stdin.write(base64Frame);
    proc.stdin.end();
  });
}

// POST /api/emotion/webcam — runs DeepFace; uses direct stdin on Unix, temp files on Windows
const IS_WINDOWS = process.platform === "win32";

router.post("/webcam", async (req, res) => {
  const { frame } = req.body ?? {};
  if (!frame) return res.json({ emotion: null, confidence: 0 });

  const id         = Date.now();
  const scriptPath = join(tmpdir(), `araea_df_${id}.py`);
  const framePath  = join(tmpdir(), `araea_frame_${id}.txt`);
  const outPath    = join(tmpdir(), `araea_out_${id}.json`);

  try {
    await writeFile(scriptPath, DEEPFACE_SCRIPT);
    await writeFile(framePath, frame);
  } catch {
    return res.json({ emotion: null, confidence: 0 });
  }

  const cleanup = () => {
    unlink(scriptPath).catch(() => {});
    unlink(framePath).catch(() => {});
    unlink(outPath).catch(() => {});
  };

  try {
    let result;

    if (IS_WINDOWS) {
      // Windows: use temp-file approach (spawn() stdin hangs on win32 cmd.exe)
      await new Promise((resolve, reject) => {
        execFile("python", [scriptPath, framePath, outPath], { timeout: 30000 }, (err) => {
          if (err) reject(err); else resolve();
        });
      });
      const raw = await readFile(outPath, "utf8");
      result = JSON.parse(raw);
      cleanup();
    } else {
      // Unix (Linux/macOS): pass base64 directly via stdin — no temp files
      cleanup(); // nothing was written; delete the empty files
      result = await processDirectly(frame);
    }

    if (result?.emotion && result.confidence >= 0.35) {
      const mapped = DEEPFACE_MAP[result.emotion] ?? result.emotion;
      if (!VALID_EMOTIONS.includes(mapped))
        return res.json({ emotion: null, confidence: 0 });

      const state = getState();
      state.emotion = { label: mapped, confidence: result.confidence, source: "webcam", lastWebcamTime: Date.now() };
      emit("emotion_update", state.emotion);
      return res.json({ emotion: mapped, confidence: result.confidence });
    }
    // DeepFace ran but found no face or low confidence
    return res.json({ emotion: null, confidence: 0, reason: "no_face" });
  } catch (err) {
    cleanup();
    // Python/DeepFace not installed or timed out
    return res.json({ emotion: null, confidence: 0, reason: "deepface_unavailable", error: err?.message });
  }
});

export default router;
