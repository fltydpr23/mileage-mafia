"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";
import { DotGothic16 } from "next/font/google";
import { motion, AnimatePresence } from "framer-motion";
import TronTrack3D from "@/components/TronTrack3D";
import { useAudio } from "@/components/AudioProvider";

const dotGothic = DotGothic16({
  weight: "400",
  subsets: ["latin"],
});

function clsx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function LoginDoorPage() {
  const router = useRouter();

  const [pw, setPw] = useState("");
  const [errFlash, setErrFlash] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const pwRef = useRef<HTMLInputElement | null>(null);

  // UX: ambience first, then reveal text slowly
  const [showGrid, setShowGrid] = useState(false);
  const [showUI, setShowUI] = useState(false);

  // Transition State
  const [isWarping, setIsWarping] = useState(false);

  const { playMusic } = useAudio();

  useEffect(() => {
    // Pure black for 4s, then fade in grid
    const tGrid = setTimeout(() => setShowGrid(true), 4000);
    // 2s later, fade in text UI
    const tUI = setTimeout(() => setShowUI(true), 6000);
    return () => {
      clearTimeout(tGrid);
      clearTimeout(tUI);
    }
  }, []);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting || isWarping) return;

      if (!pw.trim()) {
        setErrFlash(true);
        setTimeout(() => setErrFlash(false), 450);
        return;
      }

      setSubmitting(true);
      setErrFlash(false);

      try {
        const res = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: pw }),
        });

        const data = await res.json().catch(() => ({ ok: false }));
        if (!data.ok) {
          setPw("");
          setErrFlash(true);
          setTimeout(() => setErrFlash(false), 650);
          requestAnimationFrame(() => pwRef.current?.focus());
          return;
        }

        // Access Granted -> Trigger Warp Speed Transition
        try {
          sessionStorage.setItem("mm_pw_ok", "1");
        } catch { }

        // Start the music exactly as the warp jump triggers
        playMusic(0).catch(() => { });

        setIsWarping(true);
        setShowUI(false); // hide UI during warp

        // Wait for warp visual effect to peak before routing
        setTimeout(() => {
          router.push("/leaderboard");
        }, 1500);

      } finally {
        setSubmitting(false);
      }
    },
    [pw, submitting, isWarping, router]
  );

  return (
    <main className="fixed inset-0 bg-black text-white overflow-hidden">

      {/* 3D Immersive Track Background */}
      <AnimatePresence>
        {(showGrid || isWarping) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 3, ease: "easeOut" }}
            className="absolute inset-0 z-0"
          >
            <TronTrack3D runners={[]} activeRunner={null} isWarping={isWarping} showTrack={isWarping} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* CRT/static layers overlaying track */}
      <AnimatePresence>
        {(showGrid || isWarping) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 3 }}
            className="pointer-events-none absolute inset-0 z-0"
          >
            <div className="absolute inset-0 mm-static mix-blend-screen" />
            <div className="absolute inset-0 mm-scanlines mix-blend-screen" />
            <div className="absolute inset-0 mm-vignette" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 h-full w-full grid place-items-center px-6">
        <AnimatePresence>
          {showUI && (
            <motion.form
              initial={{ opacity: 0, y: 10, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -20, scale: 1.05, filter: "blur(10px)", transition: { duration: 0.4 } }}
              transition={{ duration: 2.5, ease: "easeOut" }}
              onSubmit={onSubmit}
              className="w-full max-w-[520px] pb-32"
            >
              <div className="text-center">
                <div
                  className={clsx(
                    "select-none",
                    "text-[24px] sm:text-[32px]",
                    "font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-cyan-500",
                    "leading-none drop-shadow-[0_0_15px_rgba(0,255,255,0.4)]",
                    dotGothic.className
                  )}
                  style={{
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                    letterSpacing: "0.15em",
                  }}
                >
                  mileage mafia
                </div>

                <div className="mt-14 relative flex items-center justify-start w-[min(320px,78vw)] mx-auto font-mono text-[14px] sm:text-[15px] text-cyan-400">
                  <span className="absolute -left-6 opacity-80 animate-pulse">
                    &gt;
                  </span>

                  <input
                    ref={pwRef}
                    type="password"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    autoComplete="current-password"
                    enterKeyHint="go"
                    spellCheck={false}
                    disabled={submitting || isWarping}
                    className={clsx(
                      "w-full bg-transparent outline-none",
                      "text-white tracking-[0.3em] relative z-10",
                      "placeholder:text-cyan-900/50",
                      "border-b border-cyan-800 focus:border-cyan-400 transition-colors pb-1",
                      errFlash ? "mm-shake border-red-500 text-red-400" : ""
                    )}
                    placeholder="ENTER OPERATIVE CODE"
                    aria-label="Password"
                    autoFocus
                  />
                </div>

                {isWarping && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-8 text-cyan-400 font-bold tracking-widest uppercase text-sm animate-pulse"
                  >
                    ACCESS GRANTED. INITIALIZING WARP...
                  </motion.div>
                )}

                <button type="submit" className="hidden" aria-hidden />
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        .mm-static{
          background-image:
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.78' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='220' height='220' filter=contrast(140%) brightness(115%);/%3E%3C/svg%3E");
          background-size: 320px 320px;
          animation: mmNoiseDrift 4.8s linear infinite;
          transform: translateZ(0);
        }
        @keyframes mmNoiseDrift{
          0%{ transform: translate3d(0,0,0); }
          50%{ transform: translate3d(-12px,8px,0); }
          100%{ transform: translate3d(0,0,0); }
        }

        .mm-scanlines{
          background: repeating-linear-gradient(
            to bottom,
            rgba(255,255,255,0.07),
            rgba(255,255,255,0.07) 1px,
            transparent 1px,
            transparent 4px
          );
          transform: translateZ(0);
        }

        .mm-vignette{
          background:
            radial-gradient(1100px circle at 50% 38%, rgba(255,255,255,0.04), transparent 60%),
            radial-gradient(1000px circle at 50% 120%, rgba(0,0,0,0.92), transparent 62%),
            radial-gradient(1200px circle at 50% 35%, transparent 45%, rgba(0,0,0,0.96) 82%);
        }

        .mm-shake{
          animation: mmShake 220ms ease-in-out 0s 2;
        }
        @keyframes mmShake{
          0%{ transform: translateX(0); }
          25%{ transform: translateX(-6px); }
          50%{ transform: translateX(6px); }
          75%{ transform: translateX(-4px); }
          100%{ transform: translateX(0); }
        }
      `}</style>
    </main>
  );
}
