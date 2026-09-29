/**
 * SearchBar
 *
 * Standalone search input for Spotify tracks.
 * Emits query changes via onInput; clearing via onClear.
 */
import React from "react";
import { useTheme } from "../../theme.jsx";

export function SearchBar({ query = "", isLoading = false, onInput, onClear, disabled = false, style = {} }) {
  const { T } = useTheme();
  return (
    <div style={{ position: "relative", ...style }}>
      <input
        type="text"
        value={query}
        onChange={e => onInput?.(e.target.value)}
        placeholder={disabled ? "Connect Spotify to search" : "🔍 Search any song, artist…"}
        disabled={disabled}
        style={{
          width: "100%", padding: "7px 32px 7px 10px", borderRadius: 8,
          border: `1px solid ${isLoading ? T.acc : T.border}`,
          background: T.bg3, color: T.text, fontSize: 11, outline: "none",
          boxSizing: "border-box", fontFamily: "inherit", transition: "border-color .2s",
        }}
      />
      {isLoading && (
        <div style={{
          position: "absolute", right: query ? 22 : 8, top: "50%",
          transform: "translateY(-50%)", width: 12, height: 12,
          border: "2px solid rgba(0,0,0,.1)", borderTopColor: T.acc,
          borderRadius: "50%", animation: "spin .7s linear infinite",
        }} />
      )}
      {query && (
        <button onClick={onClear} style={{
          position: "absolute", right: 8, top: "50%",
          transform: "translateY(-50%)", background: "none", border: "none",
          color: T.dim, fontSize: 14, cursor: "pointer", lineHeight: 1,
        }}>×</button>
      )}
      <style>{`@keyframes spin{to{transform:translateY(-50%) rotate(360deg)}}`}</style>
    </div>
  );
}
