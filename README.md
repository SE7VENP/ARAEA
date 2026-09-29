# ARAEA Stage 3 — AIoT Music-Driven Ambient System









After replacing the files — do this every time
cd frontend
rmdir /s /q .vite
rmdir /s /q node_modules\.vite
npm run dev

ARAEA is a full-stack ambient intelligence system that fuses emotion detection,
biometric data, environmental sensors, and Spotify playback into a single
coherent audio-visual experience.

## Quick Start

**Prerequisites:** Node.js 18+, Python 3.9+ (optional AI features)

```bash
# Windows
start.bat

# macOS / Linux
chmod +x start.sh && ./start.sh
```

Then open **http://localhost:5173** in your browser.

## Configuration

Copy `backend/.env.example` to `backend/.env` and fill in:

```env
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REFRESH_TOKEN=optional_for_auto_login
MONGODB_URI=optional_mongodb_connection_string
```

Get Spotify credentials at [developer.spotify.com](https://developer.spotify.com).

## Architecture

```
ARAEA Stage 3
├── backend/                Node.js + Express + Socket.IO
│   ├── server.js           Entry point — 125 lines, mounts routes only
│   ├── config/             All env vars (single source of truth)
│   ├── middleware/         validate.js · errors.js
│   ├── data/               Static seed data (community profiles, therapy programs…)
│   ├── services/           Business logic
│   │   ├── StateService    Single source of truth for live app state
│   │   ├── DatabaseService MongoDB + in-memory fallback
│   │   ├── PipelineService Mood fusion algorithm
│   │   ├── TherapyService  Session state machine
│   │   └── SimulationService Sensor + biometric simulation
│   └── routes/             Thin HTTP handlers (13 files)
│
├── frontend/               React 18 + Vite
│   └── src/
│       ├── constants/      Emotions · Scenes · Navigation
│       ├── utils/          Storage · Time · Math (pure functions)
│       ├── services/       backendAPI · spotifyAPI · lyricsAPI
│       ├── theme/          Design system (CSS vars + useTheme hook)
│       ├── hooks/          useSpotify · useBackendSync · useAudioEngine
│       │                   useEmotionEngine · useAudioPipeline · usePlayback
│       └── components/
│           ├── ui/         Reusable primitives (Card, Badge, TrackCard…)
│           ├── layout/     Header · IconSidebar · Footer
│           ├── visualizer/ VisualCanvas · SyncedVisualizer · Butterchurn · AI
│           ├── player/     NowPlaying · TrackList · SearchBar
│           └── pages/      Full-page feature views
│
└── python/                 Optional AI servers
    ├── emotion_detector.py  Face emotion detection (WebSocket)
    └── ai_visual_server.py  AI image generation for visualizer overlay
```

See **ARCHITECTURE.md** for detailed design decisions and contribution guidelines.

## Features

| Feature | Status |
|---------|--------|
| Emotion detection (manual / text / webcam / AI) | ✅ |
| Emotion → Spotify autoplay pipeline | ✅ |
| Audio-reactive visualizer (Web Audio FFT) | ✅ |
| Synesthesia visuals (chromesthesia, kaleidoscope) | ✅ |
| Butterchurn Milkdrop visualizer | ✅ |
| Biometric monitoring | ✅ |
| Guided therapy sessions | ✅ |
| Voice + gesture control | ✅ |
| Multi-sensory ambient control (Hue, WLED, fan…) | ✅ |
| Community ambient profiles | ✅ |
| AI insights + mood history | ✅ |
| MongoDB persistence with in-memory fallback | ✅ |

## Emotion → Audio → Visualizer Flow

```
User input (manual / text / webcam / socket)
    │
    ▼
useEmotionEngine          priority: manual > text > webcam > socket
    │ emotion label (e.g. "calm")
    ▼
useAudioPipeline          state machine: idle→searching→initiating→playing
    │ confirmed playing
    ▼
SyncedVisualizer          mounts ONLY when pipeline.status === 'playing'
    │ liveRef (FFT data)
    ▼
VisualCanvas              performance-tiered: high/medium/low
                          dt-based timing · zero GC in hot path
```

## Performance Tiers

VisualCanvas auto-detects device capability and adjusts quality:

| Tier | Cores | FPS | Particles | Kaleidoscope | Chromatic Ab. |
|------|-------|-----|-----------|-------------|---------------|
| High | ≥8   | 60  | 400       | ✅          | ✅            |
| Med  | ≥4   | 45  | 180       | —           | —             |
| Low  | <4   | 30  | 80        | —           | —             |

## API Reference

All backend routes are documented in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

Base URL: `http://localhost:3001`

```
GET  /health                     System status
GET  /auth/login                 Get Spotify OAuth URL
GET  /auth/token                 Get current access token
POST /api/emotion/manual         Set emotion { emotion: "calm" }
POST /api/scene                  Set scene { scene: "focus" | null }
GET  /api/spotify/recommendations Mood-based track recommendations
GET  /api/mood/history           Mood log
GET  /api/insights               AI analysis summary
POST /api/therapy/start          Start guided session { mode: "breathwork" }
```

## Tech Stack

**Backend:** Node.js 18 · Express 4 · Socket.IO 4 · MongoDB (optional)

**Frontend:** React 18 · Vite 5 · Web Audio API · Canvas 2D · OffscreenCanvas

**Optional AI:** Python 3.9 · TensorFlow.js · diffusers · DeepFace
