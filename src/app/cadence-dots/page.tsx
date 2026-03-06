"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const onChange = () => setReduced(!!mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

type DotEvent = {
  t: number; // seconds
  side: 0 | 1; // 0 = L, 1 = R
  jitter: number; // small variation
};

type DotsProps = {
  cadenceSpm?: number;
  laneGapPx?: number;
  flowSpeed?: number; // pixels/sec
};

function CadenceDotsCanvas({ cadenceSpm = 176, laneGapPx = 56, flowSpeed = 55 }: DotsProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  const seed = useMemo(() => Math.random() * 10000, []);
  const eventsRef = useRef<DotEvent[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
      const w = parent.clientWidth;
      const h = parent.clientHeight;

      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const secondsPerStep = 60 / clamp(cadenceSpm, 120, 240);

    // initialize buffer of events covering ~12 seconds
    const initEvents = (tNow: number) => {
      const events: DotEvent[] = [];
      const horizon = 12;
      let t = tNow - horizon;
      let side: 0 | 1 = 0;
      while (t < tNow + 1) {
        const jitter = (Math.sin(t * 3.1 + seed) + Math.sin(t * 1.7 + seed * 0.1)) * 0.18;
        events.push({ t, side, jitter });
        side = side === 0 ? 1 : 0;
        t += secondsPerStep;
      }
      eventsRef.current = events;
    };

    const ensureEvents = (tNow: number) => {
      const events = eventsRef.current;
      if (events.length === 0) initEvents(tNow);

      // append forward if needed
      const last = events[events.length - 1];
      const horizonForward = 2;
      while (last && last.t < tNow + horizonForward) {
        const nextT = last.t + secondsPerStep;
        const nextSide: 0 | 1 = last.side === 0 ? 1 : 0;
        const jitter =
          (Math.sin(nextT * 3.1 + seed) + Math.sin(nextT * 1.7 + seed * 0.1)) * 0.18;
        events.push({ t: nextT, side: nextSide, jitter });
      }

      // prune old
      const horizonBack = 14;
      while (events.length > 0 && events[0].t < tNow - horizonBack) events.shift();
    };

    const render = (now: number) => {
      const parent = canvas.parentElement;
      if (!parent) return;

      const w = parent.clientWidth;
      const h = parent.clientHeight;

      ctx.clearRect(0, 0, w, h);

      // lanes centered
      const midX = w * 0.5;
      const leftX = midX - laneGapPx * 0.5;
      const rightX = midX + laneGapPx * 0.5;

      // subtle lane guides
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.beginPath();
      ctx.moveTo(leftX + 0.5, 0);
      ctx.lineTo(leftX + 0.5, h);
      ctx.moveTo(rightX + 0.5, 0);
      ctx.lineTo(rightX + 0.5, h);
      ctx.stroke();
      ctx.restore();

      const t = reducedMotion ? 0 : now * 0.001 + seed * 0.0001;

      ensureEvents(t);

      // dots flow upward (timeline)
      const baseY = h * 0.92;

      const events = eventsRef.current;

      for (const e of events) {
        const age = t - e.t; // seconds since event
        const y = baseY - age * flowSpeed;

        // skip out of bounds
        if (y < -40 || y > h + 40) continue;

        // fade with age
        const fade = clamp(1 - age / 8, 0, 1);
        const alpha = 0.10 + fade * 0.55;

        const x = e.side === 0 ? leftX : rightX;

        // size: emphasize most recent steps
        const size = 3.2 + fade * 5.8;

        // subtle horizontal jitter for “stability”
        const jx = e.jitter * 10;

        // draw glow
        ctx.save();
        ctx.globalAlpha = alpha * 0.35;
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.beginPath();
        ctx.arc(x + jx, y, size * 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // draw core dot
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.beginPath();
        ctx.arc(x + jx, y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // center "now" marker
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(midX - 90, baseY + 0.5);
      ctx.lineTo(midX + 90, baseY + 0.5);
      ctx.stroke();
      ctx.restore();

      // labels
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.font = "600 14px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(`CADENCE • ${Math.round(cadenceSpm)} SPM`, 18, 28);

      ctx.globalAlpha = 0.6;
      ctx.font = "500 12px ui-sans-serif, system-ui";
      ctx.fillText("Left/Right step pulses as a timeline.", 18, 48);

      ctx.globalAlpha = 0.5;
      ctx.font = "600 11px ui-sans-serif, system-ui";
      ctx.fillText("L", leftX - 6, 72);
      ctx.fillText("R", rightX - 6, 72);
      ctx.restore();

      if (!reducedMotion) raf = requestAnimationFrame(render);
    };

    render(performance.now());

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [cadenceSpm, laneGapPx, flowSpeed, reducedMotion, seed]);

  return <canvas ref={canvasRef} className="absolute inset-0" />;
}

export default function CadenceDotsPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="relative min-h-screen overflow-hidden">
        <div className="absolute inset-0">
          <CadenceDotsCanvas cadenceSpm={176} laneGapPx={64} flowSpeed={55} />
          <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/55 via-neutral-950/55 to-neutral-950/85" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-6">
          <header className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/5 ring-1 ring-white/10 px-3 py-1 text-xs">
              <span className="opacity-80">Mileage Mafia</span>
              <span className="opacity-50">•</span>
              <span className="opacity-80">Cadence L/R Dots</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight">
              Left/Right cadence dots.
            </h1>

            <p className="max-w-2xl text-white/75">
              The most “runner-specific” one: cadence becomes alternating footsteps, not a waveform.
            </p>
          </header>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-stretch">
            <div className="rounded-3xl bg-neutral-900/65 ring-1 ring-neutral-800 p-6 sm:p-8 md:p-10">
              <h2 className="text-xl font-semibold">Why it works</h2>
              <ul className="mt-3 text-white/70 space-y-2 list-disc pl-5">
                <li>Very low motion complexity</li>
                <li>Cadence is obvious: L-R-L-R</li>
                <li>Can encode stability via jitter</li>
              </ul>
            </div>

            <div className="rounded-3xl bg-neutral-900/65 ring-1 ring-neutral-800 p-6 sm:p-8 md:p-10">
              <h2 className="text-xl font-semibold">Tune</h2>
              <ul className="mt-3 text-white/70 space-y-2 list-disc pl-5">
                <li>flowSpeed controls calmness</li>
                <li>laneGap controls spacing</li>
              </ul>
            </div>
          </section>

          <footer className="pt-6 text-white/55 text-sm">
            Route: <span className="text-white/80">/cadence-dots</span>
          </footer>
        </div>
      </div>
    </main>
  );
}
