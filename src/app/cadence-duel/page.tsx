"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Result = { taps: number; accuracyPct: number; meanAbsMs: number; stdMs: number };

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function scoreTaps(tapTimes: number[], intervalSec: number): Result {
  if (!tapTimes.length) return { taps: 0, accuracyPct: 0, meanAbsMs: 0, stdMs: 0 };

  const errorsMs = tapTimes.map((t) => (t - Math.round(t / intervalSec) * intervalSec) * 1000);
  const abs = errorsMs.map((e) => Math.abs(e));
  const meanAbs = abs.reduce((a, b) => a + b, 0) / abs.length;

  const mean = errorsMs.reduce((a, b) => a + b, 0) / errorsMs.length;
  const variance = errorsMs.reduce((a, b) => a + (b - mean) ** 2, 0) / errorsMs.length;
  const std = Math.sqrt(variance);

  const wPerfect = 40, wGood = 85, wOk = 130;
  const points = abs.map((a) => (a <= wPerfect ? 1 : a <= wGood ? 0.75 : a <= wOk ? 0.45 : 0.15));
  let accuracy = Math.round((points.reduce((a, b) => a + b, 0) / points.length) * 100);

  const penalty = clamp((std - 55) / 120, 0, 0.18);
  accuracy = Math.round(accuracy * (1 - penalty));

  return { taps: tapTimes.length, accuracyPct: clamp(accuracy, 0, 100), meanAbsMs: meanAbs, stdMs: std };
}

function label(accuracy: number) {
  if (accuracy >= 92) return "SYNCED";
  if (accuracy >= 84) return "CLOSE";
  if (accuracy >= 72) return "DRIFTING";
  if (accuracy >= 60) return "OFFBEAT";
  return "LOST";
}

export default function CadenceDuelPage() {
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

  const seed = useMemo(() => Math.random() * 1000, []);

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
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = (now: number) => {
      const p = c.parentElement;
      if (!p) return;
      const w = p.clientWidth;
      const h = p.clientHeight;

      ctx.clearRect(0, 0, w, h);

      // subtle grid
      ctx.save();
      ctx.globalAlpha = 0.10;
      ctx.lineWidth = 1;
      const gap = 56;
      ctx.beginPath();
      for (let x = 0; x <= w; x += gap) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
      }
      for (let y = 0; y <= h; y += gap) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
      }
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.stroke();
      ctx.restore();

      const t = now * 0.001 + seed;
      const beatPhase = (t % intervalSec) / intervalSec;
      const pulse = Math.exp(-Math.pow((beatPhase - 0.03) / 0.12, 2));

      // bars
      const barW = Math.min(120, w * 0.22);
      const gapX = Math.min(80, w * 0.08);
      const totalW = barW * 2 + gapX;
      const x0 = (w - totalW) / 2;
      const y0 = h * 0.22;
      const barH = h * 0.56;

      // frame
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x0, y0, barW, barH);
      ctx.strokeRect(x0 + barW + gapX, y0, barW, barH);
      ctx.restore();

      // target pulse column
      ctx.save();
      ctx.globalAlpha = 0.10 + 0.55 * pulse;
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      const th = barH * (0.22 + 0.62 * pulse);
      ctx.fillRect(x0 + 2, y0 + (barH - th) / 2, barW - 4, th);
      ctx.restore();

      // your pulse column: based on most recent tap timing proximity
      let yourPulse = 0.0;
      const tapsArr = tapTimesRef.current;
      if (phase === "running" && tapsArr.length) {
        const elapsed = (performance.now() - startPerfRef.current) / 1000;
        const lastTap = tapsArr[tapsArr.length - 1];
        const dt = elapsed - lastTap; // seconds since last tap
        // short decay
        yourPulse = Math.exp(-dt / 0.18);
      }
      // boost if you tapped near a beat
      if (phase === "running" && tapsArr.length) {
        const lastTap = tapsArr[tapsArr.length - 1];
        const err = Math.abs((lastTap - Math.round(lastTap / intervalSec) * intervalSec) * 1000);
        const bonus = clamp(1 - err / 120, 0, 1);
        yourPulse *= 0.65 + 0.55 * bonus;
      }

      ctx.save();
      ctx.globalAlpha = 0.10 + 0.65 * yourPulse;
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      const yh = barH * (0.18 + 0.68 * yourPulse);
      ctx.fillRect(x0 + barW + gapX + 2, y0 + (barH - yh) / 2, barW - 4, yh);
      ctx.restore();

      // labels
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.font = "600 14px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText("TARGET", x0 + 12, y0 - 12);
      ctx.fillText("YOU", x0 + barW + gapX + 12, y0 - 12);

      ctx.globalAlpha = 0.6;
      ctx.font = "500 12px ui-sans-serif, system-ui";
      ctx.fillText(`CADENCE ${TARGET_SPM} SPM`, 18, 28);
      ctx.fillText(`TIME ${timeLeft.toFixed(1)}s • TAPS ${taps}`, 18, 48);

      if (phase === "idle") {
        ctx.globalAlpha = 0.75;
        ctx.font = "700 14px ui-sans-serif, system-ui";
        ctx.fillText("TAP ANYWHERE TO START", 18, 76);
      }
      if (phase === "done" && res) {
        ctx.globalAlpha = 0.85;
        ctx.font = "700 16px ui-sans-serif, system-ui";
        ctx.fillText(`SYNC ${res.accuracyPct}% • ${label(res.accuracyPct)}`, 18, 76);
        ctx.globalAlpha = 0.6;
        ctx.font = "500 12px ui-sans-serif, system-ui";
        ctx.fillText(`MEAN ${Math.round(res.meanAbsMs)}ms • STD ${Math.round(res.stdMs)}ms • TAP TO RETRY`, 18, 98);
      }
      ctx.restore();

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [TARGET_SPM, intervalSec, phase, timeLeft, taps, res, seed]);

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
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/35 via-neutral-950/45 to-neutral-950/85" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/5 ring-1 ring-white/10 px-3 py-1 text-xs">
            <span className="opacity-80">Mileage Mafia</span>
            <span className="opacity-50">•</span>
            <span className="opacity-80">Cadence Duel</span>
          </div>

          <div className="pt-8 text-white/55 text-sm">
            Route: <span className="text-white/80">/cadence-duel</span>
          </div>
        </div>
      </div>
    </main>
  );
}
