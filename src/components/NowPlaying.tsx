"use client";

import { useEffect, useRef, useState } from "react";
import { useAudio } from "@/components/AudioProvider";

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function fmtTime(s: number) {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${String(ss).padStart(2, "0")}`;
}

export default function NowPlaying() {
  const a = useAudio();

  // ===== Desktop draggable position =====
  const [pos, setPos] = useState({ x: 20, y: 20 }); // px from bottom/right-ish via transform
  const dragging = useRef(false);
  const start = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });

  // keep within viewport (desktop only)
  function clampToViewport(x: number, y: number) {
    // Widget approx size (keeps it from being dragged fully off-screen)
    const W = 340;
    const H = 120;
    const maxX = Math.max(8, window.innerWidth - W - 8);
    const maxY = Math.max(8, window.innerHeight - H - 8);
    return { x: clamp(x, 8, maxX), y: clamp(y, 8, maxY) };
  }

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!dragging.current) return;
      const dx = e.clientX - start.current.x;
      const dy = e.clientY - start.current.y;
      const next = clampToViewport(startPos.current.x + dx, startPos.current.y + dy);
      setPos(next);
    }
    function onUp() {
      dragging.current = false;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  function onDragStart(e: React.PointerEvent) {
    // desktop only; on mobile we don't drag (touch scroll conflicts)
    dragging.current = true;
    start.current = { x: e.clientX, y: e.clientY };
    startPos.current = { ...pos };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  // ===== "lay low" when idle (desktop hover) =====
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!a.playing) return;
    setActive(true);
    const t = setTimeout(() => setActive(false), 1800);
    return () => clearTimeout(t);
  }, [a.playing, a.current.id]);

  const pct =
    a.duration && a.duration > 0 ? Math.min(1, Math.max(0, a.currentTime / a.duration)) : 0;

  // ===== UI =====
  return (
    <>
      {/* =========================
          MOBILE: bottom bar
          ========================= */}
      <div className="sm:hidden fixed inset-x-0 bottom-0 z-40">
        <div className="mx-auto max-w-6xl px-3 pb-[calc(env(safe-area-inset-bottom,0px)+10px)]">
          <div className="rounded-2xl bg-neutral-950/85 backdrop-blur-xl ring-1 ring-white/10 px-4 py-3">
            {/* progress */}
            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-white/80"
                style={{ width: `${pct * 100}%` }}
              />
            </div>

            <div className="mt-2 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-[0.25em] text-neutral-500">
                  Now Playing
                </p>
                <p className="mt-0.5 font-semibold text-white truncate">
                  {a.current.title}
                </p>
                <p className="text-[12px] text-neutral-400 tabular-nums mt-0.5">
                  {fmtTime(a.currentTime)} / {fmtTime(a.duration)}
                </p>
              </div>

              <button
                onClick={() => a.prev()}
                className="h-10 w-10 rounded-xl bg-white/5 ring-1 ring-white/10 active:scale-[0.98] transition"
                aria-label="Previous"
              >
                ‹
              </button>

              <button
                onClick={() => a.toggle()}
                className="h-10 w-10 rounded-xl bg-white text-black font-black active:scale-[0.98] transition"
                aria-label={a.playing ? "Pause" : "Play"}
              >
                {a.playing ? "❚❚" : "▶"}
              </button>

              <button
                onClick={() => a.next()}
                className="h-10 w-10 rounded-xl bg-white/5 ring-1 ring-white/10 active:scale-[0.98] transition"
                aria-label="Next"
              >
                ›
              </button>
            </div>

            {/* Seek */}
            <input
              type="range"
              min={0}
              max={a.duration || 0}
              step={0.25}
              value={a.currentTime}
              onChange={(e) => a.seek(parseFloat(e.target.value))}
              className="mt-3 w-full"
              aria-label="Seek"
            />
          </div>
        </div>
      </div>

      {/* =========================
          DESKTOP: floating draggable
          ========================= */}
      <div
        className={[
          "hidden sm:block fixed z-50",
          "rounded-2xl bg-neutral-950/70 backdrop-blur-xl ring-1 ring-white/10",
          "w-[340px] max-w-[calc(100vw-2.5rem)]",
          "transition-all",
          active ? "opacity-100" : "opacity-70 hover:opacity-100",
        ].join(" ")}
        style={{
          left: pos.x,
          top: pos.y,
        }}
        onMouseEnter={() => setActive(true)}
        onMouseLeave={() => setActive(false)}
      >
        {/* drag handle */}
        <div
          onPointerDown={onDragStart}
          className="cursor-grab active:cursor-grabbing select-none px-4 pt-3"
          aria-label="Drag player"
          title="Drag"
        >
          <div className="h-1.5 w-12 rounded-full bg-white/15" />
        </div>

        <div className="px-4 pb-4 pt-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.25em] text-neutral-500">
                Now Playing
              </p>
              <p className="mt-1 font-semibold text-white truncate">
                {a.current.title}
              </p>
              <p className="text-xs text-neutral-400 tabular-nums mt-1">
                {fmtTime(a.currentTime)} / {fmtTime(a.duration)}
              </p>
            </div>

            <button
              onClick={() => a.toggle()}
              className="shrink-0 h-10 w-10 rounded-xl bg-white text-black font-black hover:opacity-90 transition"
              aria-label={a.playing ? "Pause" : "Play"}
            >
              {a.playing ? "❚❚" : "▶"}
            </button>
          </div>

          <div className="mt-3">
            {/* progress */}
            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-white/80" style={{ width: `${pct * 100}%` }} />
            </div>

            {/* seek */}
            <input
              type="range"
              min={0}
              max={a.duration || 0}
              step={0.25}
              value={a.currentTime}
              onChange={(e) => a.seek(parseFloat(e.target.value))}
              className="mt-2 w-full"
              aria-label="Seek"
            />
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => a.prev()}
              className="h-10 w-10 rounded-xl bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition"
              aria-label="Previous track"
            >
              ‹
            </button>

            <button
              onClick={() => a.next()}
              className="h-10 w-10 rounded-xl bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition"
              aria-label="Next track"
            >
              ›
            </button>

            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-neutral-500">Vol</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={a.volume}
                onChange={(e) => a.setVolume(parseFloat(e.target.value))}
                className="w-28"
                aria-label="Volume"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

