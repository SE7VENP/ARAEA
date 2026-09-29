/**
 * useSpotify
 *
 * Owns the entire Spotify integration:
 *   - Web Playback SDK lifecycle (init, connect, disconnect, listener cleanup)
 *   - Polling /me/player every 5 s (skips hidden tabs)
 *   - Playback controls (play, pause, skip, seek, volume, shuffle, repeat)
 *   - Access-token auto-refresh every 45 minutes
 *
 * All returned function references are stable (useCallback + refs).
 * No business logic — pure integration layer.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { auth as authAPI }                            from "../services/backendAPI.js";
import { player as playerAPI, normaliseTrack, resetMarketCache } from "../services/spotifyAPI.js";
import { lsGet, lsSet }                               from "../utils/storage.js";

// ── SDK module-singleton ──────────────────────────────────
// Spotify script is loaded once per page; callbacks queue until ready.
let _sdkLoaded = false;
let _sdkReady  = false;
const _sdkCallbacks = new Set(); // Set — safe to delete from during flush

function loadSpotifySDK() {
  if (_sdkLoaded) return;
  _sdkLoaded = true;
  window.onSpotifyWebPlaybackSDKReady = () => {
    _sdkReady = true;
    _sdkCallbacks.forEach(cb => { cb(); _sdkCallbacks.delete(cb); });
  };
  const s = document.createElement("script");
  s.src = "https://sdk.scdn.co/spotify-player.js";
  s.async = true;
  document.head.appendChild(s);
}

/**
 * Run `cb` as soon as the SDK is ready.
 * Returns a cancel function that removes the callback if SDK hasn't fired yet.
 */
function onSDKReady(cb) {
  if (_sdkReady) { cb(); return () => {}; }
  _sdkCallbacks.add(cb);
  loadSpotifySDK();
  return () => _sdkCallbacks.delete(cb); // cancel registration
}

export function useSpotify({ token, onTokenExpired, connectSpotifyPlayer }) {
  const [playerReady,  setPlayerReady]  = useState(false);
  const [deviceId,     setDeviceId]     = useState(null);
  const [isPaused,     setIsPaused]     = useState(true);
  const [hasPremium,   setHasPremium]   = useState(true);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [playbackPos,  setPlaybackPos]  = useState({ position: 0, duration: 1 });
  const [shuffleOn,    setShuffleOn]    = useState(false);
  const [repeatMode,   setRepeatMode]   = useState("off");
  const [spotifyQueue, setSpotifyQueue] = useState([]);

  const tokenRef        = useRef(token);
  const playerRef       = useRef(null);
  const deviceIdRef     = useRef(null);
  const activeDeviceRef = useRef(null);
  const durRef          = useRef(1);

  useEffect(() => { tokenRef.current = token; },               [token]);
  useEffect(() => { deviceIdRef.current = deviceId; },         [deviceId]);
  useEffect(() => { durRef.current = playbackPos.duration; },  [playbackPos.duration]);

  // ── Notify track helper ───────────────────────────────
  const notifyTrack = useCallback((item) => {
    if (!item?.id) return;
    import("../services/backendAPI.js").then(({ spotify }) =>
      spotify.notifyTrack({ trackId: item.id, title: item.name, artist: item.artist, image: item.image, uri: item.uri })
    ).catch(() => {});
  }, []);

  // ── SDK init + cleanup ────────────────────────────────
  useEffect(() => {
    if (!token) return;

    let activePlayer = null; // track current player for cleanup

    const create = () => {
      // Disconnect previous player instance cleanly
      if (activePlayer) {
        activePlayer.removeListener("ready");
        activePlayer.removeListener("not_ready");
        activePlayer.removeListener("authentication_error");
        activePlayer.removeListener("account_error");
        activePlayer.removeListener("player_state_changed");
        activePlayer.disconnect();
      }

      // Reset the market cache so it gets re-fetched with the new token
      resetMarketCache();

      const vol = Number(lsGet("araea_vol", "70")) / 100;
      const p   = new window.Spotify.Player({
        name: "ARAEA Stage 3",
        getOAuthToken: cb => cb(tokenRef.current ?? token),
        volume: vol,
        // enableMediaSession lets the SDK register OS-level media controls
        // (play/pause keys, lock-screen controls). Recommended by Spotify.
        enableMediaSession: true,
      });

      p.addListener("ready", ({ device_id }) => {
        setDeviceId(device_id);
        setPlayerReady(true);
        // Small delay ensures AudioContext isn't created before user gesture
        setTimeout(() => connectSpotifyPlayer?.(p), 800);
      });
      p.addListener("not_ready",            ()            => setPlayerReady(false));
      p.addListener("authentication_error", ()            => onTokenExpired?.());
      p.addListener("account_error",        ({ message }) => {
        // "account_error" fires for Premium-required features.
        // The message wording varies across SDK versions, so treat any
        // account_error as a premium failure (it's never thrown for other reasons).
        console.warn("[Spotify] account_error:", message);
        setHasPremium(false);
      });
      let _audioConnectedThisSession = false;
      p.addListener("player_state_changed", s => {
        if (!s) return;
        // Only attempt audio connection once per session when playback starts.
        // Calling it every state tick spawns concurrent retry loops.
        if (!s.paused && !_audioConnectedThisSession) {
          _audioConnectedThisSession = true;
          setTimeout(() => connectSpotifyPlayer?.(p), 300);
        }
        setIsPaused(s.paused);
        setPlaybackPos({ position: s.position, duration: s.duration || 1 });
        const item = s.track_window?.current_track;
        if (!item) return;
        const t = normaliseTrack({ ...item, album: item.album, artists: item.artists });
        setCurrentTrack(t);
        if (!s.paused) notifyTrack(t);
      });

      p.connect();
      activePlayer     = p;
      playerRef.current = p;
    };

    const cancelSDK = onSDKReady(create);

    // ── Cleanup: remove all listeners + disconnect ──────
    return () => {
      cancelSDK(); // remove from pending queue if SDK not yet loaded
      if (activePlayer) {
        activePlayer.removeListener("ready");
        activePlayer.removeListener("not_ready");
        activePlayer.removeListener("authentication_error");
        activePlayer.removeListener("account_error");
        activePlayer.removeListener("player_state_changed");
        activePlayer.disconnect();
        playerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── /me/player polling (5 s, skips hidden tabs) ────────
  useEffect(() => {
    if (!token) return;
    const poll = async () => {
      if (document.visibilityState === "hidden") return;
      if (!navigator.onLine) return; // skip when offline — avoids ERR_INTERNET_DISCONNECTED spam
      const { data } = await playerAPI.getState(tokenRef.current);
      if (!data) return;
      if (data.device?.id) activeDeviceRef.current = data.device.id;
      if (data.item) {
        const t = normaliseTrack(data.item);
        setCurrentTrack(prev => prev?.id === t.id ? prev : t);
        setIsPaused(!data.is_playing);
        if (!playerRef.current) setPlaybackPos({ position: data.progress_ms ?? 0, duration: data.item.duration_ms ?? 1 });
        if (data.shuffle_state !== undefined) setShuffleOn(!!data.shuffle_state);
        if (data.repeat_state  !== undefined) setRepeatMode(data.repeat_state ?? "off");
        notifyTrack(t);
      }
    };
    poll();
    const id = setInterval(poll, 5_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Queue polling (15 s) ──────────────────────────────
  useEffect(() => {
    if (!token) return;
    const fetchQ = async () => {
      if (!navigator.onLine) return;
      const { data } = await playerAPI.getQueue(tokenRef.current);
      if (!data?.queue) return;
      const seen = new Set();
      setSpotifyQueue(
        data.queue.filter(t => t?.uri && !seen.has(t.uri) && seen.add(t.uri)).map(normaliseTrack)
      );
    };
    fetchQ();
    const id = setInterval(fetchQ, 15_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Token auto-refresh (every 45 min) ─────────────────
  useEffect(() => {
    if (!token) return;
    const id = setInterval(async () => {
      const { data } = await authAPI.getToken();
      if (data?.access_token && data.access_token !== tokenRef.current) {
        tokenRef.current = data.access_token;
        onTokenExpired?.(data.access_token); // bubble new token to App.jsx
      }
    }, 45 * 60_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Position sync (500 ms while playing) ─────────────
  // Only runs when SDK player_state_changed isn't firing (e.g. no active track)
  useEffect(() => {
    if (isPaused) return;
    const id = setInterval(() => {
      playerRef.current?.getCurrentState().then(s => {
        if (s && !s.paused) setPlaybackPos({ position: s.position, duration: s.duration || 1 });
      }).catch(() => {});
    }, 1000); // 1s is enough — avoids fighting with SDK events
    return () => clearInterval(id);
  }, [isPaused]);

  // ── Playback controls ─────────────────────────────────

  const togglePlay = useCallback(async () => {
    // Use the SDK player directly for pause/resume — it always targets the
    // correct browser device and avoids the 403 "Restriction violated" error
    // that occurs when the REST API targets the wrong active device.
    // The REST API path (playerAPI.pause/play) is kept as a fallback only.
    if (playerRef.current) {
      try {
        await playerRef.current.togglePlay();
        return true;
      } catch {
        // SDK failed — fall through to REST API
      }
    }
    // REST fallback (e.g. SDK not yet connected)
    const tok = tokenRef.current;
    const did = deviceIdRef.current || activeDeviceRef.current;
    const { data } = await playerAPI.getState(tok);
    if (data) {
      const r = data.is_playing
        ? await playerAPI.pause(tok, did)
        : await playerAPI.play(tok, did);
      if (r?.ok) {
        setIsPaused(data.is_playing);
      } else if (r?.status === 403) {
        // 403 from pause/play is almost always a device-targeting issue
        // ("Restriction violated"), NOT a premium issue. Do NOT set hasPremium=false.
        // Just silently return — the SDK state will self-correct on the next poll.
        console.warn("[useSpotify] togglePlay 403 — device mismatch, not a premium error");
        return false;
      }
    }
    return true;
  }, []);

  const skipNext = useCallback(async () => {
    // Try SDK first — always targets the correct device
    if (playerRef.current) {
      try { await playerRef.current.nextTrack(); return true; } catch {}
    }
    const did = deviceIdRef.current || activeDeviceRef.current;
    const r = await playerAPI.next(tokenRef.current, did);
    return r?.ok ?? false;
  }, []);

  const skipPrev = useCallback(async () => {
    // Try SDK first
    if (playerRef.current) {
      try { await playerRef.current.previousTrack(); return true; } catch {}
    }
    const did = deviceIdRef.current || activeDeviceRef.current;
    await playerAPI.prev(tokenRef.current, did);
  }, []);

  const seek = useCallback((fraction) => {
    const ms = Math.floor(Math.max(0, Math.min(1, fraction)) * (durRef.current || 1));
    playerRef.current?.seek(ms);
  }, []);

  const setVolume = useCallback(async (vol) => {
    const v = Math.max(0, Math.min(100, Number(vol) || 0));
    lsSet("araea_vol", v);
    playerRef.current?.setVolume(v / 100).catch(() => {});
    await playerAPI.setVolume(tokenRef.current, v, activeDeviceRef.current);
    return v;
  }, []);

  const playTrack = useCallback(async (uri) => {
    const tok = tokenRef.current;
    const did = deviceIdRef.current;
    if (!tok || !did || !hasPremium) return { ok: false };
    return playerAPI.play(tok, did, { uris: [uri] });
  }, [hasPremium]);

  const claimPlayback = useCallback(async () => {
    const did = deviceIdRef.current;
    if (!did) return false;
    const r = await playerAPI.transferTo(tokenRef.current, did, true);
    return r?.ok ?? false;
  }, []);

  const setShuffle = useCallback(async (on) => {
    const r = await playerAPI.setShuffle(tokenRef.current, on);
    if (r?.ok) setShuffleOn(on);
  }, []);

  const setRepeat = useCallback(async () => {
    const modes = ["off", "context", "track"];
    const next  = modes[(modes.indexOf(repeatMode) + 1) % 3];
    const r = await playerAPI.setRepeat(tokenRef.current, next);
    if (r?.ok) setRepeatMode(next);
  }, [repeatMode]);

  return {
    playerReady, deviceId, isPaused, hasPremium,
    currentTrack, playbackPos, shuffleOn, repeatMode, spotifyQueue,
    tokenRef, playerRef, deviceIdRef, activeDeviceRef,
    togglePlay, skipNext, skipPrev, seek,
    setVolume, playTrack, claimPlayback, setShuffle, setRepeat,
  };
}