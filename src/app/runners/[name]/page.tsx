import ProgressRing from "@/components/ProgressRing";
import WeeklyBars from "@/components/WeeklyBars";
import { getSheet } from "@/lib/sheets";

export const dynamic = "force-dynamic";

function norm(v: any) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
}

function toNum(v: any) {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function toPercent(v: any) {
  const s = String(v ?? "").trim();
  const n = parseFloat(s.replace("%", "").trim());
  return Number.isFinite(n) ? n : 0;
}

function fmtKm(n: number) {
  if (!Number.isFinite(n)) return "0";
  return n % 1 === 0 ? String(Math.round(n)) : n.toFixed(1);
}

function isBlankKmCell(s: string) {
  const t = String(s ?? "").trim();
  return t === "" || t === "-" || t === "—";
}

/**
 * Mafia-themed palette + full theme per level.
 */
const MAFIA_LEVELS = [
  {
    minKm: 1500,
    name: "Don",
    badge: "bg-amber-300 text-black shadow-lg shadow-amber-300/20",
    cardBg: "bg-amber-500/10",
    cardRing: "ring-amber-300/30",
    accentBar: "bg-amber-300",
    accentText: "text-amber-200",
    ringColor: "#fcd34d",
  },
  {
    minKm: 1000,
    name: "Underboss",
    badge: "bg-rose-300 text-black shadow-lg shadow-rose-300/20",
    cardBg: "bg-rose-500/10",
    cardRing: "ring-rose-300/30",
    accentBar: "bg-rose-300",
    accentText: "text-rose-200",
    ringColor: "#fda4af",
  },
  {
    minKm: 500,
    name: "Capo",
    badge: "bg-emerald-300 text-black shadow-lg shadow-emerald-300/20",
    cardBg: "bg-emerald-500/10",
    cardRing: "ring-emerald-300/30",
    accentBar: "bg-emerald-300",
    accentText: "text-emerald-200",
    ringColor: "#6ee7b7",
  },
  {
    minKm: 250,
    name: "Made Man",
    badge: "bg-sky-300 text-black shadow-lg shadow-sky-300/20",
    cardBg: "bg-sky-500/10",
    cardRing: "ring-sky-300/30",
    accentBar: "bg-sky-300",
    accentText: "text-sky-200",
    ringColor: "#7dd3fc",
  },
  {
    minKm: 0,
    name: "Associate",
    badge: "bg-zinc-300 text-black shadow-lg shadow-zinc-300/10",
    cardBg: "bg-zinc-500/10",
    cardRing: "ring-zinc-300/25",
    accentBar: "bg-zinc-300",
    accentText: "text-zinc-200",
    ringColor: "#d4d4d8",
  },
] as const;

function getMafiaLevel(km: number) {
  return (
    MAFIA_LEVELS.find((l) => km >= l.minKm) ??
    MAFIA_LEVELS[MAFIA_LEVELS.length - 1]
  );
}

/**
 * Progress within current tier band (current.minKm -> next.minKm)
 */
function getTierProgress(km: number) {
  const idx = MAFIA_LEVELS.findIndex((l) => km >= l.minKm);
  const current =
    idx >= 0 ? MAFIA_LEVELS[idx] : MAFIA_LEVELS[MAFIA_LEVELS.length - 1];

  const next = idx > 0 ? MAFIA_LEVELS[idx - 1] : null;
  const curMin = current.minKm;
  const nextMin = next ? next.minKm : curMin;

  const span = Math.max(1, nextMin - curMin);
  const into = Math.max(0, km - curMin);
  const pct = Math.min(100, (into / span) * 100);

  const kmToNext = next ? Math.max(0, nextMin - km) : 0;

  return { current, next, pct, kmToNext, curMin, nextMin };
}

export default async function RunnerPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;

  const urlName = decodeURIComponent(name);
  const routeName = norm(urlName);

  // A Name | B Yearly KM | C Completion % | D Rank | E Weekly Target | F Annual Target
  const raw = await getSheet("API_Leaderboard!A2:F200");
  const rows = (raw ?? []).map((r) => ({
    name: String(r?.[0] ?? ""),
    yearlyKm: toNum(r?.[1]),
    completionText: String(r?.[2] ?? ""),
    rank: String(r?.[3] ?? ""),
    weeklyTarget: toNum(r?.[4]),
    annualTarget: toNum(r?.[5]),
  }));

  const runner = rows.find((r) => norm(r.name) === routeName);

  const leader = rows.reduce(
    (best, r) => {
      const p = toPercent(r.completionText);
      return p > best.pct ? { name: r.name, pct: p } : best;
    },
    { name: "", pct: -1 }
  );

  const isBonusLeader = runner && norm(runner.name) === norm(leader.name);

  if (!runner) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white p-10 space-y-4">
        <h1 className="text-2xl font-bold">Runner not found</h1>
        <p className="text-neutral-400">
          URL name: <span className="text-white">{urlName}</span>
        </p>
        <p className="text-neutral-400">First 10 names in API_Leaderboard:</p>
        <ul className="list-disc pl-6 space-y-1">
          {rows.slice(0, 10).map((r, i) => (
            <li key={`${r.name}-${i}`}>{r.name || "(blank)"}</li>
          ))}
        </ul>
      </div>
    );
  }

  // Name | Week# | WeekStart | WeekEnd | WeeklyKM
  const weeklyRaw = await getSheet("API_Weekly!A2:E3307");

  const weekly = (weeklyRaw ?? [])
    .map((r) => {
      const kmRaw = String(r?.[4] ?? "").trim();
      return {
        name: String(r?.[0] ?? ""),
        weekNum: toNum(r?.[1]),
        weekStart: String(r?.[2] ?? ""),
        weekEnd: String(r?.[3] ?? ""),
        kmRaw,
        km: toNum(kmRaw),
      };
    })
    .filter((w) => norm(w.name) === routeName)
    .filter((w) => w.weekNum > 0)
    .filter((w) => !isBlankKmCell(w.kmRaw)) // ignore blank current week
    .sort((a, b) => a.weekNum - b.weekNum);

  // ===== COMPUTE =====
  const pct = toPercent(runner.completionText);
  const level = getMafiaLevel(runner.yearlyKm);
  const tier = getTierProgress(runner.yearlyKm);

  const minRequired = Math.round(runner.annualTarget * 0.85);
  const kmToSafety = Math.max(0, minRequired - runner.yearlyKm);

  const activeWeeks = weekly.length;

  // 🔥 Running streak: consecutive weeks with ANY KM > 0
  let runStreak = 0;
  for (let i = weekly.length - 1; i >= 0; i--) {
    if (weekly[i].km > 0) runStreak++;
    else break;
  }

  // 🎯 Target hit rate: weeks meeting/exceeding weekly target
  const hitWeeks = weekly.filter((w) => w.km >= runner.weeklyTarget).length;
  const targetHitRate = activeWeeks ? (hitWeeks / activeWeeks) * 100 : 0;

  // Best / worst (only completed weeks)
  const bestWeek =
    activeWeeks > 0
      ? weekly.reduce((best, w) => (w.km > best.km ? w : best), weekly[0])
      : null;

  const worstWeek =
    activeWeeks > 0
      ? weekly.reduce((worst, w) => (w.km < worst.km ? w : worst), weekly[0])
      : null;

  // Bars data (last 12 completed weeks)
  const weeklyBars = weekly.slice(-12).map((w) => ({
    label: `W${w.weekNum}`,
    km: w.km,
  }));

  // ===== RENDER =====
  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-10">
        {isBonusLeader ? (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-lime-400/20 ring-1 ring-lime-400/30 text-lime-200 font-semibold">
            +₹1000 Bonus
          </div>
        ) : null}

        <div className="flex items-end justify-between gap-6">
          <h1 className="text-6xl font-black tracking-tight">{runner.name}</h1>
          <div className="text-neutral-400 text-lg">
            Rank <span className="text-white font-bold">#{runner.rank}</span>
          </div>
        </div>

        {/* HERO */}
        <section
          className={`rounded-3xl p-10 ring-1 bg-neutral-900/70 ${level.cardBg} ${level.cardRing}`}
        >
          <div className="flex items-start justify-between gap-10">
            <div>
              <div className="text-neutral-300/80 text-sm mb-2">Yearly KM</div>

              <div
                className={`text-6xl font-black tabular-nums leading-none ${level.accentText}`}
              >
                {fmtKm(runner.yearlyKm)}
                <span className="text-xl text-neutral-300/70 ml-2">km</span>
              </div>

              <div
                className={`inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-full ${level.badge}`}
              >
                <span className="text-xs uppercase tracking-wider opacity-80">
                  Mafia Level
                </span>
                <span className="opacity-70">•</span>
                <span className="font-extrabold">{level.name}</span>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <ProgressRing
                value={pct}
                size={130}
                stroke={10}
                sublabel="Completion"
                color={level.ringColor}
              />
            </div>
          </div>

          {/* completion bar */}
          <div className="mt-10">
            <div className="h-3 bg-neutral-900/60 rounded-full overflow-hidden">
              <div
                className={`h-full ${level.accentBar}`}
                style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
              />
            </div>

            <div className="text-neutral-300/80 text-sm mt-4">
              Annual target:{" "}
              <span className="text-white font-semibold">
                {fmtKm(runner.annualTarget)} km
              </span>
              {" • "}
              85% safety:{" "}
              <span className="text-white font-semibold">
                {fmtKm(minRequired)} km
              </span>
              {" • "}
              To safety:{" "}
              <span className="text-white font-semibold">
                {fmtKm(kmToSafety)} km
              </span>
            </div>

            {/* Next level progress (NOT inside a <p>) */}
            <div className="mt-6">
              <div className="flex items-end justify-between gap-4">
                <div className="text-neutral-300 font-semibold">
                  Hierarchy progress
                </div>

                {tier.next ? (
                  <div className="text-neutral-400 text-sm">
                    <span className="text-white font-semibold tabular-nums">
                      {fmtKm(tier.kmToNext)}
                    </span>{" "}
                    km to{" "}
                    <span className="text-white font-semibold">
                      {tier.next.name}
                    </span>
                  </div>
                ) : (
                  <div className="text-neutral-400 text-sm">
                    <span className="text-white font-semibold">Top tier</span> 🥃
                  </div>
                )}
              </div>

              <div className="mt-3 h-3 bg-neutral-900/60 rounded-full overflow-hidden">
                <div
                  className={`h-full ${level.accentBar}`}
                  style={{ width: `${tier.pct}%` }}
                />
              </div>

              <div className="mt-3 text-neutral-500 text-xs">
                {tier.next ? (
                  <>
                    Progress inside{" "}
                    <span className="text-neutral-300">{tier.current.name}</span>{" "}
                    ({tier.curMin} → {tier.nextMin} km)
                  </>
                ) : (
                  <>
                    You’re at{" "}
                    <span className="text-neutral-300">{tier.current.name}</span>{" "}
                    ({tier.curMin}+ km)
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* METRICS */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <Stat
            label="Weekly Target"
            value={
              runner.weeklyTarget ? `${fmtKm(runner.weeklyTarget)} km` : "—"
            }
          />
          <Stat label="Active Weeks" value={String(activeWeeks)} />
          <Stat label="🔥 Running Streak" value={`${runStreak} weeks`} />
          <Stat label="🎯 Target Hit Rate" value={`${targetHitRate.toFixed(0)}%`} />
          <Stat
            label="📈 Best Week"
            value={bestWeek ? `W${bestWeek.weekNum} • ${fmtKm(bestWeek.km)} km` : "—"}
          />
          <Stat
            label="📉 Worst Week"
            value={worstWeek ? `W${worstWeek.weekNum} • ${fmtKm(worstWeek.km)} km` : "—"}
          />
        </section>

        {/* WEEKLY BARS */}
        <section className="bg-neutral-900/70 rounded-3xl p-8 ring-1 ring-neutral-800">
          <div className="text-neutral-400 text-xs uppercase tracking-wider">
            Trend
          </div>
          <h2 className="text-xl font-bold mt-2">Last 12 completed weeks</h2>

          <div className="mt-6">
            <WeeklyBars
              data={weeklyBars}
              target={runner.weeklyTarget}
              colorClass={level.accentBar}
            />
          </div>

          {weekly.length === 0 ? (
            <div className="text-neutral-500 text-sm mt-4">
              No completed weekly data found yet for this runner.
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-neutral-900 rounded-3xl p-8 ring-1 ring-neutral-800">
      <div className="text-neutral-400 text-sm mb-2">{label}</div>
      <div className="text-3xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
