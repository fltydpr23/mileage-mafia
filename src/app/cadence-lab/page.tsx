"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Phase = "idle" | "countdown" | "running" | "done";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function randInt(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

type Result = {
  winner: "YOU" | "BOT";
  timeSec: number;
  youTimeSec: number;
  botTimeSec: number;
  youTaps: number;
  botStyle: string;
};

function pickBotStyle() {
  const styles = [
    { name: "STEADY", desc: "smooth, consistent pace" },
    { name: "NEGATIVE SPLIT", desc: "starts calm, finishes hard" },
    { name: "EARLY PUNCH", desc: "fast start, fades late" },
    { name: "LATE KICK", desc: "chills then attacks near the end" },
  ];
  return styles[randInt(0, styles.length - 1)];
}

/**
 * Race model (units are arbitrary but consistent):
 * - trackLength = 1000 units (like 1km mini-duel)
 * - speed = units/sec
 * - taps add impulse to speed (but fatigue reduces efficiency)
 * - stamina drains from speed + tapping
 */
export default function RaceDuelPage() {
  const trackLength = 1000;
  const countdownSec = 3;

  // Tune these to make it "feels right"
  const BASE_DRAG = 1.65; // slows you down constantly
  const TAP_IMPULSE = 38; // speed boost per tap (pre-fatigue)
  const MAX_SPEED = 260;  // clamp speed
  const STAMINA_MAX = 100;
  const TAP_FATIGUE = 0.85; // stamina cost per tap
  const RUN_FATIGUE = 0.045; // stamina cost per speed per sec

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [countdown, setCountdown] = useState(countdownSec);

  const [result, setResult] = useState<Result | null>(null);
  const [hud, setHud] = useState({
    youProgress: 0,
    botProgress: 0,
    youSpeed: 0,
    botSpeed: 0,
    youStamina: STAMINA_MAX,
    botStamina: STAMINA_MAX,
    youTaps: 0,
  });

  // refs for simulation
  const startMsRef = useRef(0);
  const lastMsRef = useRef(0);

  const youRef = useRef({
    x: 0,
    v: 0,
    stamina: STAMINA_MAX,
    taps: 0,
    lastTapMs: 0,
  });

  const botRef = useRef({
    x: 0,
    v: 0,
    stamina: STAMINA_MAX,
    style: pickBotStyle(),
  });

  const seed = useMemo(() => Math.random() * 10000, []);

  const reset = () => {
    setPhase("idle");
    setCountdown(countdownSec);
    setResult(null);

    youRef.current = { x: 0, v: 0, stamina: STAMINA_MAX, taps: 0, lastTapMs: 0 };
    botRef.current = { x: 0, v: 0, stamina: STAMINA_MAX, style: pickBotStyle() };

    setHud({
      youProgress: 0,
      botProgress: 0,
      youSpeed: 0,
      botSpeed: 0,
      youStamina: STAMINA_MAX,
      botStamina: STAMINA_MAX,
      youTaps: 0,
    });
  };

  const start = () => {
    reset();
    setPhase("countdown");
    (navigator as any)?.vibrate?.(10);
  };

  const tap = () => {
    if (phase === "idle") return start();
    if (phase === "countdown") return;
    if (phase === "done") return start();
    if (phase !== "running") return;

    const you = youRef.current;
    const now = performance.now();

    // anti-spam: if you tap extremely fast, efficiency drops sharply
    const dt = you.lastTapMs ? (now - you.lastTapMs) : 9999;
    you.lastTapMs = now;

    // Efficiency curve:
    // - best tapping rhythm ~ 140–220ms between taps (feels like sprint cadence)
    // - too fast (<90ms) wastes energy
    const eff =
      dt < 90 ? 0.20 :
      dt < 130 ? 0.55 :
      dt < 220 ? 1.0 :
      dt < 340 ? 0.85 :
      0.70;

    // stamina affects impulse (tired legs)
    const staminaFactor = clamp(you.stamina / STAMINA_MAX, 0, 1);
    const impulse = TAP_IMPULSE * eff * (0.55 + 0.45 * staminaFactor);

    you.v = clamp(you.v + impulse, 0, MAX_SPEED);

    // stamina cost
    you.stamina = clamp(you.stamina - TAP_FATIGUE * (0.6 + (1 - eff)), 0, STAMINA_MAX);

    you.taps += 1;
    (navigator as any)?.vibrate?.(6);
  };

  // Countdown -> running
  useEffect(() => {
    if (phase !== "countdown") return;

    let c = countdownSec;
    setCountdown(c);

    const iv = window.setInterval(() => {
      c -= 1;
      setCountdown(c);
      if (c <= 0) {
        window.clearInterval(iv);
        startMsRef.current = performance.now();
        lastMsRef.current = startMsRef.current;
        setPhase("running");
      }
    }, 700);

    return () => window.clearInterval(iv);
  }, [phase]);

  // Simulation loop
  useEffect(() => {
    if (phase !== "running") return;

    const step = (now: number) => {
      const dt = clamp((now - lastMsRef.current) / 1000, 0, 0.05);
      lastMsRef.current = now;

      const you = youRef.current;
      const bot = botRef.current;

      // --- YOU physics ---
      // drag slows speed
      you.v = Math.max(0, you.v - BASE_DRAG * 60 * dt);

      // stamina drain from moving fast
      you.stamina = clamp(you.stamina - (you.v * RUN_FATIGUE) * dt, 0, STAMINA_MAX);

      // slight recovery if very slow (breathing)
      if (you.v < 70) you.stamina = clamp(you.stamina + 8 * dt, 0, STAMINA_MAX);

      // distance
      you.x = Math.min(trackLength, you.x + you.v * dt);

      // --- BOT behavior ---
      // Bot aims for a target speed profile based on race progress
      const p = bot.x / trackLength; // 0..1
      const staminaFactor = clamp(bot.stamina / STAMINA_MAX, 0, 1);

      // baseline target speed
      let targetV = 170;

      if (bot.style.name === "STEADY") {
        targetV = 175;
      } else if (bot.style.name === "NEGATIVE SPLIT") {
        targetV = lerp(160, 205, clamp(p, 0, 1));
      } else if (bot.style.name === "EARLY PUNCH") {
        targetV = p < 0.25 ? 215 : lerp(175, 160, clamp((p - 0.25) / 0.75, 0, 1));
      } else if (bot.style.name === "LATE KICK") {
        targetV = p < 0.75 ? 165 : lerp(175, 220, clamp((p - 0.75) / 0.25, 0, 1));
      }

      // stamina limits bot too
      targetV *= (0.62 + 0.38 * staminaFactor);

      // Bot "controller": move speed toward target
      const accel = 220; // how quickly bot adjusts
      bot.v = clamp(bot.v + clamp(targetV - bot.v, -accel * dt, accel * dt), 0, MAX_SPEED);

      // bot stamina drain
      bot.stamina = clamp(bot.stamina - (bot.v * (RUN_FATIGUE * 1.03)) * dt, 0, STAMINA_MAX);
      if (bot.v < 70) bot.stamina = clamp(bot.stamina + 7 * dt, 0, STAMINA_MAX);

      // bot distance
      bot.x = Math.min(trackLength, bot.x + bot.v * dt);

      // HUD update (throttle-ish)
      setHud({
        youProgress: you.x / trackLength,
        botProgress: bot.x / trackLength,
        youSpeed: you.v,
        botSpeed: bot.v,
        youStamina: you.stamina,
        botStamina: bot.stamina,
        youTaps: you.taps,
      });

      // Finish?
      if (you.x >= trackLength || bot.x >= trackLength) {
        const elapsed = (now - startMsRef.current) / 1000;
        const winner =
          you.x >= trackLength && bot.x >= trackLength
            ? (you.x >= bot.x ? "YOU" : "BOT")
            : you.x >= trackLength ? "YOU" : "BOT";

        // estimate finish times (rough)
        const youTime = you.x >= trackLength ? elapsed : elapsed + ((trackLength - you.x) / Math.max(you.v, 1));
        const botTime = bot.x >= trackLength ? elapsed : elapsed + ((trackLength - bot.x) / Math.max(bot.v, 1));

        setResult({
          winner,
          timeSec: elapsed,
          youTimeSec: youTime,
          botTimeSec: botTime,
          youTaps: you.taps,
          botStyle: `${bot.style.name} • ${bot.style.desc}`,
        });
        setPhase("done");
        (navigator as any)?.vibrate?.([12, 25, 12]);
        return;
      }

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase]);

  // Draw lanes + runners
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
      ctx.imageSmoothingEnabled = false;
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = (now: number) => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;

      ctx.clearRect(0, 0, w, h);

      // subtle grid
      ctx.save();
      ctx.globalAlpha = 0.10;
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
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
      ctx.stroke();
      ctx.restore();

      const padX = 28;
      const laneW = w - padX * 2;
      const laneH = 66;
      const laneGap = 22;

      const topY = h * 0.32;
      const youLaneY = topY + laneH + laneGap;

      // lane frames
      const lane = (y: number) => {
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.strokeStyle = "rgba(255,255,255,0.28)";
        ctx.lineWidth = 1;
        ctx.strokeRect(padX + 0.5, y + 0.5, laneW - 1, laneH - 1);

        ctx.globalAlpha = 0.10;
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        // dashed markers
        const t = (now * 0.001 + seed) * 80;
        for (let x = padX; x < padX + laneW; x += 30) {
          const xx = x - (t % 30);
          ctx.fillRect(xx, y + laneH / 2 - 1, 14, 2);
        }
        ctx.restore();
      };

      lane(topY);
      lane(youLaneY);

      // finish line
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      const finishX = padX + laneW - 18;
      ctx.fillRect(finishX, topY - 10, 2, laneH * 2 + laneGap + 20);
      ctx.restore();

      // runners
      const botX = padX + hud.botProgress * (laneW - 36);
      const youX = padX + hud.youProgress * (laneW - 36);

      const drawRunner = (x: number, y: number, isYou: boolean) => {
        // body block
        ctx.save();
        ctx.globalAlpha = isYou ? 0.92 : 0.70;
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.fillRect(Math.round(x), Math.round(y + 18), 18, 18);

        // legs “animate” based on speed
        const wiggle = Math.sin((now * 0.001) * (2 + (isYou ? hud.youSpeed : hud.botSpeed) / 90)) * 3;
        ctx.fillRect(Math.round(x + 2), Math.round(y + 36 + wiggle), 5, 8);
        ctx.fillRect(Math.round(x + 11), Math.round(y + 36 - wiggle), 5, 8);

        // head
        ctx.globalAlpha = isYou ? 0.85 : 0.60;
        ctx.fillRect(Math.round(x + 6), Math.round(y + 8), 6, 6);

        ctx.restore();
      };

      drawRunner(botX, topY, false);
      drawRunner(youX, youLaneY, true);

      // labels
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "600 13px ui-sans-serif, system-ui";
      ctx.fillText("BOT", padX, topY - 10);
      ctx.fillText("YOU", padX, youLaneY - 10);
      ctx.restore();

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [hud, seed]);

  const title =
    phase === "idle" ? "Tap anywhere to start" :
    phase === "countdown" ? `Lock in. ${countdown}` :
    phase === "running" ? "TAP TO RUN. CONTROL > SPAM." :
    "Tap anywhere to rematch";

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div
        className="relative min-h-screen overflow-hidden select-none"
        onPointerDown={(e) => {
          e.preventDefault();
          tap();
        }}
        style={{ touchAction: "manipulation" }}
      >
        <canvas ref={canvasRef} className="absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/25 via-neutral-950/40 to-neutral-950/85" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/5 ring-1 ring-white/10 px-3 py-1 text-xs">
                <span className="opacity-80">Mileage Mafia</span>
                <span className="opacity-40">•</span>
                <span className="opacity-80">Race Duel</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight">
                Beat the bot.
              </h1>
              <p className="max-w-2xl text-white/70">
                Two lanes. Tap to accelerate. Spam tapping wastes energy. Control wins.
              </p>
            </div>

            <button
              className="rounded-2xl bg-white/10 ring-1 ring-white/15 px-4 py-2 text-sm hover:bg-white/15 active:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                reset();
              }}
            >
              Reset
            </button>
          </div>

          <div className="mt-8 rounded-3xl bg-neutral-900/60 ring-1 ring-neutral-800 p-6 sm:p-8">
            <div className="text-sm text-white/70">{title}</div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Hud label="You speed" value={`${Math.round(hud.youSpeed)} u/s`} />
              <Hud label="Bot speed" value={`${Math.round(hud.botSpeed)} u/s`} />
              <Hud label="Your stamina" value={`${Math.round(hud.youStamina)}%`} />
              <Hud label="Your taps" value={`${hud.youTaps}`} />
            </div>

            <div className="mt-4">
              <div className="text-xs text-white/55">BOT PROFILE</div>
              <div className="text-sm text-white/80">{botRef.current.style.name} • {botRef.current.style.desc}</div>
            </div>

            {phase === "done" && result && (
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-3xl bg-white/5 ring-1 ring-white/10 p-6">
                  <div className="text-xs text-white/60">WINNER</div>
                  <div className="mt-1 text-4xl font-semibold tracking-tight">{result.winner}</div>
                  <div className="mt-2 text-white/70 text-sm">
                    Bot: {result.botStyle}
                  </div>
                </div>
                <div className="rounded-3xl bg-white/5 ring-1 ring-white/10 p-6">
                  <div className="text-xs text-white/60">TIMES</div>
                  <div className="mt-2 text-white/80 text-sm">
                    You: {result.youTimeSec.toFixed(2)}s • Bot: {result.botTimeSec.toFixed(2)}s
                  </div>
                  <div className="mt-1 text-white/55 text-xs">
                    (Times are approximations — it’s a hype duel, not a physics engine.)
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 text-white/55 text-sm">
            Route: <span className="text-white/80">/race-duel</span>
          </div>
        </div>
      </div>
    </main>
  );
}

function Hud({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
      <div className="text-xs text-white/60">{label}</div>
      <div className="text-sm font-semibold text-white/90 mt-1">{value}</div>
    </div>
  );
}
