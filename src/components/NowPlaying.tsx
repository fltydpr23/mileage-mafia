"use client";

import React, { useCallback, useMemo } from "react";
import { useAudio } from "@/components/AudioProvider";

function fmt(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function clsx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function NowPlaying() {
  const {
    playing,
    mode,
    current,
    currentTime,
    duration,
    volume,
    unlocked,
    toggle,
    next,
    prev,
    seek,
    setVolume,
    unlock,
    recover,
  } = useAudio();

  const progressPct = useMemo(() => {
    if (!duration || duration <= 0) return 0;
    return Math.max(0, Math.min(100, (currentTime / duration) * 100));
  }, [currentTime, duration]);

  const onScrub = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      if (!Number.isFinite(v)) return;
      seek(v);
    },
    [seek]
  );

  const onVol = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      if (!Number.isFinite(v)) return;
      setVolume(v);
    },
    [setVolume]
  );

  const showTransport = mode === "music";

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[360px] max-w-[92vw]">
      <div className="rounded-2xl bg-neutral-900/95 backdrop-blur-xl ring-1 ring-neutral-800 shadow-2xl overflow-hidden">
        {/* Top */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-[10px] uppercase tracking-[0.28em] text-neutral-500">
                  Now Playing
                </div>
                <span
                  className={clsx(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.24em]",
                    mode === "music"
                      ? "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/20"
                      : "bg-white/5 text-neutral-300 ring-1 ring-white/10"
                  )}
                >
                  {mode}
                </span>
              </div>

              <div className="mt-1 font-semibold truncate">
                {current?.title || "—"}
              </div>
              <div className="text-xs text-neutral-400 truncate">
                {current?.artist || "Mileage Mafia"}
              </div>

              {!unlocked ? (
                <div className="mt-3 text-xs text-neutral-500">
                  Audio is locked by your browser. Tap <span className="text-neutral-300 font-semibold">Unlock</span>.
                </div>
              ) : null}
            </div>

            <div className="shrink-0 flex items-center gap-2">
              {!unlocked ? (
                <button
                  onClick={() => void unlock()}
                  className="px-3 py-1.5 rounded-xl bg-white text-black text-xs font-bold hover:opacity-90 transition"
                  title="Unlock audio"
                >
                  Unlock
                </button>
              ) : (
                <button
                  onClick={() => void recover()}
                  className="px-3 py-1.5 rounded-xl bg-white/5 ring-1 ring-white/10 text-neutral-200 text-xs font-semibold hover:bg-white/10 transition"
                  title="Fix silent/buggy playback"
                >
                  Fix
                </button>
              )}
            </div>
          </div>

          {/* Time / seek */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] text-neutral-500 tabular-nums">
              <span>{fmt(currentTime)}</span>
              <span>{fmt(duration)}</span>
            </div>

            <input
              aria-label="Seek"
              type="range"
              min={0}
              max={Math.max(0, duration || 0)}
              step={0.1}
              value={Math.min(Math.max(0, currentTime || 0), Math.max(0, duration || 0))}
              onChange={onScrub}
              className="mt-2 w-full accent-white"
              disabled={!duration || duration <= 0}
            />

            <div className="mt-2 h-1 bg-neutral-800 rounded-full overflow-hidden">
              <div className="h-full bg-white transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          {/* Controls */}
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {showTransport ? (
                <button
                  onClick={() => void prev()}
                  className="h-9 w-9 rounded-xl bg-white/5 ring-1 ring-white/10 text-neutral-200 hover:bg-white/10 transition"
                  title="Previous"
                >
                  ‹‹
                </button>
              ) : null}

              <button
                onClick={() => void toggle()}
                className="h-9 w-9 rounded-full bg-white text-black font-black flex items-center justify-center hover:opacity-90 transition"
                title={playing ? "Pause" : "Play"}
              >
                {playing ? "❚❚" : "▶"}
              </button>

              {showTransport ? (
                <button
                  onClick={() => void next()}
                  className="h-9 w-9 rounded-xl bg-white/5 ring-1 ring-white/10 text-neutral-200 hover:bg-white/10 transition"
                  title="Next"
                >
                  ››
                </button>
              ) : null}
            </div>

            {/* Volume */}
            <div className="flex items-center gap-2 w-32">
              <span className="text-[10px] uppercase tracking-[0.22em] text-neutral-600">
                Vol
              </span>
              <input
                aria-label="Volume"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={Number.isFinite(volume) ? volume : 0.9}
                onChange={onVol}
                className="w-full accent-white"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="mt-3 text-[10px] uppercase tracking-[0.28em] text-neutral-600">
            {mode === "music" ? "Noir channel" : "Ambience channel"}
            {unlocked ? "" : " • locked"}
          </div>
        </div>
      </div>
    </div>
  );
}