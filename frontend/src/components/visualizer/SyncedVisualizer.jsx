// SyncedVisualizer.jsx
// Clean exclusive visualizer logic:
//   milkdrop ON  → Butterchurn only (VisualCanvas hidden)
//   aiEnabled ON → AI frames only (VisualCanvas hidden, no blend mess)
//   both OFF     → VisualCanvas (audio-reactive canvas)
//   both ON      → Butterchurn + AI overlay on top
// Only active when song is playing or paused.

import React, { useState, useEffect, useRef } from "react";
import VisualCanvas      from "./VisualCanvas.jsx";
import ButterchurnCanvas from "./ButterchurnCanvas.jsx";
import AIVisualCanvas    from "./AIVisualCanvas.jsx";

const FADE_IN_MS  = 700;
const FADE_OUT_MS = 500;

export function SyncedVisualizer({
  pipelineStatus,
  liveRef,
  audioEngine,
  mood      = "neutral",
  scene     = null,
  milkdrop  = false,
  aiEnabled = false,
  aiBlend   = "screen",
  aiOpacity = 0.62,
  isExternallyPlaying = false,
}) {
  const [mounted,  setMounted]  = useState(false);
  const [visible,  setVisible]  = useState(false);
  const [paused,   setPaused]   = useState(false);
  const mountTimer   = useRef(null);
  const unmountTimer = useRef(null);

  // treat external playback as "playing" when pipeline hasn't taken over yet
  const effectiveStatus = (isExternallyPlaying && pipelineStatus === "idle") ? "playing" : pipelineStatus;

  useEffect(() => {
    clearTimeout(mountTimer.current);
    clearTimeout(unmountTimer.current);

    if (effectiveStatus === "playing") {
      setPaused(false);
      setMounted(true);
      mountTimer.current = setTimeout(() => setVisible(true), 30);
    } else if (effectiveStatus === "paused") {
      setMounted(true);
      setVisible(true);
      setPaused(true);
    } else {
      setVisible(false);
      setPaused(false);
      unmountTimer.current = setTimeout(() => setMounted(false), FADE_OUT_MS + 80);
    }
    return () => {
      clearTimeout(mountTimer.current);
      clearTimeout(unmountTimer.current);
    };
  }, [effectiveStatus]);

  useEffect(() => () => {
    clearTimeout(mountTimer.current);
    clearTimeout(unmountTimer.current);
  }, []);

  const isPlaying = effectiveStatus === "playing";

  // Only milkdrop or AI visuals — no default canvas
  const showCanvas      = !milkdrop && !aiEnabled;         // restored: show canvas when neither milkdrop nor AI
  const showButterchurn = milkdrop && !aiEnabled;
  const showAIOnly      = aiEnabled && !milkdrop;
  const showAIOverlay   = aiEnabled && milkdrop;

  return (
    <div style={{ position: "absolute", inset: 0, background: "#030408" }}>

      {/* Idle state */}
      {!mounted && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 10, pointerEvents: "none",
        }}>
          <div style={{ fontSize: 32, opacity: 0.12 }}>◎</div>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 14px", borderRadius: 20,
            background: "rgba(255,255,255,.04)",
            border: "1px solid rgba(255,255,255,.08)",
          }}>
            <div style={{
              width: 5, height: 5, borderRadius: "50%",
              background: pipelineStatus === "searching" || pipelineStatus === "initiating"
                ? "#f59e0b" : "rgba(255,255,255,.2)",
              animation: (pipelineStatus === "searching" || pipelineStatus === "initiating")
                ? "pulseDot 1s ease-in-out infinite" : undefined,
            }} />
            <span style={{
              fontSize: 9, fontFamily: "monospace", letterSpacing: 1.5,
              color: "rgba(255,255,255,.25)", fontWeight: 600,
            }}>
              {pipelineStatus === "searching"  ? "FINDING MUSIC…"  :
               pipelineStatus === "initiating" ? "LOADING AUDIO…"  :
               pipelineStatus === "selected"   ? "PREPARING…"      :
               pipelineStatus === "error"      ? "PLAYBACK ERROR"  :
               pipelineStatus === "no_spotify" ? "CONNECT SPOTIFY" :
               "WAITING FOR MUSIC"}
            </span>
          </div>
        </div>
      )}

      {/* Active visualizer layers */}
      {mounted && (
        <div style={{
          position: "absolute", inset: 0,
          opacity: visible ? 1 : 0,
          transition: `opacity ${visible ? FADE_IN_MS : FADE_OUT_MS}ms ease`,
          pointerEvents: visible ? "auto" : "none",
        }}>

          {/* Case 1: plain audio-reactive canvas only */}
          {showCanvas && (
            <VisualCanvas
              liveRef={liveRef}
              isPlaying={isPlaying}
              emotion={mood}
              scene={scene}
            />
          )}

          {/* Case 2: Butterchurn only (or Butterchurn + AI overlay) */}
          {showButterchurn && (
            <ButterchurnCanvas
              audioEngine={audioEngine}
              liveRef={liveRef}
              mood={mood}
              scene={scene}
            />
          )}

          {/* Case 3: AI visuals only — clean dark background, no canvas underneath */}
          {showAIOnly && (
            <AIVisualCanvas
              liveRef={liveRef}
              enabled={true}
              blendMode="normal"
              opacity={1}
              showHUD={true}
            />
          )}

          {/* Case 4: AI overlay on top of Butterchurn */}
          {showAIOverlay && (
            <AIVisualCanvas
              liveRef={liveRef}
              enabled={true}
              blendMode={aiBlend}
              opacity={aiOpacity}
              showHUD={true}
            />
          )}

          {/* Pause overlay */}
          {paused && (
            <div style={{
              position: "absolute", inset: 0,
              background: "rgba(0,0,0,0.45)",
              display: "flex", alignItems: "center", justifyContent: "center",
              backdropFilter: "blur(4px)",
              pointerEvents: "none",
              zIndex: 20,
            }}>
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                padding: "18px 28px", borderRadius: 14,
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}>
                <span style={{ fontSize: 28 }}>⏸</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontFamily: "monospace", letterSpacing: 2.5 }}>
                  PAUSED
                </span>
              </div>
            </div>
          )}

          {/* REACTIVE badge */}
          {isPlaying && (
            <div style={{
              position: "absolute", top: 10, right: 10,
              display: "flex", alignItems: "center", gap: 5,
              padding: "4px 10px", borderRadius: 20,
              background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)",
              border: "1px solid rgba(29,185,84,.3)",
              pointerEvents: "none", zIndex: 30,
            }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#1DB954", boxShadow: "0 0 6px #1DB954" }} />
              <span style={{ fontSize: 8, fontFamily: "monospace", fontWeight: 700, letterSpacing: 1, color: "#1DB954" }}>
                {showAIOnly ? "AI VISUALS" : showButterchurn ? "MILKDROP" : "PLAYING"}
              </span>
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes pulseDot{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </div>
  );
}
