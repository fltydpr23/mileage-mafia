
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const STORAGE_POS = "mm_nowplaying_pos_v2";
const STORAGE_MINI = "mm_nowplaying_mini_v2";

type Point = { x: number; y: number };

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
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
    pause,
    playMusic,
    playAmbience,
  } = useAudio();

  // --- UI state ---
  const [mini, setMini] = useState(false);
  const [switchBusy, setSwitchBusy] = useState(false);

  // --- position (from bottom-right) ---
  const [pos, setPos] = useState<Point>({ x: 16, y: 16 });
  const draggingRef = useRef(false);
  const pointerStartRef = useRef<Point>({ x: 0, y: 0 });
  const posStartRef = useRef<Point>({ x: 16, y: 16 });

  const isNoir = mode === "music";

  // Load persisted prefs (client-only)
  useEffect(() => {
    try {
      const savedMini = localStorage.getItem(STORAGE_MINI);
      if (savedMini === "1") setMini(true);

      const savedPos = localStorage.getItem(STORAGE_POS);
      if (savedPos) {
        const p = JSON.parse(savedPos);
        if (typeof p?.x === "number" && typeof p?.y === "number") {
          setPos({ x: p.x, y: p.y });
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_MINI, mini ? "1" : "0");
    } catch {}
  }, [mini]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_POS, JSON.stringify(pos));
    } catch {}
  }, [pos]);

  // Auto-collapse when the track changes (your requirement)
  const lastTrackIdRef = useRef<string>("");
  useEffect(() => {
    const id = current?.id || "";
    if (!id) return;
    if (lastTrackIdRef.current && lastTrackIdRef.current !== id) {
      setMini(true);
    }
    lastTrackIdRef.current = id;
  }, [current?.id]);

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

  // Hard switch: stop both, start the target channel.
  // This is the cleanest way to prevent “ambience over noir”.
  const hardSwitch = useCallback(
    async (target: "music" | "ambience") => {
      if (switchBusy) return;
      setSwitchBusy(true);
      try {
        if (!unlocked) await unlock();
        pause();
        if (target === "music") await playMusic();
        else await playAmbience();
      } catch {
        try {
          await recover();
        } catch {}
      } finally {
        setSwitchBusy(false);
      }
    },
    [switchBusy, unlocked, unlock, pause, playMusic, playAmbience, recover]
  );

  // --- drag handlers (safe; no window access unless actually dragging) ---
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e as any).button != null && (e as any).button !== 0) return;
      draggingRef.current = true;
      pointerStartRef.current = { x: e.clientX, y: e.clientY };
      posStartRef.current = pos;
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}
    },
    [pos]
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;

    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;

    const next = {
      x: posStartRef.current.x - dx,
      y: posStartRef.current.y - dy,
    };

    const w = typeof window !== "undefined" ? window.innerWidth : 1000;
    const h = typeof window !== "undefined" ? window.innerHeight : 800;

    // Keep on-screen with a conservative clamp
    const maxX = Math.max(8, w - 120);
    const maxY = Math.max(8, h - 120);

    setPos({
      x: clamp(next.x, 8, maxX),
      y: clamp(next.y, 8, maxY),
    });
  }, [setPos]);

  const onPointerUp = useCallback(() => {
    draggingRef.current = false;
  }, []);

  // Sizes
  const panelW = mini ? 260 : 380;

  return (
    <div
      className="fixed z-50"
      style={{
        right: pos.x,
        bottom: pos.y,
        width: panelW,
        maxWidth: "92vw",
      }}
    >
      <div className="rounded-2xl bg-neutral-900/95 backdrop-blur-xl ring-1 ring-neutral-800 shadow-2xl overflow-hidden">
        {/* Drag handle + actions */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className={clsx(
            "select-none",
            "cursor-grab active:cursor-grabbing",
            "px-4 py-2 border-b border-neutral-800",
            "flex items-center justify-between gap-3"
          )}
          title="Drag to move"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-2 w-2 rounded-full bg-emerald-400/80" />
            <div className="text-[10px] uppercase tracking-[0.28em] text-neutral-400 truncate">
              Now Playing
            </div>
            <span
              className={clsx(
                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.24em]",
                isNoir
                  ? "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/20"
                  : "bg-white/5 text-neutral-300 ring-1 ring-white/10"
              )}
            >
              {mode}
            </span>
            {switchBusy ? (
              <span className="text-[10px] uppercase tracking-[0.22em] text-neutral-500">
                switching…
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!unlocked ? (
              <button
                onClick={() => void unlock()}
                className="px-3 py-1.5 rounded-xl bg-white text-black text-xs font-bold hover:opacity-90 transition"
              >
                Unlock
              </button>
            ) : (
              <button
                onClick={() => void recover()}
                className="px-3 py-1.5 rounded-xl bg-white/5 ring-1 ring-white/10 text-neutral-200 text-xs font-semibold hover:bg-white/10 transition"
                title="Fix silent playback"
              >
                Fix
              </button>
            )}

            <button
              onClick={() => setMini((v) => !v)}
              className="h-8 w-8 grid place-items-center rounded-xl bg-white/5 ring-1 ring-white/10 text-neutral-200 hover:bg-white/10 transition"
              title={mini ? "Expand" : "Collapse"}
            >
              {mini ? "▢" : "—"}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4">
          <div className="min-w-0">
            <div className="font-semibold truncate">{current?.title || "—"}</div>
            <div className="text-xs text-neutral-400 truncate">
              {current?.artist || "Mileage Mafia"}
            </div>
          </div>

          {/* Mini */}
          {mini ? (
            <>
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] text-neutral-500 tabular-nums">
                  <span>{fmt(currentTime)}</span>
                  <span>{fmt(duration)}</span>
                </div>
                <div className="mt-2 h-1 bg-neutral-800 rounded-full overflow-hidden">
                  <div className="h-full bg-white" style={{ width: `${progressPct}%` }} />
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {isNoir ? (
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

                  {isNoir ? (
                    <button
                      onClick={() => void next()}
                      className="h-9 w-9 rounded-xl bg-white/5 ring-1 ring-white/10 text-neutral-200 hover:bg-white/10 transition"
                      title="Next"
                    >
                      ››
                    </button>
                  ) : null}
                </div>

                <button
                  onClick={() => void hardSwitch(isNoir ? "ambience" : "music")}
                  disabled={switchBusy}
                  className={clsx(
                    "px-3 py-2 rounded-xl text-xs font-extrabold uppercase tracking-[0.22em] transition",
                    "bg-white/5 ring-1 ring-white/10 text-neutral-200 hover:bg-white/10",
                    switchBusy ? "opacity-60 cursor-not-allowed" : ""
                  )}
                  title="Switch channel"
                >
                  {isNoir ? "Amb" : "Noir"}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Channel buttons */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void hardSwitch("music")}
                  disabled={switchBusy}
                  className={clsx(
                    "px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-[0.22em] transition",
                    "ring-1 ring-neutral-800",
                    isNoir ? "bg-white text-black" : "bg-white/5 text-neutral-200 hover:bg-white/10",
                    switchBusy ? "opacity-60 cursor-not-allowed" : ""
                  )}
                >
                  Noir Channel
                </button>
                <button
                  type="button"
                  onClick={() => void hardSwitch("ambience")}
                  disabled={switchBusy}
                  className={clsx(
                    "px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-[0.22em] transition",
                    "ring-1 ring-neutral-800",
                    !isNoir ? "bg-white text-black" : "bg-white/5 text-neutral-200 hover:bg-white/10",
                    switchBusy ? "opacity-60 cursor-not-allowed" : ""
                  )}
                >
                  Ambience
                </button>
              </div>

              {/* Seek */}
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
                  value={Math.min(
                    Math.max(0, currentTime || 0),
                    Math.max(0, duration || 0)
                  )}
                  onChange={onScrub}
                  className="mt-2 w-full accent-white"
                  disabled={!duration || duration <= 0}
                />

                <div className="mt-2 h-1 bg-neutral-800 rounded-full overflow-hidden">
                  <div className="h-full bg-white" style={{ width: `${progressPct}%` }} />
                </div>
              </div>

              {/* Controls + volume */}
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {isNoir ? (
                    <button
                      onClick={() => void prev()}
                      className="h-9 w-9 rounded-xl bg-white/5 ring-1 ring-white/10 text-neutral-200 hover:bg-white/10 transition"
                      title="Previous"
                    >
                      ‹‹
                    </button>
                  ) : (
                    <div className="h-9 w-9" />
                  )}

                  <button
                    onClick={() => void toggle()}
                    className="h-9 w-9 rounded-full bg-white text-black font-black flex items-center justify-center hover:opacity-90 transition"
                    title={playing ? "Pause" : "Play"}
                  >
                    {playing ? "❚❚" : "▶"}
                  </button>

                  {isNoir ? (
                    <button
                      onClick={() => void next()}
                      className="h-9 w-9 rounded-xl bg-white/5 ring-1 ring-white/10 text-neutral-200 hover:bg-white/10 transition"
                      title="Next"
                    >
                      ››
                    </button>
                  ) : (
                    <div className="h-9 w-9" />
                  )}
                </div>

                <div className="flex items-center gap-2 w-36">
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

              <div className="mt-3 text-[10px] uppercase tracking-[0.28em] text-neutral-600">
                Drag from the top bar • Auto-collapses on track change
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

