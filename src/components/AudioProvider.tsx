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

type Track = {
  id: string;
  title: string;
  artist?: string;
  src: string;
  loop?: boolean;
};

type AudioApi = {
  // UI state
  playing: boolean;
  unlocked: boolean;
  current: Track;
  currentTime: number;
  duration: number;
  volume: number;

  // controls
  setVolume: (v: number) => void;
  seek: (sec: number) => void;

  playMusic: (startIndex?: number) => Promise<void>;
  pause: () => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;

  // browser policy helpers
  unlock: () => Promise<void>;
  recover: () => Promise<void>;
};

const AudioContextX = createContext<AudioApi | null>(null);

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}
function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

const MUSIC_PLAYLIST: Track[] = [
  { id: "noir1", title: "Katana Zero (OST)", artist: "LudoWic", src: "/audio/noir1.mp3", loop: true },
  { id: "noir2", title: "Voyager", artist: "Jasper Byrne", src: "/audio/noir2.mp3", loop: true },
  { id: "noir3", title: "Spoiler", artist: "Hyper", src: "/audio/noir3.mp3", loop: true },
];

const FALLBACK_TRACK: Track = {
  id: "none",
  title: "—",
  artist: "Mileage Mafia Radio",
  src: "",
  loop: true,
};

// ---- singleton audio element across route changes / HMR ----
function getSingletonAudio(): HTMLAudioElement {
  const g = globalThis as any;

  if (g.__mm_noir_audio_el) return g.__mm_noir_audio_el as HTMLAudioElement;

  const a = new Audio();
  a.preload = "auto";
  a.crossOrigin = "anonymous";
  a.loop = true;

  // iOS Safari hints (TS-safe)
  try {
    (a as any).playsInline = true;
    a.setAttribute("playsinline", "true");
    a.setAttribute("webkit-playsinline", "true");
  } catch {}

  g.__mm_noir_audio_el = a;
  return a;
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [musicIndex, setMusicIndex] = useState(0);
  const musicIndexRef = useRef(0);

  const [volume, setVolumeState] = useState(0.9);
  const volumeRef = useRef(0.9);

  const [playing, setPlaying] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  const [current, setCurrent] = useState<Track>(MUSIC_PLAYLIST[0] ?? FALLBACK_TRACK);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // cancel/guard async play calls
  const opIdRef = useRef(0);

  // init + listeners once
  useEffect(() => {
    if (typeof window === "undefined") return;

    const a = getSingletonAudio();
    audioRef.current = a;

    // ensure track is set
    const t = MUSIC_PLAYLIST[musicIndexRef.current] ?? MUSIC_PLAYLIST[0];
    if (t?.src && a.src !== t.src) {
      a.src = t.src;
      a.loop = t.loop !== false;
      try {
        a.load();
      } catch {}
    }

    // apply volume
    a.volume = clamp01(volumeRef.current);

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => setCurrentTime(Number.isFinite(a.currentTime) ? a.currentTime : 0);
    const onMeta = () => setDuration(Number.isFinite(a.duration) ? a.duration : 0);

    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("durationchange", onMeta);

    // sync initial UI
    setPlaying(!a.paused);
    setCurrentTime(Number.isFinite(a.currentTime) ? a.currentTime : 0);
    setDuration(Number.isFinite(a.duration) ? a.duration : 0);

    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("durationchange", onMeta);
      // IMPORTANT: do NOT pause here (we want it to continue across route changes)
    };
  }, []);

  useEffect(() => {
    musicIndexRef.current = musicIndex;
    setCurrent(MUSIC_PLAYLIST[musicIndex] ?? FALLBACK_TRACK);
  }, [musicIndex]);

  useEffect(() => {
    volumeRef.current = volume;
    const a = audioRef.current;
    if (a) a.volume = clamp01(volume);
  }, [volume]);

  const setVolume = useCallback((v: number) => {
    setVolumeState(clamp01(v));
  }, []);

  const seek = useCallback((sec: number) => {
    const a = audioRef.current;
    if (!a) return;
    const d = Number.isFinite(a.duration) ? a.duration : 0;
    const next = clamp(sec, 0, d || 0);
    try {
      a.currentTime = next;
    } catch {}
    setCurrentTime(next);
  }, []);

  const guardedPlay = useCallback(async (a: HTMLAudioElement, opId: number) => {
    if (opId !== opIdRef.current) return;

    try {
      a.muted = false;
    } catch {}

    await a.play(); // may throw if not user gesture
    if (opId !== opIdRef.current) return;

    setPlaying(true);
  }, []);

  const playMusic = useCallback(
    async (startIndex?: number) => {
      const a = audioRef.current;
      if (!a || MUSIC_PLAYLIST.length === 0) return;

      const opId = ++opIdRef.current;

      const idx =
        typeof startIndex === "number"
          ? ((startIndex % MUSIC_PLAYLIST.length) + MUSIC_PLAYLIST.length) % MUSIC_PLAYLIST.length
          : ((musicIndexRef.current % MUSIC_PLAYLIST.length) + MUSIC_PLAYLIST.length) % MUSIC_PLAYLIST.length;

      const t = MUSIC_PLAYLIST[idx];
      if (!t?.src) return;

      setMusicIndex(idx);
      musicIndexRef.current = idx;
      setCurrent(t);

      if (a.src !== t.src) {
        try {
          a.pause();
        } catch {}
        a.src = t.src;
        a.loop = t.loop !== false;
        try {
          a.load();
        } catch {}
      }

      a.volume = clamp01(volumeRef.current);
      await guardedPlay(a, opId);

      setCurrentTime(Number.isFinite(a.currentTime) ? a.currentTime : 0);
      setDuration(Number.isFinite(a.duration) ? a.duration : 0);
    },
    [guardedPlay]
  );

  const pause = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    try {
      a.pause();
    } catch {}
    setPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;

    if (!a.paused) {
      try {
        a.pause();
      } catch {}
      setPlaying(false);
      return;
    }

    const opId = ++opIdRef.current;
    a.volume = clamp01(volumeRef.current);
    void guardedPlay(a, opId).catch(() => {});
  }, [guardedPlay]);

  const next = useCallback(() => {
    if (!MUSIC_PLAYLIST.length) return;
    const idx = (musicIndexRef.current + 1) % MUSIC_PLAYLIST.length;
    void playMusic(idx);
  }, [playMusic]);

  const prev = useCallback(() => {
    if (!MUSIC_PLAYLIST.length) return;
    const idx = (musicIndexRef.current - 1 + MUSIC_PLAYLIST.length) % MUSIC_PLAYLIST.length;
    void playMusic(idx);
  }, [playMusic]);

  // unlock must be called from a user gesture (button click)
  const unlock = useCallback(async () => {
    const a = audioRef.current;
    if (!a) return;

    try {
      (a as any).playsInline = true;
      a.setAttribute("playsinline", "true");
      a.setAttribute("webkit-playsinline", "true");
    } catch {}

    const prevVol = a.volume;
    const prevMuted = a.muted;

    try {
      a.muted = false;
      a.volume = 0;
      await a.play();
      a.pause();
    } catch {
      // if it throws, it still usually “primes” on some browsers,
      // but true unlock requires the gesture anyway.
    } finally {
      try {
        a.volume = prevVol;
        a.muted = prevMuted;
      } catch {}
    }

    setUnlocked(true);
  }, []);

  const recover = useCallback(async () => {
    const a = audioRef.current;
    if (!a) return;

    // best effort
    try {
      await unlock();
    } catch {}

    // restore volume + resume if needed
    a.volume = clamp01(volumeRef.current);
    if (playing && a.paused) {
      const opId = ++opIdRef.current;
      try {
        await guardedPlay(a, opId);
      } catch {}
    }
  }, [guardedPlay, playing, unlock]);

  const api = useMemo<AudioApi>(
    () => ({
      playing,
      unlocked,
      current: current ?? FALLBACK_TRACK,
      currentTime,
      duration,
      volume,

      setVolume,
      seek,

      playMusic,
      pause,
      toggle,
      next,
      prev,

      unlock,
      recover,
    }),
    [playing, unlocked, current, currentTime, duration, volume, setVolume, seek, playMusic, pause, toggle, next, prev, unlock, recover]
  );

  return <AudioContextX.Provider value={api}>{children}</AudioContextX.Provider>;
}

export function useAudio() {
  const ctx = useContext(AudioContextX);
  if (!ctx) throw new Error("useAudio must be used within <AudioProvider>");
  return ctx;
}
