"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAudio } from "@/components/AudioProvider";

function clsx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function LoginDoorPage() {
  const router = useRouter();
  const audio = useAudio();

  const [pw, setPw] = useState("");
  const [errFlash, setErrFlash] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const pwRef = useRef<HTMLInputElement | null>(null);

  // UX: ambience first, then reveal text slowly
  const [showTitle, setShowTitle] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  const [audioBlocked, setAudioBlocked] = useState(false);

  const [hintOpen, setHintOpen] = useState(false);

  const timersRef = useRef<number[]>([]);
  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  // one-shot boot for this page visit
  const bootedRef = useRef(false);

  const bootAudioFromGesture = useCallback(async () => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    setAudioBlocked(false);

    try {
      await (audio as any)?.unlock?.();
      await (audio as any)?.preloadSfx?.();

      // Start ambience first (tiny delay keeps it reliable on some mobile browsers)
      const tA = window.setTimeout(() => {
        void (async () => {
          try {
            await (audio as any)?.playAmbience?.();
          } catch {
            setAudioBlocked(true);
          }
        })();
      }, 220);

      // Then reveal text slowly (cinematic)
      const t1 = window.setTimeout(() => setShowTitle(true), 2100);
      const t2 = window.setTimeout(() => {
        setShowPrompt(true);
        requestAnimationFrame(() => pwRef.current?.focus());
      }, 3200);

      timersRef.current.push(tA, t1, t2);
    } catch {
      bootedRef.current = false;
      setAudioBlocked(true);
    }
  }, [audio]);

  // also boot if user only types
  useEffect(() => {
    const onFirstKey = () => void bootAudioFromGesture();
    window.addEventListener("keydown", onFirstKey, { once: true });
    return () => window.removeEventListener("keydown", onFirstKey);
  }, [bootAudioFromGesture]);

  useEffect(() => {
    // reset visuals each mount
    setShowTitle(false);
    setShowPrompt(false);
    setHintOpen(false);
    clearTimers();

    return () => clearTimers();
  }, [clearTimers]);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;

      // boot attempt on submit too
      void bootAudioFromGesture();

      if (!pw.trim()) {
        setErrFlash(true);
        window.setTimeout(() => setErrFlash(false), 450);
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
          window.setTimeout(() => setErrFlash(false), 650);
          requestAnimationFrame(() => pwRef.current?.focus());
          return;
        }

        // ✅ allow next pages (simple gate)
        try {
          sessionStorage.setItem("mm_pw_ok", "1");
        } catch {}

        router.push("/login/invocation");
      } finally {
        setSubmitting(false);
      }
    },
    [pw, submitting, router, bootAudioFromGesture]
  );

  return (
    <main
      className="fixed inset-0 bg-black text-white overflow-hidden"
      onPointerDown={() => void bootAudioFromGesture()}
      onTouchStart={() => void bootAudioFromGesture()}
      onKeyDownCapture={() => void bootAudioFromGesture()}
    >
      {/* CRT/static layers */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 mm-static opacity-[0.14] mix-blend-screen" />
        <div className="absolute inset-0 mm-scanlines opacity-[0.10] mix-blend-screen" />
        <div className="absolute inset-0 mm-vignette" />
      </div>

      <div className="relative h-full w-full grid place-items-center px-6">
        <form onSubmit={onSubmit} className="w-full max-w-[520px]">
          <div className="text-center">
            <div
              className={clsx(
                "select-none",
                "text-[11px] sm:text-[12px]",
                "text-neutral-200",
                "leading-none",
                "transition-opacity duration-[1200ms] ease-out",
                showTitle ? "opacity-100" : "opacity-0"
              )}
              style={{
                fontFamily:
                  "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, 'Segoe UI', Roboto, sans-serif",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              mileage mafia
            </div>

            <div className="mt-10 flex items-center justify-center font-mono text-[14px] sm:text-[15px] text-neutral-200">
              <span className={clsx("mr-2 transition-opacity duration-500", showPrompt ? "opacity-100" : "opacity-0")}>
                &gt;
              </span>

              <input
                ref={pwRef}
                type="password"
                value={pw}
                onFocus={() => void bootAudioFromGesture()}
                onKeyDown={() => void bootAudioFromGesture()}
                onChange={(e) => setPw(e.target.value)}
                autoComplete="current-password"
                enterKeyHint="go"
                spellCheck={false}
                disabled={submitting}
                className={clsx(
                  "bg-transparent outline-none",
                  "w-[min(360px,78vw)]",
                  "text-neutral-100",
                  "placeholder:text-neutral-700",
                  errFlash ? "mm-shake" : ""
                )}
                style={{ opacity: showPrompt ? 1 : 0, transition: "opacity 520ms ease" }}
                aria-label="Password"
              />
            </div>

            {/* Forgot password under input */}
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setHintOpen((v) => !v)}
                className="text-[11px] tracking-[0.12em] uppercase text-neutral-500 hover:text-neutral-300 transition"
              >
                forgot your password?
              </button>

              <div
                className={clsx(
                  "mt-3 text-[11px] tracking-[0.18em] uppercase text-neutral-300",
                  "transition-all duration-500 ease-out",
                  hintOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none"
                )}
              >
                respect all.
              </div>
            </div>

            <div className="mt-10 h-5 text-[10px] uppercase tracking-[0.35em] text-neutral-700">
              {audioBlocked ? "tap / type once to enable audio" : "\u00A0"}
            </div>

            <button type="submit" className="hidden" aria-hidden />
          </div>
        </form>
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
