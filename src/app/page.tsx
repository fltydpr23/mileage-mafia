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
  text: "text-red-300",
  bgSoft: "bg-red-500/10",
};

export default function LoginPage() {
  const router = useRouter();
  const audio = useAudio();

  const [step, setStep] = useState<Step>("LOCK");

  // LOCK
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [doorOpen, setDoorOpen] = useState(false);
  const [doorPulse, setDoorPulse] = useState(false);
  const pwRef = useRef<HTMLInputElement | null>(null);

  // REVIEW
  const [reviewCleared, setReviewCleared] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);

  // brightness grows with pw length (0..1) — max glow around ~8 chars
  const pwProgress = Math.min(pw.length / 8, 1);

  // Tune review duration here
  const REVIEW_CLEAR_MS = 2600; // when status flips to CLEARED
  const REVIEW_TOTAL_MS = 4200; // when INDUCTED appears

  // OATH / ARTICLES
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
      { id: "respect", text: "Disorder, manipulation, or disrespect will be met with penalties at the discretion of the family." },
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

  // ---- Audio helpers (NO FADE) ----
  const stopAudio = useCallback(() => {
    const a: any = audio as any;
    try {
      // handle both "HTMLAudioElement-style" and custom providers
      a.stop?.();
      a.pause?.();
      // do NOT force volume changes (avoid glitches)
    } catch {
      // ignore
    }
  }, [audio]);

  const tryPlayAudio = useCallback(async () => {
    setAudioBlocked(false);
    try {
      await audio.play(); // NORMAL, immediate play — no fade
    } catch {
      setAudioBlocked(true);
    }
  }, [audio]);

  const resetBackToLock = useCallback(() => {
    stopAudio();
    setAudioBlocked(false);
    setReviewCleared(false);

    setStep("LOCK");
    setPw("");
    setErr("");
    setChecks(initialChecks);
    setSig("");
    setDoorOpen(false);
    setDoorPulse(false);

    requestAnimationFrame(() => {
      pwRef.current?.focus();
      // mobile hint
      pwRef.current?.click?.();
    });
  }, [initialChecks, stopAudio]);

  const onSubmitPassword = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErr("");

      if (step !== "LOCK") return;

      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });

      const data = await res.json().catch(() => ({ ok: false }));
      if (!data.ok) {
        setErr("WRONG CODE");
        setDoorPulse(true);
        window.setTimeout(() => setDoorPulse(false), 220);
        setPw("");
        requestAnimationFrame(() => {
          pwRef.current?.focus();
          pwRef.current?.click?.();
        });
        return;
      }

      setDoorOpen(true);
      window.setTimeout(() => setStep("OATH"), 520);
    },
    [pw, step]
  );

  const onSwear = useCallback(() => {
    if (step !== "OATH") return;
    if (!canSwear) return;

    setErr("");
    setAuthed();

    // REVIEW phase (silent)
    setAudioBlocked(false);
    setReviewCleared(false);
    setStep("REVIEW");
  }, [canSwear, step]);

  // REVIEW timers (flip → CLEARED, then → GRANTED)
  useEffect(() => {
    if (step !== "REVIEW") return;

    const t1 = window.setTimeout(() => setReviewCleared(true), REVIEW_CLEAR_MS);
    const t2 = window.setTimeout(() => setStep("GRANTED"), REVIEW_TOTAL_MS);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [step, REVIEW_CLEAR_MS, REVIEW_TOTAL_MS]);

  // Start music ONLY when INDUCTED is on-screen (no fade)
  useEffect(() => {
    if (step === "GRANTED") {
      tryPlayAudio();
    }
  }, [step, tryPlayAudio]);

  // Hotkeys
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (step === "REVIEW") return;

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
  }, [step, canSwear, goLedger, onSwear, resetBackToLock]);

  // Focus pw input when entering LOCK
  useEffect(() => {
    if (step === "LOCK") {
      requestAnimationFrame(() => {
        pwRef.current?.focus();
        // This helps iOS sometimes, as long as it's within a user interaction later
        // But focus alone is still useful for showing the caret/cursor.
      });
    }
  }, [step]);

  /**
   * =========================
   * LOCK (DOOR) + MOBILE CURSOR INPUT
   * =========================
   */
  if (step === "LOCK") {
    const glow = pwProgress;
    const seamOpacity = 0.35 + glow * 0.55;
    const leakOpacity = 0.10 + glow * 0.85;
    const panelLift = glow * 0.05;

    // visual caret: show even when empty
    const caretOn = true;

    return (
      <main
        className="fixed inset-0 bg-black text-white overflow-hidden"
        onMouseDown={() => {
          pwRef.current?.focus();
          pwRef.current?.click?.();
        }}
        onTouchStart={() => {
          pwRef.current?.focus();
          pwRef.current?.click?.();
        }}
      >
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-black" />

          <div
            className="absolute inset-0 transition-opacity duration-150"
            style={{
              opacity: doorOpen ? 1 : leakOpacity,
              background:
                "radial-gradient(700px circle at 50% 52%, rgba(239,68,68,0.26), transparent 62%)," +
                "radial-gradient(980px circle at 50% 55%, rgba(255,255,255,0.07), transparent 72%)",
            }}
          />

          <div
            className={[
              "absolute left-1/2 top-0 h-full w-[2px] transition-opacity duration-150",
              doorPulse ? "animate-[mmSeamShake_140ms_linear_1]" : "",
            ].join(" ")}
            style={{
              opacity: doorOpen ? 0 : seamOpacity,
              transform: "translateX(-1px)",
              background:
                "linear-gradient(to bottom, transparent, rgba(239,68,68,0.92), rgba(255,255,255,0.55), rgba(239,68,68,0.72), transparent)",
              filter: `blur(${0.4 + glow * 1.0}px)`,
            }}
          />

          <div
            className={[
              "absolute inset-y-0 left-0 w-1/2 transition-transform duration-500 ease-out",
              doorOpen ? "-translate-x-[105%]" : "translate-x-0",
            ].join(" ")}
            style={{
              background:
                "linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.00) 55%)," +
                "radial-gradient(900px circle at 100% 50%, rgba(239,68,68,0.12), transparent 55%)," +
                "repeating-linear-gradient(0deg, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 1px, rgba(0,0,0,0) 6px, rgba(0,0,0,0) 12px)",
              boxShadow: "inset -1px 0 rgba(255,255,255,0.16), inset 0 0 90px rgba(0,0,0,0.88)",
              opacity: 0.94,
              transformOrigin: "right center",
              transform: doorOpen ? "translateX(-105%)" : `translateX(0) scale(${1 + panelLift})`,
            }}
          />

          <div
            className={[
              "absolute inset-y-0 right-0 w-1/2 transition-transform duration-500 ease-out",
              doorOpen ? "translate-x-[105%]" : "translate-x-0",
            ].join(" ")}
            style={{
              background:
                "linear-gradient(270deg, rgba(255,255,255,0.04), rgba(255,255,255,0.00) 55%)," +
                "radial-gradient(900px circle at 0% 50%, rgba(239,68,68,0.12), transparent 55%)," +
                "repeating-linear-gradient(0deg, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 1px, rgba(0,0,0,0) 6px, rgba(0,0,0,0) 12px)",
              boxShadow: "inset 1px 0 rgba(255,255,255,0.16), inset 0 0 90px rgba(0,0,0,0.88)",
              opacity: 0.94,
              transformOrigin: "left center",
              transform: doorOpen ? "translateX(105%)" : `translateX(0) scale(${1 + panelLift})`,
            }}
          />

          {!doorOpen ? (
            <>
              <div className="absolute top-1/2 left-[calc(50%-80px)] h-10 w-[2px] rounded-full bg-white/10" style={{ transform: "translateY(-50%)" }} />
              <div className="absolute top-1/2 right-[calc(50%-80px)] h-10 w-[2px] rounded-full bg-white/10" style={{ transform: "translateY(-50%)" }} />
            </>
          ) : null}

          {doorPulse ? <div className="absolute inset-0 bg-red-500/12 animate-pulse" /> : null}

          <div className="pointer-events-none absolute inset-0 noir-noise opacity-[0.10] mix-blend-overlay" />
          <div className="pointer-events-none absolute inset-0 noir-scanlines opacity-[0.06] mix-blend-overlay" />

          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_circle_at_50%_50%,rgba(0,0,0,0.25),rgba(0,0,0,0.92)_70%,rgba(0,0,0,0.98)_100%)]" />
        </div>

        {/* center UI */}
        <div className="relative h-full w-full grid place-items-center">
          <form onSubmit={onSubmitPassword} className="w-full max-w-md px-8">
            <div className="text-center select-none">
              <div
                className="text-[12px] font-semibold"
                style={{
                  color: `rgba(239,68,68,${0.75 + glow * 0.25})`,
                  textShadow: `0 0 ${3 + glow * 14}px rgba(239,68,68,${0.18 + glow * 0.28})`,
                }}
              >
                Mileage Mafia
              </div>

              {/* Visible “input line” with blinking cursor so mobile users know where to type */}
              <div className="mt-5 flex items-center justify-center">
                <div className="rounded-2xl bg-black/35 ring-1 ring-white/10 px-5 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-white/70 text-xs tracking-[0.45em]">
                      {pw.length > 0 ? "•".repeat(Math.min(pw.length, 10)) : ""}
                    </span>
                    {caretOn ? <span className="mm-caret" aria-hidden /> : null}
                  </div>

                  {/* Real input (tiny + transparent) but NOT zero-sized, so mobile keyboard triggers */}
                  <input
                    ref={pwRef}
                    type="password"
                    value={pw}
                    inputMode="text"
                    autoComplete="current-password"
                    enterKeyHint="go"
                    onChange={(e) => setPw(e.target.value)}
                    aria-label="Password"
                    className="mt-3 w-full bg-transparent text-white/0 caret-transparent outline-none"
                    style={{
                      // keep it tappable; don't make it 0 height/width
                      height: 1,
                      opacity: 0.01,
                    }}
                  />
                </div>
              </div>

              <div className="mt-3 text-[11px] uppercase tracking-[0.25em] text-neutral-600">
                Tap to type • Enter to submit
              </div>

              {err ? (
                <div className="mt-4 text-red-300 text-[11px] tracking-[0.25em] uppercase">{err}</div>
              ) : null}
            </div>

            {/* hidden submit button keeps mobile "Go" behavior reliable */}
            <button type="submit" className="hidden" aria-hidden />
          </form>
        </div>

        <style>{`
          @keyframes mmSeamShake {
            0% { transform: translateX(-1px); }
            25% { transform: translateX(-3px); }
            50% { transform: translateX(1px); }
            75% { transform: translateX(-2px); }
            100% { transform: translateX(-1px); }
          }

          /* Blinking cursor */
          .mm-caret{
            width: 10px;
            height: 14px;
            border-radius: 2px;
            background: rgba(255,255,255,0.65);
            box-shadow: 0 0 12px rgba(239,68,68,0.12);
            animation: mmCaret 900ms steps(1,end) infinite;
          }
          @keyframes mmCaret {
            0%, 49% { opacity: 0.9; }
            50%, 100% { opacity: 0.0; }
          }
        `}</style>
      </main>
    );
  }

  /**
   * =========================
   * OATH / REVIEW / GRANTED
   * =========================
   */
  return (
    <main className="min-h-screen bg-neutral-950 text-white relative overflow-hidden">
      {/* background */}
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
          <div className="relative w-[min(560px,92vw)] rounded-3xl bg-black/70 backdrop-blur-xl ring-1 ring-white/10 shadow-[0_18px_70px_rgba(0,0,0,0.75)] overflow-hidden">
            <div className="px-10 py-9 text-center">
              <div className="text-xs uppercase tracking-[0.35em] text-neutral-500 mb-3">Case File Processing</div>
              <div className="text-2xl md:text-3xl font-black tracking-tight">REVIEWING</div>
              <div className="mt-3 text-neutral-400 text-sm">Articles verified. Signature cross-checked. Ledger being stamped.</div>

              <div className="mt-8 h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full w-1/3 bg-white/35 mm-scan" />
              </div>

              <div className="mt-6 text-[10px] uppercase tracking-[0.35em] text-neutral-600">
                Status:{" "}
                {reviewCleared ? (
                  <span className="mm-cleared font-semibold">CLEARED</span>
                ) : (
                  <span className="text-neutral-500">Reviewing</span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* GRANTED overlay */}
      {step === "GRANTED" ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-white/10 mm-flash" />

          <div className="relative">
            <div className="bg-black/70 backdrop-blur-xl ring-1 ring-white/10 rounded-3xl px-10 py-8 text-center w-[min(560px,92vw)] shadow-[0_18px_70px_rgba(0,0,0,0.75)] animate-[mmInduct_600ms_ease-out_both]">
              <div className="text-xs uppercase tracking-[0.35em] text-neutral-500 mb-3">Mileage Mafia</div>
              <div className="text-3xl md:text-4xl font-black tracking-tight">INDUCTED</div>
              <div className="mt-4 text-neutral-400 text-sm">Your entry has been recorded.</div>

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
                  View the Ledger →
                </button>

                <button
                  type="button"
                  onClick={resetBackToLock}
                  className="px-6 py-3 rounded-2xl font-semibold bg-white/5 ring-1 ring-white/10 text-neutral-300 hover:bg-white/10 transition"
                >
                  Back to Door
                </button>
              </div>

              {/* Audio fallback (no fade, just "play") */}
              {audioBlocked ? (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={tryPlayAudio}
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
      ) : null}

      {/* OATH */}
      {step === "OATH" ? (
        <div className="relative max-w-xl mx-auto px-6 py-20">
          <div className="relative rounded-[28px] overflow-hidden ring-1 ring-neutral-700/60 bg-neutral-950/55 backdrop-blur-xl shadow-[0_18px_70px_rgba(0,0,0,0.75)]">
            <div className="pointer-events-none absolute inset-0 opacity-[0.16] mix-blend-overlay noir-noise" />
            <div className="pointer-events-none absolute inset-0 opacity-[0.12] noir-scanlines mix-blend-overlay" />

            <div className="relative p-8 sm:p-10">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-[0.35em] text-neutral-400">Case File • Mileage Mafia</div>
                  <h2 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight">Articles of Entry</h2>
                  <p className="mt-3 text-neutral-400 text-sm leading-relaxed">Confirm each article. Sign your name.</p>
                </div>

                <button
                  type="button"
                  onClick={resetBackToLock}
                  className="shrink-0 px-4 py-2 rounded-full bg-white/5 ring-1 ring-white/10 text-neutral-300 text-sm hover:bg-white/10 transition"
                >
                  Back
                </button>
              </div>

              <div className="mt-8 space-y-3">
                {RULES.map((r, idx) => {
                  const accepted = !!checks[r.id];

                  return (
                    <label
                      key={r.id}
                      className={[
                        "group relative flex items-start gap-3 px-4 py-3 transition cursor-pointer",
                        "ring-1 ring-neutral-800 bg-neutral-950/35 hover:bg-white/[0.03]",
                        "rounded-xl",
                        accepted ? `${ACCENT.bgSoft} ring-1 ${ACCENT.ringStrong}` : "",
                      ].join(" ")}
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
                          <span
                            className={[
                              "h-[7px] w-[7px] rounded-full bg-red-500/90 transition",
                              accepted ? "scale-100 opacity-100" : "scale-0 opacity-0",
                            ].join(" ")}
                          />
                        </span>

                        {accepted ? <span className="pointer-events-none absolute -inset-2 rounded-full mm-notary" /> : null}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] uppercase tracking-[0.25em] text-neutral-500">
                            Article {String(idx + 1).padStart(2, "0")}
                          </span>

                          {accepted ? (
                            <span className={["text-[11px] uppercase tracking-[0.22em]", ACCENT.text].join(" ")}>Accepted</span>
                          ) : (
                            <span className="text-[11px] uppercase tracking-[0.22em] text-neutral-600">Pending</span>
                          )}
                        </div>

                        <div className="relative mt-1">
                          <div className={["text-neutral-200 font-mono text-[13.5px] leading-snug", accepted ? "opacity-90" : ""].join(" ")}>
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
                  className={[
                    "w-full rounded-2xl py-4 font-black tracking-[0.18em] uppercase transition shadow-[0_12px_46px_rgba(0,0,0,0.65)]",
                    canSwear ? `bg-red-500 text-black hover:brightness-110 ring-1 ${ACCENT.ringStrong}` : "bg-white text-black opacity-30 cursor-not-allowed",
                  ].join(" ")}
                >
                  Confirm Entry
                </button>

                <div className="mt-4 text-xs text-neutral-500">Your file will be reviewed before clearance is granted.</div>

                {err ? <p className="mt-4 text-red-300 text-sm">{err}</p> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <style>{`
        /* Review scan bar */
        @keyframes mmScan {
          0% { transform: translateX(-60%); opacity: 0.2; }
          20% { opacity: 0.9; }
          100% { transform: translateX(260%); opacity: 0.25; }
        }
        .mm-scan { animation: mmScan 900ms ease-in-out infinite; }

        /* Accepted strike */
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

        /* Notary pulse ring */
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

        /* Stamp */
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

        /* CLEARED glow */
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
