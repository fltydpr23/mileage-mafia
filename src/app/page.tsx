"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { setAuthed } from "@/lib/auth";
import { useAudio } from "@/components/AudioProvider";

type Step = "LOCK" | "OATH" | "REVIEW" | "GRANTED";
type Rule = { id: string; text: string };

const ACCENT = {
  ring: "ring-red-500/25",
  ringStrong: "ring-red-500/35",
  text: "text-red-200",
  bgSoft: "bg-red-500/10",
};

function clsx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function LoginPage() {
  const router = useRouter();
  const audio = useAudio();

  const [step, setStep] = useState<Step>("LOCK");

  // LOCK
  const [pw, setPw] = useState("");
  const [errFlash, setErrFlash] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const pwRef = useRef<HTMLInputElement | null>(null);

  // LOCK intro
  const [showTitle, setShowTitle] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  // Forgot password hint
  const [showHint, setShowHint] = useState(false);

  // Audio
  const [audioBlocked, setAudioBlocked] = useState(false);

  // REVIEW
  const [reviewCleared, setReviewCleared] = useState(false);
  const REVIEW_CLEAR_MS = 2400;
  const REVIEW_TOTAL_MS = 3900;

  // Guards
  const grantedFiredRef = useRef(false);
  const lastStampAtRef = useRef(0);

  // ===== audio bootstrap + timing control =====
  const bootedRef = useRef(false);
  const ambienceStartedRef = useRef(false);
  const stopAmbienceBeforeStampRef = useRef(false);

  // cancel pending timers
  const lockTimersRef = useRef<number[]>([]);
  const clearLockTimers = useCallback(() => {
    lockTimersRef.current.forEach((id) => window.clearTimeout(id));
    lockTimersRef.current = [];
  }, []);

  const stopMainTrack = useCallback(() => {
    try {
      (audio as any)?.stop?.();
      (audio as any)?.pause?.();
    } catch {}
  }, [audio]);

  // OATH rules (unchanged)
  const RULES: Rule[] = useMemo(
    () => [
      { id: "target", text: "I have pledged an annual mileage target. Once sworn, this target is final." },
      { id: "entryfee", text: "I have contributed ₹1000 to the family pot. Payment is mandatory." },
      {
        id: "clause85",
        text: "If I fail to reach 85% of my annual target by December 31st, an additional penalty of ₹1000 will be charged.",
      },
      {
        id: "first",
        text: "The first member to reach 100% of their annual target will receive a ₹1000 leader bonus, funded equally by the remaining members.",
      },
      { id: "noexcuses", text: "Conditions, injuries, devices, or circumstances do not alter the terms. Only completed distance is recognized." },
      { id: "respect", text: "Disorder, manipulation, or disrespect will be met with penalties at the discretion of the mafia." },
      { id: "strava", text: "If the activity is not logged on Strava, it doesn't count." },
      { id: "closing", text: "I accept these terms willingly. I enter the Mileage Mafia by choice, and remain by discipline." },
    ],
    []
  );

  const initialChecks = useMemo<Record<string, boolean>>(
    () => Object.fromEntries(RULES.map((r) => [r.id, false] as const)),
    [RULES]
  );

  const [checks, setChecks] = useState<Record<string, boolean>>(initialChecks);
  const [sig, setSig] = useState("");

  useEffect(() => setChecks(initialChecks), [initialChecks]);

  const allChecked = RULES.every((r) => !!checks[r.id]);
  const signed = sig.trim().length >= 3;
  const canSwear = allChecked && signed;

  const goLedger = useCallback(() => router.push("/leaderboard"), [router]);

  const toggleRule = useCallback((id: string) => {
    setChecks((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // -------------------
  // Audio helpers
  // -------------------
  const startAmbience = useCallback(async () => {
    setAudioBlocked(false);
    try {
      await (audio as any)?.playAmbience?.();
      ambienceStartedRef.current = true;
    } catch {
      setAudioBlocked(true);
      ambienceStartedRef.current = false;
      throw new Error("ambience blocked");
    }
  }, [audio]);

  const startNoir = useCallback(async () => {
    setAudioBlocked(false);
    try {
      await (audio as any)?.playMusic?.(0);
    } catch {
      setAudioBlocked(true);
      throw new Error("music blocked");
    }
  }, [audio]);

  const bootAudioFromGesture = useCallback(async () => {
    // must be called from a real user gesture
    if (bootedRef.current) return;
    bootedRef.current = true;

    setAudioBlocked(false);

    try {
      await (audio as any)?.unlock?.();
      await (audio as any)?.preloadSfx?.();

      // requirement: ambience starts a few seconds AFTER pw page (but scheduled from gesture)
      if (step === "LOCK") {
        const id = window.setTimeout(() => {
          if (step !== "LOCK") return;
          if (stopAmbienceBeforeStampRef.current) return;
          void startAmbience();
        }, 2200);
        lockTimersRef.current.push(id);
      }
    } catch {
      bootedRef.current = false;
      setAudioBlocked(true);
    }
  }, [audio, startAmbience, step]);

  // LOCK intro sequence
  useEffect(() => {
    if (step !== "LOCK") return;

    clearLockTimers();
    setShowHint(false);

    setShowTitle(false);
    setShowPrompt(false);

    const t1 = window.setTimeout(() => setShowTitle(true), 650);
    const t2 = window.setTimeout(() => {
      setShowPrompt(true);
      requestAnimationFrame(() => pwRef.current?.focus());
    }, 1450);

    lockTimersRef.current.push(t1, t2);

    return () => {
      clearLockTimers();
    };
  }, [step, clearLockTimers]);

  // leaving LOCK cancels pending timers
  useEffect(() => {
    if (step !== "LOCK") clearLockTimers();
  }, [step, clearLockTimers]);

  // -------------------
  // Auth submit
  // -------------------
  const onSubmitPassword = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (step !== "LOCK") return;
      if (submitting) return;

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

        grantedFiredRef.current = false;
        lastStampAtRef.current = 0;

        setStep("OATH");
      } finally {
        setSubmitting(false);
      }
    },
    [pw, step, submitting, bootAudioFromGesture]
  );

  const onSwear = useCallback(() => {
    if (step !== "OATH") return;
    if (!canSwear) return;

    setAuthed();
    setReviewCleared(false);
    setStep("REVIEW");
  }, [canSwear, step]);

  const resetBackToLock = useCallback(() => {
    stopMainTrack();

    ambienceStartedRef.current = false;
    stopAmbienceBeforeStampRef.current = false;
    bootedRef.current = false;

    setStep("LOCK");
    setPw("");
    setErrFlash(false);
    setSubmitting(false);
    setChecks(initialChecks);
    setSig("");
    setReviewCleared(false);
    setShowHint(false);

    grantedFiredRef.current = false;
    lastStampAtRef.current = 0;

    requestAnimationFrame(() => pwRef.current?.focus());
  }, [initialChecks, stopMainTrack]);

  // REVIEW timers
  useEffect(() => {
    if (step !== "REVIEW") return;

    const t1 = window.setTimeout(() => setReviewCleared(true), REVIEW_CLEAR_MS);
    const t2 = window.setTimeout(() => setStep("GRANTED"), REVIEW_TOTAL_MS);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [step]);

  // GRANTED: stop ambience -> stamp -> noir immediately after
  useEffect(() => {
    if (step !== "GRANTED") return;

    if (grantedFiredRef.current) return;
    grantedFiredRef.current = true;

    const t = window.setTimeout(async () => {
      stopAmbienceBeforeStampRef.current = true;

      if (ambienceStartedRef.current) {
        stopMainTrack();
        ambienceStartedRef.current = false;
      }

      const now = Date.now();
      if (now - lastStampAtRef.current > 900) {
        lastStampAtRef.current = now;
        try {
          (audio as any)?.sfx?.("stamp", { volume: 0.95, interrupt: true });
        } catch {}
      }

      try {
        await startNoir();
      } catch {}
    }, 140);

    return () => window.clearTimeout(t);
  }, [step, audio, startNoir, stopMainTrack]);

  // Hotkeys
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (step === "REVIEW") return;

      if (step === "LOCK") {
        void bootAudioFromGesture();

        if (e.key === "Escape") {
          setPw("");
          setErrFlash(false);
          requestAnimationFrame(() => pwRef.current?.focus());
        }
        return;
      }

      if (step === "GRANTED") {
        if (e.key === "Enter") {
          e.preventDefault();
          goLedger();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          resetBackToLock();
        }
        return;
      }

      if (step === "OATH" && canSwear && e.key === "Enter") {
        e.preventDefault();
        onSwear();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, canSwear, goLedger, onSwear, resetBackToLock, bootAudioFromGesture]);

  // ==========================================================
  // LOCK (TV static + centered title)
  // ==========================================================
  if (step === "LOCK") {
    return (
      <main
        className="fixed inset-0 bg-black text-white overflow-hidden"
        onPointerDown={() => void bootAudioFromGesture()}
        onTouchStart={() => void bootAudioFromGesture()}
        onKeyDownCapture={() => void bootAudioFromGesture()}
      >
        {/* TV static layers (FIXED: includes grain + animated scan shimmer) */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 mm-static opacity-[0.14] mix-blend-overlay" />
          <div className="absolute inset-0 mm-scanlines opacity-[0.10] mix-blend-overlay" />
          <div className="absolute inset-0 mm-vhs opacity-[0.10] mix-blend-overlay" />
          <div className="absolute inset-0 bg-[radial-gradient(1100px_circle_at_50%_40%,rgba(255,255,255,0.045),transparent_60%),radial-gradient(900px_circle_at_50%_100%,rgba(0,0,0,0.92),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_50%_35%,transparent_45%,rgba(0,0,0,0.96)_82%)]" />
        </div>

        <div className="relative h-full w-full grid place-items-center px-6">
          <form onSubmit={onSubmitPassword} className="w-full max-w-2xl">
            <div className="text-center">
              <div
                className={clsx(
                  "select-none",
                  "text-center",
                  "text-[11px] sm:text-[12px]",
                  "text-neutral-200",
                  "leading-none",
                  "transition-opacity duration-[1200ms] ease-out",
                  showTitle ? "opacity-100" : "opacity-0"
                )}
                style={{
                  fontFamily:
                    "Helvetica Neue, Helvetica, Arial, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}
              >
                mileage mafia
              </div>

              <div className="mt-10 flex items-center justify-center gap-2 font-mono text-[14px] sm:text-[15px] text-neutral-200">
                <span className={clsx("transition-opacity duration-500", showPrompt ? "opacity-100" : "opacity-0")}>
                  {">"}
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
                  style={{ opacity: showPrompt ? 1 : 0, transition: "opacity 500ms ease" }}
                />
              </div>

              {/* ✅ forgot password directly under field */}
              <div className={clsx("mt-3 text-[10px] tracking-[0.18em] text-neutral-600", showPrompt ? "opacity-100" : "opacity-0")} style={{ transition: "opacity 500ms ease" }}>
                {!showHint ? (
                  <button
                    type="button"
                    onClick={() => setShowHint(true)}
                    className="underline underline-offset-4 hover:text-neutral-400 transition"
                    style={{
                      fontFamily:
                        "Helvetica Neue, Helvetica, Arial, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
                      textTransform: "uppercase",
                    }}
                  >
                    forgot your password?
                  </button>
                ) : (
                  <span
                    className="text-neutral-400"
                    style={{
                      fontFamily:
                        "Helvetica Neue, Helvetica, Arial, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
                      textTransform: "uppercase",
                    }}
                  >
                    respect all.
                  </span>
                )}
              </div>

              <div className="mt-8 h-5 text-[10px] uppercase tracking-[0.35em] text-neutral-700">
                {audioBlocked ? "tap or type once to enable audio" : "\u00A0"}
              </div>

              <button type="submit" className="hidden" aria-hidden />
            </div>
          </form>
        </div>

        <style>{`
          /* ===== LOCK static (more visible + animated) ===== */
          .mm-static{
            background-image:
              url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.95' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='.65'/%3E%3C/svg%3E");
            background-size: 240px 240px;
            animation: mmNoiseDrift 2.4s steps(2,end) infinite;
          }
          @keyframes mmNoiseDrift{
            0%{ transform: translate3d(0,0,0); opacity: .95; }
            25%{ transform: translate3d(-8px,5px,0); opacity: .75; }
            50%{ transform: translate3d(10px,-6px,0); opacity: .9; }
            75%{ transform: translate3d(-6px,-4px,0); opacity: .8; }
            100%{ transform: translate3d(0,0,0); opacity: .95; }
          }

          .mm-scanlines{
            background: repeating-linear-gradient(
              to bottom,
              rgba(255,255,255,0.08),
              rgba(255,255,255,0.08) 1px,
              transparent 1px,
              transparent 4px
            );
          }

          /* subtle moving horizontal band */
          .mm-vhs{
            background: linear-gradient(
              to bottom,
              transparent 0%,
              rgba(255,255,255,0.05) 48%,
              rgba(255,255,255,0.05) 52%,
              transparent 100%
            );
            transform: translateY(-60%);
            animation: mmVhsSweep 4.2s linear infinite;
          }
          @keyframes mmVhsSweep{
            0%{ transform: translateY(-60%); opacity: .05; }
            30%{ opacity: .10; }
            100%{ transform: translateY(160%); opacity: .06; }
          }

          /* shake */
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

  /**
   * =========================
   * OATH/REVIEW/GRANTED (unchanged visuals + restored stamper CSS)
   * =========================
   */
  return (
    <main className="min-h-screen bg-neutral-950 text-white relative overflow-hidden">
      {/* noir bg */}
      <div className="pointer-events-none absolute inset-0 noir-crt">
        <div className="absolute inset-0 bg-[#050505]" />
        <div className="absolute inset-0 mm-drift opacity-[0.36]">
          <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_18%_22%,rgba(255,255,255,0.035),transparent_62%),radial-gradient(950px_circle_at_82%_18%,rgba(239,68,68,0.06),transparent_64%),radial-gradient(900px_circle_at_55%_112%,rgba(255,255,255,0.02),transparent_66%)]" />
        </div>
        <div className="absolute inset-0 noir-noise opacity-[0.15] mix-blend-overlay" />
        <div className="absolute inset-0 noir-scanlines opacity-[0.09] mix-blend-overlay" />
        <div className="absolute inset-0 mm-jitter opacity-[0.12]" />
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_50%_35%,transparent_40%,rgba(0,0,0,0.96)_82%)]" />
      </div>

      {/* REVIEW overlay */}
      {step === "REVIEW" ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
          <div className="relative w-[min(620px,92vw)] rounded-3xl bg-black/70 backdrop-blur-xl ring-1 ring-white/10 shadow-[0_18px_70px_rgba(0,0,0,0.75)] overflow-hidden">
            <div className="px-10 py-9 text-center">
              <div className="text-xs uppercase tracking-[0.35em] text-neutral-500 mb-3">Case File Processing</div>
              <div className="text-2xl md:text-3xl font-black tracking-tight">REVIEWING</div>
              <div className="mt-3 text-neutral-400 text-sm">Articles verified. Signature cross-checked. Ledger being stamped.</div>

              <div className="mt-8 h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full w-1/3 bg-white/35 mm-scan" />
              </div>

              <div className="mt-6 text-[10px] uppercase tracking-[0.35em] text-neutral-600">
                Status:{" "}
                {reviewCleared ? <span className="mm-cleared font-semibold">CLEARED</span> : <span className="text-neutral-500">Reviewing</span>}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* GRANTED overlay */}
      {step === "GRANTED" ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-white/10 mm-flash" />

          <div className="relative w-[min(640px,92vw)]">
            <div className="rounded-3xl bg-black/70 backdrop-blur-xl ring-1 ring-white/10 shadow-[0_18px_70px_rgba(0,0,0,0.80)] overflow-hidden">
              <div className="relative px-10 py-9 text-center">
                <div className="text-xs uppercase tracking-[0.35em] text-neutral-500 mb-3">Mileage Mafia</div>
                <div className="text-3xl md:text-4xl font-black tracking-tight">INDUCTED</div>
                <div className="mt-3 text-neutral-400 text-sm">Your entry has been recorded.</div>

                <div className="relative mt-7 h-24 grid place-items-center">
                  <div className="mm-filed">
                    <div className="mm-filed__inner">FILED • MM-2026</div>
                  </div>

                  <div className="mm-stamper" aria-hidden>
                    <div className="mm-stamper__top" />
                    <div className="mm-stamper__base" />
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={goLedger}
                    className={[
                      "px-6 py-3 rounded-2xl font-black transition",
                      "bg-white text-black hover:opacity-90",
                      `ring-1 ${ACCENT.ring}`,
                    ].join(" ")}
                  >
                    View the Ledger {"\u2192"}
                  </button>

                  <button
                    type="button"
                    onClick={resetBackToLock}
                    className="px-6 py-3 rounded-2xl font-semibold bg-white/5 ring-1 ring-white/10 text-neutral-300 hover:bg-white/10 transition"
                  >
                    Back to Door
                  </button>
                </div>

                {audioBlocked ? (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={bootAudioFromGesture}
                      className="px-5 py-2.5 rounded-full bg-white/5 ring-1 ring-white/10 text-neutral-200 hover:bg-white/10 transition text-sm"
                    >
                      Enable Audio
                    </button>
                  </div>
                ) : null}

                <div className="mt-6 text-[10px] uppercase tracking-[0.35em] text-neutral-600">
                  Status: <span className="mm-cleared font-semibold">CLEARED</span>
                </div>
                <div className="mt-3 text-[10px] text-neutral-600">(Enter = Ledger • Esc = Door)</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* OATH */}
      {step === "OATH" ? (
        <div className="relative max-w-5xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
            <aside className="rounded-3xl bg-neutral-950/55 ring-1 ring-neutral-800 shadow-[0_18px_70px_rgba(0,0,0,0.65)] overflow-hidden">
              <div className="relative p-7">
                <div className="pointer-events-none absolute inset-0 opacity-[0.12] mix-blend-overlay noir-noise" />
                <div className="pointer-events-none absolute inset-0 opacity-[0.10] noir-scanlines mix-blend-overlay" />

                <div className="relative">
                  <div className="text-[11px] uppercase tracking-[0.35em] text-neutral-500">Case File</div>
                  <div className="mt-2 text-2xl font-black tracking-tight">MM / ENTRY</div>

                  <div className="mt-6 space-y-3 text-sm">
                    <div className="rounded-2xl bg-black/35 ring-1 ring-white/10 p-4">
                      <div className="text-[10px] uppercase tracking-[0.35em] text-neutral-600">STATUS</div>
                      <div className="mt-2 font-semibold text-neutral-200">PENDING ARTICLES</div>
                      <div className="mt-2 text-xs text-neutral-500">Complete the dossier to proceed.</div>
                    </div>

                    <div className="rounded-2xl bg-black/35 ring-1 ring-white/10 p-4">
                      <div className="text-[10px] uppercase tracking-[0.35em] text-neutral-600">CHECKLIST</div>
                      <div className="mt-2 text-neutral-300">
                        <div className="flex items-center justify-between text-sm">
                          <span>Articles</span>
                          <span className="tabular-nums">
                            {Object.values(checks).filter(Boolean).length}/{RULES.length}
                          </span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full bg-red-500/70"
                            style={{
                              width: `${Math.round(
                                (Object.values(checks).filter(Boolean).length / Math.max(1, RULES.length)) * 100
                              )}%`,
                            }}
                          />
                        </div>
                        <div className="mt-3 flex items-center justify-between text-sm">
                          <span>Signature</span>
                          <span className="tabular-nums">{signed ? "OK" : "—"}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={resetBackToLock}
                      className="w-full px-5 py-3 rounded-2xl bg-white/5 ring-1 ring-white/10 text-neutral-200 hover:bg-white/10 transition font-semibold"
                    >
                      Back to Door
                    </button>
                  </div>

                  <div className="mt-6 text-[10px] uppercase tracking-[0.35em] text-neutral-600">
                    Tip: Enter to confirm (when ready)
                  </div>
                </div>
              </div>
            </aside>

            <section className="rounded-3xl bg-neutral-950/55 ring-1 ring-neutral-800 shadow-[0_18px_70px_rgba(0,0,0,0.75)] overflow-hidden">
              <div className="relative p-8 sm:p-10">
                <div className="pointer-events-none absolute inset-0 opacity-[0.16] mix-blend-overlay noir-noise" />
                <div className="pointer-events-none absolute inset-0 opacity-[0.12] noir-scanlines mix-blend-overlay" />

                <div className="relative">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-[0.35em] text-neutral-400">Mileage Mafia • Dossier</div>
                      <h2 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight">Articles of Entry</h2>
                      <p className="mt-3 text-neutral-400 text-sm leading-relaxed">Read. Accept. Sign. File.</p>
                    </div>

                    <div className="shrink-0">
                      <div className="rounded-2xl bg-black/35 ring-1 ring-white/10 px-4 py-3">
                        <div className="text-[10px] uppercase tracking-[0.35em] text-neutral-600">CLEARANCE</div>
                        <div className={clsx("mt-2 text-sm font-semibold", canSwear ? "text-emerald-200" : "text-neutral-300")}>
                          {canSwear ? "READY TO FILE" : "NOT READY"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 space-y-3">
                    {RULES.map((r, idx) => {
                      const accepted = !!checks[r.id];

                      return (
                        <label
                          key={r.id}
                          className={clsx(
                            "group relative flex items-start gap-3 px-4 py-3 transition cursor-pointer",
                            "ring-1 ring-neutral-800 bg-neutral-950/35 hover:bg-white/[0.03]",
                            "rounded-xl",
                            accepted ? `${ACCENT.bgSoft} ring-1 ${ACCENT.ringStrong}` : ""
                          )}
                        >
                          <span className="relative mt-[3px] shrink-0">
                            <input
                              type="checkbox"
                              checked={accepted}
                              onChange={() => toggleRule(r.id)}
                              className="peer absolute inset-0 h-5 w-5 opacity-0 cursor-pointer"
                              aria-label={`Accept ${r.id}`}
                            />

                            <span className="relative grid place-items-center h-5 w-5 rounded-full ring-1 ring-neutral-600/80 bg-black/40 transition peer-hover:ring-red-500/40 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-red-500/50">
                              <span className={clsx("h-[7px] w-[7px] rounded-full bg-red-500/90 transition", accepted ? "scale-100 opacity-100" : "scale-0 opacity-0")} />
                            </span>

                            {accepted ? <span className="pointer-events-none absolute -inset-2 rounded-full mm-notary" /> : null}
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] uppercase tracking-[0.25em] text-neutral-500">
                                Article {String(idx + 1).padStart(2, "0")}
                              </span>

                              {accepted ? (
                                <span className={clsx("text-[11px] uppercase tracking-[0.22em]", ACCENT.text)}>Accepted</span>
                              ) : (
                                <span className="text-[11px] uppercase tracking-[0.22em] text-neutral-600">Pending</span>
                              )}
                            </div>

                            <div className="relative mt-1">
                              <div className={clsx("text-neutral-200 font-mono text-[13.5px] leading-snug", accepted ? "opacity-90" : "")}>
                                <span className={accepted ? "mm-strike" : ""}>{r.text}</span>
                              </div>

                              {accepted ? <div className="pointer-events-none absolute right-0 top-[-4px] mm-stamp">INKED</div> : null}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  <div className="mt-10 rounded-2xl ring-1 ring-neutral-800 bg-neutral-950/35 p-5">
                    <div className="text-xs uppercase tracking-[0.3em] text-neutral-500">Signature</div>
                    <div className="mt-3">
                      <input
                        value={sig}
                        onChange={(e) => setSig(e.target.value)}
                        placeholder="Type full name"
                        className="w-full bg-transparent px-1 py-3 text-lg font-semibold tracking-wide outline-none border-b border-neutral-700 focus:border-red-400/60 transition"
                      />
                      <div className="mt-2 text-xs text-neutral-500">{signed ? "✅ Signed." : "Type at least 3 characters to sign."}</div>
                    </div>
                  </div>

                  <div className="mt-8">
                    <button
                      type="button"
                      onClick={onSwear}
                      disabled={!canSwear}
                      className={clsx(
                        "w-full rounded-2xl py-4 font-black tracking-[0.18em] uppercase transition shadow-[0_12px_46px_rgba(0,0,0,0.65)]",
                        canSwear ? `bg-red-500 text-black hover:brightness-110 ring-1 ${ACCENT.ringStrong}` : "bg-white text-black opacity-30 cursor-not-allowed"
                      )}
                    >
                      File Dossier
                    </button>

                    <div className="mt-4 text-xs text-neutral-500">Your file will be reviewed before clearance is granted.</div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      ) : null}

      <style>{`
        /* noir bg */
        .noir-crt{ filter: saturate(0.98) contrast(1.06); }

        .noir-noise{
          background-image:
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E");
          background-size: 220px 220px;
        }

        .noir-scanlines{
          background: repeating-linear-gradient(
            to bottom,
            rgba(255,255,255,0.06),
            rgba(255,255,255,0.06) 1px,
            transparent 1px,
            transparent 4px
          );
        }

        .mm-jitter{ animation: mmJitter 3.2s steps(1,end) infinite; }
        @keyframes mmJitter{
          0%,100%{ transform: translate(0,0); }
          92%{ transform: translate(0,0); }
          93%{ transform: translate(1px,0); }
          94%{ transform: translate(-1px,0); }
          95%{ transform: translate(0,1px); }
          96%{ transform: translate(0,-1px); }
        }

        .mm-drift{ animation: mmDrift 9s ease-in-out infinite; }
        @keyframes mmDrift{
          0%,100%{ transform: translate3d(0,0,0); }
          50%{ transform: translate3d(8px,-6px,0); }
        }

        .mm-flash{ animation: mmFlash 240ms ease-out both; }
        @keyframes mmFlash{
          0%{ opacity: 0; }
          30%{ opacity: 0.35; }
          100%{ opacity: 0; }
        }

        /* stamper + filed (restored) */
        .mm-stamper{
          position: absolute;
          top: -14px;
          left: 50%;
          width: 120px;
          height: 120px;
          transform: translateX(-50%) translateY(-88px) rotate(-8deg);
          animation: mmSlam 720ms cubic-bezier(.2,.9,.2,1) both;
          filter: drop-shadow(0 18px 30px rgba(0,0,0,0.55));
          opacity: 0.95;
          pointer-events: none;
        }
        .mm-stamper__top{
          position:absolute;
          left: 28px;
          top: 6px;
          width: 64px;
          height: 40px;
          border-radius: 18px 18px 12px 12px;
          background: linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.02));
          box-shadow: inset 0 -6px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.10);
        }
        .mm-stamper__base{
          position:absolute;
          left: 18px;
          top: 44px;
          width: 84px;
          height: 62px;
          border-radius: 16px;
          background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02));
          box-shadow: inset 0 -10px rgba(0,0,0,0.65), inset 0 0 0 1px rgba(255,255,255,0.10);
        }
        @keyframes mmSlam{
          0%{ transform: translateX(-50%) translateY(-104px) rotate(-10deg); }
          70%{ transform: translateX(-50%) translateY(10px) rotate(-8deg); }
          80%{ transform: translateX(-50%) translateY(2px) rotate(-8deg); }
          100%{ transform: translateX(-50%) translateY(6px) rotate(-8deg); }
        }

        .mm-filed{
          position: relative;
          transform: rotate(-8deg);
          opacity: 0;
          animation: mmFiledIn 180ms ease-out 540ms forwards;
          pointer-events: none;
        }
        .mm-filed__inner{
          font-size: 13px;
          letter-spacing: 0.34em;
          text-transform: uppercase;
          color: rgba(239, 68, 68, 0.78);
          border: 2px solid rgba(239, 68, 68, 0.35);
          padding: 10px 18px;
          border-radius: 14px;
          background: rgba(239, 68, 68, 0.07);
          box-shadow: 0 0 22px rgba(239,68,68,0.12);
        }
        @keyframes mmFiledIn{
          from{ opacity: 0; transform: rotate(-8deg) scale(0.98); }
          to{ opacity: 1; transform: rotate(-8deg) scale(1); }
        }

        @keyframes mmScan {
          0% { transform: translateX(-60%); opacity: 0.2; }
          20% { opacity: 0.9; }
          100% { transform: translateX(260%); opacity: 0.25; }
        }
        .mm-scan { animation: mmScan 900ms ease-in-out infinite; }

        .mm-strike { position: relative; display: inline-block; }
        .mm-strike::after {
          content: "";
          position: absolute;
          left: 0; right: 0;
          top: 55%;
          height: 1px;
          background: rgba(239, 68, 68, 0.33);
          transform: scaleX(0);
          transform-origin: left;
          animation: mmStrike 220ms ease-out forwards;
        }
        @keyframes mmStrike { to { transform: scaleX(1); } }

        .mm-notary {
          position: absolute;
          inset: -8px;
          border-radius: 999px;
          box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.22);
          animation: mmNotary 320ms ease-out both;
          pointer-events: none;
        }
        @keyframes mmNotary {
          0% { transform: scale(0.75); opacity: 0; }
          45% { opacity: 1; }
          100% { transform: scale(1.2); opacity: 0; }
        }

        .mm-stamp {
          font-size: 10px;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: rgba(239, 68, 68, 0.75);
          border: 1px solid rgba(239, 68, 68, 0.35);
          padding: 2px 6px;
          border-radius: 999px;
          transform: rotate(-6deg);
          animation: mmStamp 220ms ease-out both;
          mix-blend-mode: screen;
        }
        @keyframes mmStamp {
          0% { opacity: 0; transform: translateY(-2px) rotate(-10deg) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) rotate(-6deg) scale(1); }
        }

        .mm-cleared {
          color: rgba(134, 239, 172, 0.92);
          text-shadow: 0 0 0 rgba(34, 197, 94, 0);
          animation: mmClearedGlow 1400ms ease-out forwards;
        }
        @keyframes mmClearedGlow {
          0% { text-shadow: 0 0 0 rgba(34, 197, 94, 0); filter: brightness(1); }
          60% { text-shadow: 0 0 14px rgba(34, 197, 94, 0.28); }
          100% { text-shadow: 0 0 22px rgba(34, 197, 94, 0.42); filter: brightness(1.08); }
        }
      `}</style>
    </main>
  );
}