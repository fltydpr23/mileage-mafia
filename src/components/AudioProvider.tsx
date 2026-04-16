"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export type Track = {
  id: string;
  title: string;
  artist?: string;
  src: string;
};

export type StationId = "techno" | "tamil" | "hiphop";

export const STATION_LABELS: Record<StationId, string> = {
  techno: "TECHNO BNKR",
  tamil: "TAMIL HEAT",
  hiphop: "BEAST MODE HIP HOP",
};

type AudioApi = {
  playing: boolean;
  unlocked: boolean;
  current: Track;
  currentTime: number;
  duration: number;
  volume: number;
  activeStationId: StationId;

  setVolume: (v: number) => void;
  seek: (sec: number) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  unlock: () => Promise<void>;
  recover: () => Promise<void>;

  /** Start playback of a station (or restart current station from track 0) */
  startStation: (stationId: StationId) => Promise<void>;
  /** Switch station mid-session (used from leaderboard picker) */
  changeStation: (stationId: StationId) => void;
};

// ─────────────────────────────────────────────
// Playlists — exactly the files on disk
// ─────────────────────────────────────────────
export const PLAYLISTS: Record<StationId, Track[]> = {
  techno: [
    { id: "tc1", title: "No Return",        artist: "Artificial Intelligence", src: "/audio/techno bunker/Artificial Intelligence - No Return.mp3" },
    { id: "tc2", title: "Katana Zero OST",  artist: "LudoWic",                 src: "/audio/techno bunker/noir1.mp3" },
    { id: "tc3", title: "Voyager",          artist: "Jasper Byrne",            src: "/audio/techno bunker/noir2.mp3" },
    { id: "tc4", title: "Spoiler",          artist: "Hyper",                   src: "/audio/techno bunker/noir3.mp3" },
    { id: "tc5", title: "Nightrider",       artist: "Kavinsky",                src: "/audio/techno bunker/noir1.mp3" },
  ],
  tamil: [
    { id: "t1", title: "Lokiverse",  artist: "Anirudh",     src: "/audio/tamil heat/Anirudh - Lokiverse.mp3" },
    { id: "t2", title: "Powerhouse", artist: "Anirudh",     src: "/audio/tamil heat/Anirudh - Powerhouse.mp3" },
    { id: "t3", title: "Poongatru",  artist: "Raaja Beats", src: "/audio/tamil heat/RAAJA BEATS - POONGATRU.mp3" },
    { id: "t4", title: "Lokiverse (reprise)", artist: "Anirudh", src: "/audio/tamil heat/Anirudh - Lokiverse.mp3" },
    { id: "t5", title: "Powerhouse (reprise)", artist: "Anirudh", src: "/audio/tamil heat/Anirudh - Powerhouse.mp3" },
  ],
  hiphop: [
    { id: "h1", title: "HELICOPTER",  artist: "A$AP Rocky",                     src: "/audio/beast mode hiphop/A$AP Rocky - HELICOPTER (Visualizer).mp3" },
    { id: "h2", title: "House Money", artist: "Baby Keem",                       src: "/audio/beast mode hiphop/Baby Keem - House Money.mp3" },
    { id: "h3", title: "Cinderella",  artist: "Future, Metro Boomin & Travis",   src: "/audio/beast mode hiphop/Future, Metro Boomin & Travis Scott - Cinderella.mp3" },
    { id: "h4", title: "ALL THE LOVE",artist: "YE feat. ANDRÉ TROUTMAN",         src: "/audio/beast mode hiphop/YE - ALL THE LOVE (feat. ANDRÉ TROUTMAN).mp3" },
    { id: "h5", title: "HELICOPTER (reprise)", artist: "A$AP Rocky",             src: "/audio/beast mode hiphop/A$AP Rocky - HELICOPTER (Visualizer).mp3" },
  ],
};

const FALLBACK_TRACK: Track = { id: "none", title: "—", artist: "Mileage Mafia Radio", src: "" };
const DEFAULT_STATION: StationId = "techno";
const STORAGE_KEY = "mm_radio_station";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function clamp01(n: number) { return Math.max(0, Math.min(1, n)); }
function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

function readStation(): StationId {
  if (typeof window === "undefined") return DEFAULT_STATION;
  const raw = localStorage.getItem(STORAGE_KEY);
  return (raw && raw in PLAYLISTS) ? (raw as StationId) : DEFAULT_STATION;
}

/** One singleton <audio> that survives route changes / HMR */
function getSingletonAudio(): HTMLAudioElement {
  const g = globalThis as any;
  if (g.__mm_audio_el) return g.__mm_audio_el as HTMLAudioElement;
  const a = new Audio();
  a.preload = "auto";
  a.crossOrigin = "anonymous";
  a.loop = false;
  try {
    (a as any).playsInline = true;
    a.setAttribute("playsinline", "true");
    a.setAttribute("webkit-playsinline", "true");
  } catch {}
  g.__mm_audio_el = a;
  return a;
}

// ─────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────
const AudioCtx = createContext<AudioApi | null>(null);

// ─────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────
export function AudioProvider({ children }: { children: React.ReactNode }) {
  const audioEl = useRef<HTMLAudioElement | null>(null);
  const opId     = useRef(0);

  // ---- source-of-truth refs (never stale in callbacks) ----
  const stationRef = useRef<StationId>(DEFAULT_STATION);  // updated synchronously
  const trackIdx   = useRef(0);

  // ---- React state (drives UI only) ----
  const [activeStationId, setActiveStationId] = useState<StationId>(DEFAULT_STATION);
  const [current,  setCurrent]  = useState<Track>(FALLBACK_TRACK);
  const [playing,  setPlaying]  = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,    setDuration]    = useState(0);
  const [volume,      setVolumeState] = useState(0.9);
  const volumeRef = useRef(0.9);

  // ─── init once ───────────────────────────────────────────
  useEffect(() => {
    const a = getSingletonAudio();
    audioEl.current = a;
    a.volume = volumeRef.current;

    // ── Read saved station ONCE, synchronously, at mount ──
    // Only apply it if audio is idle (not already playing from Gateway nav).
    // If it IS playing, stationRef was already set correctly by startStation().
    if (a.paused && !a.src) {
      const savedStation = readStation();
      stationRef.current = savedStation;
      setActiveStationId(savedStation);
      const first = PLAYLISTS[savedStation][0];
      if (first?.src) {
        a.src = first.src;
        try { a.load(); } catch {}
      }
    } else if (!a.paused) {
      // Audio is already playing — just sync UI state from stationRef which
      // startStation() already set correctly.
      setActiveStationId(stationRef.current);
    } else if (a.src) {
      // Audio has a src but is paused — keep stationRef as-is, just sync UI.
      setActiveStationId(stationRef.current);
    }

    // Sync current track display from active station
    const list  = PLAYLISTS[stationRef.current];
    const track = list[trackIdx.current] ?? list[0] ?? FALLBACK_TRACK;
    setCurrent(track);

    const onPlay  = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime  = () => setCurrentTime(Number.isFinite(a.currentTime) ? a.currentTime : 0);
    const onMeta  = () => setDuration(Number.isFinite(a.duration) ? a.duration : 0);
    const onEnded = () => {
      const list = PLAYLISTS[stationRef.current];
      const next = (trackIdx.current + 1) % list.length;
      void playTrackAt(next);
    };

    a.addEventListener("play",            onPlay);
    a.addEventListener("pause",           onPause);
    a.addEventListener("timeupdate",      onTime);
    a.addEventListener("loadedmetadata",  onMeta);
    a.addEventListener("durationchange",  onMeta);
    a.addEventListener("ended",           onEnded);

    setPlaying(!a.paused);
    setCurrentTime(Number.isFinite(a.currentTime) ? a.currentTime : 0);
    setDuration(Number.isFinite(a.duration)        ? a.duration    : 0);

    return () => {
      a.removeEventListener("play",           onPlay);
      a.removeEventListener("pause",          onPause);
      a.removeEventListener("timeupdate",     onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("durationchange", onMeta);
      a.removeEventListener("ended",          onEnded);
      // NOTE: intentionally NOT pausing — audio must survive route changes
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── volume sync ─────────────────────────────────────────
  useEffect(() => {
    volumeRef.current = volume;
    if (audioEl.current) audioEl.current.volume = clamp01(volume);
  }, [volume]);

  // ─── core: load a specific track index into <audio> and play ─
  const playTrackAt = useCallback(async (idx: number): Promise<void> => {
    const a = audioEl.current;
    if (!a) return;
    const id = ++opId.current;

    const list  = PLAYLISTS[stationRef.current];
    const safeIdx = ((idx % list.length) + list.length) % list.length;
    const track = list[safeIdx];
    if (!track?.src) return;

    trackIdx.current = safeIdx;
    setCurrent(track);

    if (a.src !== location.origin + track.src && a.src !== track.src) {
      try { a.pause(); } catch {}
      a.src = track.src;
      try { a.load(); } catch {}
    }

    a.volume = clamp01(volumeRef.current);

    try {
      a.muted = false;
      await a.play();
      if (id !== opId.current) return;
      setPlaying(true);
    } catch (err) {
      console.warn("[AudioProvider] play blocked:", err);
    }
  }, []);

  // ─── public: unlock (browser gesture gate) ───────────────
  const unlock = useCallback(async () => {
    const a = audioEl.current;
    if (!a) return;
    const prevVol = a.volume;
    try {
      a.muted = false;
      a.volume = 0;
      await a.play();
      a.pause();
    } catch {}
    try { a.volume = prevVol; } catch {}
    setUnlocked(true);
  }, []);

  // ─── public: start a station (called from Gateway on select) ─
  const startStation = useCallback(async (stationId: StationId): Promise<void> => {
    // 1. Persist synchronously BEFORE updating any state
    localStorage.setItem(STORAGE_KEY, stationId);
    // 2. Update refs synchronously
    stationRef.current = stationId;
    trackIdx.current   = 0;
    // 3. Update React state for UI
    setActiveStationId(stationId);
    // 4. Play
    await playTrackAt(0);
  }, [playTrackAt]);

  // ─── public: change station mid-session ──────────────────
  const changeStation = useCallback((stationId: StationId) => {
    localStorage.setItem(STORAGE_KEY, stationId);
    stationRef.current = stationId;
    trackIdx.current   = 0;
    setActiveStationId(stationId);

    const a = audioEl.current;
    const wasPlaying = a ? !a.paused : false;

    if (a) {
      try { a.pause(); } catch {}
      const firstTrack = PLAYLISTS[stationId][0];
      a.src = firstTrack?.src || "";
      try { a.load(); } catch {}
      setCurrent(firstTrack ?? FALLBACK_TRACK);
    }

    if (wasPlaying) {
      void playTrackAt(0);
    } else {
      setCurrent(PLAYLISTS[stationId][0] ?? FALLBACK_TRACK);
    }
  }, [playTrackAt]);

  // ─── (secondary mount sync removed — merged into init effect above) ───

  // ─── public controls ─────────────────────────────────────
  const toggle = useCallback(() => {
    const a = audioEl.current;
    if (!a) return;
    if (!a.paused) {
      try { a.pause(); } catch {}
      setPlaying(false);
    } else {
      const id = ++opId.current;
      a.volume = clamp01(volumeRef.current);
      a.play().then(() => {
        if (id === opId.current) setPlaying(true);
      }).catch(() => {});
    }
  }, []);

  const next = useCallback(() => {
    const list = PLAYLISTS[stationRef.current];
    void playTrackAt((trackIdx.current + 1) % list.length);
  }, [playTrackAt]);

  const prev = useCallback(() => {
    const list = PLAYLISTS[stationRef.current];
    void playTrackAt((trackIdx.current - 1 + list.length) % list.length);
  }, [playTrackAt]);

  const seek = useCallback((sec: number) => {
    const a = audioEl.current;
    if (!a) return;
    const d = Number.isFinite(a.duration) ? a.duration : 0;
    const clamped = clamp(sec, 0, d);
    try { a.currentTime = clamped; } catch {}
    setCurrentTime(clamped);
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(clamp01(v));
  }, []);

  const recover = useCallback(async () => {
    const a = audioEl.current;
    if (!a) return;
    try { await unlock(); } catch {}
    a.volume = clamp01(volumeRef.current);
    if (playing && a.paused) {
      const id = ++opId.current;
      try { await a.play(); if (id === opId.current) setPlaying(true); } catch {}
    }
  }, [unlock, playing]);

  const api = useMemo<AudioApi>(() => ({
    playing, unlocked, current, currentTime, duration, volume, activeStationId,
    setVolume, seek, toggle, next, prev, unlock, recover,
    startStation, changeStation,
  }), [playing, unlocked, current, currentTime, duration, volume, activeStationId,
       setVolume, seek, toggle, next, prev, unlock, recover, startStation, changeStation]);

  return <AudioCtx.Provider value={api}>{children}</AudioCtx.Provider>;
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────
export function useAudio() {
  const ctx = useContext(AudioCtx);
  if (!ctx) throw new Error("useAudio must be used inside <AudioProvider>");
  return ctx;
}
