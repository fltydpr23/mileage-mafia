import Link from "next/link";
import { getSheet } from "@/lib/sheets";
import NowPlaying from "@/components/NowPlaying";
import PotChip from "@/components/PotChip";

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
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase();
}

/**
 * Level theme tokens:
 * - pill: the label badge
 * - tint: used for avatar chips / light level wash (must work with `ring-1 ${tint}`)
 * - bar: progress bar fill
 *
 * NOTE: Reuse these tokens on runner pages for cards + progress bars.
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
    pill: "bg-slate-700 text-slate-50 ring-1 ring-slate-400/25",
    tint: "bg-slate-800/20 ring-slate-400/20",
    bar: "bg-slate-500",
    desc: "250–499 km",
  },
  {
    minKm: 0,
    name: "Associate",
    pill: "bg-emerald-950 text-emerald-50 ring-1 ring-emerald-700/30",
    tint: "bg-emerald-950/18 ring-emerald-700/25",
    bar: "bg-emerald-700",
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

  // ===== POT LOGIC =====
  const oathPot = totalRunners * 1000;

  // Penalties: Kumaran + Rishi paid ₹500 each
  const PENALTIES = [
    { name: "Kumaran", amount: 500, reason: "Bribery" },
    { name: "Rishi", amount: 500, reason: "Bribery" },
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

  const APP_HEADER_H = 72; // px
  const LIST_HEADER_H = 56; // px

  return (
    <main className="min-h-screen text-white bg-neutral-950">
      {/* App background glow */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(900px_circle_at_20%_-10%,rgba(255,255,255,0.08),transparent_60%),radial-gradient(900px_circle_at_90%_0%,rgba(16,185,129,0.10),transparent_55%),radial-gradient(900px_circle_at_60%_110%,rgba(244,63,94,0.10),transparent_55%)]" />

      {/* Top Nav */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-neutral-950/70 border-b border-neutral-900">
        <div
          className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3"
          style={{ minHeight: APP_HEADER_H }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-2xl bg-white/10 ring-1 ring-white/10 flex items-center justify-center font-black shrink-0">
              MM
            </div>
            <div className="leading-tight min-w-0">
              <p className="font-black tracking-tight text-base sm:text-lg truncate">
                Mileage Mafia
              </p>
              <p className="text-neutral-400 text-xs">Season 2</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/challenges"
              className="px-3 sm:px-4 py-2 rounded-full bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition text-xs sm:text-sm font-semibold"
            >
              Challenges
            </Link>

            <Chip label="Runners" value={String(totalRunners)} />
            <PotChip total={totalPot} oathPot={oathPot} penaltyFund={penaltyFund} />
          </div>
          <div className="hidden sm:block text-neutral-500 text-xs tabular-nums ml-2">
  Last Update: 1st Feb • 22:14 IST
</div>
        </div>
      </header>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* HERO ROW (premium + consistent sizing) */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-start">
          {/* Main hero */}
          <div className="rounded-3xl bg-neutral-900/70 ring-1 ring-neutral-800 p-6 sm:p-8 md:p-8 shadow-[0_18px_70px_rgba(0,0,0,0.55)]">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
              <div className="space-y-2 min-w-0">
                <p className="text-neutral-400 text-xs uppercase tracking-wider">
                  Current leader
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-tight truncate">
                    {leader ? leader.name : "—"}
                  </h1>

                  {leaderLvl ? (
                    <span
                      className={`px-3 py-1 rounded-full text-[11px] font-extrabold ${leaderLvl.pill}`}
                    >
                      {leaderLvl.name}
                    </span>
                  ) : null}

                  {/* Leader bonus pill (for #1 runner) */}
                  {leader ? (
                    <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-white/5 ring-1 ring-white/10 text-neutral-200">
                      +₹ 1,000
                    </span>
                  ) : null}
                </div>

                {leader ? (
                  <p className="text-neutral-400">
                    <span className="text-white font-semibold tabular-nums">
                      {Math.round(leader.yearlyKm).toLocaleString("en-IN")}
                    </span>{" "}
                    km •{" "}
                    <span className="text-white font-semibold tabular-nums">
                      {leader.completion.toFixed(1)}%
                    </span>
                  </p>
                ) : null}
              </div>

              {leader ? (
                <Link
                  href={`/runners/${slugifyName(leader.name)}`}
                  className="shrink-0 px-5 py-3 rounded-full bg-white text-black font-semibold hover:opacity-90 transition w-full sm:w-auto text-center"
                >
                  Open runner →
                </Link>
              ) : null}
            </div>

            {/* Group completion bar (kept tight) */}
            <div className="mt-6">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-neutral-300 font-semibold">
                    Group completion
                  </p>
                  <p className="text-neutral-500 text-xs mt-1">
                    Average completion across the family
                  </p>
                </div>

                <p className="text-neutral-400 text-sm">
                  Avg{" "}
                  <span className="text-white font-semibold tabular-nums">
                    {avgCompletion.toFixed(1)}%
                  </span>
                </p>
              </div>

              <div className="mt-3 h-3 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white"
                  style={{
                    width: `${Math.min(Math.max(avgCompletion, 0), 100)}%`,
                  }}
                />
              </div>

              {/* 3 metrics row + 1 standout house rule block */}
              <div className="mt-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-neutral-950/50 ring-1 ring-neutral-800 px-5 py-4">
                    <p className="text-neutral-500 text-xs uppercase tracking-wider">
                      Total Target KM
                    </p>
                    <p className="text-white font-black text-lg mt-2 tabular-nums">
                      {Math.round(totalTargetKm).toLocaleString("en-IN")} km
                    </p>
                  </div>

                  <div className="rounded-2xl bg-neutral-950/50 ring-1 ring-neutral-800 px-5 py-4">
                    <p className="text-neutral-500 text-xs uppercase tracking-wider">
                      Total KM Logged
                    </p>
                    <p className="text-white font-black text-lg mt-2 tabular-nums">
                      {Math.round(totalKm).toLocaleString("en-IN")} km
                    </p>
                  </div>

                  <div className="rounded-2xl bg-neutral-950/50 ring-1 ring-neutral-800 px-5 py-4">
                    <p className="text-neutral-500 text-xs uppercase tracking-wider">
                      Avg Group Completion
                    </p>
                    <p className="text-white font-black text-lg mt-2 tabular-nums">
                      {avgCompletion.toFixed(1)}%
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-3xl bg-gradient-to-br from-red-500/12 via-red-500/6 to-transparent ring-1 ring-red-500/30 px-6 py-6 shadow-[0_0_44px_rgba(239,68,68,0.16)] relative overflow-hidden">
                  <div className="pointer-events-none absolute inset-0 opacity-[0.25] bg-[radial-gradient(700px_circle_at_18%_30%,rgba(239,68,68,0.25),transparent_60%)]" />
                  <div className="relative">
                    <p className="text-neutral-500 text-xs uppercase tracking-[0.3em]">
                      House Rule
                    </p>
                    <p className="mt-3 text-xl sm:text-2xl font-black tracking-tight text-red-200">
                      Respect the Oath.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Side column */}
          <div className="space-y-4 sm:space-y-6">
            {/* Hierarchy */}
            <div className="rounded-3xl bg-neutral-900/70 ring-1 ring-neutral-800 p-6 sm:p-8 md:p-8 shadow-[0_18px_70px_rgba(0,0,0,0.45)]">
              <p className="text-neutral-400 text-xs uppercase tracking-wider">
                Hierarchy
              </p>
              <h2 className="text-xl font-bold mt-2">Family levels</h2>
              <p className="text-neutral-500 text-sm mt-2">
                Levels are based on{" "}
                <span className="text-neutral-300">yearly KM</span>.
              </p>

              <div className="mt-6 space-y-4">
                {MAFIA_LEVELS.map((lvl) => {
                  const count = rows.filter(
                    (r) => getMafiaLevel(r.yearlyKm).name === lvl.name
                  ).length;

                  return (
                    <div
                      key={lvl.name}
                      className="flex items-start justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-3 py-1 rounded-full text-[11px] font-extrabold ${lvl.pill}`}
                          >
                            {lvl.name}
                          </span>
                          <span className="text-neutral-500 text-xs">
                            {lvl.desc}
                          </span>
                        </div>
                      </div>

                      <span className="text-white font-semibold tabular-nums">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>

              <p className="mt-6 text-neutral-600 text-xs">
                Pro tip: consistency beats hero weeks.
              </p>
            </div>

            {/* Contracts */}
            <Link
              href="/contracts"
              className="group block rounded-3xl bg-neutral-900/70 ring-1 ring-neutral-800 p-6 sm:p-8 md:p-8 hover:bg-white/[0.04] transition shadow-[0_18px_70px_rgba(0,0,0,0.55)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-neutral-400 text-xs uppercase tracking-wider">
                    Paper
                  </div>
                  <div className="mt-2 flex items-center gap-2 min-w-0">
                    <div className="text-xl font-black tracking-tight truncate">
                      Contracts
                    </div>
                    <span className="shrink-0 px-3 py-1 rounded-full text-[11px] font-extrabold bg-red-500/10 text-red-200 ring-1 ring-red-500/20">
                      New
                    </span>
                  </div>
                  <p className="mt-2 text-neutral-500 text-sm leading-relaxed">
                    Weekly/monthly clauses. Accept them. Every signature hits
                    the Paper Trail.
                  </p>
                </div>

                <div className="shrink-0 inline-flex items-center gap-2 text-sm font-semibold text-neutral-200 mt-1">
                  Open
                  <span className="transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </div>
              </div>
            </Link>
          </div>
        </section>

        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-neutral-400 text-xs uppercase tracking-wider">
              Leaderboard
            </p>
            <h3 className="text-xl sm:text-2xl font-bold mt-1">Runners</h3>
          </div>
          <p className="text-neutral-500 text-sm text-right">
            Sorted by{" "}
            <span className="text-neutral-300">
              {sorted.some((r) => r.rank) ? "rank" : "completion"}
            </span>
          </p>
        </div>

        {/* List */}
        <section className="rounded-3xl bg-neutral-900/70 ring-1 ring-neutral-800 overflow-hidden">
          <div
            className="hidden sm:block sticky z-30 bg-neutral-950/90 backdrop-blur-xl border-b border-neutral-800"
            style={{ top: APP_HEADER_H, height: LIST_HEADER_H }}
          >
            <div className="grid grid-cols-12 gap-4 px-6 md:px-8 h-full items-center text-xs uppercase tracking-wider text-neutral-500">
              <div className="col-span-1">#</div>
              <div className="col-span-6">Runner</div>
              <div className="col-span-2 text-right">KM</div>
              <div className="col-span-2 text-right">%</div>
              <div className="col-span-1 text-right" />
            </div>
          </div>

          <div className="divide-y divide-neutral-800 sm:pt-[56px]">
            {sorted.map((r, idx) => {
              const lvl = getMafiaLevel(r.yearlyKm);
              const pct = Math.min(Math.max(r.completion, 0), 100);
              const rankShown = r.rank ? r.rank : idx + 1;

              const isLeader = rankShown === 1;
              const isPenalized = PENALTIES.some(
                (p) => p.name.toLowerCase() === r.name.toLowerCase()
              );

              return (
                <Link
                  key={r.name}
                  href={`/runners/${slugifyName(r.name)}`}
                  className="block"
                >
                  {/* MOBILE */}
                  <div className="sm:hidden px-4 py-5 hover:bg-white/5 transition">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`h-11 w-11 rounded-2xl ring-1 ${lvl.tint} flex items-center justify-center font-black shrink-0`}
                        >
                          {initials(r.name)}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="text-neutral-400 font-semibold tabular-nums">
                              #{rankShown}
                            </div>
                            <div className="font-bold text-base truncate">
                              {r.name}
                            </div>
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${lvl.pill}`}
                            >
                              {lvl.name}
                            </span>

                            {/* Leader reward pill */}
                            {isLeader ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-white/5 ring-1 ring-white/10 text-neutral-200">
                                +₹ 1,000
                              </span>
                            ) : null}

                            {/* Penalized pill */}
                            {isPenalized ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-red-500/10 text-red-200 ring-1 ring-red-500/20">
                                -₹ 500
                              </span>
                            ) : null}

                            <div className="text-neutral-400 text-xs tabular-nums">
                              {Math.round(r.yearlyKm).toLocaleString("en-IN")}{" "}
                              km{" • "}
                              {pct.toFixed(1)}%
                            </div>
                          </div>

                          <div className="mt-3 h-2 bg-neutral-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${lvl.bar}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>

                          <div className="mt-2 text-neutral-500 text-xs">
                            Target {Math.round(r.annualTarget)} km • Weekly{" "}
                            {Math.round(r.weeklyTarget)} km
                          </div>
                        </div>
                      </div>

                      <div className="text-neutral-500 text-2xl leading-none">
                        ›
                      </div>
                    </div>
                  </div>

                  {/* DESKTOP */}
                  <div className="hidden sm:block px-6 md:px-8 py-6 hover:bg-white/5 transition">
                    <div className="grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-1 text-neutral-400 font-semibold tabular-nums">
                        {rankShown}
                      </div>

                      <div className="col-span-6 min-w-0">
                        <div className="flex items-center gap-4 min-w-0">
                          <div
                            className={`h-11 w-11 rounded-2xl ring-1 ${lvl.tint} flex items-center justify-center font-black`}
                          >
                            {initials(r.name)}
                          </div>

                          <div className="min-w-0 w-full">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0 flex items-center gap-2">
                                <p className="font-bold text-lg truncate">
                                  {r.name}
                                </p>

                                {/* Leader reward pill */}
                                {isLeader ? (
                                  <span className="shrink-0 px-3 py-1 rounded-full text-[11px] font-extrabold bg-white/5 ring-1 ring-white/10 text-neutral-200">
                                    +₹ 1,000
                                  </span>
                                ) : null}

                                {/* Penalized pill */}
                                {isPenalized ? (
                                  <span className="shrink-0 px-3 py-1 rounded-full text-[11px] font-extrabold bg-red-500/10 text-red-200 ring-1 ring-red-500/20">
                                    -₹ 500
                                  </span>
                                ) : null}
                              </div>

                              <span
                                className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-extrabold ${lvl.pill}`}
                              >
                                {lvl.name}
                              </span>
                            </div>

                            <p className="text-neutral-500 text-sm mt-1">
                              Target {Math.round(r.annualTarget)} km • Weekly{" "}
                              {Math.round(r.weeklyTarget)} km
                            </p>

                            <div className="mt-3 h-2 bg-neutral-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${lvl.bar}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="col-span-2 text-right">
                        <p className="text-white font-semibold tabular-nums text-lg">
                          {Math.round(r.yearlyKm).toLocaleString("en-IN")}
                        </p>
                        <p className="text-neutral-500 text-xs">km</p>
                      </div>

                      <div className="col-span-2 text-right">
                        <p className="text-white font-semibold tabular-nums text-lg">
                          {pct.toFixed(1)}
                        </p>
                        <p className="text-neutral-500 text-xs">%</p>
                      </div>

                      <div className="col-span-1 text-right text-neutral-500">
                        <span className="text-2xl leading-none">›</span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <p className="text-neutral-600 text-sm">
          Next: weekly movers (▲▼) + streaks once Strava sync lands.
        </p>
      </div>

      <NowPlaying />
    </main>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 sm:px-4 py-2 rounded-full bg-neutral-900/70 ring-1 ring-neutral-800 text-neutral-300 text-xs sm:text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className="text-white font-semibold ml-2 tabular-nums">
        {value}
      </span>
    </div>
  );
}
