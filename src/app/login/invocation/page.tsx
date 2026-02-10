"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAudio } from "@/components/AudioProvider";
import { Cinzel, Inter } from "next/font/google";

function clsx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

// Premium ritual fonts
const ritual = Cinzel({ subsets: ["latin"], weight: ["400", "600"] });
const ui = Inter({ subsets: ["latin"], weight: ["400", "500", "600"] });

const EMPH = "rgba(239, 68, 68, 0.88)"; // emphasis red

export default function InvocationPage() {
  const router = useRouter();
  const audio = useAudio();

  const lines = useMemo(
    () => [
      "before language",
      "there was breath",
      "",
      "before systems",
      "there was movement",
      "",
      "the body remembers",
      "",
      "running is the simplest rebellion",
      "the most accessible form of discipline",
      "the closest thing to meditation we were born knowing",
      "",
      "mileage mafia",
      "",
      "press any key",
    ],
    []
  );

  const [visibleCount, setVisibleCount] = useState(0);
  const [ready, setReady] = useState(false); // becomes true after full reveal
  const [audioBlocked, setAudioBlocked] = useState(false);

  const timersRef = useRef<number[]>([]);
  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  const bootedRef = useRef(false);

  // Gate access (must have passed password) — avoid replaceState spam
  useEffect(() => {
    let ok = false;
    try {
      ok = sessionStorage.getItem("mm_pw_ok") === "1";
    } catch {
      ok = false;
    }
    if (!ok) {
      router.replace("/login");
      return;
    }
  }, [router]);

  const proceed = useCallback(() => {
    router.push("/login/oath");
  }, [router]);

  // Boot audio reliably from a real gesture (and keep ambience running here)
  const bootAudioFromGesture = useCallback(async () => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    setAudioBlocked(false);

    try {
      await (audio as any)?.unlock?.();
      await (audio as any)?.preloadSfx?.();

      // Start ambience (Invocation wants sound bed while text comes in)
      const tA = window.setTimeout(() => {
        void (async () => {
          try {
            await (audio as any)?.playAmbience?.();
          } catch {
            setAudioBlocked(true);
          }
        })();
      }, 120);

      timersRef.current.push(tA);
    } catch {
      bootedRef.current = false;
      setAudioBlocked(true);
    }
  }, [audio]);

  // Cinematic reveal timing (Kojima-ish: not too fast, not too slow)
  useEffect(() => {
    clearTimers();
    setVisibleCount(0);
    setReady(false);

    const ambienceLeadIn = 2800; // “few seconds” of only sound
    const baseDelay = 2200; // cadence per line
    const blankDelay = 1800; // pauses between stanzas
    const endBuffer = 1600; // let it breathe before allowing proceed

    let t = ambienceLeadIn;

    lines.forEach((line, i) => {
      const id = window.setTimeout(() => {
        setVisibleCount((v) => Math.max(v, i + 1));
      }, t);
      timersRef.current.push(id);

      const isBlank = line.trim() === "";
      t += isBlank ? blankDelay : baseDelay;
    });

    const doneId = window.setTimeout(() => setReady(true), t + endBuffer);
    timersRef.current.push(doneId);

    return () => clearTimers();
  }, [lines, clearTimers]);

  const renderLine = (line: string) => {
    const parts = line.split(/(breath|movement|discipline)/gi);
    return (
      <>
        {parts.map((p, idx) => {
          const key = `${p}-${idx}`;
          const low = p.toLowerCase();
          if (low === "breath" || low === "movement" || low === "discipline") {
            return (
              <span key={key} style={{ color: EMPH }}>
                {p}
              </span>
            );
          }
          return <span key={key}>{p}</span>;
        })}
      </>
    );
  };

  // Interaction:
  // - First key/tap (if still revealing): jump to end
  // - Next key/tap (when ready): proceed
  const skipOrProceed = useCallback(() => {
    void bootAudioFromGesture();

    if (!ready) {
      setVisibleCount(lines.length);
      setReady(true);
      return;
    }
    proceed();
  }, [ready, proceed, lines.length, bootAudioFromGesture]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return;
      e.preventDefault();
      skipOrProceed();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [skipOrProceed]);

  return (
    <main
      className={clsx(
        "fixed inset-0 bg-black text-white overflow-hidden",
        // subtle “cinema” feel
        "select-none"
      )}
      onPointerDown={() => skipOrProceed()}
      onTouchStart={() => skipOrProceed()}
      onKeyDownCapture={() => void bootAudioFromGesture()}
    >
      {/* Moving TV static / CRT */}
      <div className="pointer-events-none absolute inset-0">
        {/* base flicker */}
        <div className="absolute inset-0 mm-tv-flicker" />
        {/* animated noise layers */}
        <div className="absolute inset-0 mm-tv-noiseA opacity-[0.12] mix-blend-overlay" />
        <div className="absolute inset-0 mm-tv-noiseB opacity-[0.10] mix-blend-overlay" />
        {/* scanlines */}
        <div className="absolute inset-0 mm-tv-scanlines opacity-[0.10] mix-blend-overlay" />
        {/* rolling band */}
        <div className="absolute inset-0 mm-tv-roll opacity-[0.10] mix-blend-screen" />
        {/* vignette */}
        <div className="absolute inset-0 mm-vignette" />
      </div>

      <div className="relative h-full w-full grid place-items-center px-6">
        <div className="w-full max-w-[760px]">
          <div className="mx-auto text-center">
            <div className="space-y-3">
              {lines.map((line, i) => {
                const visible = i < visibleCount;
                const isBlank = line.trim() === "";
                if (isBlank) return <div key={i} className="h-4 sm:h-5" aria-hidden />;

                const low = line.toLowerCase();
                const isMM = low === "mileage mafia";
                const isPress = low.includes("press any key");

                return (
                  <div
                    key={i}
                    className={clsx(
                      "transition-all",
                      visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                    )}
                    style={{
                      transitionDuration: "950ms",
                      transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",

                      // premium typography
                      fontFamily: isPress ? ui.style.fontFamily : ritual.style.fontFamily,

                      // the “ritual spacing”
                      letterSpacing: isPress ? "0.28em" : isMM ? "0.22em" : "0.08em",
                      textTransform: isPress ? "uppercase" : "lowercase",

                      fontWeight: isPress ? 500 : isMM ? 600 : 400,

                      // sizing: cinematic small + controlled
                      fontSize: isPress ? "11px" : isMM ? "12px" : "16px",
                      lineHeight: isMM ? "2.0" : "1.8",

                      color: isPress
                        ? "rgba(229,229,229,0.72)"
                        : isMM
                        ? "rgba(245,245,245,0.86)"
                        : "rgba(245,245,245,0.92)",

                      // subtle glow, very restrained
                      textShadow: isPress
                        ? "0 0 0 rgba(0,0,0,0)"
                        : "0 0 18px rgba(255,255,255,0.045)",
                    }}
                  >
                    {renderLine(line)}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 h-5 text-[10px] uppercase tracking-[0.35em] text-neutral-700">
              {audioBlocked ? "tap / type once to enable audio" : "\u00A0"}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        /* ===== Moving TV / CRT vibe ===== */

        /* low-frequency flicker */
        .mm-tv-flicker{
          background: rgba(255,255,255,0.02);
          animation: mmFlicker 6.2s steps(1,end) infinite;
          transform: translateZ(0);
        }
        @keyframes mmFlicker{
          0%,100%{ opacity: 0.06; }
          11%{ opacity: 0.03; }
          12%{ opacity: 0.08; }
          56%{ opacity: 0.04; }
          57%{ opacity: 0.075; }
          76%{ opacity: 0.035; }
        }

        /* noise A: drifting */
        .mm-tv-noiseA{
          background-image:
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='260'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.72' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='260' height='260' filter='url(%23n)' opacity='.60'/%3E%3C/svg%3E");
          background-size: 420px 420px;
          animation: mmNoiseA 7.8s linear infinite;
          transform: translateZ(0);
        }
        @keyframes mmNoiseA{
          0%{ transform: translate3d(0,0,0); }
          50%{ transform: translate3d(-18px,10px,0); }
          100%{ transform: translate3d(0,0,0); }
        }

        /* noise B: faster, slight scale + opacity wobble */
        .mm-tv-noiseB{
          background-image:
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.92' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E");
          background-size: 360px 360px;
          animation: mmNoiseB 1.9s steps(2,end) infinite;
          transform: translateZ(0);
        }
        @keyframes mmNoiseB{
          0%{ opacity: 0.06; transform: translate3d(0,0,0) scale(1); }
          25%{ opacity: 0.10; transform: translate3d(10px,-8px,0) scale(1.02); }
          50%{ opacity: 0.07; transform: translate3d(-8px,10px,0) scale(1.01); }
          75%{ opacity: 0.11; transform: translate3d(12px,6px,0) scale(1.03); }
          100%{ opacity: 0.06; transform: translate3d(0,0,0) scale(1); }
        }

        /* scanlines */
        .mm-tv-scanlines{
          background: repeating-linear-gradient(
            to bottom,
            rgba(255,255,255,0.06),
            rgba(255,255,255,0.06) 1px,
            transparent 1px,
            transparent 5px
          );
          transform: translateZ(0);
        }

        /* vertical rolling band (very subtle) */
        .mm-tv-roll{
          background: linear-gradient(
            to bottom,
            transparent,
            rgba(255,255,255,0.06),
            transparent
          );
          height: 40%;
          width: 100%;
          position: absolute;
          left: 0;
          top: -40%;
          animation: mmRoll 5.8s linear infinite;
          filter: blur(0.3px);
        }
        @keyframes mmRoll{
          0%{ transform: translateY(0); }
          100%{ transform: translateY(240%); }
        }

        /* vignette to feel “cinematic” */
        .mm-vignette{
          background:
            radial-gradient(1100px circle at 50% 34%, rgba(255,255,255,0.025), transparent 62%),
            radial-gradient(900px circle at 50% 120%, rgba(0,0,0,0.94), transparent 64%),
            radial-gradient(1200px circle at 50% 35%, transparent 46%, rgba(0,0,0,0.98) 86%);
        }
      `}</style>
    </main>
  );
}
