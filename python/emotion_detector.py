#!/usr/bin/env python3
"""
FILE: python/emotion_detector.py
PURPOSE: Real-time webcam emotion detection → POST to backend.
         Uses DeepFace if available, falls back to mock mode.

USAGE:
    pip install deepface opencv-python requests numpy
    python emotion_detector.py
    python emotion_detector.py --mock          # no camera needed
    python emotion_detector.py --interval 1.5  # faster detection
"""

import argparse
import time
import threading
import sys
import requests
import numpy as np

# ── Imports with graceful fallback ────────────────────────
try:
    from deepface import DeepFace
    DEEPFACE_OK = True
except ImportError:
    DEEPFACE_OK = False
    print("[Emotion] ⚠️  DeepFace not installed — pip install deepface")

try:
    import cv2
    CV2_OK = True
except ImportError:
    CV2_OK = False
    print("[Emotion] ⚠️  OpenCV not installed — pip install opencv-python")

# ── Emotion → valence/arousal mapping ────────────────────
EMOTION_VA = {
    "happy":    {"valence":  0.85, "arousal": 0.75},
    "sad":      {"valence": -0.75, "arousal": 0.20},
    "angry":    {"valence": -0.80, "arousal": 0.90},
    "fear":     {"valence": -0.65, "arousal": 0.85},
    "surprise": {"valence":  0.30, "arousal": 0.80},
    "disgust":  {"valence": -0.60, "arousal": 0.60},
    "neutral":  {"valence":  0.10, "arousal": 0.40},
}

# ── Mock rotation for demo ────────────────────────────────
MOCK_SEQ = ["happy","neutral","calm","sad","tense","energetic","melancholic","surprised","neutral","calm"]
_mock_i  = 0


def get_mock():
    global _mock_i
    label = MOCK_SEQ[_mock_i % len(MOCK_SEQ)]
    _mock_i += 1
    va = EMOTION_VA.get(label, EMOTION_VA["neutral"])
    return {
        "emotion_label": label,
        "confidence":    round(0.70 + np.random.uniform(0, 0.25), 3),
        "valence_score": round(va["valence"] + np.random.uniform(-0.05, 0.05), 3),
        "arousal_score": round(va["arousal"] + np.random.uniform(-0.05, 0.05), 3),
        "face_detected": True,
        "source": "mock",
    }


def analyze_frame(frame, model="VGG-Face"):
    """Detect emotion from a BGR OpenCV frame.

    Explicitly catches SystemError in addition to Exception because
    TensorFlow's C-extension can raise SystemError (not a subclass of
    Exception in Python 3) when its internal state is corrupted — e.g.
    after a prior crash or when running on an unsupported TF/Python version
    combination. Catching it here keeps the detection loop alive.
    """
    try:
        result = DeepFace.analyze(
            img_path=frame, actions=["emotion"],
            enforce_detection=False, detector_backend="opencv", silent=True,
        )
        face = result[0] if isinstance(result, list) else result
        label = face.get("dominant_emotion", "neutral").lower()
        conf  = face.get("emotion", {}).get(label, 50) / 100.0
        va    = EMOTION_VA.get(label, EMOTION_VA["neutral"])
        return {
            "emotion_label": label,
            "confidence":    round(float(conf), 3),
            "valence_score": round(float(va["valence"]), 3),
            "arousal_score": round(float(va["arousal"]), 3),
            "face_detected": True,
            "source": "webcam",
        }
    except SystemError as e:
        # TensorFlow C-extension internal failure — do NOT re-raise.
        # Log and return a neutral fallback so the loop keeps running.
        print(f"[Emotion] ⚠️  TF SystemError (continuing): {e}")
        return {
            "emotion_label": "neutral", "confidence": 0.30,
            "valence_score": 0.0, "arousal_score": 0.4,
            "face_detected": False, "source": "webcam",
        }
    except Exception:
        return {
            "emotion_label": "neutral", "confidence": 0.30,
            "valence_score": 0.0, "arousal_score": 0.4,
            "face_detected": False, "source": "webcam",
        }


def send(backend, payload):
    try:
        r = requests.post(f"{backend}/api/emotion", json=payload, timeout=3)
        data = r.json()
        print(f"[Emotion] → {payload['emotion_label']:12s} ({payload['confidence']:.0%}) | mood: {data.get('mood','?')}")
    except requests.exceptions.ConnectionError:
        print("[Emotion] ⚠️  Backend not reachable — is server.js running?")
    except Exception as e:
        print(f"[Emotion] Send error: {e}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--backend",  default="http://127.0.0.1:3001")
    p.add_argument("--interval", type=float, default=2.0)
    p.add_argument("--camera",   type=int, default=0)
    p.add_argument("--mock",     action="store_true",
                   help="Use mock data — does NOT open the camera")
    p.add_argument("--post",     action="store_true",
                   help="POST results to backend (disabled by default to avoid conflict with browser webcam)")
    p.add_argument("--show",     action="store_true", help="Show webcam window")
    args = p.parse_args()

    use_mock = args.mock or not DEEPFACE_OK or not CV2_OK
    print(f"[Emotion] Mode: {'MOCK' if use_mock else 'REAL'} | interval: {args.interval}s | posting: {args.post}")
    if not args.post:
        print("[Emotion] NOTE: Not posting to backend. Use --post flag to enable.")
        print("[Emotion] The browser webcam handles emotion detection directly.")

    cap = None
    if not use_mock:
        cap = cv2.VideoCapture(args.camera)
        if not cap.isOpened():
            print("[Emotion] Camera not available — switching to mock mode")
            use_mock = True
        else:
            for _ in range(5): cap.read()  # warmup

    try:
        while True:
            t0 = time.time()

            if use_mock:
                payload = get_mock()
            else:
                ret, frame = cap.read()
                if not ret:
                    time.sleep(0.5); continue
                if args.show:
                    cv2.imshow("AIoT Emotion", frame)
                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        break
                payload = analyze_frame(frame)

            threading.Thread(target=send, args=(args.backend, payload), daemon=True).start() if args.post else None
            time.sleep(max(0, args.interval - (time.time() - t0)))

    except KeyboardInterrupt:
        print("\n[Emotion] Stopped")
    finally:
        if cap: cap.release()
        if CV2_OK: cv2.destroyAllWindows()


if __name__ == "__main__":
    main()