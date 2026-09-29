/**
 * App.jsx — ARAEA Stage 3
 *
 * Root component.  Responsibilities:
 *   1. Auth gate (checking → logged_out → logged_in)
 *   2. Compose feature hooks (emotion, audio pipeline, spotify, playback, backend)
 *   3. Page routing (no business logic — just a switch of page components)
 *
 * Business logic lives in:
 *   hooks/useSpotify.js        — Spotify SDK + playback controls
 *   hooks/useBackendSync.js    — Socket.IO + server state
 *   hooks/useAudioEngine.js    — Web Audio FFT analysis
 *   hooks/useEmotionEngine.js  — Multi-source emotion detection
 *   hooks/useAudioPipeline.js  — Emotion → Spotify search → autoplay
 *   hooks/usePlayback.js       — Lyrics, sleep timer, recommendations, search
 */
import React, { useState, useEffect, useRef, useCallback } from "react";

// Theme
import { useTheme }  from "./theme.jsx";

// Hooks
import { useAudioEngine }    from "./hooks/useAudioEngine.js";
import { useEmotionEngine }  from "./hooks/useEmotionEngine.js";
import { useAudioPipeline }  from "./hooks/useAudioPipeline.js";
import { useSpotify }        from "./hooks/useSpotify.js";
import { useBackendSync }    from "./hooks/useBackendSync.js";
import { usePlayback }       from "./hooks/usePlayback.js";

// Services
import { auth as authAPI, emotion as emotionAPI, scenes as scenesAPI } from "./services/backendAPI.js";

// Constants / utils
import { SCENES, NAV }        from "./constants/index.js";
import { lsGet, lsSet }       from "./utils/storage.js";

// Layout
import Header      from "./components/layout/Header.jsx";
import IconSidebar from "./components/layout/IconSidebar.jsx";
import Footer      from "./components/layout/Footer.jsx";

// Pages
import EmotionFlowDashboard from "./components/EmotionFlowDashboard.jsx";
import { VisualizerPage, SensorsPage, HistoryPage, SettingsPage } from "./components/Pages.jsx";
import { PageErrorBoundary } from "./components/ui/index.jsx";

// Page components are lazy-loaded to keep the initial bundle small.
// React.Suspense (in the page area) handles the loading fallback.
const BiometricPanel    = React.lazy(() => import("./components/BiometricPanel.jsx"));
const VoiceGesturePanel = React.lazy(() => import("./components/VoiceGesturePanel.jsx"));
const TherapyMode       = React.lazy(() => import("./components/TherapyMode.jsx"));
const CommunityHub      = React.lazy(() => import("./components/CommunityHub.jsx"));
const MultiSensory      = React.lazy(() => import("./components/MultiSensory.jsx"));
const AIInsights        = React.lazy(() => import("./components/AIInsights.jsx"));
const ThemeCustomizer   = React.lazy(() => import("./components/ThemeCustomizer.jsx"));
const LoginPage         = React.lazy(() => import("./components/LoginPage.jsx"));

// ── Loading screen ─────────────────────────────────────────
function LoadingScreen() {
  return (
    <div style={{ width:"100vw", height:"100vh", background:"#030408", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:14 }}>
      <div style={{ width:48, height:48, borderRadius:12, background:"linear-gradient(135deg,#1DB954,#1ed760)", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <span style={{ fontSize:11, fontWeight:900, color:"#fff", fontFamily:"monospace", letterSpacing:1, lineHeight:1 }}>ARAEA</span>
      </div>
      <div style={{ width:28, height:28, border:"2px solid rgba(255,255,255,.1)", borderTopColor:"#1DB954", borderRadius:"50%", animation:"spin 1s linear infinite" }} />
      <span style={{ fontSize:11, color:"rgba(255,255,255,.3)", fontFamily:"monospace", letterSpacing:1 }}>CONNECTING…</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
export default function App() {
  const { T, updateTheme } = useTheme();

  // ── Auth state ─────────────────────────────────────────
  const [authStatus, setAuthStatus] = useState("checking");
  const [token,      setToken]      = useState(null);

  // ── UI ─────────────────────────────────────────────────
  const [page,      setPage]     = useState("dashboard");
  const [toast,     setToast]    = useState(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiBlend,   setAiBlend]   = useState("screen");
  const [milkdrop,  setMilkdrop]  = useState(() => lsGet("araea_milkdrop","0") === "1");
  const [cameraOn,  setCameraOn]       = useState(false);
  const [autoPlay,   setAutoPlay]       = useState(false); // always off on fresh load
  const [volume,    setVolume]    = useState(() => Number(lsGet("araea_vol","70")));
  const aiOpacity = 0.62;

  // Stream is kept in BOTH a ref (for sync access in callbacks/captureFrame) and
  // state (so child components re-render when the stream becomes available).
  const videoStreamRef = useRef(null);
  const [videoStream, setVideoStream] = useState(null);
  const webcamVideoRef = useRef(null); // off-screen <video> driving emotion capture

  useEffect(() => { lsSet("araea_milkdrop", milkdrop ? "1" : "0"); }, [milkdrop]);
  useEffect(() => { lsSet("araea_autoplay", autoPlay ? "1" : "0"); }, [autoPlay]);

  // ── Toast helper ───────────────────────────────────────
  const showToast = useCallback((msg, ms = null) => {
    const dur = ms ?? ((msg.includes("error")||msg.includes("denied")) ? 4000 : msg.length > 40 ? 3200 : 2400);
    setToast(msg);
    setTimeout(() => setToast(t => t === msg ? null : t), dur);
  }, []);

  // ── Audio engine (FFT analysis, beat detection) ────────
  const liveRef = useRef({
    mood:"neutral", energy:0.5, bpm:120, beatFlash:0, kickFlash:0,
    scene:null, bass:0.3, mid:0.3, hi:0.2, centroid:0.3,
    onsetStrength:0, chroma:null, audioConnected:false, micMode:false,
    freqData:null, timeData:null,
  });
  const audioEngine = useAudioEngine(liveRef);
  const { connectSpotifyPlayer, connectMic } = audioEngine;

  // Beat-flash decay (canvas only — no React state)
  useEffect(() => {
    const id = setInterval(() => {
      liveRef.current.beatFlash = Math.max(0, (liveRef.current.beatFlash ?? 0) - 0.04);
      liveRef.current.kickFlash = Math.max(0, (liveRef.current.kickFlash ?? 0) - 0.05);
    }, 50);
    return () => clearInterval(id);
  }, []);

  // ── Backend Socket.IO sync ─────────────────────────────
  const { appState, appStateRef } = useBackendSync({
    liveRef,
    onTherapyComplete: d => {
      showToast(`✅ Session complete · -${d.stressReduction}% stress`);
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("ARAEA — Session Complete", { body: `Stress reduced by ${d.stressReduction}%.`, icon:"/favicon.svg" });
      }
    },
    onToast: showToast,
  });

  // ── Auth ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const onMsg = e => {
      if (e.data?.type === "spotify_token" && e.data.token && !cancelled) {
        setToken(e.data.token); setAuthStatus("logged_in");
      }
    };
    window.addEventListener("message", onMsg);

    const hashTok = new URLSearchParams(window.location.hash.slice(1)).get("spotify_token");
    if (hashTok) {
      window.history.replaceState(null, "", "/");
      setToken(hashTok); setAuthStatus("logged_in");
    } else {
      authAPI.getStatus()
        .then(async ({ data }) => {
          if (cancelled) return;
          if (data?.logged_in) {
            const { data: t } = await authAPI.getToken().catch(() => ({ data: {} }));
            if (!cancelled) {
              if (t?.access_token) { setToken(t.access_token); setAuthStatus("logged_in"); }
              else setAuthStatus("logged_out");
            }
          } else if (!cancelled) setAuthStatus("logged_out");
        })
        .catch(() => { if (!cancelled) setAuthStatus("error"); });
    }
    return () => { cancelled = true; window.removeEventListener("message", onMsg); };
  }, []);

  // ── Spotify SDK + playback controls ────────────────────
  const spotify = useSpotify({
    token,
    onTokenExpired: (newToken) => {
      if (newToken) setToken(newToken);
      else { setAuthStatus("logged_out"); setToken(null); }
    },
    connectSpotifyPlayer,
  });

  // Sync BPM beat pulse to liveRef for visualizer
  useEffect(() => {
    if (spotify.isPaused || !token) return;
    const bpm = liveRef.current.bpm ?? 120;
    const id  = setInterval(() => { liveRef.current.beatFlash = 0.92; }, (60 / bpm) * 1000);
    return () => clearInterval(id);
  }, [spotify.isPaused, token]);

  // ── Emotion engine (multi-source) ──────────────────────
  const emotionEngine = useEmotionEngine({
    videoRef:  webcamVideoRef,
    cameraOn,
  });

  // Sync emotion → liveRef so visualizer reacts to mood immediately
  useEffect(() => {
    if (emotionEngine.emotion) liveRef.current.mood = emotionEngine.emotion;
  }, [emotionEngine.emotion]);

  // Sync manual/text emotion changes → backend only (not webcam/socket to avoid loops)
  useEffect(() => {
    if (!emotionEngine.emotion) return;
    if (emotionEngine.source === "socket") return;
    if (emotionEngine.source === "webcam") return;
    emotionAPI.setManual(emotionEngine.emotion).catch(() => {});
  }, [emotionEngine.emotion, emotionEngine.source]);

  // Reconnect audio analyser whenever playback resumes (pipeline forces new audio element)
  useEffect(() => {
    if (!spotify.isPaused && spotify.playerRef.current) {
      setTimeout(() => connectSpotifyPlayer(spotify.playerRef.current), 400);
    }
  }, [spotify.isPaused, connectSpotifyPlayer, spotify.playerRef]);

  // ── Audio pipeline (emotion → track → autoplay) ────────
  // pipeline enabled only when: emotion detected AND autoPlay is on
  const pipelineEmotion = emotionEngine.emotion ?? null;
  const pipeline = useAudioPipeline({
    emotion:              pipelineEmotion,
    enabled:              !!pipelineEmotion && autoPlay,
    tokenRef:             spotify.tokenRef,
    deviceIdRef:          spotify.deviceIdRef,
    activeDeviceRef:      spotify.activeDeviceRef,
    playerRef:            spotify.playerRef,
    connectSpotifyPlayer,
    hasPremium:           spotify.hasPremium,
    deviceId:             spotify.deviceId,
    externalIsPaused:     spotify.isPaused,
    externalCurrentTrack: spotify.currentTrack,
  });

  // Toast on pipeline transitions
  const prevPipelineRef = useRef("idle");
  useEffect(() => {
    const s = pipeline.status;
    if (s === "playing"   && prevPipelineRef.current !== "playing") showToast(`▶ ${pipeline.selectedTrack?.name ?? "Playing"}`);
    if (s === "error"     && pipeline.errorMsg)                     showToast(`⚠ ${pipeline.errorMsg}`);
    if (s === "no_spotify")                                          showToast("Connect Spotify to enable audio");
    prevPipelineRef.current = s;
  }, [pipeline.status, pipeline.errorMsg, pipeline.selectedTrack, showToast]);

  // ── Playback extras (lyrics, sleep, search, recs) ──────
  const playback = usePlayback({
    tokenRef:     spotify.tokenRef,
    currentTrack: spotify.currentTrack,
    isPaused:     spotify.isPaused,
    onPause: async () => {
      await spotify.togglePlay();
      showToast("😴 Sleep timer — paused");
    },
  });

  // Sync recs into appState when emotion or scene changes
  // Guard: wait for SDK device to be ready before searching to avoid 400s
  useEffect(() => {
    if (!token || !spotify.deviceId) return;
    playback.fetchRecommendations(emotionEngine.emotion ?? "neutral", appState.activeScene);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, spotify.deviceId, emotionEngine.emotion, appState.activeScene]);

  // Keep appState recs in sync with usePlayback recs
  useEffect(() => {
    if (playback.recommendations.length) {
      appStateRef.current.recommendations = playback.recommendations;
    }
  }, [playback.recommendations, appStateRef]);

  // ── Scene handler ──────────────────────────────────────
  const setScene = useCallback(async (sc) => {
    await scenesAPI.set(sc);
    liveRef.current.scene = sc;
    showToast(sc ? `${SCENES[sc]?.emoji ?? ""} ${SCENES[sc]?.label} activated` : "Scene cleared");
  }, [showToast]);

  // ── Simulation handler ─────────────────────────────────
  const simulate = useCallback(async (action) => {
    const { sensors } = await import("./services/backendAPI.js");
    sensors.simulate(action).catch(() => {});
  }, []);

  // ── Auth handlers ──────────────────────────────────────
  const handleLogin = useCallback(async () => {
    const { data, error } = await authAPI.getLoginUrl();
    if (data?.url) window.open(data.url, "_blank", "width=480,height=680,left=200,top=100");
    else showToast(error ?? "Backend not reachable — run start.bat first");
  }, [showToast]);

  const handleLogout = useCallback(async () => {
    await authAPI.logout().catch(() => {});
    setToken(null); setAuthStatus("logged_out");
    spotify.playerRef.current?.disconnect();
  }, [spotify.playerRef]);

  // ── Mic / camera ───────────────────────────────────────
  const handleMic = useCallback(async () => {
    const ok = await connectMic();
    if (ok) { showToast("🎙 Microphone connected — live FFT active"); Notification.requestPermission?.().catch(() => {}); }
    else      showToast("Mic access denied — check browser permissions");
  }, [connectMic, showToast]);

  const handleCamera = useCallback(async () => {
    if (cameraOn) {
      videoStreamRef.current?.getTracks().forEach(t => t.stop());
      videoStreamRef.current = null;
      setVideoStream(null);
      if (webcamVideoRef.current) webcamVideoRef.current.srcObject = null;
      setCameraOn(false);
      setAutoPlay(false);
      showToast("Camera disabled");
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
          audio: false,
        });
        videoStreamRef.current = stream;
        setVideoStream(stream);
        if (webcamVideoRef.current) {
          webcamVideoRef.current.srcObject = stream;
          webcamVideoRef.current.play().catch(() => {});
        }
        setCameraOn(true);
        setAutoPlay(true);
        showToast("Camera enabled — emotion detection active");
      } catch (err) {
        const name = err?.name ?? "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          showToast("Camera permission denied — allow camera access in browser settings", 5000);
        } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
          showToast("No camera found — plug in a webcam and try again", 5000);
        } else if (name === "NotReadableError" || name === "TrackStartError") {
          showToast("Camera is in use by another app — close it and try again", 5000);
        } else {
          showToast(`Camera error: ${err?.message ?? "unknown"}`, 5000);
        }
      }
    }
  }, [cameraOn, showToast]);

  const handleVolumeChange = useCallback(async (v) => {
    setVolume(v);
    lsSet("araea_vol", v);
    await spotify.setVolume(v);
  }, [spotify]);

  // Debug mood injection (dev only)
  const injectMood = useCallback(async (mood) => {
  try { await fetch(`${import.meta.env.VITE_API_URL || "http://127.0.0.1:3001"}/api/debug/mood?mood=${mood}`); } catch {}
    showToast(`Test: ${mood}`);
  }, [showToast]);

  // ── Derived values ─────────────────────────────────────
  const isLoggedIn = authStatus === "logged_in";
  const micMode    = liveRef.current?.micMode ?? false;
  const pageName   = NAV.find(n => n.id === page)?.label ?? "Dashboard";
  const PAGE_PROPS = { state: appState, T };

  // ── Conditional renders (always after ALL hooks) ───────
  if (authStatus === "logged_out" || authStatus === "error") {
    return <LoginPage onLogin={handleLogin} authStatus={authStatus} />;
  }
  if (authStatus === "checking") return <LoadingScreen />;

  // ── Main render ────────────────────────────────────────
  return (
    <div style={{ width:"100vw", height:"100vh", display:"flex", background:T.bg, color:T.text, overflow:"hidden" }}>
      <IconSidebar
        page={page} setPage={setPage}
        therapyActive={appState.therapy?.active}
        micMode={micMode} cameraOn={cameraOn}
        onMic={handleMic} onCamera={handleCamera}
      />

      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0 }}>
        <Header
          appState={appState} authStatus={authStatus}
          isLoggedIn={isLoggedIn} playerReady={spotify.playerReady}
          onLogin={handleLogin} onLogout={handleLogout}
          micMode={micMode} pageName={pageName}
          aiEnabled={aiEnabled} aiBlend={aiBlend}
          setAiBlend={setAiBlend} setAiEnabled={setAiEnabled}
          milkdrop={milkdrop} setMilkdrop={setMilkdrop}
          pipelineStatus={pipeline.status}
        />

        <div style={{ flex:1, overflow:"hidden", position:"relative", minHeight:0 }}>
          {/* Toast */}
          {toast && (
            <div style={{ position:"absolute", bottom:16, left:"50%", transform:"translateX(-50%)", background:T.bright, color:"#fff", padding:"8px 18px", borderRadius:9, fontSize:11, fontWeight:600, zIndex:9999, boxShadow:T.shMd, whiteSpace:"nowrap", animation:"fadeUp .2s ease", pointerEvents:"none" }}>
              {toast}
            </div>
          )}

          {/* ── Emotion → Audio → Visualizer dashboard ── */}
          {page === "dashboard" && (
            <EmotionFlowDashboard
              emotionEngine={emotionEngine}
              pipeline={pipeline}
              isPaused={spotify.isPaused}
              currentTrack={spotify.currentTrack}
              playbackPos={spotify.playbackPos}
              volume={volume}
              onVolumeChange={handleVolumeChange}
              onTogglePlay={spotify.togglePlay}
              onSkipNext={spotify.skipNext}
              onSkipPrev={spotify.skipPrev}
              onSeek={spotify.seek}
              onShuffle={() => spotify.setShuffle(!spotify.shuffleOn)}
              onRepeat={spotify.setRepeat}
              shuffleOn={spotify.shuffleOn}
              repeatMode={spotify.repeatMode}
              onClaimPlayback={spotify.claimPlayback}
              hasPremium={spotify.hasPremium}
              lyrics={playback.lyrics}
              showLyrics={playback.showLyrics}
              setShowLyrics={playback.setShowLyrics}
              lyricsLoading={playback.lyricsLoading}
              sleepMins={playback.sleepMins}
              sleepSecs={playback.sleepSecs}
              onSleepTimer={playback.startSleepTimer}
              onCancelSleep={playback.cancelSleepTimer}
              searchQuery={playback.searchQuery}
              searchResults={playback.searchResults}
              isSearching={playback.isSearching}
              onSearchInput={playback.handleSearchInput}
              onClearSearch={playback.clearSearch}
              liveRef={liveRef}
              audioEngine={audioEngine}
              milkdrop={milkdrop}
              aiEnabled={aiEnabled}
              aiBlend={aiBlend}
              aiOpacity={aiOpacity}
              state={appState}
              cameraOn={cameraOn}
              videoStream={videoStream}
              autoPlay={autoPlay}
              onToggleAutoPlay={() => setAutoPlay(v => !v)}
            />
          )}

          {/* ── Other pages ── */}
          <React.Suspense fallback={
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", color:"rgba(255,255,255,.3)", fontSize:11, fontFamily:"monospace", letterSpacing:2 }}>
              LOADING…
            </div>
          }>
          {page === "visualizer"   && <VisualizerPage liveRef={liveRef} state={appState} aiEnabled={aiEnabled} aiBlend={aiBlend} aiOpacity={aiOpacity} milkdrop={milkdrop} audioEngine={audioEngine} pipelineStatus={pipeline.status} isPaused={spotify.isPaused} />}
          {page === "biometrics"   && <BiometricPanel {...PAGE_PROPS} bio={appState.biometric} onRequestSim={() => showToast("Biometric simulation running")} />}
          {page === "therapy"      && <PageErrorBoundary key="therapy"><TherapyMode {...PAGE_PROPS} therapy={appState.therapy} bio={appState.biometric} onToast={showToast} /></PageErrorBoundary>}
          {page === "voice"        && <VoiceGesturePanel {...PAGE_PROPS} cameraOn={cameraOn} videoStream={videoStreamRef.current} onToast={showToast} />}
          {page === "multisensory" && <MultiSensory {...PAGE_PROPS} ms={appState.multisensory} onToast={showToast} />}
          {page === "community"    && <CommunityHub {...PAGE_PROPS} currentState={appState} onToast={showToast} />}
          {page === "insights"     && <AIInsights {...PAGE_PROPS} appState={appState} bio={appState.biometric} />}
          {page === "sensors"      && <SensorsPage state={appState} onSimulate={simulate} />}
          {page === "history"      && <HistoryPage />}
          {page === "settings"     && <SettingsPage authStatus={authStatus} onLogin={handleLogin} onLogout={handleLogout} token={token} />}
          {page === "theme"        && <ThemeCustomizer T={T} onThemeChange={updateTheme} />}

          </React.Suspense>
        </div>

        <Footer
          appState={{ ...appState, pipelineStatus: pipeline.status }}
          isLoggedIn={isLoggedIn} playerReady={spotify.playerReady}
          micMode={micMode} onInjectMood={injectMood}
        />
      </div>

      {/* Off-screen <video> that feeds captureFrame(). display:none can leave
          videoWidth=0 in some browsers (Firefox), which breaks emotion capture.
          A 1×1 transparent element keeps the decoder running and reports real
          intrinsic dimensions. The visible preview lives in the dashboard. */}
      <video
        ref={webcamVideoRef}
        muted
        playsInline
        autoPlay
        style={{
          position:    "fixed",
          left:        "-9999px",
          top:         0,
          width:       320,
          height:      240,
          pointerEvents: "none",
          zIndex:      -1,
        }}
      />
    </div>
  );
}
