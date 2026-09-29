// ══════════════════════════════════════════════════════════
// useAudioEngine.js  —  Drop into frontend/src/
// Real Web Audio API: FFT, beat detection, spectral centroid,
// onset strength, sub-bass kick tracking, chromagram
// ══════════════════════════════════════════════════════════
import { useEffect, useRef, useCallback } from "react";

const FFT_SIZE = 2048;
const BEAT_HISTORY = 43;       // ~1 sec at 60fps
const ONSET_HISTORY = 8;

export function useAudioEngine(liveRef) {
  const ctxRef    = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const freqRef   = useRef(new Uint8Array(FFT_SIZE / 2));
  const timeRef   = useRef(new Uint8Array(FFT_SIZE));
  const energyHist = useRef(new Array(BEAT_HISTORY).fill(0));
  const onsetHist  = useRef(new Array(ONSET_HISTORY).fill(0));
  const lastBeatMs = useRef(0);
  const beatTimes  = useRef([]);
  const prevFreq   = useRef(new Float32Array(FFT_SIZE / 2));
  const rafRef     = useRef(null);

  // ── Spectral centroid ────────────────────────────────────
  function spectralCentroid(data) {
    let num = 0, den = 0;
    for (let i = 0; i < data.length; i++) {
      num += i * data[i];
      den += data[i];
    }
    return den > 0 ? num / den / data.length : 0;
  }

  // ── Spectral flux (onset strength) ──────────────────────
  function spectralFlux(current, previous) {
    let flux = 0;
    for (let i = 0; i < current.length; i++) {
      const diff = (current[i] / 255) - previous[i];
      if (diff > 0) flux += diff; // half-wave rectify
    }
    return flux / current.length;
  }

  // ── RMS energy in a frequency band ──────────────────────
  function bandEnergy(data, lo, hi) {
    let sum = 0;
    const len = hi - lo;
    for (let i = lo; i < hi; i++) sum += (data[i] / 255) ** 2;
    return Math.sqrt(sum / len);
  }

  // ── Chromagram (12 pitch classes from FFT bins) ──────────
  // Maps FFT bins to 12 equal-tempered pitch classes
  // sampleRate 44100, FFT 2048 → bin width = 21.5 Hz
  function chromagram(data, sampleRate = 44100) {
    const binHz = sampleRate / FFT_SIZE;
    const chroma = new Float32Array(12);
    // A4 = 440 Hz as reference
    for (let i = 1; i < data.length; i++) {
      const freq = i * binHz;
      if (freq < 60 || freq > 4000) continue;
      const midiF = 12 * Math.log2(freq / 440) + 69;
      const pitchClass = ((Math.round(midiF) % 12) + 12) % 12;
      chroma[pitchClass] += data[i] / 255;
    }
    // Normalize
    const max = Math.max(...chroma, 0.001);
    return chroma.map(v => v / max);
  }

  // ── Beat detection via variance-adaptive threshold ────────
  function detectBeat(bassEnergy, now) {
    energyHist.current.push(bassEnergy);
    if (energyHist.current.length > BEAT_HISTORY) energyHist.current.shift();

    const avg = energyHist.current.reduce((a, b) => a + b) / energyHist.current.length;
    const variance = energyHist.current.reduce((a, v) => a + (v - avg) ** 2, 0) / energyHist.current.length;
    // C adapts: quiet tracks need lower threshold, loud tracks higher
    const C = Math.max(1.25, 1.55 - variance * 180);

    if (bassEnergy > C * avg && now - lastBeatMs.current > 180) {
      lastBeatMs.current = now;
      beatTimes.current.push(now);
      if (beatTimes.current.length > 6) beatTimes.current.shift();

      // BPM from inter-beat intervals
      if (beatTimes.current.length >= 3) {
        const diffs = [];
        for (let i = 1; i < beatTimes.current.length; i++)
          diffs.push(beatTimes.current[i] - beatTimes.current[i - 1]);
        const avgDiff = diffs.reduce((a, b) => a + b) / diffs.length;
        const bpm = Math.round(60000 / avgDiff);
        liveRef.current.bpm = Math.max(60, Math.min(220, bpm));
      }
      return true;
    }
    return false;
  }

  // ── Main analysis loop ───────────────────────────────────
  const analyse = useCallback(() => {
    const an = analyserRef.current;
    if (!an) { rafRef.current = requestAnimationFrame(analyse); return; }

    an.getByteFrequencyData(freqRef.current);
    an.getByteTimeDomainData(timeRef.current);

    const fd = freqRef.current;
    const now = performance.now();

    // Band energies (44100 Hz, 1024 bins, ~43 Hz/bin)
    const sub  = bandEnergy(fd, 0,  3);   // 0–86 Hz   sub-bass kick
    const bass = bandEnergy(fd, 0,  8);   // 0–172 Hz  bass
    const mid  = bandEnergy(fd, 8,  40);  // 172–860 Hz midrange
    const hi   = bandEnergy(fd, 40, 120); // 860–2580 Hz presence
    const air  = bandEnergy(fd, 120, 300);// 2.5–6.5 kHz air

    // Full-spectrum energy
    let fullSum = 0;
    for (let i = 0; i < fd.length; i++) fullSum += fd[i] / 255;
    const fullEnergy = fullSum / fd.length;

    // Onset / spectral flux
    const currentF32 = new Float32Array(fd.length);
    for (let i = 0; i < fd.length; i++) currentF32[i] = fd[i] / 255;
    const flux = spectralFlux(fd, prevFreq.current);
    onsetHist.current.push(flux);
    if (onsetHist.current.length > ONSET_HISTORY) onsetHist.current.shift();
    const avgFlux = onsetHist.current.reduce((a, b) => a + b) / onsetHist.current.length;
    const onsetStrength = Math.min(1, flux / (avgFlux * 2 + 0.001));
    prevFreq.current = currentF32;

    // Beat
    const isBeat = detectBeat(bass, now);
    if (isBeat) liveRef.current.beatFlash = 0.95;

    // Sub-bass kick punch (separate from beat, for visual "thump")
    if (sub > 0.55) liveRef.current.kickFlash = Math.min(1, sub);

    // Spectral features
    const centroid = spectralCentroid(fd);   // 0–1 normalized
    const chroma   = chromagram(fd);

    // Write everything into liveRef (no React re-renders)
    liveRef.current.energy        = fullEnergy;
    liveRef.current.bass          = bass;
    liveRef.current.mid           = mid;
    liveRef.current.hi            = hi;
    liveRef.current.air           = air;
    liveRef.current.centroid      = centroid;
    liveRef.current.onsetStrength = onsetStrength;
    liveRef.current.chroma        = chroma;
    liveRef.current.freqData      = fd;       // raw FFT for canvas
    liveRef.current.timeData      = timeRef.current; // waveform

    rafRef.current = requestAnimationFrame(analyse);
  }, [liveRef]);

  const retryingRef = useRef(false); // guard: only one retry loop active at a time

  // ── Connect Spotify Web Playback SDK audio element ────────────────
  // Called after SDK ready event and again when playback starts.
  const connectSpotifyPlayer = useCallback((spotifyPlayer) => {
    try {
      if (!ctxRef.current) {
        ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = ctxRef.current;
      if (ctx.state === "suspended") ctx.resume();

      // Already connected to real (non-mic) Spotify audio — skip.
      if (sourceRef.current && !liveRef.current.micMode) {
        const els = Array.from(document.querySelectorAll("audio"));
        const stillConnected = els.some(el => !el.paused && el.readyState >= 2);
        if (stillConnected) return;
        try { sourceRef.current.disconnect(); } catch {}
        sourceRef.current = null;
        liveRef.current.audioConnected = false;
      }

      // Spotify SDK v3 no longer exposes _audioElement publicly.
      // Scan all HTMLAudioElement nodes — the SDK creates one on playback start.
      const findAudio = () => {
        const els = Array.from(document.querySelectorAll("audio"));
        const playing = els.find(el => !el.paused && el.readyState >= 2 && el.src);
        if (playing) return playing;
        const hasSrc  = els.find(el => el.src && el.src.length > 0);
        if (hasSrc)  return hasSrc;
        return null;
      };

      // Guard: only one retry loop active at a time
      if (retryingRef.current) return;
      retryingRef.current = true;

      const tryConnect = (attempt = 0) => {
        if (sourceRef.current && !liveRef.current.micMode) {
          retryingRef.current = false;
          return;
        }
        const audioEl = findAudio();
        if (!audioEl) {
          if (attempt < 20) {
            setTimeout(() => tryConnect(attempt + 1), 500);
          } else {
            retryingRef.current = false;
          }
          return;
        }
        try {
          const an = ctx.createAnalyser();
          an.fftSize = FFT_SIZE;
          an.smoothingTimeConstant = 0.8;
          an.minDecibels = -90;
          an.maxDecibels = -10;

          const src = ctx.createMediaElementSource(audioEl);
          src.connect(an);
          an.connect(ctx.destination);

          analyserRef.current = an;
          sourceRef.current   = src;
          freqRef.current     = new Uint8Array(an.frequencyBinCount);
          timeRef.current     = new Uint8Array(an.fftSize);
          prevFreq.current    = new Float32Array(an.frequencyBinCount);

          liveRef.current.audioConnected = true;
          liveRef.current.micMode = false;
          console.log("[ARAEA] ✅ Web Audio connected to Spotify SDK");
        } catch (err) {
          if (!err.message?.includes("already")) {
            console.warn("[ARAEA] SDK audio connect:", err.message);
          }
        }
        retryingRef.current = false;
      };
      tryConnect();
    } catch (e) {
      console.warn("[ARAEA] connectSpotifyPlayer:", e.message);
      retryingRef.current = false;
    }
  }, [liveRef]);

  // ── Mic fallback ─────────────────────────────────────────
  const connectMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!ctxRef.current) ctxRef.current = new (window.AudioContext||window.webkitAudioContext)();
      const ctx = ctxRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const an = ctx.createAnalyser();
      an.fftSize = FFT_SIZE;
      an.smoothingTimeConstant = 0.8;
      const src = ctx.createMediaStreamSource(stream);
      src.connect(an);
      // don't connect to destination (avoid feedback)
      analyserRef.current = an;
      sourceRef.current   = src;
      freqRef.current     = new Uint8Array(an.frequencyBinCount);
      timeRef.current     = new Uint8Array(an.fftSize);
      prevFreq.current    = new Float32Array(an.frequencyBinCount);
      liveRef.current.audioConnected = true;
      liveRef.current.micMode = true;
      return true;
    } catch (e) {
      console.warn("[ARAEA] Mic access denied:", e.message);
      return false;
    }
  }, [liveRef]);

  // ── Start / stop loop ────────────────────────────────────
  useEffect(() => {
    rafRef.current = requestAnimationFrame(analyse);
    return () => {
      cancelAnimationFrame(rafRef.current);
      sourceRef.current?.disconnect();
      if (ctxRef.current && ctxRef.current.state !== "closed") {
        ctxRef.current.close();
      }
    };
  }, [analyse]);

  return { connectSpotifyPlayer, connectMic, getAudioContext:()=>ctxRef.current, getAnalyser:()=>analyserRef.current };
}