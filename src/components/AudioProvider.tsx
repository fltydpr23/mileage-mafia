"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Track = { id: string; title: string; src: string };

const TRACKS: Track[] = [
  { id: "noir1", title: "Noir I", src: "/noir1.mp3" },
  { id: "noir2", title: "Noir II", src: "/noir2.mp3" },
  { id: "noir3", title: "Noir III", src: "/noir3.mp3" },
];

type AudioCtx = {
  tracks: Track[];
  current: Track;
  playing: boolean;

  volume: number;
  setVolume: (v: number) => void;

  currentTime: number;
  duration: number;
  seek: (seconds: number) => void;

  play: () => Promise<void>;
  pause: () => void;
  toggle: () => Promise<void>;
  next: () => void;
  prev: () => void;
  setTrackById: (id: string) => void;
};

const Ctx = createContext<AudioCtx | null>(null);

export function useAudio() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAudio must be used inside <AudioProvider />");
  return ctx;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export default function AudioProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [trackId, setTrackId] = useState(TRACKS[0].id);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.7);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const current = useMemo(
    () => TRACKS.find((t) => t.id === trackId) ?? TRACKS[0],
    [trackId]
  );

  // Apply volume
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = clamp(volume, 0, 1);
    a.muted = false;
  }, [volume]);

  // Keep time + duration in sync
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const onTime = () => setCurrentTime(a.currentTime || 0);
    const onMeta = () => setDuration(Number.isFinite(a.duration) ? a.duration : 0);
    const onDuration = () => setDuration(Number.isFinite(a.duration) ? a.duration : 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("durationchange", onDuration);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);

    // initialize (in case metadata is already available)
    onMeta();
    onTime();

    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("durationchange", onDuration);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
    };
  }, []);

  // Change track; keep playing if already playing
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const wasPlaying = playing;

    // reset UI state immediately for better UX
    setCurrentTime(0);
    setDuration(0);

    a.src = current.src;
    a.load();

    // When you load a new src, browser may briefly pause — respect wasPlaying
    if (wasPlaying) {
      a.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.id]);

  // Auto-advance when a track ends (also continues playback naturally)
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const onEnded = () => {
      const idx = TRACKS.findIndex((t) => t.id === trackId);
      const nextTrack = TRACKS[(idx + 1) % TRACKS.length];
      setTrackId(nextTrack.id);
    };

    a.addEventListener("ended", onEnded);
    return () => a.removeEventListener("ended", onEnded);
  }, [trackId]);

  async function play() {
    const a = audioRef.current;
    if (!a) return;
    a.muted = false;
    a.volume = clamp(volume, 0, 1);

    try {
      await a.play();
      setPlaying(true);
    } catch (e) {
      console.log("Play blocked:", e);
      setPlaying(false);
    }
  }

  function pause() {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    setPlaying(false);
  }

  async function toggle() {
    if (playing) pause();
    else await play();
  }

  function next() {
    const idx = TRACKS.findIndex((t) => t.id === trackId);
    setTrackId(TRACKS[(idx + 1) % TRACKS.length].id);
  }

  function prev() {
    const idx = TRACKS.findIndex((t) => t.id === trackId);
    setTrackId(TRACKS[(idx - 1 + TRACKS.length) % TRACKS.length].id);
  }

  function setTrackById(id: string) {
    if (TRACKS.some((t) => t.id === id)) setTrackId(id);
  }

  function seek(seconds: number) {
    const a = audioRef.current;
    if (!a) return;

    const d = Number.isFinite(a.duration) ? a.duration : duration;
    const nextT = clamp(seconds, 0, d > 0 ? d : seconds);

    a.currentTime = nextT;
    setCurrentTime(nextT);
  }

  const value: AudioCtx = {
    tracks: TRACKS,
    current,
    playing,

    volume,
    setVolume: setVolumeState,

    currentTime,
    duration,
    seek,

    play,
    pause,
    toggle,
    next,
    prev,
    setTrackById,
  };

  return (
    <Ctx.Provider value={value}>
      <audio ref={audioRef} preload="auto" />
      {children}
    </Ctx.Provider>
  );
}
