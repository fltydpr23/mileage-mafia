import Link from "next/link";
import { getSheet } from "@/lib/sheets";
import PotChip from "@/components/PotChip";
import LeaderboardRunnersClient from "@/components/LeaderboardRunnersClient";
import F1LeaderboardView from "@/components/F1LeaderboardView";

export const dynamic = "force-dynamic";

function toNum(v: any) {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function toPercent(v: any) {
  const s = String(v ?? "").trim();
  const n = parseFloat(s.replace("%", "").trim());
  return Number.isFinite(n) ? n : 0;
}
function slugifyName(name: string) {
  return encodeURIComponent(name.trim());
}
function fmtINR(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

/**
 * Level theme tokens
 */
export const MAFIA_LEVELS = [
  {
    minKm: 1800,
    name: "Godfather",
    pill: "bg-red-900 text-red-50 ring-1 ring-red-700/40",
    tint: "bg-red-900/15 ring-red-700/35",
    bar: "bg-red-800",
    desc: "1800+ km",
  },
  {
    minKm: 1000,
    name: "Underboss",
    pill: "bg-rose-950 text-rose-50 ring-1 ring-rose-700/35",
    tint: "bg-rose-950/15 ring-rose-700/30",
    bar: "bg-rose-800",
    desc: "1000–1799 km",
  },
  {
    minKm: 500,
    name: "Area Don",
    pill: "bg-amber-900 text-amber-50 ring-1 ring-amber-700/35",
    tint: "bg-amber-900/15 ring-amber-700/30",
    bar: "bg-amber-700",
    desc: "500–999 km",
  },
  {
    minKm: 250,
    name: "Soldier",
    pill: "bg-emerald-950 text-emerald-50 ring-1 ring-emerald-700/30",
    tint: "bg-emerald-950/18 ring-emerald-700/25",
    bar: "bg-emerald-700",
    desc: "250–499 km",
  },
  {
    minKm: 0,
    name: "Associate",
    pill: "bg-neutral-700 text-neutral-100 ring-1 ring-neutral-500/30",
    tint: "bg-neutral-800/40 ring-neutral-500/25",
    bar: "bg-neutral-500",
    desc: "0–249 km",
  },
] as const;

export function getMafiaLevel(km: number) {
  return (
    MAFIA_LEVELS.find((l) => km >= l.minKm) ??
    MAFIA_LEVELS[MAFIA_LEVELS.length - 1]
  );
}

export default async function LeaderboardPage() {
  const raw = await getSheet("API_Leaderboard!A2:F200");

  const rows = (raw ?? [])
    .map((r) => ({
      name: String(r?.[0] ?? "").trim(),
      yearlyKm: toNum(r?.[1]),
      completion: toPercent(r?.[2]),
      rank: toNum(r?.[3]),
      weeklyTarget: toNum(r?.[4]),
      annualTarget: toNum(r?.[5]),
    }))
    .filter((r) => r.name.length > 0);

  const sorted = [...rows].sort((a, b) => {
    if (a.rank && b.rank) return a.rank - b.rank;
    return b.completion - a.completion;
  });

  const totalRunners = rows.length;

  // ===== POT =====
  const oathPot = totalRunners * 1000;

  const PENALTIES = [
    { name: "Kumar", amount: 500, reason: "Bribery", date: "2 Feb 2026" },
    { name: "Rishi", amount: 500, reason: "Bribery", date: "2 Feb 2026" },
  ] as const;

  const penaltyFund = PENALTIES.reduce((s, p) => s + p.amount, 0);
  const totalPot = oathPot + penaltyFund;

  // ===== STATS =====
  const totalKm = rows.reduce((s, r) => s + r.yearlyKm, 0);
  const totalTargetKm = rows.reduce((s, r) => s + r.annualTarget, 0);
  const avgCompletion = totalRunners
    ? rows.reduce((s, r) => s + r.completion, 0) / totalRunners
    : 0;

  const leader = sorted[0];
  const leaderLvl = leader ? getMafiaLevel(leader.yearlyKm) : null;

  const LAST_UPDATED = "16 Feb • 10:33 IST";

  const APP_HEADER_H = 72; // px
  const LIST_HEADER_H = 56; // px

  const sortLabel = sorted.some((r) => r.rank) ? "rank" : "completion";

  return (
    <main className="min-h-screen text-white bg-neutral-950">
      {/* App background glow */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(900px_circle_at_20%_-10%,rgba(255,255,255,0.08),transparent_60%),radial-gradient(900px_circle_at_90%_0%,rgba(16,185,129,0.10),transparent_55%),radial-gradient(900px_circle_at_60%_110%,rgba(244,63,94,0.10),transparent_55%)]" />

      {/* Top Nav - Broadcast HUD */}
      <header className="absolute top-0 w-full z-50 bg-black/40 border-b border-red-600/20 backdrop-blur-xl">
        <div className="w-full px-4 sm:px-6 py-2">

          {/* Top minimal status bar */}
          <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-2">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                <span className="text-[9px] font-black uppercase tracking-widest text-red-400">Live Broadcast</span>
              </div>
              <span className="text-[9px] font-mono text-neutral-500 tracking-wider">SECURE CONNECTION ESTABLISHED</span>
            </div>
            <div className="text-[9px] font-mono text-cyan-500/70 tracking-wider hidden sm:block">
              SYS_TIME: {LAST_UPDATED}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-neutral-900 border border-neutral-800 flex items-center justify-center relative overflow-hidden shrink-0">
                <div className="absolute inset-0 bg-red-500/5 mix-blend-overlay" />
                <span className="font-black text-sm text-neutral-300 relative z-10">MM</span>
                <div className="absolute bottom-0 w-full h-[2px] bg-red-600" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight uppercase leading-none">Global Telemetry Stream</h1>
                <p className="text-[10px] font-bold tracking-[0.2em] text-cyan-400 uppercase mt-1">Mileage Mafia // Season 02</p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Link
                href="/races"
                className="races-chip px-4 py-2 bg-neutral-900/50 border-r-2 border-r-cyan-500 text-[10px] font-black tracking-[0.2em] uppercase transition-colors hover:bg-neutral-800"
              >
                Race Calendar →
              </Link>

              <PotChip
                total={totalPot}
                oathPot={oathPot}
                penaltyFund={penaltyFund}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="absolute inset-0 z-10 pointer-events-none">
        <F1LeaderboardView
          runners={sorted}
          globalStats={{
            totalRunners: sorted.length,
            totalKm,
            totalTargetKm
          }}
        />
      </div>

      {/* ✅ CSS MUST be inside JSX return */}
      <style>{`
        .races-chip {
          position: relative;
          border: 1px solid rgba(16,185,129,0.28);
          background: rgba(16,185,129,0.10);
          color: rgba(167,243,208,0.95);
          box-shadow:
            0 0 0 1px rgba(16,185,129,0.12),
            0 0 0 rgba(16,185,129,0.0);
          animation: racesPulse 2.6s ease-in-out infinite;
          transform: translateZ(0);
          will-change: box-shadow;
        }

        .races-chip:hover {
          background: rgba(16,185,129,0.16);
        }

        .races-chip__sheen {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(
            110deg,
            transparent 0%,
            rgba(255,255,255,0.08) 35%,
            transparent 70%
          );
          transform: translateX(-120%);
          animation: sheenSweep 3.4s ease-in-out infinite;
          opacity: 0.7;
        }

        @keyframes sheenSweep {
          0%, 55% { transform: translateX(-120%); }
          85% { transform: translateX(120%); }
          100% { transform: translateX(120%); }
        }

        @keyframes racesPulse {
          0% {
            box-shadow:
              0 0 0 1px rgba(16,185,129,0.12),
              0 0 0 rgba(16,185,129,0.0);
          }
          50% {
            box-shadow:
              0 0 0 1px rgba(16,185,129,0.30),
              0 0 26px rgba(16,185,129,0.40);
          }
          100% {
            box-shadow:
              0 0 0 1px rgba(16,185,129,0.12),
              0 0 0 rgba(16,185,129,0.0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .races-chip,
          .races-chip__sheen {
            animation: none !important;
          }
        }
      `}</style>
    </main>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 sm:px-4 py-2 rounded-full bg-neutral-900/70 ring-1 ring-neutral-800 text-neutral-300 text-xs sm:text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className="text-white font-semibold ml-2 tabular-nums">{value}</span>
    </div>
  );
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-neutral-950/40 ring-1 ring-neutral-800 px-4 sm:px-5 py-3 sm:py-4">
      <p className="text-neutral-500 text-xs uppercase tracking-wider">
        {label}
      </p>
      <p className="text-white font-bold mt-2">{value}</p>
    </div>
  );
}
