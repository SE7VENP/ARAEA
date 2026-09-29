// useAudioPipeline.js — stable Emotion → Spotify → next-track
import { useState, useEffect, useRef, useCallback } from "react";

const EMOTION_QUERIES = {
  euphoric:    ["euphoric edm",       "festival dance hits",    "rave electronic",      "ecstatic pop"],
  happy:       ["happy pop songs",    "feel good hits",         "upbeat cheerful pop",  "summer pop"],
  calm:        ["calm ambient",       "peaceful relaxing music","lofi chill beats",     "meditation music"],
  melancholic: ["melancholic indie",  "bittersweet songs",      "nostalgic 90s",        "sad beautiful piano"],
  tense:       ["intense cinematic",  "epic orchestral",        "dramatic score",       "thriller soundtrack"],
  sad:         ["sad emotional songs","heartbreak ballads",     "crying songs",         "emotional piano"],
  neutral:     ["popular indie hits", "top chart songs",        "alternative pop",      "chill pop hits"],
  energetic:   ["high energy workout","power pop",              "running music",        "energetic rock"],
  surprised:   ["exciting pop",       "upbeat fun songs",       "playful indie",        "quirky pop"],
  fearful:     ["dark ambient",       "atmospheric dark",       "suspense music",       "eerie soundtrack"],
  angry:       ["aggressive rock",    "hard metal",             "punk energy",          "rage rap"],
};
const FALLBACK_QUERIES = ["top pop hits", "popular songs", "indie hits"];
const BACKEND = "http://127.0.0.1:3001";

async function sp(method, url, token, body, signal) {
  if (!token) return null;
  const full = url.startsWith("http") ? url : `https://api.spotify.com/v1${url}`;
  try {
    const headers = { Authorization: `Bearer ${token}` };
    if (body) headers["Content-Type"] = "application/json";
   const r = await fetch(full, { method, headers, body: body ? JSON.stringify(body) : undefined, signal });
    if (r.status === 204) return { ok: true };
    if (!r.ok) {
      let e = null; try { e = await r.json(); } catch {}
      return { ok: false, status: r.status, error: e?.error?.message };
    }
    const ct = r.headers.get("content-type") ?? "";
    return { ok: true, data: ct.includes("json") ? await r.json() : null };
  } catch (e) {
    if (e.name === "AbortError") return { ok: false, aborted: true };
    return { ok: false, error: e.message };
  }
}

async function searchEmotionTracks(token, emotion, signal, attempt = 0) {
  const queries   = EMOTION_QUERIES[emotion] ?? EMOTION_QUERIES.neutral;
  const queryBank = [...queries, ...FALLBACK_QUERIES];
  const q         = queryBank[attempt % queryBank.length];
  try {
   const r = await fetch(`${BACKEND}/api/search?q=${encodeURIComponent(q)}`, {
      headers: { Authorization: `Bearer ${token}` }, signal,
    });
    if (!r.ok) {
      if (r.status === 401) return { tokenExpired: true };
      if (attempt < queryBank.length - 1) return searchEmotionTracks(token, emotion, signal, attempt + 1);
      return [];
    }
    const data  = await r.json();
    const items = data?.tracks ?? [];
    if (items.length === 0 && attempt < queryBank.length - 1)
      return searchEmotionTracks(token, emotion, signal, attempt + 1);
    // Use all returned tracks (up to 20) for a larger unplayed pool
    return items.map(t => ({
      uri:         t.uri,
      id:          t.id,
      name:        t.name,
      artist:      t.artist ?? t.artists?.map(a => a.name).join(", ") ?? "",
      image:       t.image ?? t.album?.images?.[1]?.url ?? t.album?.images?.[0]?.url ?? null,
      popularity:  t.popularity ?? 0,
      duration_ms: t.duration_ms ?? 0,
      spotifyUrl:  t.spotifyUrl ?? `https://open.spotify.com/track/${t.id}`,
    }));
  } catch (e) {
    if (e.name === "AbortError") return [];
    if (attempt < queryBank.length - 1) return searchEmotionTracks(token, emotion, signal, attempt + 1);
    return [];
  }
}

export function useAudioPipeline({
  emotion, enabled = true,
  tokenRef, deviceIdRef, activeDeviceRef, playerRef,
  connectSpotifyPlayer, hasPremium, deviceId,
  externalIsPaused, externalCurrentTrack,
}) {
  const [status,        setStatus]        = useState("idle");
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [candidates,    setCandidates]    = useState([]);
  const [errorMsg,      setErrorMsg]      = useState(null);
  const [errorCode,     setErrorCode]     = useState(null);
  const [searchQuery,   setSearchQuery]   = useState(null);

  // ── All refs ────────────────────────────────────────────
  const statusRef        = useRef("idle");
  const abortRef         = useRef(null);
  const timeoutRef       = useRef(null);
  const prevEmotionRef   = useRef(null);
  const prevEnabledRef   = useRef(enabled);
  const selectedRef      = useRef(null);
  const candidatesRef    = useRef([]);
  const playedIdsRef     = useRef(new Set());
  const queueEmotionRef  = useRef(null);
  const errorCodeRef     = useRef(null);
  const runPipelineRef   = useRef(null);
  const queryAttemptRef  = useRef(0);
  const playNextLockRef  = useRef(false);
  const pendingEmotionRef = useRef(null); // emotion queued while a song is playing — applied at track end
  const trackWatchRef    = useRef(null);
  // Track position state in refs — never reset by re-renders
  const lastPositionRef  = useRef(-1);
  const lastDurationRef  = useRef(0);
  // Stable fn refs — set once in useEffect([]) so interval closures never go stale
  const pickNextRef      = useRef(null);
  const playNextRef      = useRef(null);
  const stopWatchRef     = useRef(null);
  const startWatchRef    = useRef(null);
  const playTrackRef     = useRef(null);

  const setStatusSafe    = useCallback((s) => { statusRef.current = s; setStatus(s); }, []);
  const setErrorCodeSafe = useCallback((c) => { errorCodeRef.current = c; setErrorCode(c); }, []);

  useEffect(() => { selectedRef.current   = selectedTrack; }, [selectedTrack]);
  useEffect(() => { candidatesRef.current = candidates;    }, [candidates]);

  // ── playTrackOnDevice ───────────────────────────────────
  const playTrackOnDevice = useCallback(async (track, signal) => {
    const tok = tokenRef.current;
    let did   = deviceIdRef.current || activeDeviceRef.current;
    if (!tok || !did) return false;
    try {
      const s = await sp("GET", "https://api.spotify.com/v1/me/player", tok, undefined, signal);
      if (s?.data?.device?.id && s.data.device.id !== did) {
        await sp("PUT", "https://api.spotify.com/v1/me/player", tok, { device_ids: [did], play: false }, signal);
        await new Promise(r => setTimeout(r, 300));
      }
    } catch {}
    if (signal?.aborted) return false;
    const r = await sp("PUT", `https://api.spotify.com/v1/me/player/play?device_id=${did}`,
      tok, { uris: [track.uri], position_ms: 0 }, signal);
    return r?.ok ?? false;
  }, [tokenRef, deviceIdRef, activeDeviceRef]);

  // ── Wire stable fn refs ONCE on mount ──────────────────
  // These never re-run so interval closures always call the latest logic
  // via the refs themselves (which ARE updated each render via the refs above)
  useEffect(() => {
    pickNextRef.current = () => {
      const unplayed = candidatesRef.current.filter(t => !playedIdsRef.current.has(t.id));
      if (!unplayed.length) {
        // Queue exhausted — rotate to next query for the same emotion (or apply pending)
        const em = pendingEmotionRef.current ?? queueEmotionRef.current ?? prevEmotionRef.current;
        if (em) {
          pendingEmotionRef.current = null;
          // Keep prevEmotionRef set to em so the emotion-change effect sees
          // emotion === prevEmotionRef and does NOT double-trigger the pipeline.
          prevEmotionRef.current = em;
          playedIdsRef.current.clear();
          // queryAttemptRef is NOT reset here so we rotate to the next query string
          runPipelineRef.current?.(em);
        }
        return null;
      }
      return unplayed[Math.floor(Math.random() * unplayed.length)];
    };

    stopWatchRef.current = () => {
      if (trackWatchRef.current) {
        clearInterval(trackWatchRef.current);
        trackWatchRef.current = null;
      }
      // NOTE: intentionally do NOT reset lastPositionRef/lastDurationRef here.
      // They must survive across watcher restarts so natural-end detection
      // (paused + position < 500 + lastPosition > 2000) still works correctly.
    };

    playNextRef.current = () => {
      if (playNextLockRef.current) return;
      playNextLockRef.current = true;
      stopWatchRef.current();

      // If emotion changed while a song was playing, apply it now at the track boundary
      const pending = pendingEmotionRef.current;
      if (pending && pending !== queueEmotionRef.current) {
        pendingEmotionRef.current = null;
        playedIdsRef.current.clear();
        queryAttemptRef.current = 0;
        prevEmotionRef.current = null;
        playNextLockRef.current = false;
        runPipelineRef.current?.(pending);
        return;
      }
      pendingEmotionRef.current = null;

      const next = pickNextRef.current();
      if (next) {
        playedIdsRef.current.add(next.id);
        setSelectedTrack(next);
        selectedRef.current = next;
        setStatusSafe("initiating");
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        playTrackRef.current(next, ctrl.signal).then(ok => {
          playNextLockRef.current = false;
          if (!ok && statusRef.current === "initiating") {
            setStatusSafe("error");
            setErrorMsg("Could not play next track");
          }
        });
      } else {
        // pickNext already handles queue exhaustion via re-search
        playNextLockRef.current = false;
      }
    };

    startWatchRef.current = () => {
      stopWatchRef.current();
      if (!playerRef?.current) return;

      // One-shot flag: once we schedule the next track, no further ticks should act
      let scheduledNext = false;

      trackWatchRef.current = setInterval(async () => {
        // Hard guards: if a transition is already in flight or already scheduled, bail immediately
        if (playNextLockRef.current || scheduledNext) return;
        try {
          const state = await playerRef.current.getCurrentState();
          if (!state) return;
          // Re-check after the async wait — state may have changed
          if (playNextLockRef.current || scheduledNext) return;

          const { position, duration, paused } = state;

          // Natural track end: Spotify pauses at position ~0 after having advanced
          if (paused && position < 500 && lastPositionRef.current > 2000 && lastDurationRef.current > 5000) {
            scheduledNext = true;
            stopWatchRef.current();
            playNextRef.current();
            return;
          }

          // Only update position tracking while actively playing
          if (!paused) {
            lastPositionRef.current = position;
            lastDurationRef.current = duration;
          }

          if (statusRef.current !== "playing") { stopWatchRef.current(); return; }

          // Within last 3s — schedule next at the exact moment the song ends
          const remaining = duration - position;
          if (!paused && duration > 5000 && remaining > 0 && remaining < 3000) {
            scheduledNext = true;
            stopWatchRef.current();
            // Wait until the song actually ends, then allow 200ms for Spotify state to settle
            setTimeout(() => {
              if (!playNextLockRef.current) playNextRef.current();
            }, remaining + 200);
          }
        } catch {}
      }, 1000);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← EMPTY DEPS: runs once on mount, never re-runs

  // Keep playTrackRef current (it depends on playTrackOnDevice which is stable)
  useEffect(() => { playTrackRef.current = playTrackOnDevice; }, [playTrackOnDevice]);

  // ── Pause / resume ──────────────────────────────────────
  useEffect(() => {
    if (statusRef.current === "playing" && externalIsPaused)  setStatusSafe("paused");
    if (statusRef.current === "paused"  && !externalIsPaused) setStatusSafe("playing");
  }, [externalIsPaused, setStatusSafe]);

  // ── initiating → playing ────────────────────────────────
  // Spotify SDK fires player_state_changed when track begins playing,
  // which updates externalCurrentTrack and externalIsPaused.
  // We use this as confirmation that playback started, then transition to "playing".
  // startWatch is NOT called here — runPipeline's 800ms timeout is the single
  // source of that call to prevent double-start race conditions.
  useEffect(() => {
    if (statusRef.current !== "initiating") return;
    if (externalIsPaused || !externalCurrentTrack) return;
    clearTimeout(timeoutRef.current);
    setStatusSafe("playing");
    // connectSpotifyPlayer is handled by useSpotify's player_state_changed listener
    // startWatch is already scheduled by runPipeline's 800ms timeout — don't double-call
  }, [externalIsPaused, externalCurrentTrack, setStatusSafe]);

  // ── Track change (user skip / Spotify auto-advance) ─────
  useEffect(() => {
    if (!enabled) return;
    if (statusRef.current !== "playing" && statusRef.current !== "paused" && statusRef.current !== "initiating") return;
    const currId = externalCurrentTrack?.id;
    const prevId = selectedRef.current?.id;
    if (!currId || currId === prevId) return;
    setSelectedTrack(externalCurrentTrack);
    selectedRef.current = externalCurrentTrack;
    playedIdsRef.current.add(currId);
    playNextLockRef.current = false;
    lastPositionRef.current = -1;
    lastDurationRef.current = 0;
    if (!externalIsPaused) {
      setStatusSafe("playing");
      setTimeout(() => startWatchRef.current?.(), 500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalCurrentTrack?.id]);

  // ── Main pipeline ───────────────────────────────────────
  const runPipeline = useCallback(async (targetEmotion) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    clearTimeout(timeoutRef.current);
    stopWatchRef.current?.();
    playNextLockRef.current = false;

    const tok = tokenRef.current;
    if (!tok) {
      setStatusSafe("no_spotify"); setErrorMsg("Connect Spotify to enable audio playback");
      setErrorCodeSafe("no_token"); return;
    }

    setSearchQuery((EMOTION_QUERIES[targetEmotion] ?? EMOTION_QUERIES.neutral)[queryAttemptRef.current % 4]);
    setStatusSafe("searching");
    setErrorMsg(null); setErrorCodeSafe(null);

    let tracks;
    try {
      tracks = await searchEmotionTracks(tok, targetEmotion, abortRef.current.signal, queryAttemptRef.current % 4);
      queryAttemptRef.current++; // rotate query next time
    } catch (e) {
      if (e.name === "AbortError") return;
      setStatusSafe("error"); setErrorMsg("Spotify search failed"); setErrorCodeSafe("search"); return;
    }
    if (abortRef.current?.signal.aborted) return;

    if (tracks?.tokenExpired) {
      setStatusSafe("no_spotify"); setErrorMsg("Spotify session expired — reconnect");
      setErrorCodeSafe("no_token"); return;
    }
    if (!tracks?.length) {
      setStatusSafe("error"); setErrorMsg(`No tracks found for "${targetEmotion}" mood`);
      setErrorCodeSafe("search"); return;
    }

    const fresh = tracks.filter(t => !playedIdsRef.current.has(t.id));
    const queue = fresh.length > 0 ? fresh : tracks;
    if (!fresh.length) playedIdsRef.current.clear();

    setCandidates(tracks);
    candidatesRef.current   = tracks;
    queueEmotionRef.current = targetEmotion;

    // Pick from ALL unplayed tracks (not just top 5) for variety
    const track = queue[Math.floor(Math.random() * queue.length)];
    playedIdsRef.current.add(track.id);
    setSelectedTrack(track);
    selectedRef.current = track;
    setStatusSafe("selected");

    if (!hasPremium) {
      setStatusSafe("no_spotify"); setErrorMsg("Spotify Premium required for autoplay");
      setErrorCodeSafe("no_premium"); return;
    }

    let did = deviceIdRef.current || activeDeviceRef.current;
    if (!did) {
      did = await new Promise(resolve => {
        let elapsed = 0;
        const iv = setInterval(() => {
          const d = deviceIdRef.current || activeDeviceRef.current;
          if (d || abortRef.current?.signal.aborted) { clearInterval(iv); resolve(d ?? null); return; }
          elapsed += 300;
          if (elapsed >= 8000) { clearInterval(iv); resolve(null); }
        }, 300);
      });
    }
    if (abortRef.current?.signal.aborted) return;
    if (!did) {
      setStatusSafe("error"); setErrorMsg("No Spotify player active — open Spotify first");
      setErrorCodeSafe("no_device"); return;
    }

    setStatusSafe("initiating");
    const ok = await playTrackOnDevice(track, abortRef.current.signal);
    if (abortRef.current?.signal.aborted) return;
    if (!ok) {
      setStatusSafe("error"); setErrorMsg("Playback failed — check Spotify connection");
      setErrorCodeSafe("playback"); return;
    }

    timeoutRef.current = setTimeout(() => {
      if (statusRef.current !== "initiating") return;
      setStatusSafe("playing");
      setTimeout(() => startWatchRef.current?.(), 500);
    }, 800);

  }, [tokenRef, deviceIdRef, activeDeviceRef, hasPremium, setStatusSafe, setErrorCodeSafe,
      connectSpotifyPlayer, playerRef, playTrackOnDevice]);

  useEffect(() => { runPipelineRef.current = runPipeline; }, [runPipeline]);

  // ── React to emotion changes ────────────────────────────
  useEffect(() => {
    prevEnabledRef.current = enabled;

    if (!enabled) {
      if (statusRef.current !== "playing" && statusRef.current !== "paused") {
        abortRef.current?.abort();
        clearTimeout(timeoutRef.current);
        stopWatchRef.current?.();
        setStatusSafe("idle"); setCandidates([]);
      }
      return;
    }
    if (!emotion) {
      if (statusRef.current !== "playing" && statusRef.current !== "paused") {
        abortRef.current?.abort();
        clearTimeout(timeoutRef.current);
        stopWatchRef.current?.();
        setStatusSafe("idle"); setCandidates([]);
      }
      return;
    }

    const PLAYING = new Set(["playing", "paused"]);
    const HEALTHY = new Set(["searching", "selected", "initiating", "playing", "paused"]);
    // Same emotion + pipeline healthy = do nothing — prevents restart on webcam re-emit
    if (emotion === prevEmotionRef.current && HEALTHY.has(statusRef.current)) return;

    // ── Key behaviour: if a song is actively playing/paused, never interrupt it.
    // Store the new emotion and apply it at the next track boundary (in playNextRef).
    if (PLAYING.has(statusRef.current) && emotion !== prevEmotionRef.current) {
      pendingEmotionRef.current = emotion;
      return;
    }

    // Not currently playing — start pipeline immediately
    if (emotion !== prevEmotionRef.current) {
      playedIdsRef.current.clear();
      queueEmotionRef.current = null;
      playNextLockRef.current = false;
      queryAttemptRef.current = 0;
      pendingEmotionRef.current = null;
      stopWatchRef.current?.();
    }

    prevEmotionRef.current = emotion;
    runPipelineRef.current(emotion);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emotion, enabled, setStatusSafe]);

  // ── Auto-play when device becomes available ─────────────
  useEffect(() => {
    if (!deviceId) return;
    const isStuck =
      (statusRef.current === "no_spotify" && errorCodeRef.current === "no_device") ||
      (statusRef.current === "error"      && errorCodeRef.current === "no_device") ||
      (statusRef.current === "idle"       && !!emotion && !prevEmotionRef.current);
    if (!isStuck) return;
    const em = pendingEmotionRef.current ?? prevEmotionRef.current ?? emotion;
    if (em) {
      pendingEmotionRef.current = null;
      prevEmotionRef.current = null;
      setTimeout(() => runPipelineRef.current?.(em), 200);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  // ── Retry ───────────────────────────────────────────────
  const retry = useCallback(() => {
    const em = prevEmotionRef.current;
    if (em) { prevEmotionRef.current = null; runPipelineRef.current(em); }
  }, []);

  // ── Manual track select ─────────────────────────────────
  const playTrackManual = useCallback(async (uri, trackObj) => {
    const tok = tokenRef.current;
    if (!tok || !hasPremium) return;
    let did = deviceIdRef.current || activeDeviceRef.current;
    if (!did) {
      did = await new Promise(resolve => {
        let elapsed = 0;
        const iv = setInterval(() => {
          const d = deviceIdRef.current || activeDeviceRef.current;
          if (d) { clearInterval(iv); resolve(d); return; }
          elapsed += 300;
          if (elapsed >= 4000) { clearInterval(iv); resolve(null); }
        }, 300);
      });
    }
    if (!did) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    clearTimeout(timeoutRef.current);
    stopWatchRef.current?.();
    playNextLockRef.current = false;
    setSelectedTrack(trackObj);
    selectedRef.current = trackObj;
    if (trackObj?.id) playedIdsRef.current.add(trackObj.id);
    setStatusSafe("initiating");
    const ok = await playTrackOnDevice(trackObj, abortRef.current.signal);
    if (!ok) { setStatusSafe("error"); setErrorMsg("Playback failed"); return; }
    timeoutRef.current = setTimeout(() => {
      if (statusRef.current === "initiating") {
        setStatusSafe("playing");
        setTimeout(() => startWatchRef.current?.(), 500);
      }
    }, 800);
  }, [tokenRef, deviceIdRef, activeDeviceRef, hasPremium, setStatusSafe, playTrackOnDevice]);

  // ── Cleanup ─────────────────────────────────────────────
  useEffect(() => () => {
    abortRef.current?.abort();
    clearTimeout(timeoutRef.current);
    stopWatchRef.current?.();
  }, []);

  return { status, selectedTrack, candidates, errorMsg, errorCode, searchQuery, retry, playTrackManual };
}
