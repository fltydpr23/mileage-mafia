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
  artwork?: string;
};

type SfxName =
  | "tap"
  | "beep"
  | "deny"
  | "latch"
  | "doorSlide"
  | "paper"
  | "ink"
  | "stamp"
  | "scan"
  | "type";

type SfxOptions = {
  volume?: number; // 0..1
  rate?: number; // e.g. 0.9..1.1
  detune?: number; // cents
  randomRate?: [number, number];
  randomDetune?: [number, number];
  // Optional: if caller passes this, we can hard-stop any existing SFX voice
  // (we implement this with a tiny “voice pool” below)
  interrupt?: boolean;
};

type AudioApi = {
  playing: boolean;
  current: Track; // ALWAYS defined (safe defaults)
  currentTime: number;
  duration: number;
  volume: number;

  setVolume: (v: number) => void;
  seek: (sec: number) => void;

  play: () => Promise<void>; // alias -> playMusic()
  pause: () => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  toggle: () => void;

  playAmbience: () => Promise<void>;
  playMusic: (startIndex?: number) => Promise<void>;
  mode: "ambience" | "music";

  unlock: () => Promise<void>;
  unlocked: boolean;

  sfx: (name: SfxName, opts?: SfxOptions) => void;
  preloadSfx: () => Promise<void>;
  sfxMuted: boolean;
  setSfxMuted: (v: boolean) => void;
  toggleSfxMuted: () => void;
};

const AudioContextX = createContext<AudioApi | null>(null);

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}
function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
function randRange([a, b]: [number, number]) {
  return a + Math.random() * (b - a);
}

// ===== FILE PATHS =====
const AMBIENCE_TRACK: Track = {
  id: "ambience",
  title: "Running Ambience",
  artist: "Mileage Mafia",
  src: "/audio/footsteps.mp3",
  loop: true,
};

const MUSIC_PLAYLIST: Track[] = [
  { id: "noir1", title: "Noir 1", artist: "Mileage Mafia", src: "/audio/noir1.mp3", loop: true },
  { id: "noir2", title: "Noir 2", artist: "Mileage Mafia", src: "/audio/noir2.mp3", loop: true },
  { id: "noir3", title: "Noir 3", artist: "Mileage Mafia", src: "/audio/noir3.mp3", loop: true },
];

const SFX_MAP: Record<SfxName, string> = {
  tap: "/sfx/tap.mp3",
  beep: "/sfx/beep.mp3",
  deny: "/sfx/deny.mp3",
  latch: "/sfx/latch.mp3",
  doorSlide: "/sfx/door-slide.mp3",
  paper: "/sfx/paper.mp3",
  ink: "/sfx/ink.mp3",
  stamp: "/sfx/stamp.mp3",
  scan: "/sfx/scan.mp3",
  type: "/sfx/type.mp3",
};

const FALLBACK_TRACK: Track = {
  id: "none",
  title: "—",
  artist: "Mileage Mafia Radio",
  src: "",
  loop: true,
};

export function AudioProvider({ children }: { children: React.ReactNode }) {
  // One HTMLAudioElement for playback (ambience OR music)
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // IMPORTANT: guards async “mode switching” so the latest call wins
  const opIdRef = useRef(0);

  // mode + indices
  const [mode, setMode] = useState<"ambience" | "music">("ambience");
  const [musicIndex, setMusicIndex] = useState(0);

  // playback state
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState<Track>(AMBIENCE_TRACK);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.9);

  // ===== WebAudio for SFX =====
  const ctxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const sfxGainRef = useRef<GainNode | null>(null);
  const buffersRef = useRef<Partial<Record<SfxName, AudioBuffer>>>({});
  const preloadPromiseRef = useRef<Promise<void> | null>(null);

  // Small “voice pool” for SFX to support interrupt (prevents stamp glitches)
  const activeSfxRefs = useRef<AudioBufferSourceNode[]>([]);

  const [unlocked, setUnlocked] = useState(false);

  // Persist SFX mute
  const [sfxMuted, setSfxMutedState] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("mm_sfx_muted");
      if (saved === "1") setSfxMutedState(true);
    } catch {}
  }, []);

  const setSfxMuted = useCallback((v: boolean) => {
    const next = !!v;
    setSfxMutedState(next);
    try {
      localStorage.setItem("mm_sfx_muted", next ? "1" : "0");
    } catch {}
    const g = sfxGainRef.current;
    if (g) g.gain.value = next ? 0 : 1;
  }, []);

  const toggleSfxMuted = useCallback(() => {
    setSfxMuted(!sfxMuted);
  }, [setSfxMuted, sfxMuted]);

  // Create the HTMLAudioElement once
  useEffect(() => {
    if (audioRef.current) return;

    const a = new Audio();
    a.preload = "auto";
    a.loop = true;
    a.volume = clamp01(volume);
    a.crossOrigin = "anonymous";

    audioRef.current = a;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => setCurrentTime(Number.isFinite(a.currentTime) ? a.currentTime : 0);
    const onMeta = () => setDuration(Number.isFinite(a.duration) ? a.duration : 0);
    const onEnded = () => setPlaying(false);

    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("durationchange", onMeta);
    a.addEventListener("ended", onEnded);

    setCurrent(AMBIENCE_TRACK);

    return () => {
      try {
        a.pause();
      } catch {}
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("durationchange", onMeta);
      a.removeEventListener("ended", onEnded);
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep element volume synced
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = clamp01(volume);
  }, [volume]);

  // ---- core: guarded track load + play (latest op wins) ----
  const hardStopElement = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    try {
      a.pause();
      a.currentTime = 0;
    } catch {}
    setPlaying(false);
    setCurrentTime(0);
  }, []);

  const loadTrackGuarded = useCallback(async (t: Track, opId: number) => {
    const a = audioRef.current;
    if (!a) return;

    // If superseded, abort
    if (opId !== opIdRef.current) return;

    // If no src, stop
    if (!t.src) {
      setCurrent(t);
      setPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      try {
        a.pause();
        a.removeAttribute("src");
        a.load();
      } catch {}
      return;
    }

    // pause + swap src
    try {
      a.pause();
    } catch {}

    if (opId !== opIdRef.current) return;

    a.src = t.src;
    a.loop = t.loop !== false;
    a.currentTime = 0;

    try {
      a.load();
    } catch {}

    if (opId !== opIdRef.current) return;

    setCurrent(t);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  const doPlayGuarded = useCallback(async (opId: number) => {
    const a = audioRef.current;
    if (!a) return;
    if (!a.src) return;

    if (opId !== opIdRef.current) return;

    try {
      await a.play();
    } catch {
      // Autoplay blocked
      throw new Error("Audio blocked");
    }
  }, []);

  const pause = useCallback(() => {
    try {
      audioRef.current?.pause();
    } catch {}
  }, []);

  const stop = useCallback(() => {
    // Invalidate any in-flight async ops
    opIdRef.current += 1;
    hardStopElement();
  }, [hardStopElement]);

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

  const setVolume = useCallback((v: number) => {
    setVolumeState(clamp01(v));
  }, []);

  // ===== Mode APIs (GUARDED) =====
  const playAmbience = useCallback(async () => {
    const opId = ++opIdRef.current;

    setMode("ambience");
    // stop immediately so old audio doesn't keep running in background
    hardStopElement();

    await loadTrackGuarded(AMBIENCE_TRACK, opId);
    await doPlayGuarded(opId);
  }, [hardStopElement, loadTrackGuarded, doPlayGuarded]);

  const playMusic = useCallback(
    async (startIndex?: number) => {
      if (MUSIC_PLAYLIST.length === 0) return;

      const opId = ++opIdRef.current;

      setMode("music");
      hardStopElement();

      const idx =
        typeof startIndex === "number"
          ? ((startIndex % MUSIC_PLAYLIST.length) + MUSIC_PLAYLIST.length) % MUSIC_PLAYLIST.length
          : ((musicIndex % MUSIC_PLAYLIST.length) + MUSIC_PLAYLIST.length) % MUSIC_PLAYLIST.length;

      setMusicIndex(idx);

      await loadTrackGuarded(MUSIC_PLAYLIST[idx], opId);
      await doPlayGuarded(opId);
    },
    [hardStopElement, loadTrackGuarded, doPlayGuarded, musicIndex]
  );

  // Backward-compatible alias
  const play = useCallback(async () => {
    await playMusic();
  }, [playMusic]);

  const next = useCallback(() => {
    if (MUSIC_PLAYLIST.length === 0) return;

    if (mode !== "music") {
      void playMusic(0);
      return;
    }

    const nextIdx = (musicIndex + 1) % MUSIC_PLAYLIST.length;
    void playMusic(nextIdx);
  }, [mode, musicIndex, playMusic]);

  const prev = useCallback(() => {
    if (MUSIC_PLAYLIST.length === 0) return;

    if (mode !== "music") {
      void playMusic(0);
      return;
    }

    const prevIdx = (musicIndex - 1 + MUSIC_PLAYLIST.length) % MUSIC_PLAYLIST.length;
    void playMusic(prevIdx);
  }, [mode, musicIndex, playMusic]);

  const toggle = useCallback(() => {
    if (playing) {
      pause();
    } else {
      // replay current (guarded)
      const opId = ++opIdRef.current;
      void doPlayGuarded(opId).catch(() => {});
    }
  }, [playing, pause, doPlayGuarded]);

  // ===== iOS unlock for BOTH WebAudio + HTMLAudioElement =====
  const ensureCtx = useCallback(async () => {
    if (ctxRef.current && masterGainRef.current && sfxGainRef.current) return;

    const Ctx =
      (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    if (!Ctx) return;

    const ctx = new Ctx();
    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);

    const sfxGain = ctx.createGain();
    sfxGain.gain.value = sfxMuted ? 0 : 1;
    sfxGain.connect(master);

    ctxRef.current = ctx;
    masterGainRef.current = master;
    sfxGainRef.current = sfxGain;
  }, [sfxMuted]);

  const unlock = useCallback(async () => {
    await ensureCtx();

    const ctx = ctxRef.current;
    if (ctx && ctx.state !== "running") {
      try {
        await ctx.resume();
      } catch {}
    }

    // prime WebAudio
    try {
      const c = ctxRef.current;
      const g = sfxGainRef.current;
      if (c && g) {
        const buf = c.createBuffer(1, 1, c.sampleRate);
        const src = c.createBufferSource();
        src.buffer = buf;
        src.connect(g);
        src.start(0);
      }
    } catch {}

    // prime HTMLAudioElement
    const a = audioRef.current;
    if (a) {
      const prevVol = a.volume;
      const prevSrc = a.src;

      try {
        if (!a.src) {
          a.src = AMBIENCE_TRACK.src;
          a.loop = true;
          a.currentTime = 0;
          try {
            a.load();
          } catch {}
        }

        a.volume = 0;
        await a.play();
        a.pause();
        a.currentTime = 0;
      } catch {
      } finally {
        try {
          a.volume = prevVol;
          if (prevSrc && prevSrc !== a.src) {
            a.src = prevSrc;
            try {
              a.load();
            } catch {}
          }
        } catch {}
      }
    }

    setUnlocked(true);
  }, [ensureCtx]);

  const fetchBuffer = useCallback(async (url: string) => {
    const ctx = ctxRef.current;
    if (!ctx) return null;
    const res = await fetch(url);
    const arr = await res.arrayBuffer();
    return await ctx.decodeAudioData(arr);
  }, []);

  const preloadSfx = useCallback(async () => {
    if (preloadPromiseRef.current) return preloadPromiseRef.current;

    preloadPromiseRef.current = (async () => {
      await ensureCtx();
      const ctx = ctxRef.current;
      if (!ctx) return;

      const entries = Object.entries(SFX_MAP) as Array<[SfxName, string]>;
      await Promise.all(
        entries.map(async ([name, url]) => {
          try {
            if (buffersRef.current[name]) return;
            const b = await fetchBuffer(url);
            if (b) buffersRef.current[name] = b;
          } catch {}
        })
      );
    })();

    return preloadPromiseRef.current;
  }, [ensureCtx, fetchBuffer]);

  const sfx = useCallback(
    (name: SfxName, opts?: SfxOptions) => {
      if (sfxMuted) return;

      const ctx = ctxRef.current;
      const out = sfxGainRef.current;
      if (!ctx || !out) return;
      if (ctx.state !== "running") return;

      const buf = buffersRef.current[name];
      if (!buf) {
        void (async () => {
          try {
            const b = await fetchBuffer(SFX_MAP[name]);
            if (b) buffersRef.current[name] = b;
          } catch {}
        })();
        return;
      }

      // Interrupt mode: stop active voices (helps stamp “glitch”)
      if (opts?.interrupt) {
        try {
          activeSfxRefs.current.forEach((n) => {
            try {
              n.stop(0);
            } catch {}
          });
        } catch {}
        activeSfxRefs.current = [];
      }

      const src = ctx.createBufferSource();
      src.buffer = buf;

      const g = ctx.createGain();
      const vol = clamp01(opts?.volume ?? 0.85);

      const rate = opts?.randomRate ? randRange(opts.randomRate) : opts?.rate ?? 1.0;
      const detune = opts?.randomDetune ? randRange(opts.randomDetune) : opts?.detune ?? 0;

      src.playbackRate.value = rate;
      src.detune.value = detune;

      g.gain.value = vol;
      src.connect(g);
      g.connect(out);

      activeSfxRefs.current.push(src);
      src.onended = () => {
        activeSfxRefs.current = activeSfxRefs.current.filter((x) => x !== src);
      };

      try {
        src.start(0);
      } catch {}
    },
    [fetchBuffer, sfxMuted]
  );

  // Cleanup WebAudio
  useEffect(() => {
    return () => {
      try {
        ctxRef.current?.close();
      } catch {}
      ctxRef.current = null;
      masterGainRef.current = null;
      sfxGainRef.current = null;
      buffersRef.current = {};
      preloadPromiseRef.current = null;
      activeSfxRefs.current = [];
    };
  }, []);

  const api = useMemo<AudioApi>(
    () => ({
      playing,
      current: current ?? FALLBACK_TRACK,
      currentTime,
      duration,
      volume,

      setVolume,
      seek,

      play,
      pause,
      stop,
      next,
      prev,
      toggle,

      playAmbience,
      playMusic,
      mode,

      unlock,
      unlocked,

      sfx,
      preloadSfx,
      sfxMuted,
      setSfxMuted,
      toggleSfxMuted,
    }),
    [
      playing,
      current,
      currentTime,
      duration,
      volume,
      setVolume,
      seek,
      play,
      pause,
      stop,
      next,
      prev,
      toggle,
      playAmbience,
      playMusic,
      mode,
      unlock,
      unlocked,
      sfx,
      preloadSfx,
      sfxMuted,
      setSfxMuted,
      toggleSfxMuted,
    ]
  );

  return <AudioContextX.Provider value={api}>{children}</AudioContextX.Provider>;
}

export function useAudio() {
  const ctx = useContext(AudioContextX);
  if (!ctx) throw new Error("useAudio must be used within <AudioProvider>");
  return ctx;
}
