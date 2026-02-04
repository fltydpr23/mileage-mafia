"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAudio } from "@/components/AudioProvider";

type Pos = { x: number; y: number };

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

  // --- draggable state (persisted)
  const storageKey = "mm_now_playing_pos_v1";
  const [pos, setPos] = useState<Pos>(() => {
    if (typeof window === "undefined") return { x: 20, y: 20 };
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return { x: 20, y: 20 };
      const p = JSON.parse(raw);
      if (typeof p?.x === "number" && typeof p?.y === "number") return p;
    } catch {}
    return { x: 20, y: 20 };
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(pos));
    } catch {}
  }, [pos]);

  // “low profile” unless hovered / playing
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const isActive = hovered || dragging || a.playing;

  // drag logic (pointer events)
  const drag = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    active: boolean;
  }>({ startX: 0, startY: 0, originX: 0, originY: 0, active: false });

  const rootRef = useRef<HTMLDivElement | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    // only drag via “handle” area (top row) — prevents fighting the scrubber
    const target = e.target as HTMLElement;
    const handle = target.closest("[data-drag-handle='true']");
    if (!handle) return;

    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: pos.x,
      originY: pos.y,
      active: true,
    };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current.active) return;

    const dx = e.clientX - drag.current.startX;
    const dy = e.clientY - drag.current.startY;

    const el = rootRef.current;
    const w = el?.offsetWidth ?? 360;
    const h = el?.offsetHeight ?? 120;

    // keep inside viewport with a margin
    const margin = 12;
    const maxX = window.innerWidth - w - margin;
    const maxY = window.innerHeight - h - margin;

    setPos({
      x: clamp(drag.current.originX + dx, margin, Math.max(margin, maxX)),
      y: clamp(drag.current.originY + dy, margin, Math.max(margin, maxY)),
    });
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!drag.current.active) return;
    drag.current.active = false;
    setDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  }

  // if track has no artwork, show monogram
  const art = (a.current as any)?.artwork as string | undefined;
  const title = a.current?.title ?? "—";
  const subtitle = (a.current as any)?.artist ?? "Mileage Mafia Radio";

  const progressPct = useMemo(() => {
    if (!a.duration || a.duration <= 0) return 0;
    return clamp((a.currentTime / a.duration) * 100, 0, 100);
  }, [a.currentTime, a.duration]);

  return (
    <div
      ref={rootRef}
      className={[
        "fixed z-[9999] select-none",
        "transition-all duration-300",
        isActive ? "opacity-100" : "opacity-[0.55]",
      ].join(" ")}
      style={{
        left: pos.x,
        top: pos.y,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Spotify-ish shell */}
      <div
        className={[
          "w-[360px] max-w-[calc(100vw-1.5rem)]",
          "rounded-3xl",
          "bg-neutral-950/60 backdrop-blur-2xl",
          "ring-1 ring-white/10",
          "shadow-[0_20px_60px_rgba(0,0,0,0.55)]",
          "transition-all duration-300",
          isActive ? "brightness-110 ring-white/15" : "brightness-90",
        ].join(" ")}
      >
        {/* Top row (drag handle) */}
        <div
          data-drag-handle="true"
          className={[
            "flex items-center gap-3 px-4 pt-4",
            "cursor-grab active:cursor-grabbing",
          ].join(" ")}
        >
          {/* Art */}
          <div className="h-12 w-12 rounded-2xl overflow-hidden bg-white/10 ring-1 ring-white/10 shrink-0">
            {art ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={art} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center font-black text-white/80">
                MM
              </div>
            )}
          </div>

          {/* Text */}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.25em] text-neutral-500">
              Now playing
            </p>
            <p className="mt-1 font-semibold text-white truncate leading-tight">
              {title}
            </p>
            <p className="mt-0.5 text-xs text-neutral-400 truncate">
              {subtitle}
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => a.prev()}
              className="h-10 w-10 rounded-2xl bg-neutral-900/70 ring-1 ring-neutral-800 hover:bg-white/5 transition flex items-center justify-center"
              aria-label="Previous"
              title="Previous"
            >
              ‹
            </button>

            <button
              type="button"
              onClick={() => a.toggle()}
              className="h-10 w-10 rounded-2xl bg-white text-black font-black hover:opacity-90 transition flex items-center justify-center"
              aria-label={a.playing ? "Pause" : "Play"}
              title={a.playing ? "Pause" : "Play"}
            >
              {a.playing ? "❚❚" : "▶"}
            </button>

            <button
              type="button"
              onClick={() => a.next()}
              className="h-10 w-10 rounded-2xl bg-neutral-900/70 ring-1 ring-neutral-800 hover:bg-white/5 transition flex items-center justify-center"
              aria-label="Next"
              title="Next"
            >
              ›
            </button>
          </div>
        </div>

        {/* Scrubber */}
        <div className="px-4 pb-4 pt-3">
          <div className="flex items-center justify-between text-[11px] text-neutral-500 tabular-nums">
            <span>{fmtTime(a.currentTime)}</span>
            <span>{fmtTime(a.duration)}</span>
          </div>

          <div className="mt-2">
            {/* prettier range */}
            <input
              type="range"
              min={0}
              max={a.duration || 0}
              step={0.1}
              value={a.currentTime}
              onChange={(e) => a.seek(parseFloat(e.target.value))}
              className="w-full accent-white"
              aria-label="Seek"
            />
            {/* fake progress bar under it for richer look */}
            <div className="mt-2 h-1.5 rounded-full bg-neutral-800 overflow-hidden">
              <div
                className="h-full bg-white"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Volume row */}
          <div className="mt-3 flex items-center gap-3">
            <p className="text-[11px] uppercase tracking-[0.25em] text-neutral-500">
              Vol
            </p>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={a.volume}
              onChange={(e) => a.setVolume(parseFloat(e.target.value))}
              className="w-full accent-white"
              aria-label="Volume"
            />
          </div>

          {/* tiny hint */}
          <p className="mt-2 text-[11px] text-neutral-600">
            Drag the top bar to move.
          </p>
        </div>
      </div>
    </div>
  );
}
