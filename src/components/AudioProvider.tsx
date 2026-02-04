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

export default function AudioProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [trackId, setTrackId] = useState(TRACKS[0].id);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.7);

  const current = useMemo(
    () => TRACKS.find((t) => t.id === trackId) ?? TRACKS[0],
    [trackId]
  );

  // Apply volume
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = Math.max(0, Math.min(1, volume));
    a.muted = false;
  }, [volume]);

  // Change track; keep playing if already playing
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const wasPlaying = playing;
    a.src = current.src;
    a.load();

    if (wasPlaying) {
      a.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.id]);

  // Auto-advance when a track ends
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
    a.volume = Math.max(0, Math.min(1, volume));
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

  const value: AudioCtx = {
    tracks: TRACKS,
    current,
    playing,
    volume,
    setVolume: setVolumeState,
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
