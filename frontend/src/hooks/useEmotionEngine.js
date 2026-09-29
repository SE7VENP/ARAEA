// useEmotionEngine.js — stable face-api.js in-browser emotion detection
import { useState, useEffect, useRef, useCallback } from "react";
import * as faceapi from "@vladmandic/face-api";
import { emotion as emotionAPI } from "../services/backendAPI.js";

const TEXT_KEYWORDS = {
  euphoric:    /\b(euphoric|ecstatic|elated|overjoyed|thrilled|pumped|on fire|euphoria|exhilarated|stoked)\b/i,
  happy:       /\b(happy|joy|great|amazing|wonderful|excited|love|fantastic|good mood|cheerful|delighted|awesome|excellent|glad)\b/i,
  calm:        /\b(calm|peaceful|relaxed|serene|tranquil|chill|easy|gentle|mellow|quiet|still|soothing|zen)\b/i,
  melancholic: /\b(melancholy|nostalgic|wistful|longing|bittersweet|missing|homesick|reminiscing|pensive|dreamy)\b/i,
  sad:         /\b(sad|crying|depressed|miserable|unhappy|down|blue|heartbroken|grief|sorrow|tears|lonely|hopeless|empty)\b/i,
  tense:       /\b(angry|furious|rage|hate|frustrated|annoyed|stressed|anxious|nervous|worried|tense|overwhelmed|panic|intense)\b/i,
};

function detectEmotionFromText(text) {
  if (!text || text.trim().length < 3) return null;
  for (const [emotion, pattern] of Object.entries(TEXT_KEYWORDS)) {
    if (pattern.test(text)) return { emotion, confidence: 0.75 };
  }
  const pos = /\b(good|nice|ok|okay|fine|well|better|decent|alright)\b/i.test(text);
  const neg = /\b(bad|terrible|awful|horrible|not good|rough|hard|difficult)\b/i.test(text);
  if (pos && !neg) return { emotion: "happy", confidence: 0.55 };
  if (neg && !pos) return { emotion: "sad",   confidence: 0.55 };
  return null;
}

const EXPR_MAP = {
  happy:     "happy",
  sad:       "sad",
  angry:     "angry",
  fearful:   "tense",
  disgusted: "sad",
  surprised: "surprised",
  neutral:   "neutral",
};

// Minimum confidence to commit an emotion — below this it's too uncertain
const MIN_CONFIDENCE = 0.35;

let _modelsPromise = null;
function loadModels() {
  if (_modelsPromise) return _modelsPromise;
  _modelsPromise = Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
    faceapi.nets.faceExpressionNet.loadFromUri("/models"),
  ]).then(() => true).catch(e => {
    _modelsPromise = null;
    console.error("[face-api] load failed:", e.message);
    return false;
  });
  return _modelsPromise;
}

// How long the same emotion is "locked in" before webcam can re-emit it
// 5s means: if the detected emotion changes, it updates within 5 seconds
// This allows real-time emotion tracking without restarting the pipeline too aggressively
const SAME_EMOTION_LOCK_MS = 5_000;

export function useEmotionEngine({ videoRef, cameraOn = false }) {
  // NOTE: socketEmotion intentionally removed — socket causes jumpy behaviour.
  // Face-api (webcam), manual buttons, and text input are the only sources.

  const [emotion,          setEmotion]          = useState(null);
  const [confidence,       setConfidence]       = useState(0);
  const [source,           setSource]           = useState(null);
  const [status,           setStatus]           = useState("idle");
  const [lastTextInput,    setLastTextInput]    = useState("");
  const [webcamDetecting,  setWebcamDetecting]  = useState(false);
  const [webcamEmotion,    setWebcamEmotion]    = useState(null);
  const [webcamError,      setWebcamError]      = useState(null);
  const [webcamErrorCount, setWebcamErrorCount] = useState(0);

  const manualRef        = useRef(null);
  const manualExpiresRef = useRef(0);
  const textTimerRef     = useRef(null);
  const sourceRef        = useRef(null);
  const cameraOnRef      = useRef(cameraOn);
  const lastEmittedRef   = useRef(null);
  const lastEmittedAtRef = useRef(0);
  const stopLoopRef      = useRef(false);
  const consecutiveRef   = useRef({ history: [], lastEmitted: null, lastEmittedAt: 0 }); // smoothing buffer

  useEffect(() => {
    cameraOnRef.current = cameraOn;
    if (!cameraOn && sourceRef.current === "webcam") {
      sourceRef.current = null;
    }
  }, [cameraOn]);

  const emitEmotion = useCallback((next, conf, src) => {
    setEmotion(next);
    setConfidence(conf);
    setSource(src);
    setStatus(next ? "detected" : "idle");
  }, []);

  // MANUAL — highest priority, 3-min lock
  const setManualEmotion = useCallback((em) => {
    clearTimeout(textTimerRef.current);
    manualRef.current        = em;
    sourceRef.current        = em ? "manual" : null;
    lastEmittedRef.current   = null;
    lastEmittedAtRef.current = 0;
    if (em) {
      manualExpiresRef.current = Date.now() + 3 * 60 * 1000;
      emitEmotion(em, 1.0, "manual");
      setTimeout(() => {
        if (Date.now() < manualExpiresRef.current) return;
        if (sourceRef.current !== "manual") return;
        manualRef.current = null; manualExpiresRef.current = 0;
        sourceRef.current = null; lastEmittedRef.current = null;
      }, 3 * 60 * 1000);
    } else {
      manualExpiresRef.current = 0;
      emitEmotion(null, 0, null);
      setStatus("idle");
    }
  }, [emitEmotion]);

  const clearEmotion = useCallback(() => {
    manualRef.current = null; manualExpiresRef.current = 0;
    sourceRef.current = null;
    lastEmittedRef.current = null; lastEmittedAtRef.current = 0;
    emitEmotion(null, 0, null);
    setStatus("idle");
  }, [emitEmotion]);

  // TEXT — 500ms debounce
  const setTextInput = useCallback((text) => {
    setLastTextInput(text);
    clearTimeout(textTimerRef.current);
    if (!text.trim() || manualRef.current) return;
    textTimerRef.current = setTimeout(() => {
      const r = detectEmotionFromText(text);
      if (r && sourceRef.current !== "manual") {
        sourceRef.current = "text";
        lastEmittedRef.current   = r.emotion;
        lastEmittedAtRef.current = Date.now();
        emitEmotion(r.emotion, r.confidence, "text");
      }
    }, 500);
  }, [emitEmotion]);

  // WEBCAM — face-api.js, scans every 800ms, 5s same-emotion lock
  useEffect(() => {
    if (!cameraOn) return;
    stopLoopRef.current = false;

    const loop = async () => {
      if (stopLoopRef.current) return;

      const ok = await loadModels();
      if (!ok) { setWebcamError("model_load_failed"); return; }

      const vid = videoRef?.current;
      // readyState 2 = HAVE_CURRENT_DATA, needed before face-api can read a valid frame.
      // videoWidth < 10 guards against Firefox returning 0 on display:none elements.
      if (!vid || !vid.srcObject || vid.readyState < 2 || vid.videoWidth < 10) {
        if (!stopLoopRef.current) setTimeout(loop, 500);
        return;
      }

      if (manualRef.current) {
        if (!stopLoopRef.current) setTimeout(loop, 1000);
        return;
      }

      setWebcamDetecting(true);
      try {
        const det = await faceapi
          .detectSingleFace(vid, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.35 }))
          .withFaceExpressions();

        if (!det) {
          setWebcamError("no_face");
          setWebcamErrorCount(c => c + 1);
        } else {
          setWebcamError(null);
          setWebcamErrorCount(0);

          const [expr, conf] = Object.entries(det.expressions).sort((a, b) => b[1] - a[1])[0];
          const mapped = EXPR_MAP[expr] ?? "neutral";
          setWebcamEmotion(mapped);

          if (conf >= MIN_CONFIDENCE) {
            // Majority vote over last 3 scans — survives single-frame flickers.
            // e.g. [happy, neutral, happy] → happy wins (2/3)
            const buf = consecutiveRef.current;
            buf.history.push(mapped);
            if (buf.history.length > 3) buf.history.shift();

            // Count votes in the window
            const votes = {};
            for (const e of buf.history) votes[e] = (votes[e] ?? 0) + 1;
            const [winner, winCount] = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];

            // Need at least 2 out of 3 scans agreeing (~1.6s) to commit
            if (winCount >= 2) {
              const now  = Date.now();
              const same = winner === lastEmittedRef.current;
              const stale = now - lastEmittedAtRef.current > SAME_EMOTION_LOCK_MS;
              if (!same || stale) {
                lastEmittedRef.current   = winner;
                lastEmittedAtRef.current = now;
                sourceRef.current        = "webcam";
                emitEmotion(winner, conf, "webcam");
                emotionAPI.setManual(winner).catch(() => {});
              }
            }
            sourceRef.current = "webcam";
          } else {
            // Low confidence — evict oldest entry but don't fully reset
            // so a single low-conf frame doesn't wipe accumulated votes
            const buf = consecutiveRef.current;
            if (buf.history.length > 0) buf.history.shift();
          }
        }
      } catch (e) {
        console.warn("[CAM] face-api error:", e.message);
      } finally {
        setWebcamDetecting(false);
      }

      if (!stopLoopRef.current) setTimeout(loop, 800);
    };

    const t = setTimeout(loop, 400);
    return () => {
      stopLoopRef.current = true;
      clearTimeout(t);
      setWebcamError(null);
      setWebcamErrorCount(0);
      lastEmittedRef.current   = null;
      lastEmittedAtRef.current = 0;
      consecutiveRef.current   = { history: [], lastEmitted: null, lastEmittedAt: 0 };
    };
  }, [cameraOn, videoRef, emitEmotion]);

  useEffect(() => () => { clearTimeout(textTimerRef.current); }, []);

  return {
    emotion, confidence, source, status,
    setManualEmotion, setTextInput, clearEmotion,
    lastTextInput, webcamDetecting, webcamEmotion, webcamError, webcamErrorCount,
  };
}
