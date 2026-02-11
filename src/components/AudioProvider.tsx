// See full implementation in prompt.
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

// -----------------------------
// Types
// -----------------------------

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
  rate?: number;
  detune?: number;
  randomRate?: [number, number];
  randomDetune?: [number, number];
  interrupt?: boolean;
};

type AudioMode = "ambience" | "music";

type DebugState = {
  mode: AudioMode;
  playing: boolean;
  unlocked: boolean;
  volume: number;
  ambience: {
    src: string;
    paused: boolean;
    muted: boolean;
    volume: number;
    currentTime: number;
    readyState: number;
  } | null;
  music: {
    src: string;
    paused: boolean;
    muted: boolean;
    volume: number;
    currentTime: number;
    readyState: number;
  } | null;
};

type AudioApi = {
  // UI
  playing: boolean;
  mode: AudioMode;
  current: Track; // always defined
  currentTime: number;
  duration: number;
  volume: number; // 0..1
  unlocked: boolean;

  // Foreground routing (NO play calls)
  setForeground: (m: AudioMode) => void;

  // Controls
  setVolume: (v: number) => void;
  seek: (sec: number) => void;

  // Playback
  play: () => Promise<void>; // alias playMusic()
  playAmbience: () => Promise<void>;
  playMusic: (startIndex?: number) => Promise<void>;
  pause: () => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  toggle: () => void;

  // Policy/unlock + reliability
  unlock: () => Promise<void>;
  recover: () => Promise<void>;
  getDebug: () => DebugState;

  // SFX
  sfx: (name: SfxName, opts?: SfxOptions) => void;
  preloadSfx: () => Promise<void>;
  sfxMuted: boolean;
  setSfxMuted: (v: boolean) => void;
  toggleSfxMuted: () => void;
};

const AudioContextX = createContext<AudioApi | null>(null);

// -----------------------------
// Helpers
// -----------------------------

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}
function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
function randRange([a, b]: [number, number]) {
  return a + Math.random() * (b - a);
}

// -----------------------------
// Tracks
// -----------------------------

const AMBIENCE_TRACK: Track = {
  id: "ambience",
  title: "Running Ambience",
  artist: "Mileage Mafia",
  src: "/audio/footsteps.mp3",
  loop: true,
};

const MUSIC_PLAYLIST: Track[] = [
  {
    id: "noir1",
    title: "Katana Zero (OST)",
    artist: "LudoWic",
    src: "/audio/noir1.mp3",
    loop: true,
  },
  {
    id: "noir2",
    title: "Voyager",
    artist: "Jasper Byrne",
    src: "/audio/noir2.mp3",
    loop: true,
  },
  {
    id: "noir3",
    title: "Spoiler",
    artist: "Hyper",
    src: "/audio/noir3.mp3",
    loop: true,
  },
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

// -----------------------------
// IMPORTANT: Singleton audio elements
// This prevents Next.js route transitions / hot reload from producing
// multiple audio engines and “UI says playing but silent”.
// -----------------------------

let __ambEl: HTMLAudioElement | null = null;
let __musEl: HTMLAudioElement | null = null;
let __elsReady = false;

function makeAudioEl() {
  const a = new Audio();
  a.preload = "auto";
  a.loop = true;
  a.crossOrigin = "anonymous";
  a.muted = false;
  a.volume = 0; // we route volume ourselves

  // iOS Safari hints (TS-safe)
  try {
    (a as any).playsInline = true;
    a.setAttribute("playsinline", "true");
    a.setAttribute("webkit-playsinline", "true");
  } catch {}

  return a;
}

function getOrCreateEls() {
  if (!__ambEl) {
    __ambEl = makeAudioEl();
    __ambEl.src = AMBIENCE_TRACK.src;
    __ambEl.loop = true;
  }
  if (!__musEl) {
    __musEl = makeAudioEl();
    __musEl.src = MUSIC_PLAYLIST[0]?.src ?? "";
    __musEl.loop = true;
  }
  __elsReady = true;
  return { amb: __ambEl, mus: __musEl };
}

// -----------------------------
// Provider
// -----------------------------

export function AudioProvider({ children }: { children: React.ReactNode }) {
  // refs into the singletons
  const ambienceRef = useRef<HTMLAudioElement | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);

  // authoritative intent
  const [mode, setMode] = useState<AudioMode>("ambience");
  const modeRef = useRef<AudioMode>("ambience");

  const [musicIndex, setMusicIndex] = useState(0);
  const musicIndexRef = useRef(0);

  const [volume, setVolumeState] = useState(0.9);
  const volumeRef = useRef(0.9);

  // UI state
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState<Track>(FALLBACK_TRACK);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [unlocked, setUnlocked] = useState(false);

  // guard async plays (latest wins)
  const opIdRef = useRef(0);

  // --------- WebAudio for SFX ---------
  const ctxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const sfxGainRef = useRef<GainNode | null>(null);
  const buffersRef = useRef<Partial<Record<SfxName, AudioBuffer>>>({});
  const preloadPromiseRef = useRef<Promise<void> | null>(null);
  const activeSfxRefs = useRef<AudioBufferSourceNode[]>([]);

  const [sfxMuted, setSfxMutedState] = useState(false);

  // Persist SFX mute
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
    toggleSfxMuted();
  }, [setSfxMuted]);

  // init singleton elements once
  useEffect(() => {
    const { amb, mus } = getOrCreateEls();
    ambienceRef.current = amb;
    musicRef.current = mus;

    // listeners on BOTH channels so UI never desyncs
    const bind = (el: HTMLAudioElement, kind: AudioMode) => {
      const onPlay = () => {
        if (modeRef.current === kind) setPlaying(true);
      };
      const onPause = () => {
        if (modeRef.current === kind) setPlaying(false);
      };
      const onTime = () => {
        if (modeRef.current !== kind) return;
        setCurrentTime(Number.isFinite(el.currentTime) ? el.currentTime : 0);
      };
      const onMeta = () => {
        if (modeRef.current !== kind) return;
        setDuration(Number.isFinite(el.duration) ? el.duration : 0);
      };
      const onEnded = () => {
        if (modeRef.current === kind) setPlaying(false);
      };

      el.addEventListener("play", onPlay);
      el.addEventListener("pause", onPause);
      el.addEventListener("timeupdate", onTime);
      el.addEventListener("loadedmetadata", onMeta);
      el.addEventListener("durationchange", onMeta);
      el.addEventListener("ended", onEnded);

      return () => {
        el.removeEventListener("play", onPlay);
        el.removeEventListener("pause", onPause);
        el.removeEventListener("timeupdate", onTime);
        el.removeEventListener("loadedmetadata", onMeta);
        el.removeEventListener("durationchange", onMeta);
        el.removeEventListener("ended", onEnded);
      };
    };

    const unbindAmb = bind(amb, "ambience");
    const unbindMus = bind(mus, "music");

    return () => {
      // do NOT pause/stop on unmount (layout should persist)
      // only unbind listeners
      try {
        unbindAmb();
        unbindMus();
      } catch {}
    };
  }, []);

  // keep refs synced
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    musicIndexRef.current = musicIndex;
  }, [musicIndex]);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  const getActiveEl = useCallback(() => {
    return modeRef.current === "music" ? musicRef.current : ambienceRef.current;
  }, []);

  // apply routing volumes: active = master volume, inactive = 0
  const applyVolumes = useCallback(() => {
    const amb = ambienceRef.current;
    const mus = musicRef.current;
    if (!amb || !mus) return;

    const v = clamp01(volumeRef.current);

    try {
      amb.muted = false;
      mus.muted = false;
    } catch {}

    if (modeRef.current === "ambience") {
      amb.volume = v;
      mus.volume = 0;
    } else {
      mus.volume = v;
      amb.volume = 0;
    }
  }, []);

  useEffect(() => {
    applyVolumes();
  }, [applyVolumes, mode, volume]);

  // keep UI “current track” consistent with intent
  useEffect(() => {
    if (mode === "ambience") {
      setCurrent(AMBIENCE_TRACK);
      const a = ambienceRef.current;
      if (a) {
        setCurrentTime(Number.isFinite(a.currentTime) ? a.currentTime : 0);
        setDuration(Number.isFinite(a.duration) ? a.duration : 0);
      }
    } else {
      const t = MUSIC_PLAYLIST[musicIndex] ?? FALLBACK_TRACK;
      setCurrent(t);
      const a = musicRef.current;
      if (a) {
        setCurrentTime(Number.isFinite(a.currentTime) ? a.currentTime : 0);
        setDuration(Number.isFinite(a.duration) ? a.duration : 0);
      }
    }
  }, [mode, musicIndex]);

  // Foreground routing (NO play calls)
  const setForeground = useCallback(
    (m: AudioMode) => {
      setMode(m);
      modeRef.current = m;
      applyVolumes();

      const active = m === "music" ? musicRef.current : ambienceRef.current;
      if (!active) return;

      setPlaying(!active.paused);
      setCurrentTime(Number.isFinite(active.currentTime) ? active.currentTime : 0);
      setDuration(Number.isFinite(active.duration) ? active.duration : 0);
    },
    [applyVolumes]
  );

  const setVolume = useCallback((v: number) => {
    setVolumeState(clamp01(v));
  }, []);

  const seek = useCallback(
    (sec: number) => {
      const a = getActiveEl();
      if (!a) return;
      const d = Number.isFinite(a.duration) ? a.duration : 0;
      const next = clamp(sec, 0, d || 0);
      try {
        a.currentTime = next;
      } catch {}
      setCurrentTime(next);
    },
    [getActiveEl]
  );

  const pause = useCallback(() => {
    try {
      ambienceRef.current?.pause();
      musicRef.current?.pause();
    } catch {}
    setPlaying(false);
  }, []);

  const stop = useCallback(() => {
    opIdRef.current += 1;
    try {
      const amb = ambienceRef.current;
      const mus = musicRef.current;
      if (amb) {
        amb.pause();
        amb.currentTime = 0;
      }
      if (mus) {
        mus.pause();
        mus.currentTime = 0;
      }
    } catch {}
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  // internal guarded play
  const guardedPlay = useCallback(async (el: HTMLAudioElement, opId: number) => {
    if (opId !== opIdRef.current) return;

    try {
      el.muted = false;
    } catch {}

    try {
      await el.play();
    } catch {
      throw new Error("Audio blocked");
    }

    if (opId !== opIdRef.current) return;
    setPlaying(true);
  }, []);

  const playAmbience = useCallback(async () => {
    const amb = ambienceRef.current;
    if (!amb) return;

    const opId = ++opIdRef.current;

    // routing first
    setForeground("ambience");

    if (amb.src !== AMBIENCE_TRACK.src) {
      try {
        amb.pause();
        amb.src = AMBIENCE_TRACK.src;
        amb.loop = true;
        amb.currentTime = 0;
        try {
          amb.load();
        } catch {}
      } catch {}
    }

    applyVolumes();
    await guardedPlay(amb, opId);
    setCurrent(AMBIENCE_TRACK);
  }, [applyVolumes, guardedPlay, setForeground]);

  const playMusic = useCallback(
    async (startIndex?: number) => {
      if (!MUSIC_PLAYLIST.length) return;
      const mus = musicRef.current;
      if (!mus) return;

      const opId = ++opIdRef.current;

      const idx =
        typeof startIndex === "number"
          ? ((startIndex % MUSIC_PLAYLIST.length) + MUSIC_PLAYLIST.length) % MUSIC_PLAYLIST.length
          : ((musicIndexRef.current % MUSIC_PLAYLIST.length) + MUSIC_PLAYLIST.length) % MUSIC_PLAYLIST.length;

      const t = MUSIC_PLAYLIST[idx];
      if (!t?.src) return;

      setMusicIndex(idx);
      musicIndexRef.current = idx;

      if (mus.src !== t.src) {
        try {
          mus.pause();
          mus.src = t.src;
          mus.loop = t.loop !== false;
          mus.currentTime = 0;
          try {
            mus.load();
          } catch {}
        } catch {}
      }

      // routing first
      setForeground("music");

      applyVolumes();
      await guardedPlay(mus, opId);
      setCurrent(t);
    },
    [applyVolumes, guardedPlay, setForeground]
  );

  const play = useCallback(async () => {
    await playMusic();
  }, [playMusic]);

  const next = useCallback(() => {
    if (!MUSIC_PLAYLIST.length) return;
    const nextIdx = (musicIndexRef.current + 1) % MUSIC_PLAYLIST.length;
    void playMusic(nextIdx);
  }, [playMusic]);

  const prev = useCallback(() => {
    if (!MUSIC_PLAYLIST.length) return;
    const prevIdx = (musicIndexRef.current - 1 + MUSIC_PLAYLIST.length) % MUSIC_PLAYLIST.length;
    void playMusic(prevIdx);
  }, [playMusic]);

  const toggle = useCallback(() => {
    const a = getActiveEl();
    if (!a) return;

    if (!a.paused) {
      try {
        a.pause();
      } catch {}
      setPlaying(false);
      return;
    }

    const opId = ++opIdRef.current;
    applyVolumes();
    void guardedPlay(a, opId).catch(() => {});
  }, [applyVolumes, guardedPlay, getActiveEl]);

  // ===== iOS unlock for WebAudio + both HTMLAudioElements =====
  const ensureCtx = useCallback(async () => {
    if (ctxRef.current && masterGainRef.current && sfxGainRef.current) return;

    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
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

    // prime BOTH HTMLAudio elements (gesture-authorize)
    const prime = async (a: HTMLAudioElement | null) => {
      if (!a) return;
      try {
        // TS-safe (playsInline is not in lib.dom.d.ts)
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
      } finally {
        try {
          a.volume = prevVol;
          a.muted = prevMuted;
        } catch {}
      }
    };

    await prime(ambienceRef.current);
    await prime(musicRef.current);

    applyVolumes();
    setUnlocked(true);
  }, [applyVolumes, ensureCtx]);

  // ===== recover: fixes “shows playing but silent” =====
  const recover = useCallback(async () => {
    // Best effort: re-unlock (requires gesture on iOS)
    try {
      await unlock();
    } catch {}

    // Ensure routing is correct
    applyVolumes();

    const a = getActiveEl();
    if (!a) return;

    // If UI says playing but element is paused, resume
    if (playing && a.paused) {
      const opId = ++opIdRef.current;
      try {
        await guardedPlay(a, opId);
      } catch {}
      return;
    }

    // Re-apply again to break out of stuck volume/mute states
    applyVolumes();
  }, [applyVolumes, getActiveEl, guardedPlay, playing, unlock]);

  // ----- SFX -----
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

  // Cleanup WebAudio only
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

  const getDebug = useCallback((): DebugState => {
    const amb = ambienceRef.current;
    const mus = musicRef.current;

    return {
      mode: modeRef.current,
      playing,
      unlocked,
      volume: volumeRef.current,
      ambience: amb
        ? {
            src: amb.src,
            paused: amb.paused,
            muted: amb.muted,
            volume: amb.volume,
            currentTime: Number.isFinite(amb.currentTime) ? amb.currentTime : 0,
            readyState: amb.readyState,
          }
        : null,
      music: mus
        ? {
            src: mus.src,
            paused: mus.paused,
            muted: mus.muted,
            volume: mus.volume,
            currentTime: Number.isFinite(mus.currentTime) ? mus.currentTime : 0,
            readyState: mus.readyState,
          }
        : null,
    };
  }, [playing, unlocked]);

  const api = useMemo<AudioApi>(
    () => ({
      playing,
      mode,
      current: current ?? FALLBACK_TRACK,
      currentTime,
      duration,
      volume,
      unlocked,

      setForeground,

      setVolume,
      seek,

      play,
      playAmbience,
      playMusic,
      pause,
      stop,
      next,
      prev,
      toggle,

      unlock,
      recover,
      getDebug,

      sfx,
      preloadSfx,
      sfxMuted,
      setSfxMuted,
      toggleSfxMuted,
    }),
    [
      playing,
      mode,
      current,
      currentTime,
      duration,
      volume,
      unlocked,
      setForeground,
      setVolume,
      seek,
      play,
      playAmbience,
      playMusic,
      pause,
      stop,
      next,
      prev,
      toggle,
      unlock,
      recover,
      getDebug,
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

