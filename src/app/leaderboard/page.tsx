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
 * NOTE: These same tokens should be reused on runner pages for cards + progress bars.
 */
export const MAFIA_LEVELS = [
  {
    minKm: 1500,
    name: "Godfather",
    // Blood Red
    pill: "bg-red-900 text-red-50 ring-1 ring-red-700/40",
    tint: "bg-red-900/15 ring-red-700/35",
    bar: "bg-red-800",
    desc: "1500+ km",
  },
  {
    minKm: 1000,
    name: "Underboss",
    // Burgundy (wine)
    pill: "bg-rose-950 text-rose-50 ring-1 ring-rose-700/35",
    tint: "bg-rose-950/15 ring-rose-700/30",
    bar: "bg-rose-800",
    desc: "1000–1499 km",
  },
  {
    minKm: 500,
    name: "Area Don",
    // Rust / Brass (warm metal)
    pill: "bg-amber-900 text-amber-50 ring-1 ring-amber-700/35",
    tint: "bg-amber-900/15 ring-amber-700/30",
    bar: "bg-amber-700",
    desc: "500–999 km",
  },
  {
    minKm: 250,
    name: "Soldier",
    // Gunmetal (cold steel)
    pill: "bg-slate-700 text-slate-50 ring-1 ring-slate-400/25",
    tint: "bg-slate-800/20 ring-slate-400/20",
    bar: "bg-slate-500",
    desc: "250–499 km",
  },
  {
    minKm: 0,
    name: "Associate",
    // ✅ Deep Noir Green (NOT bright emerald)
    // Goal: feels like "night-vision green" but muted + classy.
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

  // Pot logic
  const oathPot = totalRunners * 1000;
  // TODO: wire to Sheets later
  const penaltyFund = 0;
  const totalPot = oathPot + penaltyFund;

  const totalKm = rows.reduce((s, r) => s + r.yearlyKm, 0);
  const avgCompletion = totalRunners
    ? rows.reduce((s, r) => s + r.completion, 0) / totalRunners
    : 0;

  const leader = [...rows].sort((a, b) => b.completion - a.completion)[0];
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
            <Chip label="Runners" value={String(totalRunners)} />
            <PotChip total={totalPot} oathPot={oathPot} penaltyFund={penaltyFund} />
          </div>
        </div>
      </header>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Hero row */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Main hero */}
          <div className="lg:col-span-2 rounded-3xl bg-neutral-900/70 ring-1 ring-neutral-800 p-6 sm:p-8 md:p-10">
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

            <div className="mt-5 sm:mt-6 space-y-3">
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

              <div className="h-3 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white"
                  style={{
                    width: `${Math.min(Math.max(avgCompletion, 0), 100)}%`,
                  }}
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 pt-2">
                <MiniKpi
                  label="Total KM logged"
                  value={`${Math.round(totalKm).toLocaleString("en-IN")} km`}
                />
                <MiniKpi
                  label="Prize pool"
                  value={`₹${totalPot.toLocaleString("en-IN")}`}
                />
                <MiniKpi label="House rule" value="Respect the Code." />
              </div>
            </div>
          </div>

          {/* Side hero */}
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
                            <div className="text-neutral-400 text-xs tabular-nums">
                              {Math.round(r.yearlyKm).toLocaleString("en-IN")} km
                              {" • "}
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
                              <p className="font-bold text-lg truncate">{r.name}</p>
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
