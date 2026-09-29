# ARAEA Stage 3 — Architecture Reference

## Overview

ARAEA follows a clean layered architecture.
Each layer has a single responsibility and a well-defined interface to adjacent layers.

```
┌─────────────────────────────────────────────────────────┐
│  Frontend                                               │
│                                                         │
│  App.jsx ─── compose hooks + page routing               │
│      │                                                  │
│      ├── hooks/                                         │
│      │     useSpotify       Spotify SDK + REST controls │
│      │     useBackendSync   Socket.IO + app state       │
│      │     useAudioEngine   Web Audio FFT analysis      │
│      │     useEmotionEngine Multi-source emotion detect │
│      │     useAudioPipeline Emotion→audio state machine │
│      │     usePlayback      Lyrics, sleep, search, recs │
│      │                                                  │
│      ├── services/           All HTTP calls (no fetch() │
│      │     backendAPI.js     in components/hooks)       │
│      │     spotifyAPI.js                                │
│      │     lyricsAPI.js                                 │
│      │                                                  │
│      ├── components/                                    │
│      │     ui/              Reusable design primitives  │
│      │     layout/          Header, Sidebar, Footer     │
│      │     visualizer/      VisualCanvas, Butterchurn   │
│      │     player/          NowPlaying, TrackList,      │
│      │                      SearchBar                   │
│      │     pages/           Full-page feature views     │
│      │                                                  │
│      ├── constants/         Static data (emotions,      │
│      │                      scenes, navigation)         │
│      │                                                  │
│      └── utils/             Pure functions (storage,    │
│                              time, math)                │
│                                                         │
└─────────────────────────────────────────────────────────┘
              │
              │ Socket.IO + REST
              │
┌─────────────────────────────────────────────────────────┐
│  Backend (Node.js / Express)                            │
│                                                         │
│  server.js ─── mount routes + bootstrap (144 lines)    │
│      │                                                  │
│      ├── config/             All env vars (one place)   │
│      │                                                  │
│      ├── middleware/                                     │
│      │     validate.js      Input sanitization helpers  │
│      │     errors.js        Global error handler        │
│      │                                                  │
│      ├── services/           Business logic             │
│      │     StateService      Single source of truth     │
│      │     DatabaseService   Mongo + in-memory fallback │
│      │     PipelineService   Mood fusion algorithm      │
│      │     TherapyService    Session state machine      │
│      │     SimulationService Sensor + biometric sim     │
│      │                                                  │
│      ├── routes/             Thin HTTP handlers         │
│      │     auth              /auth/*                    │
│      │     sensors           /api/sensors, /simulation  │
│      │     emotion           /api/emotion/*             │
│      │     spotify           /api/spotify/*, /api/search│
│      │     therapy           /api/therapy/*             │
│      │     biometric         /api/biometric/*           │
│      │     multisensory      /api/multisensory/*        │
│      │     voice             /api/voice                 │
│      │     gesture           /api/gesture               │
│      │     community         /api/community/*           │
│      │     insights          /api/insights, /api/scene  │
│      │     debug             /api/debug/* (dev only)    │
│      │                                                  │
│      └── data/               Static seed data           │
│            communityProfiles.js                         │
│            therapyPrograms.js                           │
│            activityPresets.js                           │
│            presentationData.js                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Rules

1. **Components never call `fetch()` directly.**
   All HTTP goes through `services/backendAPI.js` or `services/spotifyAPI.js`.

2. **Business logic lives in hooks, not components.**
   Components receive data and callbacks as props/context.

3. **State is never duplicated.**
   Backend state comes through `useBackendSync` (Socket.IO).
   Spotify state comes through `useSpotify`.
   They do not overlap.

4. **All env vars live in `backend/config/index.js`.**
   No `process.env` access outside that file.

5. **Routes are thin.**
   A route handler validates input, calls a service, returns a response.
   No business logic in routes.

6. **Services are stateless where possible.**
   `StateService` is the one deliberate exception — it owns the live app state.

## Adding a New Feature

### New API endpoint
1. Add data to `backend/data/` if static
2. Add business logic to `backend/services/`
3. Add route to `backend/routes/newFeature.js`
4. Mount route in `backend/server.js`
5. Add typed call to `frontend/src/services/backendAPI.js`

### New UI feature
1. Add hook in `frontend/src/hooks/`
2. Add reusable component in `frontend/src/components/ui/` or a domain folder
3. Wire up in the relevant page component
4. If it needs a new page, add to `NAV` in `constants/navigation.js` and add a page case in `App.jsx`

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| `StateService` singleton on backend | All Socket.IO emits in one place; `_moodCandidate` never leaks |
| `useBackendSync` reads only | Frontend state is server-authoritative; no dual writes |
| `useSpotify` wraps all SDK logic | Spotify DRM quirks (AudioContext, device transfer) isolated |
| `useAudioPipeline` state machine | Prevents race conditions in emotion→search→play flow |
| Module-level buffers in VisualCanvas | Zero GC pressure in RAF hot path at 60fps |
| Performance tier detection at import | Device capability evaluated once, not per-frame |
