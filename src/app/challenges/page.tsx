import Link from "next/link";
import { getSheet } from "@/lib/sheets";
import PotChip from "@/components/PotChip";

export const dynamic = "force-dynamic";

/* =========================
   Utils
========================= */

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

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function fmtINR(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

/* =========================
   Types
========================= */

type RunnerRow = {
  name: string;
  yearlyKm: number;
  completion: number;
  rank: number;
  weeklyTarget: number;
  annualTarget: number;
};

type Challenge = {
  id: string;
  title: string;
  subtitle: string;
  thresholdKm: number;
  reward: number;
};

/* =========================
   Winner Logic
========================= */

/**
 * Deterministic "first" winner.
 * Until we have timestamps, this is the fairest approach:
 *
 * 1. Must have crossed threshold
 * 2. Highest yearly KM wins
 * 3. Higher completion %
 * 4. Lower rank
 * 5. Stable by name
 */
function resolveWinner(
  runners: RunnerRow[],
  thresholdKm: number
) {
  const eligible = runners.filter((r) => r.yearlyKm >= thresholdKm);

  if (eligible.length === 0) {
    return { claimed: false as const, winner: null as RunnerRow | null };
  }

  const winner = [...eligible].sort((a, b) => {
    if (b.yearlyKm !== a.yearlyKm) return b.yearlyKm - a.yearlyKm;
    if (b.completion !== a.completion) return b.completion - a.completion;

    const ar = a.rank || 9999;
    const br = b.rank || 9999;
    if (ar !== br) return ar - br;

    return a.name.localeCompare(b.name);
  })[0];

  return { claimed: true as const, winner };
}

/* =========================
   Page
========================= */

export default async function ChallengesPage() {
  const raw = await getSheet("API_Leaderboard!A2:F200");

  const runners: RunnerRow[] = (raw ?? [])
    .map((r) => ({
      name: String(r?.[0] ?? "").trim(),
      yearlyKm: toNum(r?.[1]),
      completion: toPercent(r?.[2]),
      rank: toNum(r?.[3]),
      weeklyTarget: toNum(r?.[4]),
      annualTarget: toNum(r?.[5]),
    }))
    .filter((r) => r.name.length > 0);

  const totalRunners = runners.length;

  /* =========================
     Pot Logic
  ========================= */

  const oathPot = totalRunners * 1000;

  // Penalties: Kumaran + Rishi (₹500 each)
  const initialPenaltyFund = 1000;

  /* =========================
     Challenges (ordered!)
     Order matters for payout sequencing
  ========================= */

  const challenges: Challenge[] = [
    {
      id: "first-soldier",
      title: "First Soldier",
      subtitle: "First to reach 250 km",
      thresholdKm: 250,
      reward: 400,
    },
    {
      id: "first-area-don",
      title: "First Area Don",
      subtitle: "First to reach 500 km",
      thresholdKm: 500,
      reward: 600,
    },
  ];

  /* =========================
     Resolve + Deduct Penalty
  ========================= */

  let penaltyRemaining = initialPenaltyFund;

  const resolved = challenges.map((c) => {
    const result = resolveWinner(runners, c.thresholdKm);

    if (result.claimed && penaltyRemaining >= c.reward) {
      penaltyRemaining -= c.reward;
      return { ...c, ...result };
    }

    return { ...c, claimed: false, winner: null };
  });

  const paidOut = initialPenaltyFund - penaltyRemaining;
  const totalPot = oathPot + penaltyRemaining;

  const runnersByKm = [...runners].sort((a, b) => b.yearlyKm - a.yearlyKm);

  /* =========================
     Render
  ========================= */

  return (
    <main className="min-h-screen text-white bg-neutral-950">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(900px_circle_at_20%_-10%,rgba(255,255,255,0.08),transparent_60%),radial-gradient(900px_circle_at_90%_0%,rgba(16,185,129,0.10),transparent_55%),radial-gradient(900px_circle_at_60%_110%,rgba(244,63,94,0.10),transparent_55%)]" />

      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-neutral-950/70 border-b border-neutral-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-neutral-400 text-xs uppercase tracking-wider">
              Mileage Mafia
            </p>
            <h1 className="font-black tracking-tight text-xl sm:text-2xl">
              Open Bounties
            </h1>
            <p className="text-neutral-500 text-sm mt-1">
              Automatic. No claims. If you cross it — it's yours.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/leaderboard"
              className="px-4 py-2 rounded-full bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition text-sm font-semibold"
            >
              ← Ledger
            </Link>

            <PotChip
              total={totalPot}
              oathPot={oathPot}
              penaltyFund={penaltyRemaining}
            />
          </div>
        </div>
      </header>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Penalty Status */}
        <section className="rounded-3xl bg-neutral-900/70 ring-1 ring-neutral-800 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-neutral-400 text-xs uppercase tracking-wider">
                Penalty Pool
              </p>
              <p className="text-lg sm:text-xl font-black mt-1">
                {fmtINR(penaltyRemaining)} remaining
              </p>
              <p className="text-neutral-500 text-sm mt-2">
                Funded by Kumaran + Rishi (₹500 each).
              </p>
            </div>

            <div className="rounded-2xl bg-neutral-950/40 ring-1 ring-neutral-800 px-5 py-4">
              <p className="text-neutral-500 text-xs uppercase tracking-wider">
                Paid Out
              </p>
              <p className="text-white font-black text-lg mt-1 tabular-nums">
                {fmtINR(paidOut)}
              </p>
            </div>
          </div>
        </section>

        {/* Challenges */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {resolved.map((c) => (
            <div
              key={c.id}
              className="rounded-3xl bg-neutral-900/70 ring-1 ring-neutral-800 p-6 sm:p-8"
            >
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black">{c.title}</h2>

                <span
                  className={`px-3 py-1 rounded-full text-[11px] font-extrabold ring-1 uppercase tracking-[0.22em] ${
                    c.claimed
                      ? "bg-emerald-500/10 text-emerald-200 ring-emerald-500/20"
                      : "bg-red-500/10 text-red-200 ring-red-500/20"
                  }`}
                >
                  {c.claimed ? "CLAIMED" : "OPEN"}
                </span>

                <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-white/5 ring-1 ring-white/10">
                  +{fmtINR(c.reward)}
                </span>
              </div>

              <p className="text-neutral-500 text-sm mt-2">{c.subtitle}</p>

              {c.claimed && c.winner ? (
                <div className="mt-6">
                  <p className="text-neutral-400 text-xs uppercase tracking-wider">
                    Winner
                  </p>
                  <Link
                    href={`/runners/${slugifyName(c.winner.name)}`}
                    className="text-lg font-black hover:opacity-90"
                  >
                    {c.winner.name}
                  </Link>
                </div>
              ) : (
                <div className="mt-6 space-y-3">
                  {runnersByKm.slice(0, 5).map((r) => {
                    const pct = clamp(
                      (r.yearlyKm / c.thresholdKm) * 100,
                      0,
                      100
                    );

                    return (
                      <div key={`${c.id}-${r.name}`}>
                        <div className="flex justify-between text-sm">
                          <span>{r.name}</span>
                          <span className="tabular-nums text-neutral-400">
                            {r.yearlyKm} / {c.thresholdKm}
                          </span>
                        </div>

                        <div className="mt-2 h-2 bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-white"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

