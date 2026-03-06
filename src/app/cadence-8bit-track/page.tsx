"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Result = {
  taps: number;
  accuracyPct: number;
  meanAbsMs: number;
  stdMs: number;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function scoreTaps(tapTimes: number[], intervalSec: number): Result {
  if (!tapTimes.length) return { taps: 0, accuracyPct: 0, meanAbsMs: 0, stdMs: 0 };

  const errorsMs = tapTimes.map((t) => {
    const k = Math.round(t / intervalSec);
    const expected = k * intervalSec;
    return (t - expected) * 1000;
  });

  const abs = errorsMs.map((e) => Math.abs(e));
  const meanAbs = abs.reduce((a, b) => a + b, 0) / abs.length;

  const mean = errorsMs.reduce((a, b) => a + b, 0) / errorsMs.length;
  const variance = errorsMs.reduce((a, b) => a + (b - mean) ** 2, 0) / errorsMs.length;
  const std = Math.sqrt(variance);

  const wPerfect = 45, wGood = 95, wOk = 150;
  const points = abs.map((a) => (a <= wPerfect ? 1 : a <= wGood ? 0.75 : a <= wOk ? 0.45 : 0.15));
  let accuracy = Math.round((points.reduce((a, b) => a + b, 0) / points.length) * 100);

  const penalty = clamp((std - 55) / 120, 0, 0.18);
  accuracy = Math.round(accuracy * (1 - penalty));

  return { taps: tapTimes.length, accuracyPct: clamp(accuracy, 0, 100), meanAbsMs: meanAbs, stdMs: std };
}

function label(accuracy: number) {
  if (accuracy >= 92) return "S-RANK";
  if (accuracy >= 84) return "A-RANK";
  if (accuracy >= 72) return "B-RANK";
  if (accuracy >= 60) return "C-RANK";
  return "D-RANK";
}

export default function Cadence8BitTrackPage() {
  const TARGET_SPM = 176;
  const DURATION_SEC = 15;
  const intervalSec = 60 / TARGET_SPM;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startPerfRef = useRef<number>(0);
  const tapTimesRef = useRef<number[]>([]);

  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [timeLeft, setTimeLeft] = useState(DURATION_SEC);
  const [taps, setTaps] = useState(0);
  const [res, setRes] = useState<Result | null>(null);

  const seed = useMemo(() => Math.random() * 9999, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const p = c.parentElement;
      if (!p) return;
      const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
      c.width = Math.floor(p.clientWidth * dpr);
      c.height = Math.floor(p.clientHeight * dpr);
      c.style.width = `${p.clientWidth}px`;
      c.style.height = `${p.clientHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false; // 8-bit look
    };

    resize();
    window.addEventListener("resize", resize);

    const drawPixelText = (text: string, x: number, y: number) => {
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono'";
      ctx.fillText(text, x, y);
      ctx.restore();
    };

    const draw = (now: number) => {
      const p = c.parentElement;
      if (!p) return;
      const w = p.clientWidth;
      const h = p.clientHeight;

      ctx.clearRect(0, 0, w, h);

      const t = now * 0.001 + seed;

      // "track" background: dark with pixel lane lines
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0)";
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      const trackTop = h * 0.18;
      const trackBottom = h * 0.92;
      const trackLeft = w * 0.18;
      const trackRight = w * 0.82;

      // border
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 2;
      ctx.strokeRect(trackLeft, trackTop, trackRight - trackLeft, trackBottom - trackTop);
      ctx.restore();

      // scrolling lane dashes
      const dashGap = 28;
      const dashLen = 14;
      const speed = 80; // px/sec
      const offset = ((t * speed) % dashGap);

      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      const lanes = 4;
      for (let i = 1; i < lanes; i++) {
        const x = trackLeft + ((trackRight - trackLeft) * i) / lanes;
        for (let y = trackTop - dashGap; y < trackBottom + dashGap; y += dashGap) {
          const yy = y + offset;
          ctx.fillRect(x - 1, yy, 2, dashLen);
        }
      }
      ctx.restore();

      // Beat cue as a pixel "lamp" at top
      const beatPhase = (t % intervalSec) / intervalSec;
      const pulse = Math.exp(-Math.pow((beatPhase - 0.03) / 0.12, 2));
      const lampSize = 10 + 18 * pulse;

      ctx.save();
      ctx.globalAlpha = 0.25 + 0.55 * pulse;
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.fillRect(w * 0.5 - lampSize * 0.5, trackTop - 34, lampSize, lampSize);
      ctx.restore();

      // runner sprite (simple 8-bit block) at bottom center
      const runnerY = trackBottom - 26;
      const runnerX = w * 0.5 - 8;
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillRect(runnerX, runnerY, 16, 16);
      // legs as 2 pixels, alternate with beat
      const leg = beatPhase < 0.5 ? -1 : 1;
      ctx.fillRect(runnerX + 3, runnerY + 16, 3, 6);
      ctx.fillRect(runnerX + 10, runnerY + 16, 3, 6);
      ctx.fillRect(runnerX + 3 + leg * 2, runnerY + 20, 3, 3);
      ctx.fillRect(runnerX + 10 - leg * 2, runnerY + 20, 3, 3);
      ctx.restore();

      // HUD
      drawPixelText(`CADENCE ${TARGET_SPM} SPM`, 18, 26);
      drawPixelText(`TIME ${timeLeft.toFixed(1)}s`, 18, 46);
      drawPixelText(`TAPS ${taps}`, 18, 66);

      if (phase === "idle") {
        drawPixelText("TAP ANYWHERE TO START", 18, 92);
        drawPixelText("HOLD RHYTHM • 15s", 18, 112);
      }

      if (phase === "done" && res) {
        drawPixelText(`ACCURACY ${res.accuracyPct}%`, 18, 92);
        drawPixelText(`RANK ${label(res.accuracyPct)}`, 18, 112);
        drawPixelText(`MEAN ${Math.round(res.meanAbsMs)}ms • STD ${Math.round(res.stdMs)}ms`, 18, 132);
        drawPixelText("TAP TO RETRY", 18, 152);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [TARGET_SPM, DURATION_SEC, intervalSec, phase, timeLeft, taps, res, seed]);

  useEffect(() => {
    if (phase !== "running") return;

    const timer = window.setInterval(() => {
      const elapsed = (performance.now() - startPerfRef.current) / 1000;
      const left = clamp(DURATION_SEC - elapsed, 0, DURATION_SEC);
      setTimeLeft(left);

      if (left <= 0) {
        window.clearInterval(timer);
        const r = scoreTaps(tapTimesRef.current, intervalSec);
        setRes(r);
        setPhase("done");
      }
    }, 50);

    return () => window.clearInterval(timer);
  }, [phase, DURATION_SEC, intervalSec]);

  const start = () => {
    tapTimesRef.current = [];
    setTaps(0);
    setRes(null);
    setTimeLeft(DURATION_SEC);
    startPerfRef.current = performance.now();
    setPhase("running");
    if (navigator.vibrate) navigator.vibrate(10);
  };

  const tap = () => {
    if (phase === "idle") return start();
    if (phase === "done") return start();
    if (phase !== "running") return;

    const t = (performance.now() - startPerfRef.current) / 1000;
    tapTimesRef.current.push(t);
    setTaps((x) => x + 1);
    if (navigator.vibrate) navigator.vibrate(8);
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="relative min-h-screen overflow-hidden" onPointerDown={tap} style={{ touchAction: "manipulation" }}>
        <canvas ref={canvasRef} className="absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/30 via-neutral-950/40 to-neutral-950/80" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/5 ring-1 ring-white/10 px-3 py-1 text-xs">
            <span className="opacity-80">Mileage Mafia</span>
            <span className="opacity-50">•</span>
            <span className="opacity-80">Cadence Test (8-bit Track)</span>
          </div>

          <div className="pt-8 text-white/55 text-sm">
            Route: <span className="text-white/80">/cadence-8bit-track</span>
          </div>
        </div>
      </div>
    </main>
  );
}
