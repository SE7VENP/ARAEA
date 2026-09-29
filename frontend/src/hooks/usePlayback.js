/**
 * usePlayback  (FIXED v2)
 *
 * Manages playback extras that don't belong in useSpotify:
 *  - Lyrics fetching (Lyrics.ovh)
 *  - Sleep timer (countdown → auto-pause)
 *  - Spotify recommendations (search by emotion/scene)
 *  - Track search with debounce + AbortController
 *
 * FIXES vs v1:
 *   1. fetchRecommendations debounce is now per-emotion-key, not wall-clock time.
 *      v1 used a single lastFetchRef timestamp with a 25s cooldown. This meant:
 *        a) On first load the 25s hadn't elapsed — calls silently bailed.
 *        b) If emotion changed within 25s of a prior call the change was ignored.
 *        c) After the 3-min manual lock expired, socket neutral overrode the emotion,
 *           triggering a "neutral" rec-fetch even though user had just been on "happy".
 *      Fix: track lastFetchedEmotion. Skip the fetch only when emotion+scene haven't
 *      changed since the last successful fetch. A hard 5s cooldown prevents
 *      true rapid-fire bursts while still responding to meaningful changes.
 *   2. searchAPI.tracks limit param is passed correctly (was 20, which is fine and
 *      matches the backend's default — no change needed there).
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { fetchLyrics }    from "../services/lyricsAPI.js";
import { search as searchAPI, normaliseTrack, dedupTracks } from "../services/spotifyAPI.js";

// Emotion/scene → search query bank (mirrors useAudioPipeline)
const EMOTION_QUERIES = {
  euphoric:    "euphoria dance",
  happy:       "happy feel good",
  calm:        "calm ambient relaxing",
  melancholic: "melancholic indie",
  tense:       "intense cinematic",
  sad:         "sad emotional songs",
  neutral:     "top pop hits",
  energetic:   "high energy workout",
  surprised:   "exciting upbeat pop",
  fearful:     "dark atmospheric",
  angry:       "hard rock metal",
};
const SCENE_QUERIES = {
  focus:  "focus study concentration",  party:   "party dance hits",
  sleep:  "sleep calm relaxing",         workout: "gym power workout",
  cosmic: "cosmic space ambient",        jazz:    "smooth jazz",
  wakeup: "morning energy",              relax:   "chill relaxing lofi",
};

/**
 * @param {{ tokenRef: React.RefObject, currentTrack: object|null,
 *            isPaused: boolean, onPause: ()=>void }} opts
 */
export function usePlayback({ tokenRef, currentTrack, isPaused, onPause }) {
  // ── Lyrics ─────────────────────────────────────────────
  const [lyrics,        setLyrics]        = useState(null);
  const [showLyrics,    setShowLyrics]    = useState(false);
  const [lyricsLoading, setLyricsLoading] = useState(false);

  useEffect(() => {
    if (!currentTrack?.name || !currentTrack?.artist) return;
    setLyrics(null);
    setLyricsLoading(true);
    let cancelled = false;
    const ctrl    = new AbortController();
    fetchLyrics(currentTrack.artist, currentTrack.name, ctrl.signal)
      .then(text => { if (!cancelled) setLyrics(text); })
      .finally(() => { if (!cancelled) setLyricsLoading(false); });
    return () => { cancelled = true; ctrl.abort(); };
  }, [currentTrack?.id]);

  // ── Sleep timer ────────────────────────────────────────
  const [sleepMins, setSleepMins] = useState(null);
  const [sleepSecs, setSleepSecs] = useState(null);

  useEffect(() => {
    if (sleepSecs == null || sleepSecs <= 0) return;
    const t = setTimeout(() => setSleepSecs(s => (s != null && s > 0 ? s - 1 : 0)), 1000);
    return () => clearTimeout(t);
  }, [sleepSecs]);

  useEffect(() => {
    if (sleepSecs !== 0) return;
    onPause?.();
    setSleepMins(null);
    setSleepSecs(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sleepSecs]);

  const startSleepTimer = useCallback((minutes) => {
    setSleepMins(minutes);
    setSleepSecs(minutes * 60);
  }, []);

  const cancelSleepTimer = useCallback(() => {
    setSleepMins(null);
    setSleepSecs(null);
  }, []);

  // ── Recommendations ────────────────────────────────────
  const [recommendations, setRecommendations] = useState([]);

  // FIX: replace single timestamp debounce with a per-key dedup + minimal cooldown.
  // lastFetchKeyRef stores "emotion::scene" of the last successful fetch, so we
  // skip only when the effective query hasn't changed, not based on wall-clock time.
  // lastFetchTimeRef provides a 5s hard cooldown to prevent rapid-fire bursts.
  const lastFetchKeyRef  = useRef(null);
  const lastFetchTimeRef = useRef(0);

  const fetchRecommendations = useCallback(async (emotion = "neutral", scene = null) => {
    const tok = tokenRef.current;
    if (!tok) return;

    const key = `${emotion ?? "neutral"}::${scene ?? ""}`;
    const now = Date.now();

    // Skip if same emotion+scene was already fetched (unless 5 min has passed for a refresh)
    if (key === lastFetchKeyRef.current && now - lastFetchTimeRef.current < 5 * 60 * 1000) return;
    // Hard cooldown: never fire more than once per 5s regardless of key
    if (now - lastFetchTimeRef.current < 5_000) return;

    lastFetchKeyRef.current  = key;
    lastFetchTimeRef.current = now;

    try {
      const q = (scene && SCENE_QUERIES[scene]) ?? EMOTION_QUERIES[emotion] ?? "popular songs";
      const { data } = await searchAPI.tracks(tok, q, 20);
      if (!data?.tracks?.items?.length) return;

      const tracks = dedupTracks(data.tracks.items)
        .filter(t => t.uri && t.name)
        .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
        .slice(0, 10)
        .map(normaliseTrack);

      if (tracks.length) setRecommendations(tracks);
    } catch (e) {
      console.warn("[usePlayback] fetchRecommendations error:", e.message);
      // On error, clear the key so the next call retries instead of being silently skipped
      if (lastFetchKeyRef.current === key) lastFetchKeyRef.current = null;
    }
  }, [tokenRef]);

  // ── Track search (debounced + abortable) ──────────────
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching,   setIsSearching]   = useState(false);
  const searchTimerRef = useRef(null);
  const searchAbortRef = useRef(null);

  const handleSearchInput = useCallback((query) => {
    setSearchQuery(query);
    clearTimeout(searchTimerRef.current);
    if (!query.trim()) { setSearchResults([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      const tok = tokenRef.current;
      if (!tok) return;
      searchAbortRef.current?.abort();
      searchAbortRef.current = new AbortController();
      setIsSearching(true);
      try {
        const { data } = await searchAPI.tracks(tok, query, 20, searchAbortRef.current.signal);
        if (data?.tracks?.items) {
          setSearchResults(dedupTracks(data.tracks.items).map(normaliseTrack));
        }
      } catch (e) {
        if (e.name !== "AbortError") console.warn("[search]", e.message);
      } finally {
        setIsSearching(false);
      }
    }, 800);
  }, [tokenRef]);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setSearchResults([]);
    clearTimeout(searchTimerRef.current);
    searchAbortRef.current?.abort();
  }, []);

  return {
    // Lyrics
    lyrics, showLyrics, setShowLyrics, lyricsLoading,
    // Sleep timer
    sleepMins, sleepSecs, startSleepTimer, cancelSleepTimer,
    // Recommendations
    recommendations, setRecommendations, fetchRecommendations,
    // Search
    searchQuery, searchResults, isSearching,
    handleSearchInput, clearSearch,
  };
}