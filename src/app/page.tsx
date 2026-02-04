"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setAuthed } from "@/lib/auth";
import { useAudio } from "@/components/AudioProvider";

export default function LoginPage() {
  const router = useRouter();
  const audio = useAudio();

  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [granted, setGranted] = useState(false);

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

    // Check password via API
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

    // 🔑 THIS is the magic line (must happen on the same click)
  await audio.play();

  setAuthed();
  setGranted(true); // ACCESS GRANTED overlay
    // Start global music on submit gesture (so it persists across routes)
    
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white relative overflow-hidden">
      {/* Cinematic drift + fog + jitter + scanlines + grain */}
      <div className="pointer-events-none absolute inset-0">
        {/* moving gradient */}
        <div className="absolute inset-0 mm-drift">
          <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_15%_15%,rgba(255,255,255,0.08),transparent_55%),radial-gradient(900px_circle_at_85%_10%,rgba(244,63,94,0.14),transparent_55%),radial-gradient(900px_circle_at_55%_115%,rgba(245,158,11,0.12),transparent_55%)]" />
        </div>

        {/* fog layer */}
        <div
          className="absolute inset-0 opacity-[0.18] mm-drift"
          style={{ animationDuration: "28s", mixBlendMode: "screen" as any }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(700px_circle_at_30%_30%,rgba(255,255,255,0.08),transparent_60%),radial-gradient(800px_circle_at_80%_70%,rgba(255,255,255,0.06),transparent_62%)]" />
        </div>

        {/* jitter */}
        <div className="absolute inset-0 mm-jitter" />

        {/* vignette */}
        <div className="absolute inset-0 [background:radial-gradient(60%_60%_at_50%_35%,transparent_40%,rgba(0,0,0,0.92)_100%)]" />

        {/* subtle scanlines */}
        <div className="absolute inset-0 opacity-[0.10] mix-blend-overlay [background:repeating-linear-gradient(to_bottom,rgba(255,255,255,0.05),rgba(255,255,255,0.05)_1px,transparent_1px,transparent_4px)]" />

        {/* grain */}
        <div className="absolute inset-0 opacity-[0.10] mix-blend-overlay [background-image:url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22160%22%3E%3Cfilter id=%22n%22 x=%220%22 y=%220%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22160%22 height=%22160%22 filter=%22url(%23n)%22 opacity=%220.35%22/%3E%3C/svg%3E')]" />
      </div>

      {/* ACCESS GRANTED overlay (persistent until Continue) */}
      {granted ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          {/* flash frame */}
          <div className="absolute inset-0 bg-white/40 mm-flash" />

          {/* click-anywhere backdrop */}
          <button
            type="button"
            onClick={goIn}
            className="absolute inset-0 cursor-pointer"
            aria-label="Continue"
          />

          <div className="relative mm-shake">
            <div className="bg-black/60 backdrop-blur-xl ring-1 ring-white/10 rounded-3xl px-10 py-8 text-center mm-grant w-[min(520px,90vw)]">
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
                <span className="text-neutral-500 text-xs">(Click anywhere / press Enter)</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Content */}
      <div className="relative max-w-xl mx-auto px-6 py-20">
        {/* Top strip */}
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-white/10 ring-1 ring-white/10 flex items-center justify-center font-black mm-flicker opacity-90">
              MM
            </div>
            <div className="leading-tight">
              <p className="text-sm text-neutral-400">The Family</p>
              <h1 className="text-2xl font-black tracking-tight">Mileage Mafia</h1>
            </div>
          </div>

          <button
  type="button"
  onClick={() => audio.play()}
  disabled={granted}
  className="px-4 py-2 rounded-full bg-neutral-900/60 ring-1 ring-neutral-800 text-neutral-300 text-sm hover:bg-white/5 transition"
>
  {audio.playing ? "Playing" : "Play Music"}
</button>
        </div>

        {/* Card */}
        <div className="mt-14 bg-neutral-900/60 ring-1 ring-neutral-800 rounded-3xl p-8">
          <p className="text-xs uppercase tracking-wider text-neutral-500">Enter the code</p>
          <p className="mt-2 text-neutral-300">
            The sheet is the truth. No GPS excuses in court.
          </p>

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
                Don’t leak the code. The family remembers 😈
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
