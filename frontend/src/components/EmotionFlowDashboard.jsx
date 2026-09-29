/**
 * EmotionFlowDashboard
 *
 * The main ARAEA dashboard implementing the strict:
 *   Emotion Detection → Audio Playback → Audio-Reactive Visualizer
 * flow.
 *
 * Layout (3-column):
 *   LEFT  (280px) — Emotion detection controls
 *   CENTER (flex)  — Gated visualizer + pipeline overlay
 *   RIGHT (270px)  — Now Playing + track recommendations
 */
import React, { useState, useEffect } from "react";
import { useTheme }    from "../theme.jsx";
import { useBreakpoint } from "../hooks/useBreakpoint.js";
import { useDashboardConfig } from "../hooks/useDashboardConfig.js";
import { MOODS }       from "../constants/index.js";
import { SyncedVisualizer }  from "./visualizer/SyncedVisualizer.jsx";
import { NowPlaying }        from "./player/NowPlaying.jsx";
import { TrackList }         from "./player/TrackList.jsx";
import { SearchBar }         from "./player/SearchBar.jsx";
import DashboardConfigMenu   from "./DashboardConfigMenu.jsx";

// ── Status config ─────────────────────────────────────────
const PIPELINE_STATUS = {
  idle:       { label: "Detect your emotion to begin",    color: "#64748b", pulse: false },
  searching:  { label: "Finding music for your mood…",    color: "#f59e0b", pulse: true  },
  selected:   { label: "Track selected — preparing…",     color: "#3b82f6", pulse: true  },
  initiating: { label: "Loading audio…",                  color: "#6366f1", pulse: true  },
  playing:    { label: "Playing",                         color: "#10b981", pulse: false },
  paused:     { label: "Paused",                          color: "#94a3b8", pulse: false },
  error:      { label: "Playback issue",                  color: "#ef4444", pulse: false },
  no_spotify: { label: "Connect Spotify to enable audio", color: "#f59e0b", pulse: false },
};

// ── Confidence ring ───────────────────────────────────────
function ConfidenceRing({ confidence = 0, color = "#8b5cf6", size = 44 }) {
  const r   = (size - 4) / 2;
  const c   = size / 2;
  const circ = 2 * Math.PI * r;
  const off  = circ * (1 - Math.max(0, Math.min(1, confidence)));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position:"absolute", top:0, left:0 }}>
      <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth="2.5" opacity="0.15" />
      <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth="2.5"
        strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
        transform={`rotate(-90 ${c} ${c})`} style={{ transition: "stroke-dashoffset .6s ease" }} />
    </svg>
  );
}

// ── Loading waveform ──────────────────────────────────────
function LoadingWave({ color = "#3b82f6" }) {
  const heights = [0.3, 0.6, 1, 0.8, 0.5, 0.9, 0.4, 0.7, 1, 0.6, 0.3, 0.8];
  return (
    <div style={{ display:"flex", gap:3, alignItems:"center", height:32 }}>
      {heights.map((h, i) => (
        <div key={i} style={{
          width: 4, borderRadius: 2, background: color,
          animation: `wvBar .9s ease-in-out ${i * .07}s infinite alternate`,
          height: `${h * 100}%`, opacity: 0.8,
        }} />
      ))}
      <style>{`@keyframes wvBar{from{transform:scaleY(.3);opacity:.4}to{transform:scaleY(1);opacity:1}}`}</style>
    </div>
  );
}

// ── Pipeline center overlay ───────────────────────────────
function PipelineOverlay({ status, pipeline, emotionObj }) {
  const { T } = useTheme();
  const cfg   = PIPELINE_STATUS[status] ?? PIPELINE_STATUS.idle;

  if (status === "playing") return null;

  const isSearching  = ["searching","initiating","selected"].includes(status);
  const isError      = ["error","no_spotify"].includes(status);
  const isIdle       = status === "idle";

  return (
    <div style={{
      position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)",
      zIndex: 10, pointerEvents: "none",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
    }}>
      <div style={{
        padding: "4px 14px", borderRadius: 20,
        background: "rgba(0,0,0,.6)", backdropFilter: "blur(8px)",
        border: `1px solid ${isError ? "rgba(239,68,68,.3)" : isSearching ? "rgba(245,158,11,.3)" : "rgba(255,255,255,.1)"}`,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        {isSearching && (
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.color, animation: "pulseDot 1s infinite" }} />
        )}
        <span style={{
          fontSize: 9, fontFamily: "monospace", letterSpacing: .5,
          color: isError ? "#ef4444" : isSearching ? cfg.color : "rgba(255,255,255,.35)",
        }}>
          {isError     ? (pipeline.errorMsg ?? cfg.label) :
           isSearching ? cfg.label :
           isIdle && !emotionObj ? "Select an emotion or enable camera" :
           isIdle ? "Searching for music…" :
           status === "paused" ? "Paused" : cfg.label}
        </span>
        {isError && (
          <button
            onClick={pipeline.retry}
            style={{ fontSize: 8, color: "#ef4444", background: "transparent", border: "none", cursor: "pointer", pointerEvents: "auto", padding: "0 4px" }}
          >↺</button>
        )}
      </div>
      <style>{"@keyframes pulseDot{0%,100%{opacity:1}50%{opacity:.3}}"}</style>
    </div>
  );
}


// ── Mobile layout: tab-based single column ───────────────
function MobileLayout({ emotionEngine, pipeline, em, liveRef, audioEngine, milkdrop, aiEnabled, aiBlend, aiOpacity, state, currentTrack, playbackPos, isPaused, volume, onVolumeChange, onTogglePlay, onSkipNext, onSkipPrev, onSeek, onShuffle, onRepeat, shuffleOn, repeatMode, onClaimPlayback, hasPremium, lyrics, showLyrics, setShowLyrics, lyricsLoading, sleepMins, sleepSecs, onSleepTimer, onCancelSleep, searchQuery, searchResults, isSearching, onSearchInput, onClearSearch }) {
  const { T } = useTheme();
  const [tab, setTab] = useState("visualizer");
  const emotionObj = emotionEngine.emotion
    ? { emotion: emotionEngine.emotion, confidence: emotionEngine.confidence, source: emotionEngine.source }
    : null;

  const TABS = [["emotion","🧠"],["visualizer","◎"],["player","▶"]];

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      {/* Tab bar */}
      <div style={{ display:"flex", borderBottom:`1px solid ${T.border}`, flexShrink:0, background:T.bg2 }}>
        {TABS.map(([id, icon]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex:1, padding:"10px 4px", background:"none", border:"none",
            borderBottom:`2px solid ${tab===id?T.acc:"transparent"}`,
            color:tab===id?T.acc:T.muted, fontSize:12, cursor:"pointer",
          }}>
            {icon} <span style={{fontSize:9, marginLeft:3, letterSpacing:.5, textTransform:"uppercase"}}>{id}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex:1, overflow:"hidden", position:"relative" }}>
        {tab === "visualizer" && (
          <>
            <SyncedVisualizer pipelineStatus={pipeline.status} liveRef={liveRef} audioEngine={audioEngine}
              mood={emotionEngine.emotion ?? "neutral"} scene={state?.activeScene ?? null}
              milkdrop={milkdrop} aiEnabled={aiEnabled} aiBlend={aiBlend} aiOpacity={aiOpacity}
              isExternallyPlaying={!isPaused} />
            <PipelineOverlay status={pipeline.status} pipeline={pipeline} emotionObj={emotionObj} />
          </>
        )}
        {tab === "emotion" && (
          <div style={{ overflowY:"auto", height:"100%", padding:14, display:"flex", flexDirection:"column", gap:10 }}>
            {em ? (
              <div style={{ padding:"12px 14px", borderRadius:12, background:`${em.col}10`, border:`1px solid ${em.col}25`, display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ fontSize:28 }}>{em.emoji}</div>
                <div>
                  <div style={{ fontSize:15, fontWeight:800, color:em.col }}>{em.label}</div>
                  <div style={{ fontSize:10, color:T.dim, marginTop:2 }}>{emotionEngine.source} · {Math.round((emotionEngine.confidence??0)*100)}%</div>
                </div>
                <button onClick={emotionEngine.clearEmotion} style={{ marginLeft:"auto", background:"none", border:"none", color:T.dim, fontSize:16, cursor:"pointer" }}>✕</button>
              </div>
            ) : (
              <div style={{ padding:12, borderRadius:10, background:T.bg3, border:`1px solid ${T.border}`, textAlign:"center", color:T.dim, fontSize:11 }}>No emotion detected</div>
            )}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6 }}>
              {Object.entries(MOODS).map(([key, cfg]) => (
                <button key={key} onClick={() => emotionEngine.setManualEmotion(emotionEngine.emotion===key&&emotionEngine.source==="manual"?null:key)}
                  style={{ padding:"10px 4px", borderRadius:10, cursor:"pointer", textAlign:"center", border:`1px solid ${emotionEngine.emotion===key?cfg.col+"44":T.border}`, background:emotionEngine.emotion===key?`${cfg.col}12`:T.bg3 }}>
                  <div style={{ fontSize:18, marginBottom:2 }}>{cfg.emoji}</div>
                  <div style={{ fontSize:8, fontWeight:600, color:emotionEngine.emotion===key?cfg.col:T.dim, textTransform:"uppercase" }}>{key}</div>
                </button>
              ))}
            </div>
            <input value={emotionEngine.lastTextInput} onChange={e => emotionEngine.setTextInput(e.target.value)}
              placeholder="How do you feel?…"
              style={{ padding:"10px 12px", borderRadius:9, border:`1px solid ${T.border}`, background:T.bg3, color:T.text, fontSize:12, outline:"none", fontFamily:"inherit" }} />
          </div>
        )}
        {tab === "player" && (
          <div style={{ overflowY:"auto", height:"100%", padding:12, display:"flex", flexDirection:"column", gap:10 }}>
            <NowPlaying track={currentTrack} playbackPos={playbackPos} isPaused={isPaused}
              volume={volume} shuffleOn={shuffleOn} repeatMode={repeatMode} hasPremium={hasPremium}
              sleepMins={sleepMins} sleepSecs={sleepSecs} lyrics={lyrics} showLyrics={showLyrics}
              lyricsLoading={lyricsLoading} moodColor={em?.col}
              onTogglePlay={onTogglePlay} onSkipNext={onSkipNext} onSkipPrev={onSkipPrev}
              onSeek={onSeek} onVolumeChange={onVolumeChange} onShuffle={onShuffle} onRepeat={onRepeat}
              onShowLyrics={() => setShowLyrics(v => !v)} onSleepTimer={onSleepTimer}
              onCancelSleep={onCancelSleep} onClaimPlayback={onClaimPlayback} />
            {pipeline.candidates.length > 0 && (
              <TrackList tracks={pipeline.candidates} currentId={currentTrack?.id} moodColor={em?.col}
                hasPremium={hasPremium} emptyLabel="Detect an emotion first"
                onSelect={tr => pipeline.playTrackManual(tr.uri, tr)} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Camera preview ──────────────────────────────────────
// Small live <video> that mirrors the same MediaStream the off-screen capture
// element uses. Rendered inside the webcam status card so the user can see
// their own face being analyzed.
function CameraPreview({ stream, T, mood, webcamDetecting, webcamError, webcamEmotion }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!ref.current) return;
    ref.current.srcObject = stream ?? null;
    if (stream) ref.current.play().catch(() => {});
  }, [stream]);

  const noFace = webcamError === "no_face";
  const detecting = webcamDetecting;

  return (
    <div style={{
      position: "relative",
      marginTop: 8,
      borderRadius: 8,
      overflow: "hidden",
      background: "#000",
      border: `1px solid ${mood?.col ? mood.col + "33" : T.border}`,
      aspectRatio: "4 / 3",
      width: "100%",
    }}>
      <video
        ref={ref}
        muted
        playsInline
        autoPlay
        style={{
          width: "100%", height: "100%",
          objectFit: "cover",
          transform: "scaleX(-1)",
          display: "block",
        }}
      />
      {/* Face guide oval */}
      <svg viewBox="0 0 100 100" style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none" }}>
        <ellipse
          cx="50" cy="48" rx="22" ry="28"
          fill="none"
          stroke={detecting ? "#f59e0b" : noFace ? "rgba(255,255,255,0.3)" : mood?.col ?? "#10b981"}
          strokeWidth="1.2"
          strokeDasharray={noFace ? "3 3" : "none"}
          style={{ transition: "stroke 0.4s ease" }}
        />
      </svg>
      <div style={{
        position:"absolute", top:6, left:6,
        padding:"2px 6px", borderRadius:4,
        background:"rgba(239,68,68,.85)", color:"#fff",
        fontSize:7, fontWeight:800, letterSpacing:.6, fontFamily:"monospace",
      }}>● LIVE</div>
      {detecting && (
        <div style={{ position:"absolute", bottom:6, left:"50%", transform:"translateX(-50%)", padding:"2px 8px", borderRadius:4, background:"rgba(0,0,0,.6)", backdropFilter:"blur(4px)", fontSize:8, color:"#f59e0b", fontWeight:700, letterSpacing:.4, whiteSpace:"nowrap" }}>
          ANALYZING…
        </div>
      )}
      {webcamEmotion && !detecting && (
        <div style={{ position:"absolute", bottom:6, left:"50%", transform:"translateX(-50%)", padding:"2px 8px", borderRadius:4, background:"rgba(0,0,0,.6)", backdropFilter:"blur(4px)", fontSize:8, color:mood?.col ?? "#10b981", fontWeight:700, letterSpacing:.4, whiteSpace:"nowrap" }}>
          {webcamEmotion.toUpperCase()}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
export default function EmotionFlowDashboard({
  // Emotion engine
  emotionEngine,
  // Audio pipeline
  pipeline,
  // Spotify playback (from useSpotify)
  isPaused, currentTrack, playbackPos,
  volume, onVolumeChange,
  onTogglePlay, onSkipNext, onSkipPrev, onSeek,
  onShuffle, onRepeat, shuffleOn, repeatMode,
  onClaimPlayback, hasPremium,
  // Playback extras (from usePlayback)
  lyrics, showLyrics, setShowLyrics, lyricsLoading,
  sleepMins, sleepSecs, onSleepTimer, onCancelSleep,
  searchQuery, searchResults, isSearching,
  onSearchInput, onClearSearch,
  // Visualizer
  liveRef, audioEngine, milkdrop, aiEnabled, aiBlend, aiOpacity,
  // App state
  state,
  // Webcam preview
  cameraOn, videoStream,
  // AutoPlay toggle
  autoPlay, onToggleAutoPlay,
}) {
  const { T }   = useTheme();
  const bp      = useBreakpoint(); // "mobile" | "tablet" | "desktop"
  const em      = MOODS[emotionEngine.emotion];
  const [rightTab, setRightTab] = useState("player"); // "player" | "search" | "queue"

  // Layout customization (presets + per-panel toggles, persisted in localStorage)
  const { config: panel, preset, setPanel, applyPreset } = useDashboardConfig();
  const [configOpen, setConfigOpen] = useState(false);

  // If the current right-tab is now hidden by the layout config, fall back to
  // "player" (which is always visible) — otherwise the right column would be
  // blank.
  useEffect(() => {
    if (rightTab === "search" && !panel.searchTab) setRightTab("player");
    if (rightTab === "queue"  && !panel.queueTab)  setRightTab("player");
  }, [rightTab, panel.searchTab, panel.queueTab]);

  const emotionObj = emotionEngine.emotion
    ? { emotion: emotionEngine.emotion, confidence: emotionEngine.confidence, source: emotionEngine.source }
    : null;

  return (
    <>
    {/* Mobile: tabbed single-column. Tablet: emotion+player sidebar. Desktop: full 3-col. */}
    {bp === "mobile" && (
      <MobileLayout
        emotionEngine={emotionEngine} pipeline={pipeline} em={em} state={state}
        isPaused={isPaused} currentTrack={currentTrack} playbackPos={playbackPos}
        volume={volume} onVolumeChange={onVolumeChange} onTogglePlay={onTogglePlay}
        onSkipNext={onSkipNext} onSkipPrev={onSkipPrev} onSeek={onSeek}
        onShuffle={onShuffle} onRepeat={onRepeat} shuffleOn={shuffleOn} repeatMode={repeatMode}
        onClaimPlayback={onClaimPlayback} hasPremium={hasPremium}
        lyrics={lyrics} showLyrics={showLyrics} setShowLyrics={setShowLyrics}
        lyricsLoading={lyricsLoading} sleepMins={sleepMins} sleepSecs={sleepSecs}
        onSleepTimer={onSleepTimer} onCancelSleep={onCancelSleep}
        searchQuery={searchQuery} searchResults={searchResults}
        isSearching={isSearching} onSearchInput={onSearchInput} onClearSearch={onClearSearch}
        liveRef={liveRef} audioEngine={audioEngine} milkdrop={milkdrop}
        aiEnabled={aiEnabled} aiBlend={aiBlend} aiOpacity={aiOpacity}
      />
    )}
    {bp !== "mobile" && (
    <div className="dashboard-grid" style={{
      display: "grid",
      gridTemplateColumns: bp === "tablet" ? "240px 1fr 240px" : "280px 1fr 270px",
      height: "100%", overflow: "hidden",
      position: "relative",
    }}>

      {/* Floating layout-config gear (top-right of the dashboard) */}
      <button
        onClick={() => setConfigOpen(o => !o)}
        title="Customize dashboard layout"
        style={{
          position:    "absolute",
          top:         8,
          right:       10,
          zIndex:      60,
          width:       32,
          height:      32,
          borderRadius: 8,
          background:  configOpen ? `${T.acc}22` : "rgba(0,0,0,.35)",
          border:      `1px solid ${configOpen ? T.acc + "55" : "rgba(255,255,255,.12)"}`,
          color:       configOpen ? T.acc : "rgba(255,255,255,.65)",
          cursor:      "pointer",
          fontSize:    14,
          display:     "flex",
          alignItems:  "center",
          justifyContent: "center",
          backdropFilter: "blur(6px)",
          transition:  "all .15s",
        }}
        aria-label="Dashboard layout settings"
      >
        ⚙
      </button>

      {configOpen && (
        <DashboardConfigMenu
          config={panel}
          preset={preset}
          setPanel={setPanel}
          applyPreset={applyPreset}
          onClose={() => setConfigOpen(false)}
        />
      )}

      {/* ════ LEFT: EMOTION DETECTION ════ */}
      <div style={{ background:T.bg2, borderRight:`1px solid ${T.border}`, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ padding:"10px 14px 7px", borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
          <span style={{ fontSize:10, fontWeight:600, color:T.muted, letterSpacing:1, fontFamily:"monospace", textTransform:"uppercase" }}>Emotion Detection</span>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:"10px 12px", display:"flex", flexDirection:"column", gap:10 }}>

          {/* Camera preview — pinned at top when camera is on */}
          {cameraOn && videoStream && (
            <div style={{ flexShrink:0 }}>
              <div style={{ fontSize:9, color:T.muted, letterSpacing:1, textTransform:"uppercase", fontFamily:"monospace", marginBottom:5 }}>Live Camera</div>
              <CameraPreview stream={videoStream} T={T} mood={em}
                webcamDetecting={emotionEngine.webcamDetecting}
                webcamError={emotionEngine.webcamError}
                webcamEmotion={emotionEngine.webcamEmotion} />

              {/* Detected emotion — shown directly below camera */}
              {em ? (
                <div style={{ marginTop:8, padding:"9px 11px", borderRadius:10, background:`${em.col}0e`, border:`1px solid ${em.col}22`, display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ position:"relative", width:36, height:36, flexShrink:0 }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:em.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>{em.emoji}</div>
                    <ConfidenceRing confidence={emotionEngine.confidence} color={em.col} size={36} />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:em.col, fontFamily:"'Outfit',sans-serif" }}>{em.label}</div>
                    <div style={{ fontSize:10, color:T.muted, marginTop:2 }}>
                      <span style={{ padding:"2px 6px", borderRadius:4, background:`${em.col}22`, color:em.col, fontSize:10, fontWeight:600, fontFamily:"'Outfit',sans-serif" }}>{emotionEngine.source}</span>
                      <span style={{ marginLeft:5, fontWeight:500, fontFamily:"'JetBrains Mono',monospace", fontSize:10 }}>{Math.round((emotionEngine.confidence ?? 0) * 100)}%</span>
                    </div>
                  </div>
                  <button onClick={emotionEngine.clearEmotion} style={{ background:"none", border:"none", color:T.muted, fontSize:16, cursor:"pointer", flexShrink:0, lineHeight:1 }}>✕</button>
                </div>
              ) : (
                <div style={{ marginTop:8, padding:"8px 11px", borderRadius:9, background:T.bg3, border:`1px solid ${T.border}`, display:"flex", alignItems:"center", gap:7 }}>
                  {emotionEngine.webcamDetecting ? (
                    <>
                      <div style={{ width:7, height:7, borderRadius:"50%", background:"#f59e0b", animation:"pulse 1s infinite", flexShrink:0 }} />
                      <span style={{ fontSize:11, color:T.text, fontWeight:500, fontFamily:"'Outfit',sans-serif" }}>Scanning face…</span>
                    </>
                  ) : (
                    <>
                      <div style={{ width:7, height:7, borderRadius:"50%", background:T.border, flexShrink:0 }} />
                      <span style={{ fontSize:11, color:T.muted, fontFamily:"'Outfit',sans-serif", fontWeight:400 }}>Waiting for detection…</span>
                    </>
                  )}
                </div>
              )}

              {/* Webcam errors */}
              {emotionEngine.webcamError && !emotionEngine.webcamDetecting && emotionEngine.webcamError !== "no_face" && (
                <div style={{ marginTop:5, padding:"6px 9px", borderRadius:7, background:"rgba(239,68,68,.10)", border:"1px solid rgba(239,68,68,.25)", fontSize:9, color:"#fca5a5", lineHeight:1.6, fontWeight:500 }}>
                  {emotionEngine.webcamError === "model_load_failed" && <>⚠ Face detection failed to load — refresh the page</>}
                  {emotionEngine.webcamError === "deepface_missing"  && <>⚠ Face detection models missing — check /models folder</>}
                  {emotionEngine.webcamError === "backend_down"      && <>⚠ Detection error — try refreshing</>}
                  {emotionEngine.webcamError === "rate_limited"      && <>⚠ Too many requests — slowing down</>}
                  {emotionEngine.webcamError === "low_confidence"    && <>Low confidence — improve lighting or move closer</>}
                  {emotionEngine.webcamError === "capture_failed"    && <>Camera still initialising…</>}
                </div>
              )}
              {emotionEngine.webcamError === "no_face" && !emotionEngine.webcamDetecting && (
                <div style={{ marginTop:5, padding:"6px 9px", borderRadius:7, background:"rgba(245,158,11,.08)", border:"1px solid rgba(245,158,11,.2)", fontSize:9, color:"#fbbf24", lineHeight:1.6, fontWeight:500 }}>
                  👤 No face detected — look directly at the camera
                </div>
              )}
              {/* Show raw webcam expression as hint even before committed */}
              {emotionEngine.webcamEmotion && !em && !emotionEngine.webcamDetecting && (
                <div style={{ marginTop:5, padding:"5px 9px", borderRadius:7, background:"rgba(245,158,11,.08)", border:"1px solid rgba(245,158,11,.2)", fontSize:9, color:"#fbbf24", fontWeight:600 }}>
                  Sensing: {emotionEngine.webcamEmotion}…
                </div>
              )}
              {emotionEngine.webcamDetecting && (
                <div style={{ marginTop:5, display:"flex", alignItems:"center", gap:6 }}>
                  <div style={{ width:6, height:6, borderRadius:"50%", background:"#f59e0b", animation:"pulse 1s infinite" }} />
                  <span style={{ fontSize:9, color:T.text, fontWeight:500, fontFamily:"'Outfit',sans-serif" }}>Analyzing face…</span>
                </div>
              )}
              <button
                onClick={onToggleAutoPlay}
                style={{
                  marginTop:8, width:"100%",
                  padding:"7px 10px", borderRadius:7, cursor:"pointer",
                  border:`1px solid ${autoPlay ? "#1DB954" : T.border}`,
                  background: autoPlay ? "rgba(29,185,84,.15)" : T.bg4,
                  color: autoPlay ? "#1DB954" : T.muted,
                  fontSize:10, fontWeight:700, textAlign:"center",
                  transition:"all .2s",
                }}
              >
                {autoPlay ? "🎵 Auto-Play ON — click to disable" : "▶ Enable Auto-Play from emotion"}
              </button>
            </div>
          )}

          {/* Active emotion display — shown here only when camera is OFF */}
          {!cameraOn && em && (
            <div style={{ padding:"11px 13px", borderRadius:11, background:`${em.col}0e`, border:`1px solid ${em.col}22`, display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ position:"relative", width:44, height:44, flexShrink:0 }}>
                <div style={{ width:44, height:44, borderRadius:12, background:em.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>{em.emoji}</div>
                <ConfidenceRing confidence={emotionEngine.confidence} color={em.col} />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:700, color:em.col, fontFamily:"'Outfit',sans-serif" }}>{em.label}</div>
                <div style={{ fontSize:9, color:T.dim, marginTop:2 }}>
                  <span style={{ padding:"1px 6px", borderRadius:4, background:`${em.col}18`, color:em.col, fontSize:9, fontWeight:600, fontFamily:"'Outfit',sans-serif", letterSpacing:.4 }}>{emotionEngine.source}</span>
                  <span style={{ marginLeft:5, fontFamily:"'JetBrains Mono',monospace", fontSize:10 }}>{Math.round((emotionEngine.confidence ?? 0) * 100)}%</span>
                </div>
              </div>
              <button onClick={emotionEngine.clearEmotion} style={{ background:"none", border:"none", color:T.dim, fontSize:15, cursor:"pointer", flexShrink:0 }}>✕</button>
            </div>
          )}
          {!cameraOn && !em && (
            <div style={{ padding:"9px 13px", borderRadius:10, background:T.bg3, border:`1px solid ${T.border}`, textAlign:"center", color:T.dim, fontSize:10 }}>No emotion detected</div>
          )}

          {/* Manual emotion grid */}
          {panel.manualGrid && (
          <div>
            <div style={{ fontSize:9, color:T.muted, letterSpacing:1, fontFamily:"monospace", textTransform:"uppercase", marginBottom:6 }}>Manual Override</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:5 }}>
              {Object.entries(MOODS).map(([key, cfg]) => {
                const active = emotionEngine.emotion === key && emotionEngine.source === "manual";
                return (
                  <button key={key} onClick={() => emotionEngine.setManualEmotion(active ? null : key)}
                    style={{ padding:"7px 3px", borderRadius:9, cursor:"pointer", textAlign:"center", border:`1px solid ${active ? cfg.col + "55" : T.border}`, background:active ? `${cfg.col}12` : T.bg3, boxShadow:active ? `0 0 0 2px ${cfg.col}2a` : undefined, transition:"all .15s" }}>
                    <div style={{ fontSize:15, marginBottom:1 }}>{cfg.emoji}</div>
                <span style={{ fontSize:7.5, fontWeight:600, color:active ? cfg.col : T.muted, textTransform:"uppercase", letterSpacing:.3, fontFamily:"monospace" }}>{key}</span>
                  </button>
                );
              })}
            </div>
          </div>
          )}

          {/* Text input */}
          {panel.textInput && (
          <div>
            <div style={{ fontSize:9, color:T.muted, letterSpacing:1, fontFamily:"monospace", textTransform:"uppercase", marginBottom:5 }}>How do you feel?</div>
            <div style={{ position:"relative" }}>
              <input value={emotionEngine.lastTextInput} onChange={e => emotionEngine.setTextInput(e.target.value)}
                placeholder="e.g. feeling relaxed and chill…"
                style={{ width:"100%", padding:"8px 28px 8px 10px", borderRadius:7, border:`1px solid ${T.border}`, background:T.bg3, color:T.text, fontSize:11, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }}
                onFocus={e => e.target.style.borderColor = T.acc}
                onBlur={e  => e.target.style.borderColor = T.border} />
              {emotionEngine.lastTextInput && (
                <button onClick={() => emotionEngine.setTextInput("")} style={{ position:"absolute", right:7, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:T.dim, fontSize:13, cursor:"pointer" }}>×</button>
              )}
            </div>
            {emotionEngine.source === "text" && emotionEngine.emotion && (
              <div style={{ fontSize:8, color:"#10b981", marginTop:3 }}>✓ Detected: {emotionEngine.emotion}</div>
            )}
          </div>
          )}

          {/* Webcam status + live preview */}
          {panel.webcamCard && (
          <div style={{ padding:"8px 11px", borderRadius:9, background:T.bg3, border:`1px solid ${T.border}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:11, fontWeight:600, color:T.text }}>Webcam Detection</div>
                <div style={{ fontSize:9, color:T.muted, marginTop:1 }}>
                  {emotionEngine.webcamDetecting
                    ? "🔍 Analyzing…"
                    : emotionEngine.webcamEmotion
                      ? `Last: ${emotionEngine.webcamEmotion}`
                      : cameraOn
                        ? "Camera active — waiting for first detection…"
                        : "Enable camera from sidebar"}
                </div>
              </div>
              {emotionEngine.webcamDetecting && <div style={{ width:8, height:8, borderRadius:"50%", background:"#ef4444", animation:"pulse 1s infinite" }} />}
            </div>

            {/* AutoPlay toggle inside webcam card — only shown when camera is off (when on, it's shown at top) */}
            {!cameraOn && (
              <div style={{ marginTop:6, fontSize:9, color:T.dim, textAlign:"center" }}>
                Enable camera from sidebar to start detection
              </div>
            )}
          </div>
          )}

          {/* Pipeline flow stepper */}
          {panel.flowStepper && (
          <div style={{ padding:"8px 11px", borderRadius:9, background:T.bg3, border:`1px solid ${T.border}` }}>
            <div style={{ fontSize:9, color:T.muted, letterSpacing:1, textTransform:"uppercase", fontFamily:"monospace", marginBottom:8 }}>Flow State</div>
            {[
              { n:1, label:"Emotion",    done:!!emotionEngine.emotion,  active:false },
              { n:2, label:"Audio",      done:pipeline.status==="playing"||pipeline.status==="paused", active:pipeline.status==="searching"||pipeline.status==="initiating" },
              { n:3, label:"Visualizer", done:pipeline.status==="playing", active:false },
            ].map((s, i) => (
              <div key={s.n} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:i<2?7:0 }}>
                <div style={{ width:18, height:18, borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, fontWeight:700, background:s.done?"#10b981":s.active?T.acc:T.bg4, color:(s.done||s.active)?"#fff":T.dim, transition:"background .4s" }}>
                  {s.done ? "✓" : s.n}
                </div>
                <span style={{ fontSize:11, fontWeight:s.done||s.active?600:400, color:s.done?"#10b981":s.active?T.acc:T.dim, fontFamily:"'Outfit',sans-serif" }}>{s.label}</span>
                {s.active && <div style={{ width:5, height:5, borderRadius:"50%", background:T.acc, animation:"pulse 1s infinite", marginLeft:"auto" }} />}
              </div>
            ))}
          </div>
          )}

          {/* Spotify audio features (when playing) */}
          {panel.audioAnalysis && (pipeline.status === "playing" || pipeline.status === "paused") && state?.spotify && (
            <div style={{ padding:"8px 11px", borderRadius:9, background:T.bg3, border:`1px solid ${T.border}` }}>
              <div style={{ fontSize:9, color:T.muted, letterSpacing:1, textTransform:"uppercase", fontFamily:"monospace", marginBottom:7 }}>Audio Analysis</div>
              {[
                { l:"Valence",      v:state.spotify.valence      ?? 0, c:"#8b5cf6" },
                { l:"Energy",       v:state.spotify.energy       ?? 0, c:"#f59e0b" },
                { l:"Danceability", v:state.spotify.danceability ?? 0, c:"#10b981" },
              ].map(r => (
                <div key={r.l} style={{ marginBottom:5 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                <span style={{ fontSize:9, color:T.muted, fontFamily:"monospace" }}>{r.l}</span>
                    <span style={{ fontSize:9, color:r.c, fontFamily:"monospace", fontWeight:700 }}>{(r.v*100).toFixed(0)}%</span>
                  </div>
                  <div style={{ height:2, background:T.bg4, borderRadius:1 }}>
                    <div style={{ height:"100%", width:`${r.v*100}%`, background:r.c, borderRadius:1, transition:"width .8s ease" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ════ CENTER: VISUALIZER ════ */}
      <div style={{ position:"relative", overflow:"hidden", background:"#03040e" }}>
        <SyncedVisualizer
          pipelineStatus={pipeline.status}
          liveRef={liveRef}
          audioEngine={audioEngine}
          mood={emotionEngine.emotion ?? state?.mood ?? "neutral"}
          scene={state?.activeScene ?? null}
          milkdrop={milkdrop}
          aiEnabled={aiEnabled}
          aiBlend={aiBlend}
          aiOpacity={aiOpacity}
          isExternallyPlaying={!isPaused}
        />
        <PipelineOverlay status={pipeline.status} pipeline={pipeline} emotionObj={emotionObj} />
      </div>

      {/* ════ RIGHT: PLAYER + TRACKS ════ */}
      <div style={{ background:T.bg2, borderLeft:`1px solid ${T.border}`, display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* Tab bar — Player is always visible; Search/Queue are togglable */}
        <div style={{ display:"flex", borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
          {[
            ["player","▶ Player",  true],
            ["search","🔍 Search", panel.searchTab],
            ["queue", "⏭ Queue",  panel.queueTab],
          ].filter(([,,visible]) => visible).map(([id, label]) => (
            <button key={id} onClick={() => setRightTab(id)}
              style={{ flex:1, padding:"10px 4px", background:"none", border:"none", borderBottom:`2px solid ${rightTab===id?T.acc:"transparent"}`, color:rightTab===id?T.acc:T.muted, fontSize:12, fontWeight:600, fontFamily:"'Outfit',sans-serif", cursor:"pointer", transition:"all .15s", letterSpacing:.2 }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:"10px 10px" }}>

          {/* Player tab — NowPlaying component */}
          {rightTab === "player" && (
            <>
              <NowPlaying
                track={currentTrack}
                playbackPos={playbackPos}
                isPaused={isPaused}
                volume={volume}
                shuffleOn={shuffleOn}
                repeatMode={repeatMode}
                sleepMins={sleepMins}
                sleepSecs={sleepSecs}
                lyrics={lyrics}
                showLyrics={showLyrics}
                lyricsLoading={lyricsLoading}
                hasPremium={hasPremium}
                moodColor={em?.col}
                onTogglePlay={onTogglePlay}
                onSkipNext={onSkipNext}
                onSkipPrev={onSkipPrev}
                onSeek={onSeek}
                onVolumeChange={onVolumeChange}
                onShuffle={onShuffle}
                onRepeat={onRepeat}
                onShowLyrics={() => setShowLyrics(v => !v)}
                onSleepTimer={onSleepTimer}
                onCancelSleep={onCancelSleep}
                onClaimPlayback={onClaimPlayback}
              />

              {/* Track candidates from pipeline */}
              {panel.trackList && pipeline.candidates.length > 0 && (
                <div style={{ marginTop:10 }}>
                  <div style={{ fontSize:9, color:T.muted, letterSpacing:1, textTransform:"uppercase", fontFamily:"monospace", marginBottom:6, paddingLeft:2 }}>
                    {emotionEngine.emotion ?? "neutral"} · {pipeline.candidates.length} tracks
                  </div>
                  <TrackList
                    tracks={pipeline.candidates}
                    currentId={currentTrack?.id}
                    moodColor={em?.col}
                    hasPremium={hasPremium}
                    emptyLabel="Detect an emotion to see recommendations"
                    onSelect={tr => pipeline.playTrackManual(tr.uri, tr)}
                  />
                </div>
              )}
            </>
          )}

          {/* Search tab */}
          {rightTab === "search" && panel.searchTab && (
            <>
              <SearchBar
                query={searchQuery}
                isLoading={isSearching}
                onInput={onSearchInput}
                onClear={onClearSearch}
                disabled={!state?.spotify && !currentTrack}
                style={{ marginBottom: 10 }}
              />
              <TrackList
                tracks={searchResults}
                currentId={currentTrack?.id}
                moodColor={em?.col}
                hasPremium={hasPremium}
                emptyLabel={searchQuery ? "No results" : "Search any song or artist"}
                onSelect={tr => pipeline.playTrackManual(tr.uri, tr)}
              />
            </>
          )}

          {/* Queue tab */}
          {rightTab === "queue" && panel.queueTab && (
            <TrackList
              tracks={state?.recommendations ?? []}
              currentId={currentTrack?.id}
              moodColor={em?.col}
              hasPremium={hasPremium}
              emptyLabel="Queue will appear here"
              onSelect={tr => pipeline.playTrackManual(tr.uri, tr)}
            />
          )}
        </div>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
    )}
    </>
  );
}