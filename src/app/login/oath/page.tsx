"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { setAuthed } from "@/lib/auth";
import { useAudio } from "@/components/AudioProvider";

type Step = "OATH" | "REVIEW" | "GRANTED";
type Rule = { id: string; text: string };

function clsx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

const ACCENT = {
  ring: "ring-red-500/25",
  redText: "rgba(239, 68, 68, 0.86)",
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

export default function OathPage() {
  const router = useRouter();
  const audio = useAudio();

  const [step, setStep] = useState<Step>("OATH");

  // -------------------------
  // Gate access
  // -------------------------
  useEffect(() => {
    try {
      if (sessionStorage.getItem("mm_pw_ok") !== "1") router.replace("/login");
    } catch {
      router.replace("/login");
    }
  }, [router]);

  // -------------------------
  // Ambience control
  // -------------------------
  const startAmbience = useCallback(async () => {
    try {
      await (audio as any)?.playAmbience?.();
    } catch {}
  }, [audio]);

  const stopMainTrack = useCallback(() => {
    try {
      (audio as any)?.stop?.();
      (audio as any)?.pause?.();
    } catch {}
  }, [audio]);

  // Keep ambience on this page
  useEffect(() => {
    void startAmbience();
  }, [startAmbience]);

  // -------------------------
  // ✅ HARD FIX: Noir prewarm that ALWAYS works
  // We keep a separate HTMLAudioElement playing at near-zero volume
  // (started from a user gesture), then fade it up later.
  // -------------------------
  const noirElRef = useRef<HTMLAudioElement | null>(null);
  const noirPrimedRef = useRef(false);

  const ensureNoirElement = useCallback(() => {
    if (noirElRef.current) return noirElRef.current;
    const el = new Audio("/audio/noir1.mp3");
    el.loop = true;
    el.preload = "auto";
    el.crossOrigin = "anonymous";
    el.volume = 0; // start silent, we’ll set to 0.001 before play
    noirElRef.current = el;
    return el;
  }, []);

  const primeNoirFromGesture = useCallback(async () => {
    if (noirPrimedRef.current) return;
    noirPrimedRef.current = true;

    // keep your provider unlock too (SFX, etc)
    try {
      await (audio as any)?.unlock?.();
    } catch {}

    const el = ensureNoirElement();

    try {
      // Important: Safari sometimes treats exactly 0 volume weirdly; use tiny non-zero.
      el.volume = 0.001;
      await el.play(); // MUST happen during gesture
      // leave it running silently; do NOT pause it
    } catch {
      noirPrimedRef.current = false;
    }
  }, [audio, ensureNoirElement]);

  const fadeNoirTo = useCallback((target: number, ms: number) => {
    const el = noirElRef.current;
    if (!el) return;

    const start = el.volume;
    const end = clamp01(target);
    const t0 = performance.now();

    const tick = (t: number) => {
      const p = clamp01((t - t0) / ms);
      el.volume = start + (end - start) * p;
      if (p < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, []);

  // -------------------------
  // REVIEW timers
  // -------------------------
  const [reviewCleared, setReviewCleared] = useState(false);
  const REVIEW_CLEAR_MS = 2400;
  const REVIEW_TOTAL_MS = 3900;

  // -------------------------
  // Rules
  // -------------------------
  const RULES: Rule[] = useMemo(
    () => [
      { id: "target", text: "I have pledged an annual mileage target. Once sworn, this target is final." },
      { id: "entryfee", text: "I have contributed ₹1000 to the family pot. Payment is mandatory." },
      { id: "clause85", text: "If I fail to reach 85% of my annual target by December 31st, an additional penalty of ₹1000 will be charged." },
      { id: "first", text: "The first member to reach 100% of their annual target will receive a ₹1000 leader bonus, funded equally by the remaining members." },
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

  const toggleRule = useCallback((id: string) => {
    setChecks((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const onSwear = useCallback(() => {
    if (step !== "OATH") return;
    if (!canSwear) return;

    // clicking this is a user gesture: prime noir RIGHT HERE too
    void primeNoirFromGesture();

    setAuthed();
    setReviewCleared(false);
    setStep("REVIEW");
  }, [canSwear, step, primeNoirFromGesture]);

  const goLedger = useCallback(() => router.push("/leaderboard"), [router]);

  const resetBackToDoor = useCallback(() => {
    stopMainTrack();
    try {
      sessionStorage.removeItem("mm_pw_ok");
    } catch {}
    router.replace("/login");
  }, [router, stopMainTrack]);

  // -------------------------
  // Stagger rules on first load
  // -------------------------
  const [rulesVisibleCount, setRulesVisibleCount] = useState(0);
  const ruleTimersRef = useRef<number[]>([]);
  const clearRuleTimers = useCallback(() => {
    ruleTimersRef.current.forEach((id) => window.clearTimeout(id));
    ruleTimersRef.current = [];
  }, []);

  useEffect(() => {
    if (step !== "OATH") return;

    clearRuleTimers();
    setRulesVisibleCount(0);

    const START_DELAY_MS = 520;
    const RULE_STAGGER_MS = 170;

    for (let i = 0; i < RULES.length; i++) {
      const id = window.setTimeout(() => setRulesVisibleCount((v) => Math.max(v, i + 1)), START_DELAY_MS + i * RULE_STAGGER_MS);
      ruleTimersRef.current.push(id);
    }

    return () => clearRuleTimers();
  }, [step, RULES.length, clearRuleTimers]);

  // REVIEW timers -> GRANTED
  useEffect(() => {
    if (step !== "REVIEW") return;

    const t1 = window.setTimeout(() => setReviewCleared(true), REVIEW_CLEAR_MS);
    const t2 = window.setTimeout(() => setStep("GRANTED"), REVIEW_TOTAL_MS);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [step]);

  // -------------------------
  // GRANTED: Fade ambience down, fade noir up
  // -------------------------
  const grantedFiredRef = useRef(false);
  const [fadeDim, setFadeDim] = useState(false);

  useEffect(() => {
    if (step !== "GRANTED") return;

    // reset dim state each entry
    setFadeDim(false);

    if (grantedFiredRef.current) return;
    grantedFiredRef.current = true;

    // Start dim + fade timing
    const DIM_IN_MS = 120;
    const FADE_MS = 900;

    const dimId = window.setTimeout(() => setFadeDim(true), DIM_IN_MS);

    // Fade noir UP (it is already playing silently)
    const noirUpId = window.setTimeout(() => {
      fadeNoirTo(0.9, FADE_MS);
    }, 220);

    // Stop ambience a bit after noir fade begins (so we never need a new play() call)
    const stopId = window.setTimeout(() => {
      stopMainTrack();
    }, 420);

    return () => {
      window.clearTimeout(dimId);
      window.clearTimeout(noirUpId);
      window.clearTimeout(stopId);
    };
  }, [step, fadeNoirTo, stopMainTrack]);

  // -------------------------
  // Hotkeys
  // -------------------------
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (step === "REVIEW") return;

      if (step === "OATH") {
        void primeNoirFromGesture();
        if (canSwear && e.key === "Enter") {
          e.preventDefault();
          onSwear();
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
          resetBackToDoor();
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, canSwear, onSwear, goLedger, resetBackToDoor, primeNoirFromGesture]);

  // Button multi-tap fix: nav lock
  const navLockRef = useRef(false);
  const onLedgerClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (navLockRef.current) return;
      navLockRef.current = true;
      goLedger();
      window.setTimeout(() => {
        navLockRef.current = false;
      }, 1200);
    },
    [goLedger]
  );

  return (
    <main
      className="min-h-screen bg-black text-white relative overflow-hidden"
      onPointerDown={() => void primeNoirFromGesture()}
      onTouchStart={() => void primeNoirFromGesture()}
    >
      {/* background */}
      <div className="pointer-events-none absolute inset-0 noir-layer">
        <div className="absolute inset-0 bg-[#050505]" />
        <div className="absolute inset-0 noir-static opacity-[0.10] mix-blend-overlay" />
        <div className="absolute inset-0 noir-scanlines opacity-[0.08] mix-blend-overlay" />
        <div className="absolute inset-0 noir-drift opacity-[0.28]" />
        <div className="absolute inset-0 noir-vignette" />
      </div>

      {/* REVIEW */}
      {step === "REVIEW" ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-auto">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] pointer-events-none" />
          <div className="relative w-[min(640px,92vw)] rounded-3xl bg-black/70 backdrop-blur-xl ring-1 ring-white/10 shadow-[0_18px_70px_rgba(0,0,0,0.78)] overflow-hidden pointer-events-auto">
            <div className="px-10 py-9 text-center">
              <div className="text-[10px] uppercase tracking-[0.38em] text-neutral-500 mb-3">Case File Processing</div>

              <div
                className="text-2xl md:text-3xl tracking-tight"
                style={{
                  fontFamily: "ui-serif, Georgia, 'Times New Roman', Times, serif",
                  letterSpacing: "0.02em",
                  fontWeight: 700,
                }}
              >
                REVIEWING
              </div>

              <div className="mt-3 text-neutral-400 text-sm">Articles verified. Signature cross-checked. Clearance being issued.</div>

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

      {/* GRANTED: CLEAN welcome card (NO “system loading” junk) */}
      {step === "GRANTED" ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-auto">
          {/* sexy dim during fade */}
          <div className={clsx("absolute inset-0 pointer-events-none transition-opacity duration-700", fadeDim ? "opacity-60" : "opacity-0")} style={{ background: "black" }} />

          <div className="relative w-[min(680px,92vw)] pointer-events-auto">
            <div className="rounded-3xl bg-black/70 backdrop-blur-xl ring-1 ring-white/10 shadow-[0_18px_70px_rgba(0,0,0,0.84)] overflow-hidden pointer-events-auto">
              <div className="relative px-10 py-10 text-center pointer-events-auto">
                <div className="text-[10px] uppercase tracking-[0.38em] text-neutral-500 mb-3">Mileage Mafia</div>

                <div
                  className="text-3xl md:text-4xl tracking-tight"
                  style={{
                    fontFamily: "ui-serif, Georgia, 'Times New Roman', Times, serif",
                    letterSpacing: "0.02em",
                    fontWeight: 900,
                  }}
                >
                  CLEARANCE GRANTED
                </div>

                <div className="mt-3 text-neutral-400 text-sm">Welcome to the family. The ledger is now available.</div>

                <div className="mt-8 mx-auto w-full max-w-[540px] rounded-2xl bg-black/35 ring-1 ring-white/10 px-6 py-6 text-left">
                  <div className="text-[10px] uppercase tracking-[0.35em] text-neutral-600">CASE FILE</div>

                  <div className="mt-4 space-y-2 text-[12px] uppercase tracking-[0.18em] text-neutral-300">
                    <div className="flex items-center justify-between">
                      <span>Identity</span>
                      <span className="text-emerald-200/90">Verified</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Oath</span>
                      <span className="text-emerald-200/90">Filed</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Ledger Access</span>
                      <span className="text-emerald-200/90">Enabled</span>
                    </div>
                    <div className="mt-4 h-px bg-white/10" />
                    <div className="flex items-center justify-between">
                      <span>Status</span>
                      <span className="mm-cleared font-semibold">CLEARED</span>
                    </div>
                  </div>
                </div>

                <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-3 pointer-events-auto">
                  <button
                    type="button"
                    onClick={onLedgerClick}
                    className={clsx("px-6 py-3 rounded-2xl font-semibold transition", "bg-white text-black hover:opacity-90", `ring-1 ${ACCENT.ring}`)}
                    style={{ letterSpacing: "0.02em", touchAction: "manipulation" }}
                  >
                    View the Ledger →
                  </button>

                  <button
                    type="button"
                    onClick={resetBackToDoor}
                    className="px-6 py-3 rounded-2xl font-semibold bg-white/5 ring-1 ring-white/10 text-neutral-300 hover:bg-white/10 transition"
                    style={{ letterSpacing: "0.02em", touchAction: "manipulation" }}
                  >
                    Back to Door
                  </button>
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
            {/* Sidebar */}
            <aside className="rounded-3xl bg-black/55 ring-1 ring-white/10 shadow-[0_18px_70px_rgba(0,0,0,0.68)] overflow-hidden">
              <div className="relative p-7">
                <div className="pointer-events-none absolute inset-0 opacity-[0.08] noir-static mix-blend-overlay" />
                <div className="pointer-events-none absolute inset-0 opacity-[0.08] noir-scanlines mix-blend-overlay" />

                <div className="relative">
                  <div className="text-[10px] uppercase tracking-[0.38em] text-neutral-500">Case File</div>

                  <div
                    className="mt-2 text-2xl tracking-tight"
                    style={{
                      fontFamily: "ui-serif, Georgia, 'Times New Roman', Times, serif",
                      fontWeight: 800,
                      letterSpacing: "0.02em",
                    }}
                  >
                    MM / ENTRY
                  </div>

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
                            className="h-full"
                            style={{
                              width: `${Math.round((Object.values(checks).filter(Boolean).length / Math.max(1, RULES.length)) * 100)}%`,
                              background: "linear-gradient(90deg, rgba(239,68,68,0.78), rgba(239,68,68,0.28))",
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
                      onClick={resetBackToDoor}
                      className="w-full px-5 py-3 rounded-2xl bg-white/5 ring-1 ring-white/10 text-neutral-200 hover:bg-white/10 transition font-semibold"
                      style={{ letterSpacing: "0.02em", touchAction: "manipulation" }}
                    >
                      Back to Door
                    </button>
                  </div>

                  <div className="mt-6 text-[10px] uppercase tracking-[0.35em] text-neutral-600">Tip: Enter to file (when cleared)</div>
                  <div className="mt-6 text-[10px] tracking-[0.22em] uppercase text-neutral-700">built by me • all rights reserved</div>
                </div>
              </div>
            </aside>

            {/* Main */}
            <section className="rounded-3xl bg-black/55 ring-1 ring-white/10 shadow-[0_18px_70px_rgba(0,0,0,0.78)] overflow-hidden">
              <div className="relative p-8 sm:p-10">
                <div className="pointer-events-none absolute inset-0 opacity-[0.10] noir-static mix-blend-overlay" />
                <div className="pointer-events-none absolute inset-0 opacity-[0.08] noir-scanlines mix-blend-overlay" />

                <div className="relative">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-[0.38em] text-neutral-400">Mileage Mafia • Dossier</div>
                      <h2
                        className="mt-2 text-3xl sm:text-4xl tracking-tight"
                        style={{
                          fontFamily: "ui-serif, Georgia, 'Times New Roman', Times, serif",
                          fontWeight: 900,
                          letterSpacing: "0.01em",
                        }}
                      >
                        Articles of Entry
                      </h2>
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

                  {/* Rules */}
                  <div className="mt-8 space-y-3">
                    {RULES.map((r, idx) => {
                      const accepted = !!checks[r.id];
                      const visible = idx < rulesVisibleCount;

                      return (
                        <label
                          key={r.id}
                          className={clsx(
                            "group relative flex items-start gap-3 px-4 py-3 cursor-pointer",
                            "ring-1 ring-white/10 bg-black/35 hover:bg-white/[0.03]",
                            "rounded-2xl",
                            accepted ? "mm-accepted" : "",
                            "transition-all ease-out",
                            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
                          )}
                          style={{ transitionDuration: "520ms" }}
                        >
                          <span className="relative mt-[3px] shrink-0">
                            <input
                              type="checkbox"
                              checked={accepted}
                              onChange={() => toggleRule(r.id)}
                              className="peer absolute inset-0 h-5 w-5 opacity-0 cursor-pointer"
                              aria-label={`Accept ${r.id}`}
                            />
                            <span className="relative grid place-items-center h-5 w-5 rounded-full ring-1 ring-white/20 bg-black/40 transition peer-hover:ring-white/35 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-red-500/40">
                              <span
                                className={clsx("h-[7px] w-[7px] rounded-full transition", accepted ? "scale-100 opacity-100" : "scale-0 opacity-0")}
                                style={{ background: "rgba(239,68,68,0.92)" }}
                              />
                            </span>
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] uppercase tracking-[0.34em] text-neutral-500">
                                Article {String(idx + 1).padStart(2, "0")}
                              </span>
                              {accepted ? (
                                <span className="text-[10px] uppercase tracking-[0.28em]" style={{ color: ACCENT.redText }}>
                                  Accepted
                                </span>
                              ) : (
                                <span className="text-[10px] uppercase tracking-[0.28em] text-neutral-600">Pending</span>
                              )}
                            </div>

                            <div className="relative mt-2">
                              <div className={clsx("text-neutral-200 text-[13.5px] leading-relaxed", accepted ? "opacity-90" : "")}>
                                {r.text}
                              </div>
                              {accepted ? <div className="pointer-events-none absolute right-0 top-[-6px] mm-ink">INKED</div> : null}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  {/* Signature */}
                  <div className="mt-10 rounded-3xl ring-1 ring-white/10 bg-black/35 p-6 sm:p-7">
                    <div className="text-[10px] uppercase tracking-[0.38em] text-neutral-500">Signature</div>

                    <div className="mt-4">
                      <input
                        value={sig}
                        onChange={(e) => setSig(e.target.value)}
                        placeholder="Type full name"
                        className="w-full bg-transparent px-1 py-3 text-lg outline-none border-b border-white/20 focus:border-white/40 transition"
                        style={{
                          fontFamily: "ui-serif, Georgia, 'Times New Roman', Times, serif",
                          letterSpacing: "0.02em",
                          fontWeight: 700,
                        }}
                      />

                      <div className="mt-2 text-xs text-neutral-500">
                        {signed ? <span className="text-emerald-200/90">Signed.</span> : "Type at least 3 characters to sign."}
                      </div>
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="mt-8">
                    <button
                      type="button"
                      onClick={onSwear}
                      disabled={!canSwear}
                      className={clsx(
                        "w-full rounded-2xl py-4 transition shadow-[0_12px_46px_rgba(0,0,0,0.65)]",
                        canSwear ? "bg-white text-black hover:opacity-90 ring-1 ring-white/20" : "bg-white text-black opacity-25 cursor-not-allowed"
                      )}
                      style={{
                        fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif",
                        letterSpacing: "0.22em",
                        textTransform: "uppercase",
                        fontWeight: 800,
                      }}
                    >
                      File Dossier
                    </button>

                    <div className="mt-4 text-xs text-neutral-500">Your file will be reviewed before clearance is granted.</div>

                    {canSwear ? (
                      <div className="mt-3 text-[10px] uppercase tracking-[0.35em]" style={{ color: ACCENT.redText }}>
                        clearance granted • press enter
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      ) : null}

      <style>{`
        .noir-layer{ filter: saturate(0.98) contrast(1.06); }

        .noir-static{
          background-image:
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.72' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E");
          background-size: 420px 420px;
          animation: mmNoiseDrift 7.8s linear infinite;
          transform: translateZ(0);
        }
        @keyframes mmNoiseDrift{
          0%{ transform: translate3d(0,0,0); }
          35%{ transform: translate3d(-12px,8px,0); }
          70%{ transform: translate3d(10px,-7px,0); }
          100%{ transform: translate3d(0,0,0); }
        }

        .noir-scanlines{
          background: repeating-linear-gradient(
            to bottom,
            rgba(255,255,255,0.06),
            rgba(255,255,255,0.06) 1px,
            transparent 1px,
            transparent 5px
          );
          transform: translateZ(0);
        }

        .noir-drift{
          background:
            radial-gradient(900px_circle_at_18%_22%,rgba(255,255,255,0.03),transparent_62%),
            radial-gradient(950px_circle_at_82%_18%,rgba(239,68,68,0.05),transparent_64%),
            radial-gradient(900px_circle_at_55%_112%,rgba(255,255,255,0.02),transparent_66%);
          animation: mmDrift 10s ease-in-out infinite;
        }
        @keyframes mmDrift{
          0%,100%{ transform: translate3d(0,0,0); }
          50%{ transform: translate3d(8px,-6px,0); }
        }

        .noir-vignette{
          background:
            radial-gradient(1200px_circle_at_50%_35%,transparent_40%,rgba(0,0,0,0.97)_84%),
            radial-gradient(1000px_circle_at_50%_120%,rgba(0,0,0,0.94),transparent_64%);
        }

        .mm-accepted{
          background: rgba(239,68,68,0.08);
          box-shadow: inset 0 0 0 1px rgba(239,68,68,0.14);
        }

        .mm-ink{
          font-size: 10px;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: rgba(239, 68, 68, 0.75);
          border: 1px solid rgba(239, 68, 68, 0.30);
          padding: 2px 6px;
          border-radius: 999px;
          transform: rotate(-6deg);
          animation: mmInk 220ms ease-out both;
          mix-blend-mode: screen;
        }
        @keyframes mmInk {
          0% { opacity: 0; transform: translateY(-2px) rotate(-10deg) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) rotate(-6deg) scale(1); }
        }

        @keyframes mmScan {
          0% { transform: translateX(-60%); opacity: 0.2; }
          20% { opacity: 0.9; }
          100% { transform: translateX(260%); opacity: 0.25; }
        }
        .mm-scan { animation: mmScan 900ms ease-in-out infinite; }

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
