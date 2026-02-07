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
  // Gunmetal Grey (clean + minimal)
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

  // Penalties: Kumaran + Rishi paid ₹500 each (Bribery on 2 Feb 2026)
  const PENALTIES = [
    { name: "Kumaran", amount: 500, reason: "Bribery", date: "2 Feb 2026" },
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

  // Manual for now (later: read from Sheets)
  const LAST_UPDATED = "2 Feb • 22:14 IST";

  const APP_HEADER_H = 72; // px
  const LIST_HEADER_H = 56; // px

  return (
    <main className="min-h-screen text-white bg-neutral-950">
      {/* App background glow */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(900px_circle_at_20%_-10%,rgba(255,255,255,0.08),transparent_60%),radial-gradient(900px_circle_at_90%_0%,rgba(16,185,129,0.10),transparent_55%),radial-gradient(900px_circle_at_60%_110%,rgba(244,63,94,0.10),transparent_55%)]" />

      {/* Top Nav */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-neutral-950/70 border-b border-neutral-900">
        <div
          className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4"
          style={{ minHeight: APP_HEADER_H }}
        >
          {/* Row 1 */}
          <div className="flex items-center justify-between gap-3">
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

            {/* Pot + runner count live on the RIGHT (not under logo) */}
            <div className="flex items-center gap-2 shrink-0">
              <Chip label="Runners" value={String(totalRunners)} />
              <Link href="/pot" className="block">
                <PotChip total={totalPot} oathPot={oathPot} penaltyFund={penaltyFund} />
              </Link>
            </div>
          </div>

          {/* Row 2 (mobile-friendly last updated) */}
          <div className="mt-2 flex items-center justify-between">
            <p className="text-neutral-500 text-xs tabular-nums">
              Last update: <span className="text-neutral-300 font-semibold">{LAST_UPDATED}</span>
            </p>

            <p className="text-neutral-600 text-xs hidden sm:block">
              Sheet → Site sync is manual (for now).
            </p>
          </div>
        </div>
      </header>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* HERO ROW */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-stretch">
          {/* Leader */}
          <div className="rounded-3xl bg-neutral-900/70 ring-1 ring-neutral-800 p-6 sm:p-8 md:p-10 h-full">
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

            {/* Stats tiles (4 total, premium grid) */}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <MiniKpi
                label="Group target"
                value={`${Math.round(totalTargetKm).toLocaleString("en-IN")} km`}
              />
              <MiniKpi
                label="KM logged"
                value={`${Math.round(totalKm).toLocaleString("en-IN")} km`}
              />
              <MiniKpi label="Avg completion" value={`${avgCompletion.toFixed(1)}%`} />
              <MiniKpi label="House rule" value="Respect the Code." />
            </div>
          </div>

          {/* Right column: Hierarchy + Challenges */}
          <div className="space-y-4 sm:space-y-6 h-full">
            {/* Hierarchy */}
            <div className="rounded-3xl bg-neutral-900/70 ring-1 ring-neutral-800 p-6 sm:p-8 md:p-10">
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
                          <span className="text-neutral-500 text-xs">{lvl.desc}</span>
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

            {/* Challenges (replaces Contracts) */}
            <Link
              href="/challenges"
              className="group block rounded-3xl bg-neutral-900/70 ring-1 ring-neutral-800 p-6 sm:p-8 md:p-10 hover:bg-white/[0.04] transition shadow-[0_18px_70px_rgba(0,0,0,0.55)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-neutral-400 text-xs uppercase tracking-wider">
                    Bounties
                  </div>

                  <div className="mt-2 flex items-center gap-2 min-w-0">
                    <div className="text-xl font-black tracking-tight truncate">
                      Challenges
                    </div>

                    <span className="shrink-0 px-3 py-1 rounded-full text-[11px] font-extrabold bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/20">
                      Live
                    </span>
                  </div>

                  <p className="mt-2 text-neutral-500 text-sm leading-relaxed">
                    Automatic rewards funded by penalty money.
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-neutral-950/40 ring-1 ring-neutral-800 px-4 py-3">
                      <p className="text-neutral-500 text-[10px] uppercase tracking-wider">
                        First Soldier
                      </p>
                      <p className="mt-1 font-black tabular-nums">+{fmtINR(400)}</p>
                      <p className="mt-1 text-neutral-600 text-xs">at 250 km</p>
                    </div>

                    <div className="rounded-2xl bg-neutral-950/40 ring-1 ring-neutral-800 px-4 py-3">
                      <p className="text-neutral-500 text-[10px] uppercase tracking-wider">
                        First Area Don
                      </p>
                      <p className="mt-1 font-black tabular-nums">+{fmtINR(600)}</p>
                      <p className="mt-1 text-neutral-600 text-xs">at 500 km</p>
                    </div>
                  </div>

                  <p className="mt-4 text-neutral-600 text-xs">
                    Penalty pool: <span className="text-neutral-300 font-semibold tabular-nums">{fmtINR(penaltyFund)}</span>{" "}
                    (Kumaran + Rishi — bribery, 2 Feb 2026)
                  </p>
                </div>

                <div className="shrink-0 inline-flex items-center gap-2 text-sm font-semibold text-neutral-200 mt-1">
                  Open
                  <span className="transition-transform group-hover:translate-x-0.5">→</span>
                </div>
              </div>
            </Link>
          </div>
        </section>

        {/* Leaderboard header */}
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

                            {isLeader ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-white/5 ring-1 ring-white/10 text-neutral-200">
                                +₹ 1,000
                              </span>
                            ) : null}

                            {isPenalized ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-red-500/10 text-red-200 ring-1 ring-red-500/20">
                                -₹ 500
                              </span>
                            ) : null}

                            <div className="text-neutral-400 text-xs tabular-nums">
                              {Math.round(r.yearlyKm).toLocaleString("en-IN")} km •{" "}
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

                      <div className="text-neutral-500 text-2xl leading-none">›</div>
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
                                <p className="font-bold text-lg truncate">{r.name}</p>

                                {isLeader ? (
                                  <span className="shrink-0 px-3 py-1 rounded-full text-[11px] font-extrabold bg-white/5 ring-1 ring-white/10 text-neutral-200">
                                    +₹ 1,000
                                  </span>
                                ) : null}

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
      <span className="text-white font-semibold ml-2 tabular-nums">{value}</span>
    </div>
  );
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-neutral-950/40 ring-1 ring-neutral-800 px-4 sm:px-5 py-3 sm:py-4">
      <p className="text-neutral-500 text-xs uppercase tracking-wider">{label}</p>
      <p className="text-white font-bold mt-2">{value}</p>
    </div>
  );
}
