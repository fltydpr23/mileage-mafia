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

  // LOCK (Terminal)
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [terminalState, setTerminalState] = useState<
    "IDLE" | "CONNECTING" | "DENIED" | "GRANTED"
  >("IDLE");
  const pwRef = useRef<HTMLInputElement | null>(null);

  // REVIEW
  const [reviewCleared, setReviewCleared] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);

  // Tune review duration here
  const REVIEW_CLEAR_MS = 2400; // when status flips to CLEARED
  const REVIEW_TOTAL_MS = 3900; // when INDUCTED appears

  // OATH / Case File Dossier (Articles)
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
      {
        id: "noexcuses",
        text: "Conditions, injuries, devices, or circumstances do not alter the terms. Only completed distance is recognized.",
      },
      {
        id: "respect",
        text: "Disorder, manipulation, or disrespect will be met with penalties at the discretion of the family.",
      },
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

  // ---- Audio helpers ----
  const stopAudio = useCallback(() => {
    const a: any = audio as any;
    try {
      a.stop?.();
      a.pause?.();
    } catch {
      // ignore
    }
  }, [audio]);

  const tryPlayAmbience = useCallback(async () => {
    setAudioBlocked(false);
    try {
      await audio.playAmbience();
    } catch {
      setAudioBlocked(true);
    }
  }, [audio]);

  const tryPlayMusic = useCallback(async () => {
    setAudioBlocked(false);
    try {
      await audio.playMusic(0);
    } catch {
      setAudioBlocked(true);
    }
  }, [audio]);

  // Ambience should play on LOCK automatically
  useEffect(() => {
    if (step !== "LOCK") return;
    // best effort autoplay
    void tryPlayAmbience();
  }, [step, tryPlayAmbience]);

  const resetBackToLock = useCallback(() => {
    stopAudio();
    setAudioBlocked(false);
    setReviewCleared(false);

    setStep("LOCK");
    setPw("");
    setErr("");
    setChecks(initialChecks);
    setSig("");
    setTerminalState("IDLE");

    requestAnimationFrame(() => {
      pwRef.current?.focus();
      pwRef.current?.click?.();
    });
  }, [initialChecks, stopAudio]);

  const onSubmitPassword = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErr("");
      if (step !== "LOCK") return;

      if (!pw.trim()) {
        setErr("ACCESS KEY REQUIRED");
        setTerminalState("DENIED");
        window.setTimeout(() => setTerminalState("IDLE"), 650);
        return;
      }

      setTerminalState("CONNECTING");

      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });

      const data = await res.json().catch(() => ({ ok: false }));
      if (!data.ok) {
        setErr("ACCESS DENIED");
        setTerminalState("DENIED");
        window.setTimeout(() => setTerminalState("IDLE"), 700);
        setPw("");
        requestAnimationFrame(() => {
          pwRef.current?.focus();
          pwRef.current?.click?.();
        });
        return;
      }

      setTerminalState("GRANTED");
      // tiny beat then proceed
      window.setTimeout(() => setStep("OATH"), 520);
    },
    [pw, step]
  );

  const onSwear = useCallback(() => {
    if (step !== "OATH") return;
    if (!canSwear) return;

    setErr("");
    setAuthed();

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
  }, [step]);

  // Noir starts when INDUCTED is on-screen
  useEffect(() => {
    if (step !== "GRANTED") return;

    // optional: try to align with the stamp hit moment
    // (keeps it feeling like the music starts "on stamp")
    const t = window.setTimeout(() => {
      // if you have SFX wired, this is the vibe:
      try {
        (audio as any).sfx?.("stamp", { volume: 0.9 });
      } catch {}
      void tryPlayMusic();
    }, 220);

    return () => window.clearTimeout(t);
  }, [step, audio, tryPlayMusic]);

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
      });
    }
  }, [step]);

  /**
   * =========================
   * TERMINAL (LOCK)
   * =========================
   */
  if (step === "LOCK") {
    const statusLabel =
      terminalState === "CONNECTING"
        ? "CONNECTING"
        : terminalState === "DENIED"
        ? "DENIED"
        : terminalState === "GRANTED"
        ? "GRANTED"
        : "STANDBY";

    const statusTone =
      terminalState === "CONNECTING"
        ? "bg-white/5 ring-white/10 text-neutral-200"
        : terminalState === "DENIED"
        ? "bg-red-500/10 ring-red-500/20 text-red-200"
        : terminalState === "GRANTED"
        ? "bg-emerald-500/10 ring-emerald-500/20 text-emerald-200"
        : "bg-white/5 ring-white/10 text-neutral-400";

    const dotTone =
      terminalState === "CONNECTING"
        ? "bg-white/60 mm-dot"
        : terminalState === "DENIED"
        ? "bg-red-400"
        : terminalState === "GRANTED"
        ? "bg-emerald-400"
        : "bg-white/25";

    return (
      <main
        className="fixed inset-0 bg-black text-white overflow-hidden"
        onMouseDown={() => pwRef.current?.focus()}
        onTouchStart={() => pwRef.current?.focus()}
      >
        {/* noir bg */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-black" />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(900px circle at 50% 18%, rgba(255,255,255,0.06), transparent 55%)," +
                "radial-gradient(900px circle at 80% 85%, rgba(239,68,68,0.08), transparent 58%)",
              opacity: 0.95,
            }}
          />
          <div className="pointer-events-none absolute inset-0 noir-noise opacity-[0.12] mix-blend-overlay" />
          <div className="pointer-events-none absolute inset-0 noir-scanlines opacity-[0.10] mix-blend-overlay" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_circle_at_50%_45%,transparent_35%,rgba(0,0,0,0.97)_82%)]" />
        </div>

        <div className="relative h-full w-full grid place-items-center px-6">
          <form onSubmit={onSubmitPassword} className="w-full max-w-2xl">
            <div className="rounded-[26px] bg-neutral-950/55 ring-1 ring-neutral-800 shadow-[0_18px_70px_rgba(0,0,0,0.75)] overflow-hidden">
              {/* top bar */}
              <div className="px-6 sm:px-7 py-4 border-b border-white/5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.38em] text-neutral-500">
                    Mileage Mafia Secure Terminal
                  </div>
                  <div className="mt-1 text-sm text-neutral-400 truncate">
                    mm://private-ledger • auth required
                  </div>
                </div>

                <div className={clsx("shrink-0 inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] uppercase tracking-[0.22em] ring-1", statusTone)}>
                  <span className={clsx("h-1.5 w-1.5 rounded-full", dotTone)} />
                  {statusLabel}
                </div>
              </div>

              {/* “terminal” body */}
              <div className="relative p-6 sm:p-7">
                <div className="pointer-events-none absolute inset-0 opacity-[0.12] mix-blend-overlay noir-noise" />
                <div className="pointer-events-none absolute inset-0 opacity-[0.10] noir-scanlines mix-blend-overlay" />

                <div className="relative font-mono">
                  <div className="text-[12px] sm:text-[13px] leading-relaxed text-neutral-300">
                    <Line dim>$</Line> <Line>handshake --target mm-ledger</Line>
                    <Line dim>&gt;</Line>{" "}
                    <Line>
                      link: <span className="text-neutral-200">ok</span> • integrity:{" "}
                      <span className="text-neutral-200">verified</span>
                    </Line>
                    <Line dim>&gt;</Line>{" "}
                    <Line>
                      clearance:{" "}
                      <span className={terminalState === "DENIED" ? "text-red-200" : terminalState === "GRANTED" ? "text-emerald-200" : "text-neutral-200"}>
                        pending
                      </span>
                    </Line>
                    <div className="mt-4 h-px bg-white/5" />
                  </div>

                  <div className="mt-5">
                    <label className="block text-[10px] uppercase tracking-[0.35em] text-neutral-600 font-sans">
                      Access key
                    </label>

                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-neutral-500 select-none">$</span>
                      <input
                        ref={pwRef}
                        type="password"
                        value={pw}
                        onChange={(e) => setPw(e.target.value)}
                        autoComplete="current-password"
                        enterKeyHint="go"
                        placeholder="enter key"
                        className={clsx(
                          "flex-1 rounded-2xl bg-black/45 px-4 py-3 text-[14px] tracking-[0.12em]",
                          "ring-1 outline-none transition",
                          err ? "ring-red-500/35 focus:ring-red-500/45" : "ring-white/10 focus:ring-red-500/25"
                        )}
                      />

                      <button
                        type="submit"
                        className={clsx(
                          "px-4 py-2 rounded-full text-sm font-semibold transition font-sans",
                          "bg-white/5 ring-1 ring-white/10 text-neutral-200 hover:bg-white/10"
                        )}
                      >
                        Execute ↵
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-neutral-500 font-sans">
                      <span>Enter to submit • Tap anywhere to focus</span>

                      {audioBlocked ? (
                        <button
                          type="button"
                          onClick={tryPlayAmbience}
                          className="px-3 py-1.5 rounded-full bg-white/5 ring-1 ring-white/10 text-neutral-200 hover:bg-white/10 transition"
                        >
                          Enable Audio
                        </button>
                      ) : (
                        <span className="text-neutral-600">ambience: armed</span>
                      )}
                    </div>

                    {err ? (
                      <div className="mt-4 text-red-200 text-[11px] tracking-[0.25em] uppercase font-sans">
                        {err}
                      </div>
                    ) : null}

                    {terminalState === "GRANTED" ? (
                      <div className="mt-4 text-emerald-200 text-[11px] tracking-[0.25em] uppercase font-sans">
                        Clearance granted.
                      </div>
                    ) : null}
                  </div>

                  {/* hidden submit button keeps mobile Go reliable */}
                  <button type="submit" className="hidden" aria-hidden />
                </div>
              </div>

              {/* footer */}
              <div className="border-t border-white/5 px-6 sm:px-7 py-4">
                <div className="text-[11px] text-neutral-500 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="uppercase tracking-[0.28em]">MM SECURE</span>
                  <span className="text-neutral-700">•</span>
                  <span>unauthorized access is logged</span>
                </div>
              </div>
            </div>
          </form>
        </div>

        <style>{`
          .mm-dot{ animation: mmDot 900ms ease-in-out infinite; }
          @keyframes mmDot{ 0%,100%{ opacity: .25 } 50%{ opacity: .9 } }
        `}</style>
      </main>
    );
  }

  /**
   * =========================
   * CASE FILE DOSSIER → REVIEWING → STAMP INDUCTED
   * (unchanged)
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

      {/* GRANTED overlay (STAMP INDUCTED) */}
      {step === "GRANTED" ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-white/10 mm-flash" />

          <div className="relative w-[min(640px,92vw)]">
            <div className="rounded-3xl bg-black/70 backdrop-blur-xl ring-1 ring-white/10 shadow-[0_18px_70px_rgba(0,0,0,0.80)] overflow-hidden">
              <div className="relative px-10 py-9 text-center">
                <div className="text-xs uppercase tracking-[0.35em] text-neutral-500 mb-3">Mileage Mafia</div>
                <div className="text-3xl md:text-4xl font-black tracking-tight">INDUCTED</div>
                <div className="mt-3 text-neutral-400 text-sm">Your entry has been recorded.</div>

                {/* stamp stage */}
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

                {audioBlocked ? (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={tryPlayMusic}
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

      {/* CASE FILE DOSSIER (OATH) */}
      {step === "OATH" ? (
        <div className="relative max-w-5xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
            {/* left dossier tab */}
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
                          <span className="tabular-nums">{Object.values(checks).filter(Boolean).length}/{RULES.length}</span>
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

            {/* right dossier body */}
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
                              <span
                                className={clsx(
                                  "h-[7px] w-[7px] rounded-full bg-red-500/90 transition",
                                  accepted ? "scale-100 opacity-100" : "scale-0 opacity-0"
                                )}
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

                    {err ? <p className="mt-4 text-red-300 text-sm">{err}</p> : null}
                  </div>
                </div>
              </div>
            </section>
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

        /* Small pill stamp */
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

        /* Stamp Inducted */
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
      `}</style>
    </main>
  );
}

function Line({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return <span className={dim ? "text-neutral-600" : ""}>{children}</span>;
}
