# ARAEA AI Visual Server — Setup Guide

## Quick Start (Tier 4 — works on any machine)

```bash
cd araea-stage3/python
pip install websockets Pillow numpy scipy
python ai_visual_server.py --tier 4
```

Open the dashboard → click **AI Visuals** toggle. Reaction-diffusion + Fourier synthesis streams immediately.

---

## Tier 3 — StyleGAN2 ONNX (CPU, ~120ms/frame)

```bash
pip install onnxruntime   # or onnxruntime-gpu for CUDA
```

Download the pretrained abstract art model:
```bash
mkdir -p python/models
# Option A: HuggingFace Hub
pip install huggingface_hub
python -c "
from huggingface_hub import hf_hub_download
hf_hub_download('araea/stylegan2-abstract-onnx',
                'stylegan2_abstract.onnx',
                local_dir='python/models')
"

# Option B: Manual — convert any StyleGAN2 PyTorch checkpoint
# See: https://github.com/NVlabs/stylegan2-ada-pytorch
```

```bash
python ai_visual_server.py --tier 3
```

---

## Tier 2 — SD 1.5 + LCM (~350ms/frame, 4GB VRAM)

```bash
# Install PyTorch first from pytorch.org for your CUDA version, then:
pip install diffusers transformers accelerate
python ai_visual_server.py --tier 2
# Model (~1.7GB) downloads automatically on first run
```

---

## Tier 1 — SDXL-Turbo (~200ms/frame, 8GB VRAM)

```bash
pip install diffusers transformers accelerate xformers
python ai_visual_server.py --tier 1
# Model (~7GB) downloads automatically on first run
```

---

## How it works

```
Audio features (mood, energy, bpm, bass, mid, hi, beat, scene)
        │
        ▼
  Prompt Builder  →  "euphoric neon aurora, deep space, intense pulsating..."
        │
        ▼
  Image Generator (Tier 1–4)
        │
        ▼
  Base64 JPEG frame  →  WebSocket  →  Frontend overlay
```

### Tier 4 — Reaction-Diffusion + Fourier (Procedural)
- Gray-Scott reaction-diffusion simulation driven by audio
- f/k parameters mapped from bass/energy → organic patterns
- Beat injection creates explosive visual bursts
- Fourier synthesis adds frequency-domain structure
- Colormap shifts with mood + scene hue
- ~40ms/frame on any CPU

### Tier 3 — StyleGAN2 ONNX (Latent Walking)
- Random latent vector z ∈ R^512
- Each frame: z += α × (bass_dir×bass + mid_dir×mid + energy_dir×energy)
- Beat: random noise injection into z
- Smooth continuous evolution through the GAN's abstract art manifold
- No prompt needed — audio directly controls latent space

### Tier 1–2 — Stable Diffusion img2img
- Audio features → text prompt → SD img2img
- Previous frame used as base image (strength 0.4–0.7)
- Low denoising strength = smooth evolution, preserving structure
- Beat = higher strength = more dramatic change
- Continuous audio-reactive narrative visual

---

## Ports

| Service | Port |
|---------|------|
| Node.js backend | 3001 |
| AI Visual Server | 5678 |
| Frontend (Vite) | 5173 |

---

## Troubleshooting

**"Module not found: websockets"** → `pip install websockets`

**"CUDA out of memory"** → Use `--tier 2` or `--res 256` for smaller frames

**"Model not found"** → First run downloads model, needs internet + disk space

**Slow on CPU** → Use `--tier 4` for instant procedural visuals

**Black frames** → Check WebSocket connection in AI Visuals panel (ws://127.0.0.1:5678)
