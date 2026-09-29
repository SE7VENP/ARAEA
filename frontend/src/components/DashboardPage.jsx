// â”€â”€ Dashboard page â€” left / center / right 3-column layout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import React from "react";
import { useTheme } from "../theme.jsx";
import { MOODS, SCENES, EMOTIONS, EMO_EMOJI } from "../constants.js";
import { Card, SLabel, Bar, TrackCard } from "./ui/index.jsx";
import VisualCanvas      from "./visualizer/VisualCanvas.jsx";
import AIVisualCanvas    from "./visualizer/AIVisualCanvas.jsx";
import ButterchurnCanvas from "./visualizer/ButterchurnCanvas.jsx";

export default function DashboardPage({
  state, token, playerReady, isPaused, hasPremium,
  currentTrack, playbackPos, liveRef,
  onTogglePlay, onSkipNext, onSkipPrev, onSeek,
  onPlayTrack, onSetEmotion, onSetScene,
  onClaimPlayback, onFetchRecs,
  aiEnabled, aiBlend, aiOpacity,
  volume, onVolumeChange,
  searchQuery, searchResults, searching,
  onSearchInput, onClearSearch, onStartInBrowser,
  spotifyQueue, milkdrop, audioEngine,
  lyrics, showLyrics, setShowLyrics, lyricsLoading,
  sleepMins, sleepSecs, onSleepTimer, onCancelSleep,
  shuffleOn, repeatMode, onShuffle, onRepeat,
}) {
  const { T } = useTheme();
  const m = MOODS[state?.mood] ?? MOODS.neutral;

  // Safe playback values
  const pos = playbackPos?.position ?? 0;
  const dur = playbackPos?.duration ?? 1;

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "280px 1fr 264px",
      gap: 12, height: "100%", padding: 14,
      boxSizing: "border-box", overflow: "hidden",
    }}>

      {/* â”€â”€ LEFT COLUMN â”€â”€ */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", minWidth: 0 }}>

        {/* Mood card */}
        <Card glow={m.col} style={{ border: `1px solid ${m.col}22`, background: m.bg, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: `0 2px 8px ${m.col}33`, flexShrink: 0 }}>
              {m.emoji}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: m.col, lineHeight: 1 }}>{m.label}</div>
              <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{m.desc}</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div style={{ background: "rgba(255,255,255,.6)", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 9, color: T.muted, letterSpacing: 1, marginBottom: 3, fontFamily: "monospace" }}>INTENSITY</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: m.col, fontFamily: "monospace" }}>
                {((state?.intensity ?? 0) * 100).toFixed(0)}<span style={{ fontSize: 10, color: T.muted }}>%</span>
              </div>
            </div>
            <div style={{ background: "rgba(255,255,255,.6)", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 9, color: T.muted, letterSpacing: 1, marginBottom: 3, fontFamily: "monospace" }}>BPM</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.bright, fontFamily: "monospace" }}>{state?.spotify?.bpm ?? "â€”"}</div>
            </div>
          </div>
          <div style={{ height: 4, background: "rgba(255,255,255,.5)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(state?.intensity ?? 0) * 100}%`, background: m.col, borderRadius: 4, transition: "width .4s ease" }} />
          </div>
        </Card>

        {/* Audio analysis */}
        <Card style={{ flexShrink: 0 }}>
          <SLabel>Audio Analysis</SLabel>
          {state?.spotify ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { l: "Valence",      v: state.spotify.valence      ?? 0, c: "#8b5cf6" },
                { l: "Energy",       v: state.spotify.energy       ?? 0, c: T.warning },
                { l: "Danceability", v: state.spotify.danceability ?? 0, c: T.success },
                { l: "Acousticness", v: state.spotify.acousticness ?? 0, c: "#f97316" },
              ].map(r => (
                <div key={r.l}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: T.muted, fontWeight: 500 }}>{r.l}</span>
                    <span style={{ fontSize: 11, color: r.c, fontFamily: "monospace", fontWeight: 700 }}>{(r.v * 100).toFixed(0)}%</span>
                  </div>
                  <Bar value={r.v} color={r.c} height={5} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "16px 0", color: T.dim, fontSize: 11 }}>
              Connect Spotify to see analysis
            </div>
          )}
        </Card>

        {/* Emotion override */}
        <Card style={{ flexShrink: 0 }}>
          <SLabel>Emotion Override</SLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5 }}>
            {EMOTIONS.map(em => {
              const active = state?.emotion?.label === em;
              return (
                <button key={em} onClick={() => onSetEmotion?.(em)} style={{
                  padding: "7px 2px", borderRadius: 9, cursor: "pointer", textAlign: "center",
                  background: active ? T.accBg : T.bg3,
                  border: `1px solid ${active ? T.acc + "55" : T.border}`,
                  transition: "all .15s",
                }}>
                  <div style={{ fontSize: 14, marginBottom: 2 }}>{EMO_EMOJI[em]}</div>
                  <div style={{ fontSize: 7.5, fontWeight: active ? 700 : 500, color: active ? T.acc : T.muted, fontFamily: "monospace" }}>{em}</div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* AI Fusion */}
        <Card style={{ flexShrink: 0 }}>
          <SLabel>AI Fusion Engine</SLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {[
              { label: "Emotion Signal", val: state?.emotion?.label ?? "â€”",                           weight: "50%", col: T.warning },
              { label: "Environment",    val: (state?.sensor?.context ?? "default").replace(/_/g, " "),weight: "30%", col: T.success },
              { label: "Time of Day",    val: (state?.timeMood ?? "â€”").replace(/_/g, " "),            weight: "20%", col: T.acc2 },
            ].map(r => (
              <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: T.bg3, border: `1px solid ${T.border}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: r.col, textTransform: "capitalize", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.val}</div>
                  <div style={{ fontSize: 9, color: T.muted, marginTop: 1 }}>{r.label}</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 800, color: r.col, fontFamily: "monospace", flexShrink: 0 }}>{r.weight}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* â”€â”€ CENTER COLUMN â”€â”€ */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0, overflow: "hidden" }}>
        {/* Visualizer */}
        <div style={{ flex: 1, borderRadius: 14, overflow: "hidden", minHeight: 0, boxShadow: T.shMd, border: `1px solid ${T.border}`, position: "relative" }}>
          {!milkdrop && !aiEnabled && <VisualCanvas liveRef={liveRef} theme="arctic" />}
          {milkdrop && <ButterchurnCanvas audioEngine={audioEngine} liveRef={liveRef} mood={state?.mood ?? "neutral"} scene={state?.activeScene ?? null} />}
          {aiEnabled && !milkdrop && <AIVisualCanvas liveRef={liveRef} enabled={true} blendMode="normal" opacity={1} showHUD={true} />}
          {aiEnabled && milkdrop && <AIVisualCanvas liveRef={liveRef} enabled={true} blendMode={aiBlend} opacity={aiOpacity} showHUD={true} />}
        </div>

        {/* Now Playing */}
        {currentTrack ? (
          <Card style={{ flexShrink: 0, padding: "10px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 9, overflow: "hidden", flexShrink: 0, background: T.bg4, boxShadow: T.sh }}>
                {currentTrack.image && <img src={currentTrack.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.bright, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentTrack.name}</div>
                <div style={{ fontSize: 10, color: T.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>{currentTrack.artist}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <button onClick={onSkipPrev} style={{ background: "none", border: "none", color: T.muted, fontSize: 18, cursor: "pointer", padding: 2, opacity: .75 }}>â®</button>
                <button onClick={onTogglePlay} style={{ width: 34, height: 34, borderRadius: "50%", background: token ? T.acc : T.bg4, border: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#fff", cursor: token ? "pointer" : "not-allowed", boxShadow: token ? `0 2px 8px ${T.acc}55` : undefined }}>
                  {isPaused ? "â–¶" : "â¸"}
                </button>
                <button onClick={onSkipNext} style={{ background: "none", border: "none", color: T.muted, fontSize: 18, cursor: "pointer", padding: 2, opacity: .75 }}>â­</button>
              </div>
            </div>

            {/* Seek bar â€” passes 0..1 fraction to onSeek */}
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontSize: 8, color: T.dim, fontFamily: "monospace", flexShrink: 0, minWidth: 26 }}>
                {Math.floor(pos / 60000)}:{String(Math.floor((pos % 60000) / 1000)).padStart(2, "0")}
              </span>
              <div
                style={{ flex: 1, height: 3, background: T.bg4, borderRadius: 2, cursor: "pointer" }}
                onClick={e => {
                  const r = e.currentTarget.getBoundingClientRect();
                  onSeek?.((e.clientX - r.left) / r.width);
                }}
              >
                <div style={{ height: "100%", background: T.acc, borderRadius: 2, width: `${Math.min(100, (pos / Math.max(1, dur)) * 100)}%`, transition: "width .5s linear" }} />
              </div>
              <span style={{ fontSize: 8, color: T.dim, fontFamily: "monospace", flexShrink: 0, minWidth: 26, textAlign: "right" }}>
                {Math.floor(dur / 60000)}:{String(Math.floor((dur % 60000) / 1000)).padStart(2, "0")}
              </span>
            </div>

            {/* Controls row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <button onClick={onShuffle} title="Shuffle" style={{ fontSize: 12, color: shuffleOn ? T.acc : T.dim, background: "transparent", border: "none", cursor: "pointer", padding: 2 }}>â‡€</button>
                <button onClick={onRepeat} title={`Repeat: ${repeatMode}`} style={{ fontSize: 12, color: repeatMode !== "off" ? T.acc : T.dim, background: "transparent", border: "none", cursor: "pointer", padding: 2 }}>
                  {repeatMode === "track" ? "â†»Â¹" : "â†»"}
                </button>
              </div>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <button onClick={() => setShowLyrics?.(v => !v)} style={{ fontSize: 9, padding: "2px 7px", borderRadius: 5, border: `1px solid ${showLyrics ? T.acc + "44" : T.border}`, background: showLyrics ? T.accBg : "transparent", color: showLyrics ? T.acc : T.dim, cursor: "pointer" }}>ðŸŽµ Lyrics</button>
                <button onClick={onClaimPlayback} style={{ fontSize: 9, color: T.muted, background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}>â†— Transfer</button>
              </div>
            </div>

            {/* Lyrics panel */}
            {showLyrics && (
              <div style={{ marginTop: 8, padding: "8px 10px", background: T.bg3, borderRadius: 8, border: `1px solid ${T.border}`, maxHeight: 80, overflowY: "auto", fontSize: 10, color: T.text, lineHeight: 1.7, whiteSpace: "pre-line" }}>
                {lyricsLoading ? "Loading lyricsâ€¦" : (lyrics ?? "No lyrics found for this track.")}
              </div>
            )}

            {/* Volume */}
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 6 }}>
              <span style={{ fontSize: 11, color: T.dim }}>ðŸ”ˆ</span>
              <input
                type="range" min={0} max={100} step={1} value={volume ?? 70}
                onChange={e => onVolumeChange?.(Number(e.target.value))}
                style={{ flex: 1, accentColor: T.acc, height: 3, cursor: "pointer" }}
              />
              <span style={{ fontSize: 9, color: T.muted, fontFamily: "monospace", minWidth: 26, textAlign: "right" }}>{volume ?? 70}%</span>
            </div>

            {/* Sleep timer */}
            {sleepMins == null ? (
              <div style={{ marginTop: 6, display: "flex", gap: 4, alignItems: "center" }}>
                <span style={{ fontSize: 8, color: T.dim }}>ðŸ˜´</span>
                {[15, 30, 45, 60].map(mins => (
                  <button key={mins} onClick={() => onSleepTimer?.(mins)} style={{ padding: "2px 7px", borderRadius: 5, border: `1px solid ${T.border}`, background: T.bg3, color: T.muted, fontSize: 8, cursor: "pointer" }}>{mins}m</button>
                ))}
              </div>
            ) : (
              <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center", padding: "4px 8px", background: T.accBg, borderRadius: 6, border: `1px solid ${T.acc}44` }}>
                <span style={{ fontSize: 9, color: T.acc }}>ðŸ˜´ {Math.floor((sleepSecs ?? 0) / 60)}:{String((sleepSecs ?? 0) % 60).padStart(2, "0")}</span>
                <button onClick={onCancelSleep} style={{ fontSize: 9, color: T.danger, background: "transparent", border: "none", cursor: "pointer", marginLeft: "auto" }}>âœ•</button>
              </div>
            )}

            {!hasPremium && (
              <div style={{ marginTop: 6, padding: "4px 8px", background: "#fef2f2", borderRadius: 6, fontSize: 9, color: T.danger, textAlign: "center", border: `1px solid ${T.danger}22` }}>
                Spotify Premium required for playback control
              </div>
            )}
          </Card>
        ) : (
          <Card style={{ padding: "12px 14px", textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: T.dim, marginBottom: 8 }}>
              {token ? "Open Spotify and start playing â€” or click a recommendation below" : "Connect Spotify to enable playback"}
            </div>
            {token && (
              <button onClick={onStartInBrowser} style={{ padding: "6px 16px", borderRadius: 8, border: "none", background: T.acc, color: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                â–¶ Start in Browser
              </button>
            )}
          </Card>
        )}
      </div>

      {/* â”€â”€ RIGHT COLUMN â”€â”€ */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", minWidth: 0 }}>

        {/* Search */}
        <Card style={{ flexShrink: 0, padding: "10px 12px" }}>
          <div style={{ position: "relative", marginBottom: (searching || searchResults.length > 0) ? 8 : 0 }}>
            <input
              type="text" value={searchQuery}
              onChange={e => onSearchInput?.(e.target.value)}
              placeholder={token ? "ðŸ” Search any song, artistâ€¦" : "Connect Spotify to search"}
              disabled={!token}
              style={{
                width: "100%", padding: "7px 32px 7px 10px", borderRadius: 8,
                border: `1px solid ${searching ? T.acc : T.border}`,
                background: T.bg3, color: T.text, fontSize: 11, outline: "none",
                boxSizing: "border-box", fontFamily: "inherit", transition: "border-color .2s",
              }}
            />
            {searching && <div style={{ position: "absolute", right: searchQuery ? 22 : 8, top: "50%", transform: "translateY(-50%)", width: 12, height: 12, border: "2px solid rgba(0,0,0,.1)", borderTopColor: T.acc, borderRadius: "50%", animation: "spin .7s linear infinite" }} />}
            {searchQuery && <button onClick={onClearSearch} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: T.dim, fontSize: 14, cursor: "pointer", lineHeight: 1 }}>Ã—</button>}
          </div>
          {searchResults.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {searchResults.slice(0, 6).map((tr, i) => (
                <TrackCard key={tr.uri ?? tr.id ?? i} track={tr}
                  playing={currentTrack?.id === tr.id}
                  onClick={() => hasPremium ? onPlayTrack?.(tr.uri) : window.open(tr.spotifyUrl, "_blank")}
                  moodCol={m.col} />
              ))}
            </div>
          )}
        </Card>

        {/* Ambient lighting */}
        <Card style={{ flexShrink: 0 }}>
          <SLabel>Ambient Lighting</SLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: state?.lighting?.hex ?? m.col, boxShadow: `0 4px 16px ${state?.lighting?.hex ?? m.col}55`, transition: "all 1.5s ease", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontFamily: "monospace", color: T.bright, fontWeight: 700 }}>{state?.lighting?.hex ?? m.col}</div>
              <div style={{ fontSize: 9, color: T.muted, marginTop: 2 }}>{m.label} Â· Auto-reactive</div>
            </div>
          </div>
          <div style={{ height: 3, borderRadius: 2, background: T.bg4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(state?.intensity ?? 0.5) * 100}%`, background: `linear-gradient(90deg,${state?.lighting?.hex ?? m.col}88,${state?.lighting?.hex ?? m.col})`, transition: "all 2s" }} />
          </div>
        </Card>

        {/* Scene presets */}
        <Card style={{ flexShrink: 0 }}>
          <SLabel>Scene Presets</SLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5 }}>
            {Object.entries(SCENES).map(([key, sc]) => {
              const active = state?.activeScene === key;
              return (
                <button key={key} onClick={() => onSetScene?.(active ? null : key)} title={sc.desc}
                  style={{ padding: "7px 2px", borderRadius: 9, cursor: "pointer", textAlign: "center", background: active ? `${sc.col}15` : T.bg3, border: `1px solid ${active ? sc.col + "44" : T.border}`, transition: "all .2s", boxShadow: active ? `0 2px 8px ${sc.col}22` : undefined }}>
                  <div style={{ fontSize: 14, marginBottom: 2 }}>{sc.emoji}</div>
                  <div style={{ fontSize: 7.5, fontWeight: 600, color: active ? sc.col : T.muted, textTransform: "uppercase", letterSpacing: .3 }}>{sc.label}</div>
                </button>
              );
            })}
          </div>
          {state?.activeScene && (
            <div style={{ marginTop: 8, padding: "6px 9px", background: T.bg3, borderRadius: 7, border: `1px solid ${SCENES[state.activeScene]?.col}22` }}>
              <div style={{ fontSize: 9, color: T.muted }}>{SCENES[state.activeScene]?.desc} mode active</div>
            </div>
          )}
        </Card>

        {/* Recommendations */}
        <Card style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexShrink: 0 }}>
            <SLabel style={{ marginBottom: 0 }}>
              {(state?.recommendations ?? []).some(r => r.isRecent)
                ? "ðŸ• Recently Played"
                : (state?.recommendations?.length ?? 0) > 0
                  ? `âœ¨ For You Â· ${((state?.mood ?? "neutral").charAt(0).toUpperCase() + (state?.mood ?? "neutral").slice(1))}`
                  : "Recommendations"}
            </SLabel>
            <button onClick={onFetchRecs} style={{ background: "none", border: "none", color: T.muted, fontSize: 15, cursor: "pointer", padding: 2, lineHeight: 1 }}>â†º</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
            {(state?.recommendations?.length ?? 0) > 0
              ? (state?.recommendations ?? []).slice(0, 8).map((tr, i) => (
                <TrackCard key={tr.uri ?? tr.id ?? i} track={tr}
                  playing={currentTrack?.id === tr.id}
                  onClick={() => hasPremium ? onPlayTrack?.(tr.uri) : window.open(tr.spotifyUrl, "_blank")}
                  moodCol={m.col} />
              ))
              : (
                <div style={{ textAlign: "center", padding: "16px 0", color: T.dim, fontSize: 11, lineHeight: 1.9 }}>
                  {token ? "No recommendations yet" : "Connect Spotify for AI-curated tracks"}
                  {token && (
                    <div style={{ marginTop: 6 }}>
                      <button onClick={onFetchRecs} style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${T.acc}44`, background: T.accBg, color: T.acc, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>â†º Load</button>
                    </div>
                  )}
                </div>
              )}
          </div>
        </Card>

        {/* Queue */}
        {(spotifyQueue?.length ?? 0) > 0 && (
          <Card style={{ flexShrink: 0 }}>
            <SLabel>Up Next ({spotifyQueue.length})</SLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {spotifyQueue.slice(0, 3).map((tr, i) => (
                <TrackCard key={tr.uri ?? tr.id ?? i} track={tr}
                  playing={false}
                  onClick={() => hasPremium ? onPlayTrack?.(tr.uri) : window.open(tr.spotifyUrl, "_blank")}
                  moodCol={m.col} />
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
