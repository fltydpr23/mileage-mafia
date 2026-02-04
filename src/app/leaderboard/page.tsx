import Link from "next/link";
import { getSheet } from "@/lib/sheets";
import NowPlaying from "@/components/NowPlaying";


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

const MAFIA_LEVELS = [
  {
    minKm: 1500,
    name: "Godfather",
    pill: "bg-amber-300 text-black",
    tint: "bg-amber-500/10 ring-amber-300/25",
    bar: "bg-amber-300",
    desc: "1500+ km",
  },
  {
    minKm: 1000,
    name: "Underboss",
    pill: "bg-rose-300 text-black",
    tint: "bg-rose-500/10 ring-rose-300/25",
    bar: "bg-rose-300",
    desc: "1000–1499 km",
  },
  {
    minKm: 500,
    name: "Area Don",
    pill: "bg-emerald-300 text-black",
    tint: "bg-emerald-500/10 ring-emerald-300/25",
    bar: "bg-emerald-300",
    desc: "500–999 km",
  },
  {
    minKm: 250,
    name: "Soldier",
    pill: "bg-sky-300 text-black",
    tint: "bg-sky-500/10 ring-sky-300/25",
    bar: "bg-sky-300",
    desc: "250–499 km",
  },
  {
    minKm: 0,
    name: "Associate",
    pill: "bg-zinc-300 text-black",
    tint: "bg-zinc-500/10 ring-zinc-300/20",
    bar: "bg-zinc-300",
    desc: "0–249 km",
  },
] as const;


function getMafiaLevel(km: number) {
  return MAFIA_LEVELS.find((l) => km >= l.minKm) ?? MAFIA_LEVELS[MAFIA_LEVELS.length - 1];
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
  const pot = totalRunners * 1000;

  const totalKm = rows.reduce((s, r) => s + r.yearlyKm, 0);
  const avgCompletion = totalRunners ? rows.reduce((s, r) => s + r.completion, 0) / totalRunners : 0;

  const leader = [...rows].sort((a, b) => b.completion - a.completion)[0];
  const leaderLvl = leader ? getMafiaLevel(leader.yearlyKm) : null;

  return (
    <main className="min-h-screen text-white bg-neutral-950">
      {/* App background glow */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(900px_circle_at_20%_-10%,rgba(255,255,255,0.08),transparent_60%),radial-gradient(900px_circle_at_90%_0%,rgba(16,185,129,0.10),transparent_55%),radial-gradient(900px_circle_at_60%_110%,rgba(244,63,94,0.10),transparent_55%)]" />
{/* DEBUG: force visible */}
    
      <NowPlaying />
  

      {/* Top Nav (sticky) */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-neutral-950/70 border-b border-neutral-900">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-white/10 ring-1 ring-white/10 flex items-center justify-center font-black">
              MM
            </div>
            <div className="leading-tight">
              <p className="font-black tracking-tight text-lg">Mileage Mafia</p>
              <p className="text-neutral-400 text-xs">Leaderboard</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Chip label="Runners" value={String(totalRunners)} />
            <Chip label="Pot" value={`₹${pot.toLocaleString("en-IN")}`} />
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="relative max-w-6xl mx-auto px-6 py-10 space-y-10">
        {/* Hero card */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-3xl bg-neutral-900/70 ring-1 ring-neutral-800 p-8 md:p-10">
            <div className="flex items-start justify-between gap-6">
              <div className="space-y-2 min-w-0">
                <p className="text-neutral-400 text-xs uppercase tracking-wider">Current leader</p>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl md:text-4xl font-black tracking-tight truncate">
                    {leader ? leader.name : "—"}
                  </h1>
                  {leaderLvl ? (
                    <span className={`px-3 py-1 rounded-full text-[11px] font-extrabold ${leaderLvl.pill}`}>
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
                  className="shrink-0 px-5 py-3 rounded-full bg-white text-black font-semibold hover:opacity-90 transition"
                >
                  Open →
                </Link>
              ) : null}
            </div>

            <div className="mt-8 space-y-3">
              <div className="flex items-end justify-between">
                <p className="text-neutral-300 font-semibold">Group completion</p>
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
                  style={{ width: `${Math.min(Math.max(avgCompletion, 0), 100)}%` }}
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4">
                <MiniKpi label="Total KM logged" value={`${Math.round(totalKm).toLocaleString("en-IN")} km`} />
                <MiniKpi label="Prize pool" value={`₹${pot.toLocaleString("en-IN")}`} />
                <MiniKpi label="House rule" value="Sheet is truth" />
              </div>
            </div>
          </div>

          {/* Side card: hierarchy */}
          <div className="rounded-3xl bg-neutral-900/70 ring-1 ring-neutral-800 p-8 md:p-10">
            <p className="text-neutral-400 text-xs uppercase tracking-wider">Hierarchy</p>
            <h2 className="text-xl font-bold mt-2">Family levels</h2>

            <div className="mt-6 space-y-3">
              {MAFIA_LEVELS.map((lvl) => {
  const count = rows.filter((r) => getMafiaLevel(r.yearlyKm).name === lvl.name).length;

  return (
    <div key={lvl.name} className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-[11px] font-extrabold ${lvl.pill}`}>
            {lvl.name}
          </span>
          <span className="text-neutral-500 text-xs">{lvl.desc}</span>
        </div>
      </div>

      <span className="text-white font-semibold tabular-nums">{count}</span>
    </div>
  );
})}

            </div>

            <p className="mt-6 text-neutral-500 text-xs">Levels based on yearly KM.</p>
          </div>
        </section>

        {/* List section header */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-neutral-400 text-xs uppercase tracking-wider">Leaderboard</p>
            <h3 className="text-2xl font-bold mt-2">Runners</h3>
          </div>
          <p className="text-neutral-500 text-sm">
            Sorted by {sorted.some((r) => r.rank) ? "rank" : "completion"}
          </p>
        </div>

        {/* App-like list */}
        <section className="rounded-3xl bg-neutral-900/70 ring-1 ring-neutral-800 overflow-hidden">
          {/* sticky list header */}
          <div className="sticky top-[72px] z-20 bg-neutral-950/60 backdrop-blur-xl border-b border-neutral-800">
            <div className="grid grid-cols-12 gap-4 px-6 md:px-8 py-4 text-xs uppercase tracking-wider text-neutral-500">
              <div className="col-span-1">#</div>
              <div className="col-span-6">Runner</div>
              <div className="col-span-2 text-right">KM</div>
              <div className="col-span-2 text-right">%</div>
              <div className="col-span-1 text-right"> </div>
            </div>
          </div>

          <div className="divide-y divide-neutral-800">
            {sorted.map((r, idx) => {
              const lvl = getMafiaLevel(r.yearlyKm);
              const pct = Math.min(Math.max(r.completion, 0), 100);

              return (
                <Link key={r.name} href={`/runners/${slugifyName(r.name)}`} className="block">
                  <div className="px-6 md:px-8 py-6 hover:bg-white/5 transition">
                    <div className="grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-1 text-neutral-400 font-semibold tabular-nums">
                        {r.rank ? r.rank : idx + 1}
                      </div>

                      <div className="col-span-6 min-w-0">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={`h-11 w-11 rounded-2xl ring-1 ${lvl.tint} flex items-center justify-center font-black`}>
                            {initials(r.name)}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-bold text-lg truncate">{r.name}</p>
                              <span className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-extrabold ${lvl.pill}`}>
                                {lvl.name}
                              </span>
                            </div>

                            <p className="text-neutral-500 text-sm mt-1">
                              Target {Math.round(r.annualTarget)} km • Weekly {Math.round(r.weeklyTarget)} km
                            </p>

                            <div className="mt-3 h-2 bg-neutral-800 rounded-full overflow-hidden">
                              <div className={`h-full ${lvl.bar}`} style={{ width: `${pct}%` }} />
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

      {/* ✅ Music controls (fixed overlay widget) */}
      <NowPlaying />
    </main>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-2 rounded-full bg-neutral-900/70 ring-1 ring-neutral-800 text-neutral-300 text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className="text-white font-semibold ml-2">{value}</span>
    </div>
  );
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-neutral-950/40 ring-1 ring-neutral-800 px-5 py-4">
      <p className="text-neutral-500 text-xs uppercase tracking-wider">{label}</p>
      <p className="text-white font-bold mt-2">{value}</p>
    </div>
  );
}

