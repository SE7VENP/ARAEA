// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  VisualCanvas.jsx  —  ARAEA Stage 3                                     ║
// ║                                                                          ║
// ║  Synesthesia-quality audio-reactive WebCanvas visualizer.                ║
// ║                                                                          ║
// ║  Performance:                                                            ║
// ║    • Auto-detects device tier (high/medium/low)                          ║
// ║    • dt-based timing — smooth at any framerate (30/45/60fps)             ║
// ║    • Zero heap allocations in hot path (pre-allocated buffers)           ║
// ║    • willReadFrequently only where pixel reads are needed                ║
// ║    • Conditional effects per tier (chromAb, bloom, kaleidoscope)         ║
// ║    • Object pool for particles                                           ║
// ║                                                                          ║
// ║  Audio:                                                                  ║
// ║    • Real FFT from Web Audio API via liveRef (preferred)                 ║
// ║    • Smooth synthetic FFT when audio not connected                       ║
// ║    • Stops + fades cleanly when isPlaying=false                         ║
// ║    • Resets state (particles/waves/ribbon) on emotion change             ║
// ║                                                                          ║
// ║  Props:                                                                  ║
// ║    liveRef     — shared audio analysis ref (from useAudioEngine)         ║
// ║    isPlaying   — boolean: false fades canvas to black gracefully         ║
// ║    emotion     — string: change triggers particle/state reset            ║
// ║    scene       — string: controls render mode                            ║
// ╚══════════════════════════════════════════════════════════════════════════╝
import { useEffect, useRef } from "react";

// ── Chromesthesia: semitone → hue mapping ────────────────
// Based on Newton's color wheel + synesthetic research
const NOTE_HUE = [0, 30, 55, 90, 140, 175, 195, 225, 260, 290, 320, 350];
//               C  C#   D  D#   E    F   F#   G   G#   A   A#    B

// ── Mood / scene hue tables ───────────────────────────────
const MOOD_HUE  = { euphoric:0, happy:38, calm:196, melancholic:265, tense:345, sad:218, neutral:200, angry:5, energetic:155, surprised:25, fearful:280 };
const SCENE_HUE = { party:32, focus:210, sleep:240, wakeup:30, workout:4, cosmic:276, jazz:35, relax:168 };

// ── Pre-allocated module-level buffers (zero GC in hot path) ─
const SMOOTH_FFT  = new Float32Array(512);
const SYNTH_FFT   = new Float32Array(512);
const NOISE_TABLE = Float32Array.from({ length: 512 }, () => Math.random());

// Separate noise tables per-bin for synthetic FFT phase variation
const NOISE_PHASE = Float32Array.from({ length: 512 }, () => Math.random() * Math.PI * 2);

// ── Performance tier detection ───────────────────────────
// Runs once at import time — safe to do, purely reads navigator
function detectTier() {
  const cores = navigator.hardwareConcurrency ?? 2;
  // deviceMemory is a hint API (Chrome only, often undefined)
  const mem = navigator.deviceMemory ?? 4;
  if (cores >= 8 && mem >= 8) return "high";
  if (cores >= 4 && mem >= 4) return "medium";
  return "low";
}
const DEVICE_TIER = detectTier();

// Per-tier limits
const TIER = {
  high:   { fps: 60, maxParticles: 400, maxWaves: 8,  bloom: true,  chromAb: true,  kaleid: true,  ribbon: true,  shadowBlur: true  },
  medium: { fps: 45, maxParticles: 180, maxWaves: 5,  bloom: false, chromAb: false, kaleid: false, ribbon: true,  shadowBlur: false },
  low:    { fps: 30, maxParticles: 80,  maxWaves: 3,  bloom: false, chromAb: false, kaleid: false, ribbon: false, shadowBlur: false },
}[DEVICE_TIER];

// ══════════════════════════════════════════════════════════
// MATH / COLOR UTILITIES
// ══════════════════════════════════════════════════════════

const hs = (h, s, l, a = 1) => `hsla(${h | 0},${s | 0}%,${l | 0}%,${Math.max(0, Math.min(1, a)).toFixed(3)})`;

// Map FFT bin index → chromesthesia hue
function binHue(bin, totalBins) {
  const freq = (bin / totalBins) * 22050;
  if (freq < 20) return NOTE_HUE[0];
  const note = ((Math.round(12 * Math.log2(Math.max(1, freq) / 440)) % 12) + 12) % 12;
  return NOTE_HUE[note];
}

// Log-scale bin mapping (bass frequencies get more resolution)
function logBin(i, n, len) {
  return Math.min(len - 1, Math.round(Math.pow(i / n, 1.25) * len * 0.7));
}

// Exponential smoothing constant (time-based, not frame-rate dependent)
// tau = time constant in seconds; dt = elapsed time in seconds
function smoothK(tau, dt) {
  return 1 - Math.exp(-dt / tau);
}

// ── Smooth synthetic FFT (no per-frame allocations, no random noise) ─
// Uses pre-computed noise table and sin/cos for smooth organic motion
function buildSyntheticFFT(bpm, energy, t, beat) {
  const bp    = (bpm || 120) / 60;
  const phase = (t * bp) % 1;
  const decay = Math.max(0, 1 - phase * 3.2);
  const beatBoost = 1 + beat * 0.7;

  for (let i = 0; i < 512; i++) {
    const n = NOISE_TABLE[i];
    const p = NOISE_PHASE[i];
    SYNTH_FFT[i] = Math.min(1, Math.max(0,
      i < 12  ? (decay * 0.88 + n * 0.08) * energy * beatBoost :
      i < 40  ? (decay * 0.55 + Math.abs(Math.sin(t * 2.7 + p)) * 0.25) * energy :
      i < 120 ? (Math.abs(Math.sin(t * 1.8 + i * 0.11 + p)) * 0.52 + 0.04) * energy * 0.75 :
      i < 280 ? (Math.abs(Math.sin(t * 4.9 + i * 0.06 + p)) * 0.22 + 0.02) * energy * 0.45 :
                (n * 0.08 + 0.01) * energy * 0.25
    ));
  }
  return SYNTH_FFT;
}

// ── Band RMS helper ───────────────────────────────────────
function bandRms(fft, lo, hi) {
  let sum = 0;
  const len = hi - lo;
  if (len <= 0) return 0;
  for (let i = lo; i < hi; i++) sum += fft[i] * fft[i];
  return Math.sqrt(sum / len);
}

// ══════════════════════════════════════════════════════════
// PARTICLE SYSTEM (object pool — reuses dead particles)
// ══════════════════════════════════════════════════════════
function createParticlePool(maxSize) {
  const pool = [];
  const active = [];

  function get() {
    return pool.length > 0 ? pool.pop() : {};
  }
  function release(p) {
    if (pool.length < maxSize) pool.push(p);
  }

  function spawn(W, H, hue, energy, isBeat, cx, cy) {
    if (active.length >= maxSize) return;
    const p    = get();
    const a    = Math.random() * Math.PI * 2;
    const spd  = isBeat
      ? (2.5 + Math.random() * 8.5) * (0.7 + energy * 0.5)
      : (0.25 + Math.random() * 2.2) * (0.4 + energy * 0.8);
    p.x        = isBeat ? cx : W * 0.08 + Math.random() * W * 0.84;
    p.y        = isBeat ? cy : H * 0.08 + Math.random() * H * 0.84;
    p.vx       = Math.cos(a) * spd;
    p.vy       = Math.sin(a) * spd - (isBeat ? 0 : 0.12);
    p.life     = isBeat ? 0.55 + Math.random() * 0.7 : 0.7 + Math.random() * 1.4;
    p.maxLife  = p.life;
    p.r        = isBeat ? 1.4 + Math.random() * 3.2 : 0.5 + Math.random() * 2.2;
    p.hue      = ((hue + (Math.random() - 0.5) * 80) + 360) % 360;
    p.sat      = 78 + Math.random() * 20;
    p.trailX   = p.x;
    p.trailY   = p.y;
    p.glow     = isBeat || energy > 0.7;
    active.push(p);
  }

  function spawnFromSpectrum(W, H, fft, energy) {
    const N  = 80;
    const bw = W / N;
    for (let i = 0; i < N; i++) {
      const v = fft[logBin(i, N, fft.length)];
      if (v < 0.42 || Math.random() > 0.22) continue;
      if (active.length >= maxSize) break;
      const p    = get();
      const ph   = binHue(logBin(i, N, fft.length), fft.length);
      const spd  = (0.8 + Math.random() * 3.2) * (0.5 + energy * 0.5);
      const ang  = (Math.random() - 0.5) * 0.85 - Math.PI * 0.5;
      p.x        = i * bw + bw * 0.5;
      p.y        = H - v * H * 0.65;
      p.vx       = Math.cos(ang) * spd;
      p.vy       = Math.sin(ang) * spd;
      p.life     = 0.3 + Math.random() * 0.45;
      p.maxLife  = p.life;
      p.r        = 0.6 + Math.random() * 2.0;
      p.hue      = ph;
      p.sat      = 92;
      p.trailX   = p.x;
      p.trailY   = p.y;
      p.glow     = true;
      active.push(p);
    }
  }

  function tick(ctx, dt) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";

    const gravity = 0.009 * (dt / 0.0167); // scale gravity to dt

    for (let i = active.length - 1; i >= 0; i--) {
      const p = active[i];
      p.life  -= dt * 0.72;
      if (p.life <= 0) {
        release(p);
        active.splice(i, 1);
        continue;
      }
      const af = Math.max(0, p.life / p.maxLife);
      const prevX = p.trailX;
      const prevY = p.trailY;
      p.trailX = p.x;
      p.trailY = p.y;
      p.x  += p.vx * (dt / 0.0167);
      p.y  += p.vy * (dt / 0.0167);
      p.vy += gravity;
      p.vx *= 0.993;

      // Trail line
      ctx.beginPath();
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(p.x, p.y);
      ctx.lineWidth  = p.r * (0.4 + af * 0.6);
      ctx.strokeStyle = hs(p.hue, p.sat, 55 + af * 25, af * 0.35);
      ctx.stroke();

      // Core dot
      if (TIER.shadowBlur && p.glow) {
        ctx.shadowBlur  = 7;
        ctx.shadowColor = hs(p.hue, p.sat, 62, af * 0.55);
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.3, p.r * af), 0, Math.PI * 2);
      ctx.fillStyle = hs(p.hue, p.sat, 60 + af * 24, af * 0.9);
      ctx.fill();
      if (TIER.shadowBlur && p.glow) ctx.shadowBlur = 0;
    }

    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  }

  function flush() {
    active.forEach(p => pool.push(p));
    active.length = 0;
  }

  return { spawn, spawnFromSpectrum, tick, flush, get count() { return active.length; } };
}

// ══════════════════════════════════════════════════════════
// DRAWING HELPERS (no allocations)
// ══════════════════════════════════════════════════════════

// ── Shockwaves ────────────────────────────────────────────
function tickWaves(ctx, waves, dt) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const speed = 4.5 * (dt / 0.0167);
  for (let i = waves.length - 1; i >= 0; i--) {
    const w  = waves[i];
    w.r     += speed;
    w.alpha  = Math.max(0, 1 - w.r / w.maxR);
    if (w.alpha <= 0) { waves.splice(i, 1); continue; }
    // Outer ring
    ctx.beginPath();
    ctx.arc(w.cx, w.cy, w.r, 0, Math.PI * 2);
    ctx.strokeStyle = hs(w.hue, 100, 65, w.alpha * 0.38);
    ctx.lineWidth   = 2.5;
    ctx.stroke();
    // Inner bright ring
    ctx.beginPath();
    ctx.arc(w.cx, w.cy, w.r, 0, Math.PI * 2);
    ctx.strokeStyle = hs(w.hue, 100, 88, w.alpha * 0.65);
    ctx.lineWidth   = 1;
    ctx.stroke();
    // Sub-ring
    if (w.r > 18) {
      ctx.beginPath();
      ctx.arc(w.cx, w.cy, w.r * 0.62, 0, Math.PI * 2);
      ctx.strokeStyle = hs(w.hue, 80, 72, w.alpha * 0.22);
      ctx.lineWidth   = 1;
      ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}

// ── Chromesthetic radial spectrum ─────────────────────────
function drawRadial(ctx, W, H, fft, beat, kick, iR_mult = 0.18, oR_mult = 0.46) {
  const cx = W / 2, cy = H / 2;
  const size = Math.min(W, H);
  const iR   = size * iR_mult * (1 + kick * 0.12);
  const oR   = size * oR_mult;
  const N    = DEVICE_TIER === "low" ? 144 : 288;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (let i = 0; i < N; i++) {
    const v = fft[logBin(i, N, fft.length)] * (1 + beat * 0.5);
    if (v < 0.012) continue;
    const ang = (i / N) * Math.PI * 2 - Math.PI / 2;
    const r2  = iR + v * (oR - iR);
    const fh  = binHue(logBin(i, N, fft.length), fft.length);
    const x1  = cx + Math.cos(ang) * iR;
    const y1  = cy + Math.sin(ang) * iR;
    const x2  = cx + Math.cos(ang) * r2;
    const y2  = cy + Math.sin(ang) * r2;
    // Glow layer (skip on low/medium tier)
    if (TIER.shadowBlur) {
      ctx.lineWidth   = 5 + v * 5;
      ctx.strokeStyle = hs(fh, 90, 48, v * 0.16);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    // Main line
    ctx.lineWidth   = 1.4;
    ctx.strokeStyle = hs(fh, 100, 68 + v * 26, 0.80 + v * 0.20);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}

// ── Frequency bar spectrum ────────────────────────────────
function drawBars(ctx, W, H, fft, beat, N = 120, yBase = 1) {
  const bw = W / N;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < N; i++) {
    const v  = fft[logBin(i, N, fft.length)] * (1 + beat * 0.65);
    if (v < 0.015) continue;
    const bh = v * H * 0.80 * yBase;
    const x  = i * bw;
    const fh = binHue(logBin(i, N, fft.length), fft.length);
    // Gradient bar
    const g = ctx.createLinearGradient(x, H, x, H - bh);
    g.addColorStop(0, hs(fh, 100, 40 + v * 40, 0.92));
    g.addColorStop(1, hs((fh + 50) % 360, 100, 70, 0.25));
    if (TIER.shadowBlur) {
      ctx.shadowBlur  = 14 + v * 20;
      ctx.shadowColor = hs(fh, 100, 55, 0.9);
    }
    ctx.fillStyle = g;
    ctx.fillRect(x + 0.5, H - bh, bw - 0.5, bh);
    // Top cap
    if (v > 0.08) {
      ctx.fillStyle = hs(fh, 100, 94, 0.92);
      ctx.fillRect(x + 0.5, H - bh - 3, bw - 0.5, 3);
    }
    if (TIER.shadowBlur) ctx.shadowBlur = 0;
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}

// ── Center orb (mood-colored pulse) ──────────────────────
function drawOrb(ctx, W, H, hue, energy, beat, kick) {
  const cx  = W / 2, cy = H / 2;
  const r   = Math.min(W, H) * (0.046 + energy * 0.026 + beat * 0.016 + kick * 0.012);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  // Glow layers
  const layers = DEVICE_TIER === "high"
    ? [[r * 5.0, 0.11], [r * 3.0, 0.18], [r * 1.8, 0.28]]
    : [[r * 3.0, 0.14], [r * 1.8, 0.24]];
  layers.forEach(([rr, a]) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
    g.addColorStop(0, hs(hue, 100, 65, a * (0.5 + energy * 0.5)));
    g.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  });
  ctx.globalCompositeOperation = "source-over";
  // Sharp core
  const gc = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  gc.addColorStop(0,   hs(hue, 100, 96, 0.92));
  gc.addColorStop(0.5, hs(hue, 100, 68, 0.70));
  gc.addColorStop(1,   "transparent");
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = gc;
  ctx.fill();
  // Outer ring
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.28, 0, Math.PI * 2);
  ctx.strokeStyle = hs(hue, 100, 72, (0.22 + beat * 0.42) * (0.6 + energy * 0.4));
  ctx.lineWidth   = 1.8;
  ctx.stroke();
  ctx.restore();
}

// ── Waveform ring ─────────────────────────────────────────
function drawWaveRing(ctx, W, H, td, hue, energy, ringR) {
  if (!td?.length) return;
  const cx = W / 2, cy = H / 2;
  const N  = Math.min(td.length, 512);
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    const v   = ((td[i] ?? 128) - 128) / 128;
    const ang = (i / N) * Math.PI * 2 - Math.PI / 2;
    const r   = ringR * (1 + v * 0.52 * (1 + energy * 0.4));
    const x   = cx + Math.cos(ang) * r;
    const y   = cy + Math.sin(ang) * r;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.lineWidth   = 2.2;
  ctx.strokeStyle = hs(hue, 88, 55, 0.12);
  ctx.stroke();
  ctx.lineWidth   = 1.2;
  ctx.strokeStyle = hs(hue, 96, 72, 0.62);
  ctx.stroke();
  ctx.restore();
}

// ── Chromagram highlights ─────────────────────────────────
function drawChroma(ctx, W, H, chroma) {
  if (!chroma?.length) return;
  const cx = W / 2, cy = H / 2;
  const hR = Math.min(W, H) * 0.46;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 12; i++) {
    const v = chroma[i] ?? 0;
    if (v < 0.12) continue;
    const ang = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const len = Math.min(W, H) * 0.068 * v;
    if (TIER.shadowBlur) {
      ctx.shadowBlur  = 10;
      ctx.shadowColor = hs(NOTE_HUE[i], 100, 55, v * 0.65);
    }
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * hR, cy + Math.sin(ang) * hR);
    ctx.lineTo(cx + Math.cos(ang) * (hR + len), cy + Math.sin(ang) * (hR + len));
    ctx.strokeStyle = hs(NOTE_HUE[i], 100, 62, v * 0.55);
    ctx.lineWidth   = 2.5 + v * 5;
    ctx.stroke();
    if (TIER.shadowBlur) ctx.shadowBlur = 0;
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}

// ── Plasma waves ──────────────────────────────────────────
function drawPlasma(ctx, W, H, hue, energy, t) {
  const layers = DEVICE_TIER === "low" ? 2 : 4;
  ctx.save();
  for (let l = 0; l < layers; l++) {
    const amp  = H * (0.04 + l * 0.025) * (1 + energy * 0.3);
    const freq = 0.005 + l * 0.003;
    const ph   = t * (0.2 + energy * 0.18) * (0.5 + l * 0.35);
    const yB   = H * (0.22 + l * 0.2);
    ctx.beginPath();
    const step = DEVICE_TIER === "low" ? 4 : 2;
    for (let x = 0; x <= W; x += step) {
      const y = yB + Math.sin(x * freq + ph) * amp + Math.sin(x * freq * 2.1 + ph * 1.5) * amp * 0.5;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
    const g = ctx.createLinearGradient(0, yB - amp, 0, H);
    g.addColorStop(0, hs((hue + l * 38) % 360, 60, 32, 0.13));
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fill();
    // Wave crest line
    ctx.globalCompositeOperation = "lighter";
    ctx.beginPath();
    for (let x = 0; x <= W; x += step) {
      const y = yB + Math.sin(x * freq + ph) * amp + Math.sin(x * freq * 2.1 + ph * 1.5) * amp * 0.5;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.lineWidth   = 1.5;
    ctx.strokeStyle = hs((hue + l * 38) % 360, 80, 58, 0.28 + l * 0.05);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.restore();
}

// ── Frequency ribbon history ──────────────────────────────
const RIBBON_SNAP = new Float32Array(72); // reused every frame
function updateRibbon(ribbon, fft) {
  for (let i = 0; i < 72; i++) RIBBON_SNAP[i] = fft[logBin(i, 72, fft.length)];
  ribbon.unshift(RIBBON_SNAP.slice()); // slice() needed — we reuse the source
  if (ribbon.length > 38) ribbon.pop();
}
function drawRibbon(ctx, W, H, ribbon, energy) {
  if (ribbon.length < 4) return;
  const bw = W / 72;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let age = ribbon.length - 1; age >= 0; age--) {
    const t = age / ribbon.length;
    if (t > 0.9) continue; // skip very old
    const yOff = (age / ribbon.length) * H * 0.13;
    for (let i = 0; i < 72; i++) {
      const v = ribbon[age][i];
      if (v < 0.018) continue;
      const bh = v * H * 0.26 * (1 - t * 0.5);
      const fh = binHue(logBin(i, 72, 512), 512);
      ctx.fillStyle = hs(fh, 85, 52 + v * 26, (1 - t) * 0.25 * energy);
      ctx.fillRect(i * bw, H - yOff - bh, bw * 0.8, bh);
    }
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}

// ── Depth tunnel ──────────────────────────────────────────
function drawTunnel(ctx, W, H, fft, hue, energy, beat, t) {
  const cx = W / 2, cy = H / 2;
  const rings = DEVICE_TIER === "low" ? 14 : 22;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = rings; i > 0; i--) {
    const phase = ((i / rings) + t * 0.062 + beat * 0.02) % 1;
    const r     = phase * Math.min(W, H) * 0.52;
    const v     = fft[logBin(i, rings, fft.length)] ?? 0;
    const fh    = binHue(logBin(i, rings, fft.length), fft.length);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = hs(fh, 90, 60, (1 - phase) * 0.36 + v * 0.28);
    ctx.lineWidth   = 1.4 + phase * 2.2;
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}

// ── Lissajous figure ──────────────────────────────────────
function drawLissajous(ctx, W, H, td, hue, energy, t) {
  if (!td?.length) return;
  const cx = W / 2, cy = H / 2;
  const sc = Math.min(W, H) * (0.27 + energy * 0.16);
  const N  = 512;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    const ang  = (i / N) * Math.PI * 2;
    const tx   = ((td[i % td.length] ?? 128) - 128) / 128;
    const ty   = ((td[(i + 80) % td.length] ?? 128) - 128) / 128;
    const lx   = cx + Math.sin(3 * ang + Math.PI / 4 + t * 0.02) * sc * 0.5 + tx * sc * 0.48;
    const ly   = cy + Math.sin(2 * ang) * sc * 0.5 + ty * sc * 0.48;
    i === 0 ? ctx.moveTo(lx, ly) : ctx.lineTo(lx, ly);
  }
  ctx.lineWidth   = 3.5;
  ctx.strokeStyle = hs(hue, 80, 50, 0.07);
  ctx.stroke();
  if (TIER.shadowBlur) {
    ctx.shadowBlur  = 7;
    ctx.shadowColor = hs(hue, 100, 65, 0.35);
  }
  ctx.lineWidth   = 1.2;
  ctx.strokeStyle = hs(hue, 100, 72, 0.72);
  ctx.stroke();
  if (TIER.shadowBlur) ctx.shadowBlur = 0;
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}

// ── Kaleidoscope (high tier only) ────────────────────────
function kaleidoscope(dstCtx, srcCanvas, W, H, slices, rot) {
  const cx = W / 2, cy = H / 2;
  const R  = Math.sqrt(cx * cx + cy * cy) * 1.42;
  const step = (Math.PI * 2) / slices;
  dstCtx.save();
  dstCtx.translate(cx, cy);
  for (let i = 0; i < slices; i++) {
    dstCtx.save();
    dstCtx.rotate(rot + i * step);
    dstCtx.beginPath();
    dstCtx.moveTo(0, 0);
    for (let j = 0; j <= 32; j++) {
      dstCtx.lineTo(Math.cos((j / 32) * step) * R, Math.sin((j / 32) * step) * R);
    }
    dstCtx.closePath();
    dstCtx.clip();
    if (i % 2 === 0) {
      dstCtx.drawImage(srcCanvas, -cx, -cy);
    } else {
      dstCtx.save();
      dstCtx.scale(1, -1);
      dstCtx.rotate(step);
      dstCtx.drawImage(srcCanvas, -cx, cy - H);
      dstCtx.restore();
    }
    dstCtx.restore();
  }
  dstCtx.restore();
}

// ── Chromatic aberration (high tier only) ────────────────
// Pre-allocates buffer per W×H; re-allocates only on resize
let _chromBuf = null, _chromW = 0, _chromH = 0;
function chromAb(ctx, W, H, intensity) {
  if (intensity < 0.03 || !TIER.chromAb) return;
  try {
    if (_chromW !== W || _chromH !== H) {
      _chromBuf = new Uint8ClampedArray(W * H * 4);
      _chromW   = W;
      _chromH   = H;
    }
    const id  = ctx.getImageData(0, 0, W, H);
    const src = id.data;
    const out = _chromBuf;
    const d   = Math.max(1, Math.round(intensity * 4));
    // Copy to avoid overwrite aliasing
    out.set(src);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const base     = (y * W + x) * 4;
        const rSrc     = (y * W + Math.min(W - 1, x + d)) * 4;
        const bSrc     = (y * W + Math.max(0, x - d)) * 4;
        out[base]      = src[rSrc];     // R shifted right
        out[base + 2]  = src[bSrc + 2]; // B shifted left
        // G and A unchanged
      }
    }
    ctx.putImageData(new ImageData(out, W, H), 0, 0);
  } catch {}
}

// ── HUD overlay ───────────────────────────────────────────
function drawHUD(ctx, W, H, live, hasAudio, isPlaying) {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.font    = "600 10px 'JetBrains Mono',monospace";
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  // Bottom-left: mood + BPM
  const bpmStr = live.bpm ? ` · ${Math.round(live.bpm)} BPM` : "";
  ctx.fillText(`${(live.mood || "neutral").toUpperCase()}${bpmStr}`, 12, H - 11);
  // Bottom-right: scene
  if (live.scene) {
    ctx.textAlign = "right";
    ctx.fillText(live.scene.toUpperCase(), W - 12, H - 11);
  }
  // Bottom-center: audio status
  if (!hasAudio && isPlaying) {
    ctx.textAlign   = "center";
    ctx.font        = "500 10px 'Outfit',sans-serif";
    ctx.fillStyle   = "rgba(255,255,255,0.28)";
    ctx.fillText("🎙 Enable mic for live audio-reactive mode  ·  sidebar M", W / 2, H - 32);
  }
  // Top-right: tier badge (dev aid — can be removed in prod)
  if (process.env.NODE_ENV === "development") {
    ctx.textAlign = "right";
    ctx.font      = "500 9px 'JetBrains Mono',monospace";
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillText(`${DEVICE_TIER.toUpperCase()} TIER`, W - 12, 16);
  }
  ctx.textAlign = "left";
  ctx.restore();
}

// ══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════
export default function VisualCanvas({
  liveRef,
  isPlaying  = true,
  emotion    = "neutral",
  scene      = null,
}) {
  const wrapRef  = useRef(null);
  const cvsRef   = useRef(null);

  // Props → refs (read inside RAF without triggering effect re-runs)
  const isPlayingRef = useRef(isPlaying);
  const emotionRef   = useRef(emotion);
  const sceneRef     = useRef(scene);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { emotionRef.current   = emotion;   }, [emotion]);
  useEffect(() => { sceneRef.current     = scene;     }, [scene]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const cvs  = cvsRef.current;
    if (!wrap || !cvs) return;

    // ── Canvas setup ──────────────────────────────────────
    // alpha:false — avoid alpha compositing cost
    // willReadFrequently:false — chromAb uses a SEPARATE read call on demand
    const ctx = cvs.getContext("2d", { alpha: false, willReadFrequently: false });

    // Offscreen canvas for kaleidoscope source (pre-allocated, not in hot path)
    let offCvs = null, offCtx = null;
    if (TIER.kaleid) {
      offCvs = new OffscreenCanvas(1, 1);
      offCtx = offCvs.getContext("2d", { alpha: false });
    }

    // ── Particle pool ─────────────────────────────────────
    const particles = createParticlePool(TIER.maxParticles);

    // ── Persistent state ──────────────────────────────────
    const waves  = [];       // shockwave objects
    const ribbon = [];       // frequency history for ribbon
    let kRot     = 0;        // kaleidoscope rotation (seconds-based)

    // Smoothed audio values (exponential moving average, dt-based)
    let sEn   = 0.25; // smoothed energy
    let sBeat = 0;    // smoothed beat flash
    let sKick = 0;    // smoothed kick flash
    let sChrom = 0;   // chromatic aberration intensity

    // Time
    let t         = 0;     // elapsed seconds
    let lastTime  = 0;     // for dt calculation
    let rafId     = null;

    // Stop/fade state
    let fadeOutTimer = 0;  // seconds since isPlaying went false

    // Emotion change detection
    let prevEmotion = emotionRef.current;

    // Beat timing
    let lastBeatStamp = 0;

    // ── Resize ────────────────────────────────────────────
    function resize() {
      const W = wrap.clientWidth  || 800;
      const H = wrap.clientHeight || 600;
      cvs.width  = W; cvs.height  = H;
      ctx.fillStyle = "#030408";
      ctx.fillRect(0, 0, W, H);
      if (TIER.kaleid && offCvs) {
        offCvs.width  = W; offCvs.height  = H;
        offCtx.fillStyle = "#030408";
        offCtx.fillRect(0, 0, W, H);
      }
      // Invalidate chromAb buffer on resize
      _chromW = 0; _chromH = 0;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    // ── Main render loop ──────────────────────────────────
    function frame(now) {
      rafId = requestAnimationFrame(frame);

      // FPS throttle — skip frame if too soon
      const elapsed = now - lastTime;
      const TARGET  = 1000 / TIER.fps;
      if (elapsed < TARGET - 1) return;

      // dt in seconds — capped to avoid spiral of death
      const dt = Math.min(elapsed, TARGET * 2.5) / 1000;
      lastTime = now;
      t       += dt;

      const W = cvs.width, H = cvs.height;
      if (!W || !H) return;

      const live     = liveRef.current;
      const playing  = isPlayingRef.current;
      const currEmo  = emotionRef.current;
      const currScene = sceneRef.current ?? live.scene ?? null;

      // ── Emotion change → reset state ──────────────────
      if (currEmo !== prevEmotion) {
        prevEmotion = currEmo;
        particles.flush();
        waves.length  = 0;
        ribbon.length = 0;
        kRot          = 0;
        sEn   = 0.18;
        sBeat = 0;
        sKick = 0;
        sChrom = 0;
        fadeOutTimer = 0;
      }

      // ── Stop / fade behavior ───────────────────────────
      if (!playing) {
        fadeOutTimer += dt;
        // Accelerated decay when stopped
        sEn   = Math.max(0, sEn   - dt * 1.5);
        sBeat = Math.max(0, sBeat - dt * 4.0);
        sKick = Math.max(0, sKick - dt * 5.0);
        // After 1.8s, go to black
        if (fadeOutTimer > 1.8) {
          ctx.fillStyle = "#030408";
          ctx.fillRect(0, 0, W, H);
          if (TIER.kaleid && offCtx) { offCtx.fillStyle = "#030408"; offCtx.fillRect(0, 0, offCvs.width, offCvs.height); }
          return;
        }
      } else {
        fadeOutTimer = 0;
      }

      // ── Read audio data ────────────────────────────────
      const hasAudio = !!(live.freqData && live.audioConnected);
      const rawFFT   = hasAudio ? live.freqData : buildSyntheticFFT(live.bpm || 120, playing ? (live.energy || 0.3) : sEn, t, sBeat);

      // Smooth FFT (time-based, not frame-rate dependent)
      // Faster response when real audio; slower for synthetic (more cinematic)
      const fftTau = hasAudio ? 0.045 : 0.085;
      const fk     = smoothK(fftTau, dt);
      for (let i = 0; i < SMOOTH_FFT.length; i++) {
        const raw = hasAudio ? (rawFFT[i] ?? 0) / 255 : (rawFFT[i] ?? 0);
        SMOOTH_FFT[i] = SMOOTH_FFT[i] * (1 - fk) + raw * fk;
      }

      // ── Smooth live values (time-based EMA) ───────────
      const targetEn   = playing ? (live.energy    ?? 0.3) : sEn * 0.7;
      const targetBeat = live.beatFlash ?? 0;
      const targetKick = live.kickFlash ?? 0;

      // Beat: instant attack, time-based decay
      if (targetBeat > sBeat) sBeat = targetBeat;
      else                    sBeat = Math.max(0, sBeat - dt * (playing ? 2.4 : 6.0));
      if (targetKick > sKick) sKick = targetKick;
      else                    sKick = Math.max(0, sKick - dt * (playing ? 3.2 : 7.0));

      sEn    += (targetEn - sEn) * smoothK(0.18, dt);
      sChrom  = sChrom * (1 - smoothK(0.24, dt)) + (sBeat > 0.7 ? sBeat * 0.85 : 0) * smoothK(0.24, dt);

      // ── Hue calculation ────────────────────────────────
      const mH      = MOOD_HUE[live.mood]     ?? MOOD_HUE.neutral;
      const sH      = SCENE_HUE[currScene]    ?? null;
      const baseHue = ((((sH !== null ? sH : mH) + (live.centroid ?? 0.3) * 36 - 18) % 360) + 360) % 360;

      // ── Decide render target ───────────────────────────
      // Kaleidoscope: render to offscreen first, then mirror
      const useKaleid  = TIER.kaleid && (!currScene || currScene === "cosmic" || currScene === "relax");
      const tgt        = useKaleid ? offCtx  : ctx;
      const TW         = useKaleid ? offCvs.width  : W;
      const TH         = useKaleid ? offCvs.height : H;

      // ── Spawn particles ────────────────────────────────
      const spawnRate = DEVICE_TIER === "high" ? 0.38 : DEVICE_TIER === "medium" ? 0.25 : 0.15;
      if (playing && particles.count < TIER.maxParticles && Math.random() < spawnRate + sEn * 0.55) {
        particles.spawn(TW, TH, baseHue, sEn, false, TW / 2, TH / 2);
      }

      // Beat burst
      if (sBeat > 0.82 && (now - lastBeatStamp) > 160) {
        lastBeatStamp = now;
        const burstN = DEVICE_TIER === "high" ? 26 : DEVICE_TIER === "medium" ? 14 : 7;
        for (let i = 0; i < burstN; i++) particles.spawn(TW, TH, baseHue, sEn, true, TW / 2, TH / 2);
        if (waves.length < TIER.maxWaves) {
          waves.push({ cx: TW / 2, cy: TH / 2, r: 5, maxR: Math.min(TW, TH) * 0.54, alpha: 1, hue: baseHue });
        }
      }

      // ── Background trail ──────────────────────────────
      // Less clearing = more motion trail; beat drops clear less (bright flash look)
      const trailA = playing
        ? (sBeat > 0.7 ? 0.055 : 0.175)
        : 0.38; // fast clear on stop
      tgt.fillStyle = `rgba(3,4,14,${trailA})`;
      tgt.fillRect(0, 0, TW, TH);

      // ── Ribbon history (medium+) ───────────────────────
      if (TIER.ribbon) updateRibbon(ribbon, SMOOTH_FFT);

      // ══════════════════════════════════════════════════
      // SCENE-SPECIFIC RENDERING
      // ══════════════════════════════════════════════════

      if (currScene === "party") {
        // ── Party: high-energy bars + strobes ────────────
        if (sBeat > 0.65) {
          tgt.save();
          tgt.globalCompositeOperation = "lighter";
          tgt.fillStyle = hs(baseHue, 100, 42, (sBeat - 0.65) * 0.22);
          tgt.fillRect(0, 0, TW, TH);
          tgt.restore();
        }
        drawBars(tgt, TW, TH, SMOOTH_FFT, sBeat, DEVICE_TIER === "low" ? 80 : 120);
        tickWaves(tgt, waves, dt);
        if (DEVICE_TIER !== "low") particles.spawnFromSpectrum(TW, TH, SMOOTH_FFT, sEn);
        particles.tick(tgt, dt);
        // Kick rays
        if (sKick > 0.42 && DEVICE_TIER !== "low") {
          const cx = TW / 2, cy = TH / 2;
          const len = Math.min(TW, TH) * 0.22 * sKick;
          tgt.save();
          tgt.globalCompositeOperation = "lighter";
          const rays = DEVICE_TIER === "high" ? 16 : 10;
          for (let i = 0; i < rays; i++) {
            const ang = (i / rays) * Math.PI * 2 + t * 1.3;
            tgt.beginPath();
            tgt.moveTo(cx, cy);
            tgt.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
            tgt.strokeStyle = hs(binHue(i * 32, 512), 100, 65, sKick * 0.42);
            tgt.lineWidth   = 1.8;
            tgt.stroke();
          }
          tgt.restore();
        }

      } else if (currScene === "focus") {
        // ── Focus: clean radial + waveform ───────────────
        drawRadial(tgt, TW, TH, SMOOTH_FFT, sBeat * 0.5, sKick * 0.4, 0.10, 0.32);
        drawWaveRing(tgt, TW, TH, live.timeData, baseHue, sEn, Math.min(TW, TH) * 0.15);
        tickWaves(tgt, waves, dt);
        drawOrb(tgt, TW, TH, baseHue, sEn * 0.7, sBeat * 0.5, sKick * 0.3);

      } else if (currScene === "sleep") {
        // ── Sleep: slow plasma + gentle particles ─────────
        drawPlasma(tgt, TW, TH, baseHue, sEn * 0.6, t * 0.7);
        drawOrb(tgt, TW, TH, baseHue, sEn * 0.5, sBeat * 0.4, sKick * 0.3);
        particles.tick(tgt, dt);

      } else if (currScene === "relax") {
        // ── Relax: plasma + radial (kaleidoscoped) ───────
        drawPlasma(tgt, TW, TH, baseHue, sEn, t);
        drawRadial(tgt, TW, TH, SMOOTH_FFT, sBeat * 0.45, sKick * 0.3, 0.14, 0.34);
        particles.tick(tgt, dt);

      } else if (currScene === "workout") {
        // ── Workout: aggressive bars + flash ─────────────
        tgt.fillStyle = `rgba(0,0,0,${sBeat > 0.78 ? 0.022 : 0.17})`;
        tgt.fillRect(0, 0, TW, TH);
        if (sBeat > 0.5) {
          tgt.save();
          tgt.globalCompositeOperation = "lighter";
          tgt.fillStyle = `rgba(210,18,0,${(sBeat - 0.5) * 0.24})`;
          tgt.fillRect(0, 0, TW, TH);
          tgt.restore();
        }
        drawBars(tgt, TW, TH, SMOOTH_FFT, sBeat, DEVICE_TIER === "low" ? 72 : 96, 1);
        tickWaves(tgt, waves, dt);
        particles.tick(tgt, dt);

      } else if (currScene === "jazz") {
        // ── Jazz: Lissajous + warm radial ─────────────────
        tgt.fillStyle = "rgba(5,3,0,0.18)";
        tgt.fillRect(0, 0, TW, TH);
        drawLissajous(tgt, TW, TH, live.timeData, baseHue, sEn, t);
        drawRadial(tgt, TW, TH, SMOOTH_FFT, sBeat * 0.55, sKick * 0.4, 0.10, 0.36);
        tickWaves(tgt, waves, dt);
        particles.tick(tgt, dt);

      } else if (currScene === "wakeup") {
        // ── Wakeup: sunrise rays + bars ───────────────────
        tgt.save();
        tgt.fillStyle = "rgba(2,1,0,0.16)";
        tgt.fillRect(0, 0, TW, TH);
        tgt.globalCompositeOperation = "lighter";
        const sg = tgt.createRadialGradient(TW / 2, TH, 0, TW / 2, TH, TH * 0.95);
        sg.addColorStop(0, hs(baseHue, 100, 50, 0.08 + sEn * 0.07));
        sg.addColorStop(1, "transparent");
        tgt.fillStyle = sg;
        tgt.fillRect(0, 0, TW, TH);
        const rayN = DEVICE_TIER === "low" ? 14 : 22;
        for (let i = 0; i < rayN; i++) {
          const ang = Math.PI * (-0.12 + 1.24 * (i / (rayN - 1))) + Math.PI;
          const v   = SMOOTH_FFT[logBin(i, rayN, SMOOTH_FFT.length)] ?? 0;
          tgt.beginPath();
          tgt.moveTo(TW / 2, TH);
          tgt.lineTo(TW / 2 + Math.cos(ang) * TH * 1.4, TH + Math.sin(ang) * TH * 1.4);
          tgt.strokeStyle = hs(binHue(i * 23, 512), 100, 65, v * 0.15 + 0.03);
          tgt.lineWidth   = TH * 0.048;
          tgt.stroke();
        }
        tgt.restore();
        drawBars(tgt, TW, TH, SMOOTH_FFT, sBeat, DEVICE_TIER === "low" ? 80 : 110);
        tickWaves(tgt, waves, dt);
        particles.tick(tgt, dt);

      } else if (currScene === "cosmic") {
        // ── Cosmic: tunnel + full radial spectrum ──────────
        drawTunnel(tgt, TW, TH, SMOOTH_FFT, baseHue, sEn, sBeat, t);
        drawRadial(tgt, TW, TH, SMOOTH_FFT, sBeat, sKick);
        drawWaveRing(tgt, TW, TH, live.timeData, baseHue, sEn, Math.min(TW, TH) * 0.09);
        tickWaves(tgt, waves, dt);
        particles.tick(tgt, dt);

      } else {
        // ── NEBULA (default): layered radial + waveform + orb ─
        // Double radial: outer glow pass + sharp pass
        tgt.save();
        tgt.globalAlpha = 0.45;
        drawRadial(tgt, TW, TH, SMOOTH_FFT, sBeat * 0.6, sKick * 0.4, 0.28, 0.46);
        tgt.globalAlpha = 1;
        tgt.restore();
        drawRadial(tgt, TW, TH, SMOOTH_FFT, sBeat, sKick);
        drawWaveRing(tgt, TW, TH, live.timeData, baseHue, sEn, Math.min(TW, TH) * 0.10);
        drawOrb(tgt, TW, TH, baseHue, sEn, sBeat, sKick);
        tickWaves(tgt, waves, dt);
        if (DEVICE_TIER !== "low") particles.spawnFromSpectrum(TW, TH, SMOOTH_FFT, sEn);
        particles.tick(tgt, dt);
      }

      // ── Shared overlays (most scenes) ─────────────────
      if (currScene !== "focus" && currScene !== "sleep") {
        if (TIER.ribbon) drawRibbon(tgt, TW, TH, ribbon, sEn * 0.48);
      }
      if (live.chroma && DEVICE_TIER !== "low") drawChroma(tgt, TW, TH, live.chroma);

      // ── Kaleidoscope post-process ──────────────────────
      if (useKaleid && TIER.kaleid) {
        // Rotation speed: faster with energy, with beat kick
        kRot += dt * 0.00038 * (1 + sEn * 0.55 + sBeat * 0.18) * 2 * Math.PI;
        ctx.fillStyle = "#030408";
        ctx.fillRect(0, 0, W, H);
        kaleidoscope(ctx, offCvs, W, H, 8, kRot);
        if (sChrom > 0.12) chromAb(ctx, W, H, sChrom * 0.35);
      } else {
        if (sChrom > 0.12) chromAb(ctx, W, H, sChrom * 0.30);
      }

      // ── HUD ───────────────────────────────────────────
      drawHUD(ctx, W, H, live, hasAudio, playing);
    }

    lastTime = performance.now();
    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      particles.flush();
    };
  }, [liveRef]); // only liveRef dep — everything else read via refs in the RAF

  return (
    <div
      ref={wrapRef}
      style={{ width: "100%", height: "100%", background: "#030408", position: "relative", overflow: "hidden" }}
    >
      <canvas
        ref={cvsRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </div>
  );
}
