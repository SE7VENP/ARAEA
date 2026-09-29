/**
 * TrackList
 *
 * Reusable list of tracks.  Used for recommendations, search results,
 * and queue display.  Emits an `onSelect` callback with the track object.
 */
import React from "react";
import { useTheme }  from "../../theme.jsx";
import { formatMs }  from "../../utils/time.js";
import { TrackCard } from "../ui/index.jsx";

export function TrackList({
  tracks      = [],
  currentId   = null,
  moodColor,
  hasPremium  = true,
  emptyLabel  = "No tracks",
  onSelect,
  style       = {},
}) {
  const { T } = useTheme();
  if (!tracks.length) {
    return <div style={{ textAlign: "center", padding: "18px 0", color: T.dim, fontSize: 11, ...style }}>{emptyLabel}</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, ...style }}>
      {tracks.map((tr, i) => (
        <TrackCard
          key={tr.uri ?? tr.id ?? i}
          track={tr}
          playing={currentId === tr.id}
          onClick={() => hasPremium ? onSelect?.(tr) : tr.spotifyUrl && window.open(tr.spotifyUrl, "_blank")}
          moodCol={moodColor}
        />
      ))}
    </div>
  );
}
