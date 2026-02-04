"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { setAuthed } from "@/lib/auth";
import { useAudio } from "@/components/AudioProvider";

type Step = "LOCK" | "OATH" | "GRANTED";
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

  // OATH
  const RULES: Rule[] = useMemo(
    () => [
      { id: "target", text: "I have declared an annual mileage target. Once sworn, this target is final." },
      { id: "entryfee", text: "I will contribute ₹1000 to the family pot. Payment is mandatory. Delay is not tolerated." },
      { id: "first", text: "The first member to reach 100% of their annual target will receive a ₹1000 leader bonus, funded equally by the remaining members." },
      { id: "clause85", text: "Any member who fails to reach 85% of their annual target by December 31st will pay an additional ₹1000 penalty into the family fund." },
      { id: "strava", text: "All runs must be logged on Strava. If it is not recorded, it does not exist." },
      { id: "noexcuses", text: "Conditions, injuries, devices, or circumstances do not alter the oath. Only completed distance is recognized." },
      { id: "sheetlaw", text: "The leaderboard is the final authority. Disputes end at the Sheet." },
      { id: "respect", text: "Disorder, manipulation, or disrespect will be met with penalties at the discretion of the family." },
      { id: "closing", text: "I accept this oath willingly. I submit to the rules of the Sheet. I enter the Mileage Mafia by choice, and remain by discipline." },
    ],
    []
  );

  const initialChecks = useMemo<Record<string, boolean>>(() => {
    return Object.fromEntries(RULES.map((r) => [r.id, false] as const));
  }, [RULES]);

  const [checks, setChecks] = useState<Record<string, boolean>>(initialChecks);
  const [sig, setSig] = useState("");

  useEffect(() => setChecks(initialChecks), [initialChecks]);

  const allChecked = RULES.every((r) => !!checks[r.id]);
  const signed = sig.trim().length >= 3;
  const canSwear = allChecked && signed;

  const goIn = useCallback(() => router.push("/leaderboard"), [router]);

  const toggleRule = useCallback((id: string) => {
    setChecks((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const resetBackToLock = useCallback(() => {
    setStep("LOCK");
    setPw("");
    setErr("");
    setChecks(initialChecks);
    setSig("");
  }, [initialChecks]);

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
        return;
      }

      setStep("OATH");
    },
    [pw, step]
  );

  const onSwear = useCallback(async () => {
    if (step !== "OATH") return;
    if (!canSwear) return;

    setErr("");

    // must start on user gesture
    await audio.play();

    setAuthed();
    setStep("GRANTED");
  }, [audio, canSwear, step]);

  // hotkeys
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (step === "GRANTED") {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault();
          goIn();
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
  }, [step, canSwear, goIn, onSwear]);

  /**
   * =========================
   * LOCK (video background)
   * =========================
   */
  if (step === "LOCK") {
    return (
      <main className="fixed inset-0 bg-black text-white overflow-hidden">
        {/* Video bg */}
        <div className="absolute inset-0">
          <video
            className="h-full w-full object-cover grayscale contrast-125 brightness-[0.55]"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            poster="/lock-run.jpg"
          >
            <source src="/lock-run.mp4" type="video/mp4" />
          </video>

          {/* Noir overlays */}
          <div className="pointer-events-none absolute inset-0">
            {/* vignette */}
            <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_50%_40%,rgba(0,0,0,0.35),rgba(0,0,0,0.92)_72%,rgba(0,0,0,0.98)_100%)]" />

            {/* subtle drift glow (keeps it alive without adding color) */}
            <div className="absolute inset-0 mm-drift opacity-[0.18]">
              <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_22%_25%,rgba(255,255,255,0.05),transparent_62%),radial-gradient(900px_circle_at_82%_18%,rgba(255,255,255,0.03),transparent_66%)]" />
            </div>

            {/* grain + scanlines (from your global.css classes) */}
            <div className="absolute inset-0 noir-noise opacity-[0.14] mix-blend-overlay" />
            <div className="absolute inset-0 noir-scanlines opacity-[0.08] mix-blend-overlay" />
          </div>
        </div>

        {/* Center title + hidden password input */}
        <div className="relative h-full w-full flex items-center justify-center">
          <form onSubmit={onSubmitPassword} className="w-full max-w-md px-8">
            <div className="text-center select-none">
              {/* ONLY this text */}
              <div className="text-[12px] font-semibold text-red-500">
                Mileage Mafia
              </div>

              {/* tiny dots only when typing */}
              <div className="mt-5 h-5 flex items-center justify-center">
                {pw.length > 0 ? (
                  <span className="text-white/70 text-xs tracking-[0.45em]">
                    {"•".repeat(Math.min(pw.length, 10))}
                  </span>
                ) : (
                  <span className="opacity-0 text-xs">.</span>
                )}
              </div>

              {/* keep error minimal too */}
              {err ? (
                <div className="mt-4 text-red-300 text-[11px] tracking-[0.25em] uppercase">
                  {err}
                </div>
              ) : null}
            </div>

            {/* INVISIBLE input: captures typing, no UI */}
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoFocus
              aria-label="Password"
              className="absolute -z-10 h-0 w-0 opacity-0 pointer-events-none"
            />
          </form>
        </div>
      </main>
    );
  }

  /**
   * =========================
   * OATH / GRANTED (your noir CRT screens)
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

      {/* granted overlay */}
      {step === "GRANTED" ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-white/18 mm-flash" />
          <button
            type="button"
            onClick={goIn}
            className="absolute inset-0"
            aria-label="Continue"
          />
          <div className="relative mm-shake">
            <div className="bg-black/70 backdrop-blur-xl ring-1 ring-white/10 rounded-3xl px-10 py-8 text-center mm-grant w-[min(560px,92vw)] shadow-[0_18px_70px_rgba(0,0,0,0.75)]">
              <div className="text-xs uppercase tracking-[0.35em] text-neutral-400 mb-3">
                Mileage Mafia
              </div>
              <div className="text-3xl md:text-4xl font-black tracking-tight mm-typewriter">
                WELCOME, SOLDIER
              </div>
              <div className="mt-4 text-neutral-400 text-sm">
                The oath is signed. The family sees you.
              </div>

              <div className="mt-8 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={goIn}
                  className={[
                    "px-6 py-3 rounded-full font-black bg-white text-black hover:opacity-90 transition",
                    `ring-1 ${ACCENT.ring}`,
                  ].join(" ")}
                >
                  Enter the Family →
                </button>
                <span className="text-neutral-500 text-xs">
                  (Click anywhere / press Enter)
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* oath */}
      {step === "OATH" ? (
        <div className="relative max-w-xl mx-auto px-6 py-20">
          <div className="relative rounded-[28px] overflow-hidden ring-1 ring-neutral-700/60 bg-neutral-950/55 backdrop-blur-xl shadow-[0_18px_70px_rgba(0,0,0,0.75)]">
            <div className="pointer-events-none absolute inset-0 opacity-[0.16] mix-blend-overlay noir-noise" />
            <div className="pointer-events-none absolute inset-0 opacity-[0.12] noir-scanlines mix-blend-overlay" />

            <div className="relative p-8 sm:p-10">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-[0.35em] text-neutral-400">
                    Case File • Mileage Mafia
                  </div>
                  <h2 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight">
                    Oath of Entry
                  </h2>
                  <p className="mt-3 text-neutral-400 text-sm leading-relaxed">
                    By proceeding, you swear to uphold every article below. This oath is
                    taken by choice, and enforced by discipline.
                  </p>
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
                        "group flex gap-4 rounded-2xl px-4 py-4 transition cursor-pointer",
                        "ring-1 ring-neutral-800 bg-neutral-950/35 hover:bg-white/[0.03]",
                        accepted ? `${ACCENT.bgSoft} ring-1 ${ACCENT.ringStrong}` : "",
                      ].join(" ")}
                    >
                      <span className="mt-[2px] inline-flex h-8 w-8 items-center justify-center rounded-lg ring-1 ring-neutral-700 bg-black/50">
                        <input
                          type="checkbox"
                          checked={accepted}
                          onChange={() => toggleRule(r.id)}
                          className="h-5 w-5 accent-red-500"
                        />
                      </span>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] uppercase tracking-[0.25em] text-neutral-500">
                            Article {String(idx + 1).padStart(2, "0")}
                          </span>
                          {accepted ? (
                            <span
                              className={[
                                "text-[11px] uppercase tracking-[0.22em]",
                                ACCENT.text,
                              ].join(" ")}
                            >
                              Accepted
                            </span>
                          ) : (
                            <span className="text-[11px] uppercase tracking-[0.22em] text-neutral-600">
                              Pending
                            </span>
                          )}
                        </div>

                        <div className="mt-1 text-neutral-200 leading-relaxed font-mono text-[13.5px]">
                          {r.text}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="mt-10 rounded-2xl ring-1 ring-neutral-800 bg-neutral-950/35 p-5">
                <div className="text-xs uppercase tracking-[0.3em] text-neutral-500">
                  Signature
                </div>
                <div className="mt-3">
                  <input
                    value={sig}
                    onChange={(e) => setSig(e.target.value)}
                    placeholder="Type full name"
                    className="w-full bg-transparent px-1 py-3 text-lg font-semibold tracking-wide outline-none border-b border-neutral-700 focus:border-red-400/60 transition"
                  />
                  <div className="mt-2 text-xs text-neutral-500">
                    {signed ? "✅ Oath signed." : "Type at least 3 characters to sign."}
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <button
                  type="button"
                  onClick={onSwear}
                  disabled={!canSwear}
                  className={[
                    "w-full rounded-2xl py-4 font-black tracking-[0.18em] uppercase transition shadow-[0_12px_46px_rgba(0,0,0,0.65)]",
                    canSwear
                      ? `bg-red-500 text-black hover:brightness-110 ring-1 ${ACCENT.ringStrong}`
                      : "bg-white text-black opacity-30 cursor-not-allowed",
                  ].join(" ")}
                >
                  Seal the Oath
                </button>

                <div className="mt-4 text-xs text-neutral-500">
                  By sealing, you accept judgment by the Sheet — and the Family.
                </div>

                {err ? <p className="mt-4 text-red-300 text-sm">{err}</p> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
