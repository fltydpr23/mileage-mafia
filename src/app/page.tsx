"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { setAuthed } from "@/lib/auth";
import { useAudio } from "@/components/AudioProvider";

export default function LoginPage() {
  const router = useRouter();
  const audio = useAudio();

  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [granted, setGranted] = useState(false);

  const houseRule = useMemo(
    () => "The mafia awaits.",
    []
  );

  function goIn() {
    router.push("/leaderboard");
  }

  // Hotkeys when overlay is up
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!granted) return;
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        goIn();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [granted]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (granted) return;

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });

    const data = await res.json().catch(() => ({ ok: false }));

    if (!data.ok) {
      setErr("Wrong code. Try again.");
      return;
    }

    // must happen on same user gesture
    await audio.play();

    setAuthed();
    setGranted(true);
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white relative overflow-hidden">
      {/* ===== Noir CRT Background (subtle movement, not bright) ===== */}
      <div className="pointer-events-none absolute inset-0 noir-crt noir-breath">
        {/* deep base */}
        <div className="absolute inset-0 bg-[#050505]" />

        {/* subtle blooms (from global.css .noir-blooms) */}
        <div className="absolute inset-0 noir-blooms opacity-[0.95]" />

        {/* grain + scanlines */}
        <div className="absolute inset-0 noir-noise opacity-[0.16] mix-blend-overlay" />
        <div className="absolute inset-0 noir-scanlines opacity-[0.08] mix-blend-overlay" />

        {/* very subtle shimmer band */}
        <div className="absolute inset-0 noir-shimmer opacity-[0.16]" />

        {/* micro jitter (tiny) */}
        <div className="absolute inset-0 mm-jitter opacity-[0.18]" />

        {/* vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_50%_35%,transparent_38%,rgba(0,0,0,0.95)_82%)]" />
      </div>

      {/* ACCESS GRANTED overlay (persistent until Continue) */}
      {granted ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          {/* flash frame (dim) */}
          <div className="absolute inset-0 bg-white/20 mm-flash" />

          {/* click-anywhere backdrop */}
          <button
            type="button"
            onClick={goIn}
            className="absolute inset-0 cursor-pointer"
            aria-label="Continue"
          />

          <div className="relative mm-shake">
            <div className="bg-black/65 backdrop-blur-xl ring-1 ring-white/10 rounded-3xl px-10 py-8 text-center mm-grant w-[min(520px,90vw)]">
              <div className="text-xs uppercase tracking-[0.35em] text-neutral-400 mb-3">
                Mileage Mafia
              </div>

              <div className="text-3xl md:text-4xl font-black tracking-tight mm-typewriter">
                ACCESS GRANTED
              </div>

              <div className="mt-4 text-neutral-400 text-sm">
                Welcome to the family.
              </div>

              <div className="mt-8 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={goIn}
                  className="px-6 py-3 rounded-full bg-white text-black font-bold hover:opacity-90 transition"
                >
                  Continue →
                </button>
                <span className="text-neutral-500 text-xs">
                  (Click anywhere / press Enter)
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Content */}
      <div className="relative max-w-xl mx-auto px-6 py-20">
        {/* Top strip */}
        <div className="flex items-center justify-between gap-4">
          <div className="inline-flex items-center gap-3 min-w-0">
            <div className="h-12 w-12 rounded-2xl bg-white/10 ring-1 ring-white/10 flex items-center justify-center font-black mm-flicker opacity-90 shrink-0">
              MM
            </div>
            <div className="leading-tight min-w-0">
              <p className="text-sm text-neutral-400">Season 2</p>
              <h1 className="text-2xl font-black tracking-tight truncate">
                Mileage Mafia
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => audio.play()}
            disabled={granted}
            className="shrink-0 px-4 py-2 rounded-full bg-neutral-900/60 ring-1 ring-neutral-800 text-neutral-300 text-sm hover:bg-white/5 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {audio.playing ? "Playing" : "Play Music"}
          </button>
        </div>

        {/* Card */}
        <div className="mt-14 bg-neutral-900/55 ring-1 ring-neutral-800 rounded-3xl p-8 backdrop-blur-xl">
          <p className="text-xs uppercase tracking-wider text-neutral-500">
            Enter the code
          </p>

          <p className="mt-2 text-neutral-300">{houseRule}</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="••••••••"
              disabled={granted}
              className="w-full px-5 py-4 rounded-2xl bg-neutral-950/60 ring-1 ring-neutral-800 focus:ring-white/30 outline-none text-lg tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
            />

            {err ? (
              <p className="text-rose-300 text-sm">{err}</p>
            ) : (
              <p className="text-neutral-500 text-sm">
                
              </p>
            )}

            <button
              type="submit"
              disabled={granted}
              className="w-full py-4 rounded-2xl bg-white text-black font-bold hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Enter →
            </button>
          </form>

          <div className="mt-6 text-xs text-neutral-500">
            By entering you accept the rules (and the ₹1000 pot).
          </div>
        </div>
      </div>
    </main>
  );
}
