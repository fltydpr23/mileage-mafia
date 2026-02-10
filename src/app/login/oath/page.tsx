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

// Accent stays, but we’ll use it more selectively (premium feel)
const ACCENT = {
  ring: "ring-red-500/25",
  ringStrong: "ring-red-500/35",
  redSoft: "rgba(239, 68, 68, 0.14)",
  redText: "rgba(239, 68, 68, 0.86)",
};

export default function OathPage() {
  const router = useRouter();
  const audio = useAudio();

  const [step, setStep] = useState<Step>("OATH");

  // Gate access
  useEffect(() => {
    try {
      if (sessionStorage.getItem("mm_pw_ok") !== "1") router.replace("/login");
    } catch {
      router.replace("/login");
    }
  }, [router]);

  // ===== Audio: keep ambience through OATH+REVIEW, stamp, then noir immediately =====
  const grantedFiredRef = useRef(false);
  const lastStampAtRef = useRef(0);

  const stopMainTrack = useCallback(() => {
    try {
      (audio as any)?.stop?.();
      (audio as any)?.pause?.();
    } catch {}
  }, [audio]);

  const startAmbience = useCallback(async () => {
    try {
      await (audio as any)?.playAmbience?.();
    } catch {}
  }, [audio]);

  const startNoir = useCallback(async () => {
    try {
      await (audio as any)?.playMusic?.(0);
    } catch {}
  }, [audio]);

  // Ensure ambience continues when arriving here (and in case of refresh)
  useEffect(() => {
    void startAmbience();
  }, [startAmbience]);

  // REVIEW
  const [reviewCleared, setReviewCleared] = useState(false);
  const REVIEW_CLEAR_MS = 2400;
  const REVIEW_TOTAL_MS = 3900;

  // ===== Content =====
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

  const onSwear = useCallback(() => {
    if (step !== "OATH") return;
    if (!canSwear) return;

    setAuthed();
    setReviewCleared(false);
    setStep("REVIEW");
  }, [canSwear, step]);

  const resetBackToDoor = useCallback(() => {
    stopMainTrack();
    try {
      sessionStorage.removeItem("mm_pw_ok");
    } catch {}
    router.replace("/login");
  }, [router, stopMainTrack]);

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

  // ✅ GRANTED: stamp SFX (WebAudio) -> stop ambience -> noir immediately
  useEffect(() => {
    if (step !== "GRANTED") return;
    if (grantedFiredRef.current) return;
    grantedFiredRef.current = true;

    const t = window.setTimeout(async () => {
      // stamp
      const now = Date.now();
      if (now - lastStampAtRef.current > 900) {
        lastStampAtRef.current = now;
        try {
          (audio as any)?.sfx?.("stamp", { volume: 0.95 });
        } catch {}
      }

      // stop ambience immediately after triggering stamp
      stopMainTrack();

      // noir immediately after (tiny beat)
      window.setTimeout(() => void startNoir(), 90);
    }, 140);

    return () => window.clearTimeout(t);
  }, [step, audio, stopMainTrack, startNoir]);

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
          resetBackToDoor();
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
  }, [step, canSwear, goLedger, onSwear, resetBackToDoor]);

  // =========================
  // UI: keep dossier, but make it “Invocation premium”
  // - ritual serif headings, clean body
  // - calmer red, more whitespace, less “template”
  // - animated TV static background (moving)
  // =========================

  return (
    <main className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* premium noir + moving TV static */}
      <div className="pointer-events-none absolute inset-0 noir-layer">
        <div className="absolute inset-0 bg-[#050505]" />
        <div className="absolute inset-0 noir-static opacity-[0.10] mix-blend-overlay" />
        <div className="absolute inset-0 noir-scanlines opacity-[0.08] mix-blend-overlay" />
        <div className="absolute inset-0 noir-drift opacity-[0.28]" />
        <div className="absolute inset-0 noir-vignette" />
      </div>

      {/* REVIEW overlay */}
      {step === "REVIEW" ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
          <div className="relative w-[min(640px,92vw)] rounded-3xl bg-black/70 backdrop-blur-xl ring-1 ring-white/10 shadow-[0_18px_70px_rgba(0,0,0,0.78)] overflow-hidden">
            <div className="px-10 py-9 text-center">
              <div
                className="text-[10px] uppercase tracking-[0.38em] text-neutral-500 mb-3"
                style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif" }}
              >
                Case File Processing
              </div>

              <div
                className="text-2xl md:text-3xl tracking-tight"
                style={{
                  fontFamily:
                    "ui-serif, Georgia, 'Times New Roman', Times, serif",
                  letterSpacing: "0.02em",
                  fontWeight: 700,
                }}
              >
                REVIEWING
              </div>

              <div className="mt-3 text-neutral-400 text-sm">
                Articles verified. Signature cross-checked. Ledger being stamped.
              </div>

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

          <div className="relative w-[min(660px,92vw)]">
            <div className="rounded-3xl bg-black/70 backdrop-blur-xl ring-1 ring-white/10 shadow-[0_18px_70px_rgba(0,0,0,0.84)] overflow-hidden">
              <div className="relative px-10 py-9 text-center">
                <div className="text-[10px] uppercase tracking-[0.38em] text-neutral-500 mb-3">Mileage Mafia</div>

                <div
                  className="text-3xl md:text-4xl tracking-tight"
                  style={{
                    fontFamily: "ui-serif, Georgia, 'Times New Roman', Times, serif",
                    letterSpacing: "0.02em",
                    fontWeight: 800,
                  }}
                >
                  INDUCTED
                </div>

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
                    className={clsx(
                      "px-6 py-3 rounded-2xl font-semibold transition",
                      "bg-white text-black hover:opacity-90",
                      `ring-1 ${ACCENT.ring}`
                    )}
                    style={{ letterSpacing: "0.02em" }}
                  >
                    View the Ledger →
                  </button>

                  <button
                    type="button"
                    onClick={resetBackToDoor}
                    className="px-6 py-3 rounded-2xl font-semibold bg-white/5 ring-1 ring-white/10 text-neutral-300 hover:bg-white/10 transition"
                    style={{ letterSpacing: "0.02em" }}
                  >
                    Back to Door
                  </button>
                </div>

                <div className="mt-6 text-[10px] uppercase tracking-[0.35em] text-neutral-600">
                  Status: <span className="mm-cleared font-semibold">CLEARED</span>
                </div>
                <div className="mt-3 text-[10px] text-neutral-600">(Enter = Ledger • Esc = Door)</div>

                <div className="mt-10 text-[10px] tracking-[0.22em] uppercase text-neutral-700">
                  built by me • all rights reserved
                </div>
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
                          <span className="tabular-nums">
                            {Object.values(checks).filter(Boolean).length}/{RULES.length}
                          </span>
                        </div>

                        <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full"
                            style={{
                              width: `${Math.round(
                                (Object.values(checks).filter(Boolean).length / Math.max(1, RULES.length)) * 100
                              )}%`,
                              background:
                                "linear-gradient(90deg, rgba(239,68,68,0.78), rgba(239,68,68,0.28))",
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
                      style={{ letterSpacing: "0.02em" }}
                    >
                      Back to Door
                    </button>
                  </div>

                  <div className="mt-6 text-[10px] uppercase tracking-[0.35em] text-neutral-600">
                    Tip: Enter to file (when cleared)
                  </div>

                  <div className="mt-6 text-[10px] tracking-[0.22em] uppercase text-neutral-700">
                    built by me • all rights reserved
                  </div>
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
                      <div className="text-[10px] uppercase tracking-[0.38em] text-neutral-400">
                        Mileage Mafia • Dossier
                      </div>

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

                      <p className="mt-3 text-neutral-400 text-sm leading-relaxed">
                        Read. Accept. Sign. File.
                      </p>
                    </div>

                    <div className="shrink-0">
                      <div className="rounded-2xl bg-black/35 ring-1 ring-white/10 px-4 py-3">
                        <div className="text-[10px] uppercase tracking-[0.35em] text-neutral-600">CLEARANCE</div>
                        <div
                          className={clsx("mt-2 text-sm font-semibold", canSwear ? "text-emerald-200" : "text-neutral-300")}
                          style={{ letterSpacing: "0.02em" }}
                        >
                          {canSwear ? "READY TO FILE" : "NOT READY"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Rules */}
                  <div className="mt-8 space-y-3">
                    {RULES.map((r, idx) => {
                      const accepted = !!checks[r.id];

                      return (
                        <label
                          key={r.id}
                          className={clsx(
                            "group relative flex items-start gap-3 px-4 py-3 transition cursor-pointer",
                            "ring-1 ring-white/10 bg-black/35 hover:bg-white/[0.03]",
                            "rounded-2xl",
                            accepted ? "mm-accepted" : ""
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

                            <span className="relative grid place-items-center h-5 w-5 rounded-full ring-1 ring-white/20 bg-black/40 transition peer-hover:ring-white/35 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-red-500/40">
                              <span
                                className={clsx(
                                  "h-[7px] w-[7px] rounded-full transition",
                                  accepted ? "scale-100 opacity-100" : "scale-0 opacity-0"
                                )}
                                style={{ background: "rgba(239,68,68,0.92)" }}
                              />
                            </span>

                            {accepted ? <span className="pointer-events-none absolute -inset-2 rounded-full mm-notary" /> : null}
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
                              <div
                                className={clsx("text-neutral-200 text-[13.5px] leading-relaxed", accepted ? "opacity-90" : "")}
                                style={{
                                  fontFamily:
                                    "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, 'Segoe UI', Roboto, sans-serif",
                                  letterSpacing: "0.01em",
                                }}
                              >
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
                        {signed ? (
                          <span className="text-emerald-200/90">Signed.</span>
                        ) : (
                          "Type at least 3 characters to sign."
                        )}
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

                    <div className="mt-4 text-xs text-neutral-500">
                      Your file will be reviewed before clearance is granted.
                    </div>

                    {/* subtle red “ritual” hint when ready */}
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
        /* ====== premium moving TV static ====== */
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

        /* ====== subtle accepted styling ====== */
        .mm-accepted{
          background: rgba(239,68,68,0.08);
          box-shadow: inset 0 0 0 1px rgba(239,68,68,0.14);
        }

        .mm-notary {
          position: absolute;
          inset: -8px;
          border-radius: 999px;
          box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.18);
          animation: mmNotary 320ms ease-out both;
          pointer-events: none;
        }
        @keyframes mmNotary {
          0% { transform: scale(0.75); opacity: 0; }
          45% { opacity: 1; }
          100% { transform: scale(1.18); opacity: 0; }
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

        /* ====== review progress scan ====== */
        @keyframes mmScan {
          0% { transform: translateX(-60%); opacity: 0.2; }
          20% { opacity: 0.9; }
          100% { transform: translateX(260%); opacity: 0.25; }
        }
        .mm-scan { animation: mmScan 900ms ease-in-out infinite; }

        /* ====== granted flash ====== */
        .mm-flash{ animation: mmFlash 240ms ease-out both; }
        @keyframes mmFlash{
          0%{ opacity: 0; }
          30%{ opacity: 0.35; }
          100%{ opacity: 0; }
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

        /* ====== stamper + filed (same as your previous, retained) ====== */
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
      `}</style>
    </main>
  );
}
