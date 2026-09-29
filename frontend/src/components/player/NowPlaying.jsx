/**
 * NowPlaying
 *
 * Displays the currently playing track with playback controls,
 * seek bar, volume, and sleep timer.  Pure UI — all data/logic
 * comes from props.
 */
import React from "react";
import { useTheme }   from "../../theme.jsx";
import { formatMs }   from "../../utils/time.js";
import { clamp }      from "../../utils/math.js";

export function NowPlaying({
  track,
  playbackPos   = { position: 0, duration: 1 },
  isPaused      = true,
  volume        = 70,
  shuffleOn     = false,
  repeatMode    = "off",
  sleepMins     = null,
  sleepSecs     = null,
  lyrics        = null,
  showLyrics    = false,
  lyricsLoading = false,
  hasPremium    = true,
  moodColor,
  // Callbacks
  onTogglePlay,
  onSkipNext,
  onSkipPrev,
  onSeek,
  onVolumeChange,
  onShuffle,
  onRepeat,
  onShowLyrics,
  onSleepTimer,
  onCancelSleep,
  onClaimPlayback,
}) {
  const { T }  = useTheme();
  const pos    = playbackPos.position ?? 0;
  const dur    = playbackPos.duration ?? 1;
  const accent = moodColor ?? T.acc;

  if (!track) return null;

  return (
    <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 14px" }}>
      {/* Track identity */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ width: 40, height: 40, borderRadius: 9, overflow: "hidden", flexShrink: 0, background: T.bg4, boxShadow: `0 2px 8px ${accent}44` }}>
          {track.image && <img src={track.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.bright, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {track.name}
          </div>
          <div style={{ fontSize: 10, color: T.muted, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {track.artist}
          </div>
        </div>
        {/* Transport */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          <button onClick={onSkipPrev}   style={btnStyle(T.muted, "transparent", "none")}>⏮</button>
          <button onClick={onTogglePlay} style={{ ...btnStyle("#fff", accent, "none"), width: 34, height: 34, borderRadius: "50%", boxShadow: `0 2px 8px ${accent}55` }}>
            {isPaused ? "▶" : "⏸"}
          </button>
          <button onClick={onSkipNext}   style={btnStyle(T.muted, "transparent", "none")}>⏭</button>
        </div>
      </div>

      {/* Seek bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
        <span style={timeStyle}>{formatMs(pos)}</span>
        <div style={{ flex: 1, height: 3, background: T.bg4, borderRadius: 2, cursor: "pointer" }}
          onClick={e => { const r = e.currentTarget.getBoundingClientRect(); onSeek?.((e.clientX - r.left) / r.width); }}>
          <div style={{ height: "100%", background: accent, borderRadius: 2, width: `${clamp(pos / Math.max(1, dur), 0, 1) * 100}%`, transition: "width .5s linear" }} />
        </div>
        <span style={{ ...timeStyle, textAlign: "right" }}>{formatMs(dur)}</span>
      </div>

      {/* Controls row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={onShuffle} title="Shuffle" style={iconBtn(shuffleOn ? accent : T.dim)}>⇀</button>
          <button onClick={onRepeat}  title={`Repeat: ${repeatMode}`} style={iconBtn(repeatMode !== "off" ? accent : T.dim)}>
            {repeatMode === "track" ? "↻¹" : "↻"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          <button onClick={onShowLyrics}    style={{ ...pillBtn(T, showLyrics, accent) }}>🎵 Lyrics</button>
          <button onClick={onClaimPlayback} style={{ ...pillBtn(T, false, T.muted) }}>↗ Transfer</button>
        </div>
      </div>

      {/* Lyrics */}
      {showLyrics && (
        <div style={{ marginTop: 8, padding: "8px 10px", background: T.bg3, borderRadius: 8, border: `1px solid ${T.border}`, maxHeight: 80, overflowY: "auto", fontSize: 10, color: T.text, lineHeight: 1.7, whiteSpace: "pre-line" }}>
          {lyricsLoading ? "Loading lyrics…" : (lyrics ?? "No lyrics found.")}
        </div>
      )}

      {/* Volume */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 7 }}>
        <span style={{ fontSize: 10, color: T.dim }}>🔈</span>
        <input type="range" min={0} max={100} step={1} value={volume}
          onChange={e => onVolumeChange?.(Number(e.target.value))}
          style={{ flex: 1, accentColor: accent, height: 3, cursor: "pointer" }} />
        <span style={{ fontSize: 9, color: T.muted, fontFamily: "monospace", minWidth: 26, textAlign: "right" }}>{volume}%</span>
      </div>

      {/* Sleep timer */}
      {sleepMins == null ? (
        <div style={{ display: "flex", gap: 4, marginTop: 6, alignItems: "center" }}>
          <span style={{ fontSize: 8, color: T.dim }}>😴</span>
          {[15, 30, 45, 60].map(m => (
            <button key={m} onClick={() => onSleepTimer?.(m)}
              style={{ padding: "2px 7px", borderRadius: 5, border: `1px solid ${T.border}`, background: T.bg3, color: T.muted, fontSize: 8, cursor: "pointer" }}>
              {m}m
            </button>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, padding: "4px 8px", background: `${accent}10`, borderRadius: 6, border: `1px solid ${accent}33` }}>
          <span style={{ fontSize: 9, color: accent }}>😴 {Math.floor((sleepSecs ?? 0) / 60)}:{String((sleepSecs ?? 0) % 60).padStart(2,"0")}</span>
          <button onClick={onCancelSleep} style={{ fontSize: 9, color: T.danger, background: "transparent", border: "none", cursor: "pointer", marginLeft: "auto" }}>✕</button>
        </div>
      )}

      {!hasPremium && (
        <div style={{ marginTop: 6, padding: "3px 8px", background: "#fef2f2", borderRadius: 6, fontSize: 9, color: T.danger, textAlign: "center" }}>
          Spotify Premium required for playback control
        </div>
      )}
    </div>
  );
}

// ── Style helpers (kept local to avoid leaking into design system) ─
const btnStyle = (color, bg, border, size = 18) => ({
  background: bg, border, color, fontSize: size, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
});
const iconBtn = color => ({
  background: "transparent", border: "none", color,
  fontSize: 12, cursor: "pointer", padding: "2px 3px",
});
const pillBtn = (T, active, accent) => ({
  fontSize: 9, padding: "2px 7px", borderRadius: 5, cursor: "pointer",
  border: `1px solid ${active ? accent + "44" : T.border}`,
  background: active ? `${accent}10` : "transparent",
  color: active ? accent : T.dim,
});
const timeStyle = { fontSize: 8, color: "#94a3b8", fontFamily: "monospace", minWidth: 26 };
