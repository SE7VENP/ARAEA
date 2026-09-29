<div align="center">

<img src="frontend/public/favicon.svg" width="72" alt="ARAEA Logo"/>

# ARAEA — AIoT Music Ambient System
### Stage 3 · v3.0.0

**Real-time emotion-driven music, powered by face detection, environmental sensors, and the Spotify Web API.**

[![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18.2-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)](https://python.org)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-010101?logo=socket.io)](https://socket.io)
[![Spotify](https://img.shields.io/badge/Spotify-Web%20API-1DB954?logo=spotify&logoColor=white)](https://developer.spotify.com)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

---

</div>

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Setup & Installation](#setup--installation)
  - [1. Spotify Developer App](#1-spotify-developer-app)
  - [2. Clone & Install](#2-clone--install)
  - [3. Environment Variables](#3-environment-variables)
  - [4. Arduino / ESP32 (Optional)](#4-arduino--esp32-optional)
- [Running the Project](#running-the-project)
  - [Quick Start (Windows)](#quick-start-windows)
  - [Manual Start](#manual-start)
- [How It Works](#how-it-works)
- [API Reference](#api-reference)
- [Emotion Engine](#emotion-engine)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## Overview

ARAEA is a full-stack **AIoT (Artificial Intelligence of Things)** system that detects your emotional state in real time and autonomously curates a Spotify playlist to match or shift your mood. It fuses signals from four independent sources:

| Source | Technology | What it detects |
|--------|-----------|-----------------|
| **Face** | Python + DeepFace + OpenCV | Facial expression → emotion label |
| **Voice** | Web Speech API | Spoken words → sentiment |
| **Environment** | ESP32 + DHT22 / BH1750 / PIR | Temperature, humidity, light, motion |
| **Biometrics** | Simulation / wearable input | Heart rate, HRV |

These signals are fused by a weighted pipeline on the backend, producing a single **emotion label** (e.g. `happy`, `calm`, `tense`) that drives automatic track selection and ambient visualisations.

---

## System Architecture

```
┌─────────────────────── BROWSER ───────────────────────────┐
│                                                           │
│  React Dashboard (Vite · :5173)                           │
│                                                           │
│  ┌──────────────┐  ┌─────────────┐  ┌────────────────┐  │
│  │ useSpotify   │  │ useEmotion  │  │ useAudioPipeline│  │
│  │ SDK + REST   │  │ Engine      │  │ Emotion→Tracks  │  │
│  └──────┬───────┘  └──────┬──────┘  └───────┬────────┘  │
│         │                 │                  │            │
│  Spotify Web Playback SDK          Backend REST / WS      │
└─────────┼─────────────────┼──────────────────┼───────────┘
          │                 │                  │
          ▼                 ▼                  ▼
┌─────────────────── NODE.JS BACKEND (:3001) ───────────────┐
│                                                           │
│  Express + Socket.IO                                      │
│  ├── /api/auth        Spotify OAuth 2.0 (PKCE-ready)     │
│  ├── /api/search      Spotify search proxy                │
│  ├── /api/emotion     Ingest + fuse emotion signals       │
│  ├── /api/sensors     IoT sensor data ingestion           │
│  ├── /api/spotify     Playback control passthrough        │
│  ├── /api/insights    AI-generated mood insights          │
│  ├── /api/therapy     Guided therapy session logic        │
│  └── /api/community   Shared mood board                   │
│                                                           │
│  Services: StateService · PipelineService · DatabaseService│
│  OAuth: oauthServer.js (HTTP server on :8888)             │
└─────────────────────────────────────────────────────────┬─┘
                                                          │
          ┌───────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────── PYTHON AI (:5678 WS) ─────────────┐
│                                                           │
│  emotion_detector.py     DeepFace + OpenCV, webcam feed   │
│  ai_visual_server.py     WebSocket AI visual generation   │
└───────────────────────────────────────────────────────────┘
          ▲
          │  HTTP JSON  (every 2 sec)
┌─────────────────────── ESP32 ─────────────────────────────┐
│  arduino/sensors.ino                                      │
│  DHT22 · BH1750 · PIR → POST /api/sensors                │
└───────────────────────────────────────────────────────────┘
```

---

## Features

**Emotion Detection**
- Real-time facial emotion recognition via DeepFace (7 emotion classes)
- Graceful mock mode when no camera is available (`--mock` flag)
- Voice sentiment analysis using the browser's Web Speech API
- Biometric input (heart rate / HRV) from simulation or wearable

**Smart Music Playback**
- Emotion-to-music mapping with curated search query banks per mood
- Automatic track selection and queuing via Spotify Web Playback SDK
- Full playback controls: play, pause, skip, seek, volume
- Lyrics display (synced where available)
- Sleep timer with configurable fade-out

**Environmental Sensing**
- ESP32-based IoT node with DHT22, BH1750, and PIR sensors
- Environmental context (hot room → energetic music, dark + calm → ambient)
- Simulation mode when hardware is unavailable

**Visualisations**
- Butterchurn WebGL music visualiser (Milkdrop-style, 200+ presets)
- AI Visual Canvas: generative visuals synced to emotion and audio FFT
- Real-time waveform and spectrum rendering via Web Audio API

**Advanced Modes**
- **Therapy Mode** — guided mood-shifting sessions with progress tracking
- **Community Hub** — shared emotion board and collaborative playlists
- **AI Insights** — natural-language mood summaries and trend analysis
- **Multi-Sensory** — haptic and ambient lighting integration hooks
- **Voice & Gesture** — hands-free control via speech commands

**Dashboard**
- Light / dark theme with custom accent colours
- Historical mood timeline and charts
- Project presentation / demo mode

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend framework | React 18 + Vite 5 |
| Styling | CSS custom properties (no external UI framework) |
| Real-time | Socket.IO client ↔ Socket.IO server |
| Music | Spotify Web Playback SDK + Web API |
| Visualiser | Butterchurn (WebGL), Canvas 2D, Web Audio API |
| Backend | Node.js 22, Express 4, Socket.IO 4 |
| Database | MongoDB (optional) with in-memory fallback |
| OAuth | Custom Express OAuth 2.0 server on :8888 |
| Emotion AI | Python 3.10+, DeepFace, OpenCV, NumPy |
| IoT firmware | Arduino C++ (ESP32 DevKit C) |
| HTTP client | Native `fetch` (Node 22 + browser) |

---

## Prerequisites

Before you begin, make sure you have the following installed:

| Tool | Version | Notes |
|------|---------|-------|
| **Node.js** | ≥ 18.x (22.x recommended) | [nodejs.org](https://nodejs.org) |
| **npm** | ≥ 9.x | Ships with Node.js |
| **Python** | ≥ 3.10 | [python.org](https://python.org) |
| **pip** | latest | `python -m pip install --upgrade pip` |
| **Git** | any | [git-scm.com](https://git-scm.com) |
| **Spotify Premium** | required for playback | Free accounts cannot use the Web Playback SDK |

---

## Project Structure

```
araea/
├── arduino/
│   └── sensors.ino             # ESP32 firmware (DHT22, BH1750, PIR)
│
├── backend/
│   ├── config/
│   │   └── index.js            # All environment variables (single source)
│   ├── data/                   # Static data: therapy programs, presets, etc.
│   ├── middleware/             # Express middleware (validation, error handling)
│   ├── models/
│   │   └── index.js            # Mongoose models (mood logs, song history)
│   ├── routes/
│   │   ├── auth.js             # Spotify OAuth endpoints
│   │   ├── emotion.js          # Emotion ingestion + fusion
│   │   ├── history.js          # Search proxy + mood/song history
│   │   ├── sensors.js          # IoT sensor ingestion
│   │   ├── spotify.js          # Playback control passthrough
│   │   ├── insights.js         # AI mood insights
│   │   ├── therapy.js          # Therapy session state machine
│   │   ├── community.js        # Shared mood board
│   │   └── voice.js            # Voice command processing
│   ├── services/
│   │   ├── StateService.js     # Global app state (single source of truth)
│   │   ├── DatabaseService.js  # MongoDB + in-memory fallback
│   │   ├── PipelineService.js  # Emotion fusion algorithm
│   │   ├── TherapyService.js   # Guided session logic
│   │   └── SimulationService.js# Sensor simulation for demo mode
│   ├── oauthServer.js          # Standalone OAuth callback HTTP server
│   ├── spotifyService.js       # All Spotify Web API calls
│   ├── contextEngine.js        # Environmental context → mood modifier
│   ├── server.js               # Express app entry point
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── public/
│   │   ├── favicon.svg
│   │   └── manifest.json
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/         # Header, Sidebar, Footer
│   │   │   ├── player/         # NowPlaying, TrackList, SearchBar
│   │   │   ├── visualizer/     # Butterchurn, AI Canvas, Synced Visualizer
│   │   │   └── ui/             # Reusable design primitives
│   │   ├── constants/          # Emotion labels, scene config, navigation
│   │   ├── hooks/
│   │   │   ├── useSpotify.js       # Spotify SDK lifecycle + token management
│   │   │   ├── useEmotionEngine.js # Multi-source emotion detection
│   │   │   ├── useAudioPipeline.js # Emotion → track selection state machine
│   │   │   ├── usePlayback.js      # Lyrics, search, recommendations
│   │   │   ├── useAudioEngine.js   # Web Audio API FFT analysis
│   │   │   └── useBackendSync.js   # Socket.IO + REST state sync
│   │   ├── services/
│   │   │   ├── backendAPI.js   # All ARAEA backend HTTP calls
│   │   │   ├── spotifyAPI.js   # Spotify REST calls (via backend proxy)
│   │   │   └── lyricsAPI.js    # Lyrics fetching
│   │   ├── utils/              # Pure helpers: storage, time, math
│   │   ├── App.jsx             # Root component, hook composition
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── python/
│   ├── emotion_detector.py     # Webcam → DeepFace → POST /api/emotion
│   ├── ai_visual_server.py     # WebSocket AI visual generation server
│   ├── requirements.txt        # Core Python deps
│   └── requirements_ai.txt     # AI visual server deps
│
├── start.bat                   # One-click launcher (Windows)
├── start.sh                    # One-click launcher (macOS / Linux)
└── README.md
```

---

## Setup & Installation

### 1. Spotify Developer App

ARAEA requires a Spotify app with **Web API** and **Web Playback SDK** enabled.

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Click **Create App**
3. Fill in:
   - **App name**: ARAEA (or anything you like)
   - **App description**: AIoT Music Ambient System
   - **Redirect URIs** — add **both** of these exactly:
     ```
     http://127.0.0.1:8888/callback
     http://localhost:8888/callback
     ```
   - **APIs used**: check **Web API** and **Web Playback SDK**
4. Click **Save** → go to **Settings** → copy your **Client ID** and **Client Secret**

> **Important:** Playback requires a **Spotify Premium** account. Search and metadata work on any account type.

---

### 2. Clone & Install

```bash
# Clone the repository
git clone https://github.com/your-username/araea.git
cd araea

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Install Python dependencies (core)
cd ../python
pip install -r requirements.txt

# Optional: AI visual server dependencies
pip install -r requirements_ai.txt
```

---

### 3. Environment Variables

Copy the example file and fill in your credentials:

```bash
cd backend
copy .env.example .env        # Windows
# cp .env.example .env        # macOS / Linux
```

Edit `backend/.env`:

```env
# ── Spotify OAuth ─────────────────────────────────────────
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
SPOTIFY_REFRESH_TOKEN=          # leave blank — filled automatically on first login

# ── MongoDB (optional) ────────────────────────────────────
# Leave blank to use the built-in in-memory store
MONGODB_URI=mongodb://localhost:27017/araea

# ── Server ────────────────────────────────────────────────
PORT=3001
```

---

### 4. Arduino / ESP32 (Optional)

If you have an ESP32 with DHT22, BH1750, and PIR sensors:

1. Open `arduino/sensors.ino` in the Arduino IDE
2. Install required libraries via the Library Manager:
   - `DHT sensor library` by Adafruit
   - `Adafruit Unified Sensor` by Adafruit
   - `BH1750` by Christopher Laws
   - `ArduinoJson` by Benoit Blanchon
3. Edit the config block at the top of the sketch:
   ```cpp
   const char* WIFI_SSID     = "YOUR_WIFI_NAME";
   const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
   const char* SERVER_IP     = "192.168.x.x";  // Your PC's local IP
   const int   SERVER_PORT   = 3001;
   ```
4. Select **Tools → Board → ESP32 Dev Module** and upload

> **No hardware?** The backend runs a simulation that generates realistic sensor data automatically. You don't need an ESP32 to use ARAEA.

**Wiring diagram:**

```
ESP32 DevKit C
│
├── GPIO4  → DHT22 DATA  (10kΩ pull-up to 3.3V)
├── GPIO21 → BH1750 SDA
├── GPIO22 → BH1750 SCL
└── GPIO15 → PIR OUT

DHT22:   VCC → 3.3V,  GND → GND
BH1750:  VCC → 3.3V,  GND → GND
PIR:     VCC → 5V,    GND → GND
```

---

## Running the Project

### Quick Start (Windows)

Double-click `start.bat` in the project root. It will:

1. Start the **backend** server on `:3001`
2. Start the **frontend** dev server on `:5173`
3. Start the **Python AI visual server** on `:5678`
4. Open the dashboard automatically at `http://localhost:5173`

---

### Manual Start

Open **three separate terminals**:

**Terminal 1 — Backend**
```bash
cd backend
npm run dev
# Server starts at http://127.0.0.1:3001
# OAuth callback server starts at http://127.0.0.1:8888
```

**Terminal 2 — Frontend**
```bash
cd frontend
npm run dev
# Dashboard starts at http://localhost:5173
```

**Terminal 3 — Python Emotion Detector** *(optional but recommended)*
```bash
cd python

# With webcam (real emotion detection):
python emotion_detector.py

# Without webcam (simulated emotions for demo):
python emotion_detector.py --mock

# Faster detection interval:
python emotion_detector.py --interval 1.5
```

**Terminal 4 — AI Visual Server** *(optional)*
```bash
cd python
python ai_visual_server.py --tier 4
# WebSocket server starts at ws://127.0.0.1:5678
```

---

**First-time login flow:**

1. Open `http://localhost:5173`
2. Click **Connect Spotify**
3. A browser window opens to Spotify's auth page — log in and approve
4. You are redirected back automatically and the dashboard activates
5. Click an emotion tile or let the camera detect your emotion
6. Music starts playing automatically on the ARAEA player in your browser

---

## How It Works

### Emotion → Music Pipeline

```
Webcam frame
    │
    ▼  (Python, every 2 sec)
DeepFace.analyze()
    │  emotion label + confidence
    ▼
POST /api/emotion/detector
    │
    ▼  (PipelineService)
Weighted fusion:
  face    × 0.45
  voice   × 0.25
  sensors × 0.20
  bio     × 0.10
    │  dominant emotion
    ▼
Socket.IO broadcast → frontend
    │
    ▼  (useAudioPipeline)
Emotion → search query bank lookup
    │  e.g. "calm" → ["ambient relaxing", "peaceful calm", "chill lofi"]
    ▼
GET /api/search?q=ambient+relaxing    (backend Spotify proxy)
    │  track list
    ▼
Pick highest-popularity track not recently played
    │
    ▼
Transfer playback to ARAEA SDK device
PUT /me/player  { device_ids: [sdk_device_id], play: false }
    │
    ▼
Play track
PUT /me/player/play?device_id=... { uris: [track.uri] }
    │
    ▼
Now Playing + Visualiser updates
```

### Emotion Labels

ARAEA maps raw DeepFace emotions to an extended set of moods:

| DeepFace Output | ARAEA Mood | Music Style |
|----------------|-----------|-------------|
| `happy` | happy / euphoric | Pop, upbeat, dance |
| `sad` | sad / melancholic | Emotional piano, indie |
| `angry` | angry / tense | Rock, cinematic, intense |
| `fear` | fearful | Dark ambient, gothic |
| `disgust` | angry | Hard rock |
| `surprise` | surprised | Exciting pop, fun indie |
| `neutral` | neutral / calm | Top charts, alternative |

---

## API Reference

All backend endpoints are served at `http://127.0.0.1:3001`.

### Authentication

| Method | Endpoint | Description |
|--------|---------|-------------|
| `GET` | `/auth/login` | Returns Spotify OAuth URL |
| `GET` | `/auth/status` | Check if a valid token is stored |
| `GET` | `/auth/token` | Returns current access token |
| `GET` | `/auth/logout` | Clear stored tokens |

### Emotion

| Method | Endpoint | Description |
|--------|---------|-------------|
| `POST` | `/api/emotion/detector` | Ingest a detection result from Python |
| `POST` | `/api/emotion/voice` | Ingest a voice sentiment result |
| `GET` | `/api/emotion/state` | Get current fused emotion state |

### Music

| Method | Endpoint | Description |
|--------|---------|-------------|
| `GET` | `/api/search?q={query}` | Search Spotify (backend proxy) |
| `GET` | `/api/songs/history` | Get recently played tracks |
| `GET` | `/api/mood/history` | Get mood log entries |

### Sensors

| Method | Endpoint | Description |
|--------|---------|-------------|
| `POST` | `/api/sensors/data` | Ingest ESP32 sensor reading |
| `GET` | `/api/sensors/latest` | Get most recent sensor values |

### Socket.IO Events

| Event | Direction | Payload |
|-------|----------|---------|
| `emotion:update` | Server → Client | `{ emotion, confidence, sources }` |
| `sensor:update` | Server → Client | `{ temperature, humidity, light, motion }` |
| `track:notify` | Client → Server | `{ trackId, name, artist }` |
| `therapy:state` | Server → Client | `{ phase, progress, nextEmotion }` |

---

## Emotion Engine

The frontend `useEmotionEngine` hook fuses emotion signals from multiple sources with configurable weights:

```js
// Default source weights (sum to 1.0)
const WEIGHTS = {
  face:    0.45,   // DeepFace via Python → Socket.IO
  voice:   0.25,   // Web Speech API (browser)
  sensors: 0.20,   // ESP32 via backend → Socket.IO
  bio:     0.10,   // Biometric simulation / wearable
};
```

The final emotion is determined by a weighted vote across all active sources. Sources that haven't reported in the last 30 seconds are excluded from the fusion to avoid stale data skewing the result.

---

## Troubleshooting

**Spotify search returns 400 "Invalid limit"**

This is a known Spotify Web API quirk where browser-origin search requests from free-tier accounts in certain regions are rejected. ARAEA routes all search calls through the backend proxy (`/api/search`) to avoid this. Make sure:
- Your **backend** server is running (`http://127.0.0.1:3001`)
- You have re-authenticated via **Connect Spotify** after any backend restart

**"No tracks found for X mood"**

1. Check the backend terminal for `[searchTracks]` log lines
2. The Spotify token may have expired — click **Connect Spotify** again to re-authenticate
3. Verify your Spotify app has **Web API** checked in the dashboard settings

**"Playback issue" / tracks don't play**

- Spotify **Premium** is required for the Web Playback SDK
- Make sure no other Spotify client (phone, desktop app) has taken over as the active device
- The ARAEA player in the browser must be the active Spotify device; it transfers automatically on first play

**Python emotion detector not working**

```bash
# Check DeepFace is installed:
pip install deepface opencv-python

# Run in mock mode to test without camera:
python emotion_detector.py --mock
```

**"Robustness level" warning in browser console**

This is a Chrome EME (Encrypted Media Extensions) warning triggered internally by the Spotify Web Playback SDK. It is cosmetic only and does not affect playback. The `index.html` EME patch in this project suppresses it on supported browsers.

**Backend won't start — port already in use**

```powershell
# Windows: find and kill the process on port 3001
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

---

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'feat: add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

Please follow the existing code style — ES modules throughout, no default exports from service files, hooks return plain objects (not arrays).

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

<div align="center">

Built with ❤️ as part of the ARAEA AIoT research project · Stage 3

</div>
