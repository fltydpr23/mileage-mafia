"use client";

import React, { useMemo, useState } from "react";
import { useAudio } from "@/components/AudioProvider";

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function fmtTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export default function NowPlaying() {
  const a = useAudio();
  const [expanded, setExpanded] = useState(false);

  const track = a.current ?? {
    title: "—",
    artist: "Mileage Mafia Radio",
    src: "",
  };

  const progressPct = useMemo(() => {
    if (!a.duration || a.duration <= 0) return 0;
    return clamp((a.currentTime / a.duration) * 100, 0, 100);
  }, [a.currentTime, a.duration]);

  /* =========================================================
     MOBILE VERSION (Clean bottom dock)
  ========================================================== */

  const MobilePlayer = (
    <div className="fixed bottom-4 left-4 right-4 z-50 sm:hidden">
      <div className="rounded-2xl bg-neutral-950/80 backdrop-blur-xl ring-1 ring-white/10 shadow-xl overflow-hidden">
        {/* Compact Bar */}
        <div
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between px-4 py-3 cursor-pointer"
        >
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-neutral-500">
              Now Playing
            </p>
            <p className="text-sm font-semibold truncate">
              {track.title}
            </p>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              a.toggle();
            }}
            className="h-9 w-9 rounded-xl bg-white text-black flex items-center justify-center font-bold"
          >
            {a.playing ? "❚❚" : "▶"}
          </button>
        </div>

        {/* Expandable Controls */}
        {expanded && (
          <div className="px-4 pb-4 pt-2 space-y-3 border-t border-white/10">
            <div className="flex items-center justify-between text-xs text-neutral-500 tabular-nums">
              <span>{fmtTime(a.currentTime)}</span>
              <span>{fmtTime(a.duration)}</span>
            </div>

            <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
              <div
                className="h-full bg-white"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => a.prev()}
                className="px-4 py-2 rounded-xl bg-neutral-900 ring-1 ring-white/10"
              >
                ‹
              </button>

              <button
                onClick={() => a.next()}
                className="px-4 py-2 rounded-xl bg-neutral-900 ring-1 ring-white/10"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  /* =========================================================
     DESKTOP VERSION (Floating glass card)
  ========================================================== */

  const DesktopPlayer = (
    <div className="hidden sm:block fixed bottom-6 right-6 z-50 w-[380px]">
      <div className="rounded-3xl bg-neutral-950/70 backdrop-blur-2xl ring-1 ring-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.6)] p-5 space-y-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-neutral-500">
            Now Playing
          </p>
          <p className="mt-1 font-semibold text-white truncate">
            {track.title}
          </p>
          <p className="text-xs text-neutral-400 truncate">
            {track.artist}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => a.prev()}
            className="h-10 w-10 rounded-2xl bg-neutral-900 ring-1 ring-white/10"
          >
            ‹
          </button>

          <button
            onClick={() => a.toggle()}
            className="h-10 w-10 rounded-2xl bg-white text-black font-bold"
          >
            {a.playing ? "❚❚" : "▶"}
          </button>

          <button
            onClick={() => a.next()}
            className="h-10 w-10 rounded-2xl bg-neutral-900 ring-1 ring-white/10"
          >
            ›
          </button>
        </div>

        <div>
          <div className="flex justify-between text-xs text-neutral-500 tabular-nums">
            <span>{fmtTime(a.currentTime)}</span>
            <span>{fmtTime(a.duration)}</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-neutral-800 overflow-hidden">
            <div
              className="h-full bg-white"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {MobilePlayer}
      {DesktopPlayer}
    </>
  );
}
