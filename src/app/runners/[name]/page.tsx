import ProgressRing from "@/components/ProgressRing";
import WeeklyBars from "@/components/WeeklyBars";
import RunnerCharts from "@/components/RunnerCharts";
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

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function median(nums: number[]) {
  const arr = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  const n = arr.length;
  if (!n) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}

// --- Date helpers (server-safe + deterministic)
function isLeapYear(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}
function dayOfYear(d: Date) {
  const start = new Date(d.getFullYear(), 0, 1);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / 86400000) + 1;
}
function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
function fmtDate(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][
    d.getMonth()
  ];
  const y = d.getFullYear();

  const now = new Date();
  const thisYear = now.getFullYear();

  return y === thisYear ? `${dd} ${mon}` : `${dd} ${mon} ${y}`;
}

// Accepts dd/mm/yyyy, dd-mm-yyyy, or Google serial numbers (e.g., 46055)
function parseSheetDate(v: any): Date | null {
  const s = String(v ?? "").trim();
  if (!s) return null;

  // serial number
  if (/^\d+(\.\d+)?$/.test(s)) {
    const serial = Number(s);
    if (!Number.isFinite(serial)) return null;
    // Google Sheets: days since 1899-12-30
    const base = new Date(Date.UTC(1899, 11, 30));
    base.setUTCDate(base.getUTCDate() + Math.floor(serial));
    return new Date(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate());
  }

  // dd/mm/yyyy or dd-mm-yyyy
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  const d = new Date(yyyy, mm - 1, dd);
  return Number.isNaN(d.getTime()) ? null : d;
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
    name: "Area Don",
    badge: "bg-emerald-300 text-black shadow-lg shadow-emerald-300/20",
    cardBg: "bg-emerald-500/10",
    cardRing: "ring-emerald-300/30",
    accentBar: "bg-emerald-300",
    accentText: "text-emerald-200",
    ringColor: "#6ee7b7",
  },
  {
    minKm: 250,
    name: "Soldier",
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
  return MAFIA_LEVELS.find((l) => km >= l.minKm) ?? MAFIA_LEVELS[MAFIA_LEVELS.length - 1];
}

function getTierProgress(km: number) {
  const idx = MAFIA_LEVELS.findIndex((l) => km >= l.minKm);
  const current = idx >= 0 ? MAFIA_LEVELS[idx] : MAFIA_LEVELS[MAFIA_LEVELS.length - 1];
  const next = idx > 0 ? MAFIA_LEVELS[idx - 1] : null;

  const curMin = current.minKm;
  const nextMin = next ? next.minKm : curMin;

  const span = Math.max(1, nextMin - curMin);
  const into = Math.max(0, km - curMin);
  const pct = Math.min(100, (into / span) * 100);

  const kmToNext = next ? Math.max(0, nextMin - km) : 0;

  return { current, next, pct, kmToNext, curMin, nextMin };
}
type AcceptedContract = {
  contractId: string;
  title: string;
  period: string;
  ts: string;
  meta?: string;
};

function safeDate(ts: string) {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtAcceptedTs(ts: string) {
  const d = safeDate(ts);
  if (!d) return ts || "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}


export default async function RunnerPage({ params }: { params: Promise<{ name: string }> }) {
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
        <div className="text-neutral-400">
          URL name: <span className="text-white">{urlName}</span>
        </div>
        <div className="text-neutral-400">First 10 names in API_Leaderboard:</div>
        <ul className="list-disc pl-6 space-y-1 text-neutral-300">
          {rows.slice(0, 10).map((r, i) => (
            <li key={`${r.name}-${i}`}>{r.name || "(blank)"}</li>
          ))}
        </ul>
      </div>
    );
  }

  // ===== CONTRACTS (Accepted) =====
// Sheet: API_ContractLog
// A ts | B runner | C action | D contractId | E title | F period | G meta
const logRaw = await getSheet("API_ContractLog!A2:G5000");

const acceptedAll = (logRaw ?? [])
  .map((r: any[]) => ({
    ts: String(r?.[0] ?? "").trim(),
    runner: String(r?.[1] ?? "").trim(),
    action: String(r?.[2] ?? "").trim().toUpperCase(),
    contractId: String(r?.[3] ?? "").trim(),
    title: String(r?.[4] ?? "").trim(),
    period: String(r?.[5] ?? "").trim(),
    meta: String(r?.[6] ?? "").trim(),
  }))
  .filter((x) => norm(x.runner) === routeName)
  .filter((x) => x.action === "ACCEPTED")
  .filter((x) => x.contractId);

// Dedup by contractId (keep newest)
const map = new Map<string, AcceptedContract>();
for (const x of acceptedAll) {
  const prev = map.get(x.contractId);
  if (!prev) {
    map.set(x.contractId, {
      contractId: x.contractId,
      title: x.title || x.contractId,
      period: x.period || "—",
      ts: x.ts,
      meta: x.meta,
    });
    continue;
  }

  const tPrev = safeDate(prev.ts)?.getTime() ?? 0;
  const tCur = safeDate(x.ts)?.getTime() ?? 0;
  if (tCur >= tPrev) {
    map.set(x.contractId, {
      contractId: x.contractId,
      title: x.title || x.contractId,
      period: x.period || "—",
      ts: x.ts,
      meta: x.meta,
    });
  }
}

const acceptedContracts = Array.from(map.values()).sort((a, b) => {
  const ta = safeDate(a.ts)?.getTime() ?? 0;
  const tb = safeDate(b.ts)?.getTime() ?? 0;
  return tb - ta;
});



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
    .filter((w) => !isBlankKmCell(w.kmRaw))
    .sort((a, b) => a.weekNum - b.weekNum);

  // ===== COMPUTE =====
  const pct = toPercent(runner.completionText);
  const level = getMafiaLevel(runner.yearlyKm);
  const tier = getTierProgress(runner.yearlyKm);

  const annualTarget = runner.annualTarget > 0 ? runner.annualTarget : 0;
  const weeklyTarget = runner.weeklyTarget > 0 ? runner.weeklyTarget : 0;

  const minRequired = Math.round(annualTarget * 0.85);
  const kmToSafety = Math.max(0, minRequired - runner.yearlyKm);

  const activeWeeks = weekly.length;

  // ===== Chart data: weekly km + roll4 + cumulative + expected cumulative =====
  const today = new Date();
  const yearNow = today.getFullYear();
  const totalDaysNow = isLeapYear(yearNow) ? 366 : 365;

  let cum = 0;

  const chartData = weekly.map((w, i) => {
    cum += w.km;

    const start = Math.max(0, i - 3);
    const window = weekly.slice(start, i + 1);
    const roll4 = window.reduce((s, x) => s + x.km, 0) / Math.max(1, window.length);

    const endDate = parseSheetDate(w.weekEnd) ?? parseSheetDate(w.weekStart);
    const y = (endDate ?? today).getFullYear();
    const totalDays = isLeapYear(y) ? 366 : 365;
    const doy = endDate ? dayOfYear(endDate) : Math.min(totalDays, (i + 1) * 7);

    const expectedCum = annualTarget > 0 ? (annualTarget * doy) / totalDays : 0;

    return {
      week: `W${w.weekNum}`,
      km: w.km,
      hit: (weeklyTarget > 0 && w.km >= weeklyTarget ? 1 : 0) as 0 | 1,
      roll4,
      cum,
      expectedCum,
    };
  });

  // 🔥 Running streak: consecutive completed weeks with ANY km > 0
  let runStreak = 0;
  for (let i = weekly.length - 1; i >= 0; i--) {
    if (weekly[i].km > 0) runStreak++;
    else break;
  }

  // 🎯 Target hit rate
  const hitWeeks = weeklyTarget > 0 ? weekly.filter((w) => w.km >= weeklyTarget).length : 0;
  const targetHitRate = activeWeeks && weeklyTarget > 0 ? (hitWeeks / activeWeeks) * 100 : 0;

  const bestWeek =
    activeWeeks > 0 ? weekly.reduce((best, w) => (w.km > best.km ? w : best), weekly[0]) : null;

  const worstWeek =
    activeWeeks > 0 ? weekly.reduce((worst, w) => (w.km < worst.km ? w : worst), weekly[0]) : null;

  const weeklyBars = weekly.slice(-12).map((w) => ({
    label: `W${w.weekNum}`,
    km: w.km,
  }));

  // ===== Days ahead/behind (linear plan to annual target) =====
  const doyNow = dayOfYear(today);
  const requiredKmPerDay = annualTarget > 0 ? annualTarget / totalDaysNow : 0;
  const expectedKmByToday = annualTarget > 0 ? annualTarget * (doyNow / totalDaysNow) : 0;
  const kmDelta = runner.yearlyKm - expectedKmByToday;
  const daysAheadBehind = requiredKmPerDay > 0 ? kmDelta / requiredKmPerDay : 0;

  const daysBadge =
    requiredKmPerDay <= 0
      ? { label: "—", sub: "Set annual target" }
      : daysAheadBehind >= 0
      ? { label: `${Math.round(daysAheadBehind)} days ahead`, sub: `+${fmtKm(kmDelta)} km vs plan` }
      : { label: `${Math.abs(Math.round(daysAheadBehind))} days behind`, sub: `${fmtKm(kmDelta)} km vs plan` };

  // ===== Projected completion date (median-based, less sensitive to spikes) =====
  const N = 6;
  const recentWeeks = weekly.slice(-N);
  const recentWeekKms = recentWeeks.map((w) => w.km).filter((k) => k > 0);

  let medianWeekly = median(recentWeekKms);

  // guardrail: if weeklyTarget exists, cap median to avoid silly projections
  if (weeklyTarget > 0) {
    medianWeekly = Math.min(medianWeekly, weeklyTarget * 2.5);
  }

  const kmPerDayMedian = medianWeekly / 7;
  const paceSoFarKmPerDay = doyNow > 0 ? runner.yearlyKm / doyNow : 0;

  const kmPerDay = recentWeekKms.length >= 3 ? kmPerDayMedian : paceSoFarKmPerDay;

  const remainingKm = Math.max(0, annualTarget - runner.yearlyKm);

  const projectedDays =
    annualTarget > 0 && kmPerDay > 0.05 ? Math.ceil(remainingKm / kmPerDay) : null;

  const projectedDate = projectedDays ? addDays(today, projectedDays) : null;

  const projectionNote =
    recentWeekKms.length >= 3
      ? `Median of last ${Math.min(N, recentWeekKms.length)} weeks: ~${fmtKm(medianWeekly)} km/wk`
      : `Using pace so far: ~${fmtKm(kmPerDay * 7)} km/wk`;

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
          <h1 className="text-5xl sm:text-6xl font-black tracking-tight">{runner.name}</h1>
          <div className="text-neutral-400 text-lg">
            Rank <span className="text-white font-bold">#{runner.rank}</span>
          </div>
        </div>

        {/* HERO */}
        <section className={`rounded-3xl p-10 ring-1 bg-neutral-900/70 ${level.cardBg} ${level.cardRing}`}>
          <div className="flex flex-col sm:flex-row items-start justify-between gap-10">
            <div>
              <div className="text-neutral-300/80 text-sm mb-2">Yearly KM</div>

              <div className={`text-6xl font-black tabular-nums leading-none ${level.accentText}`}>
                {fmtKm(runner.yearlyKm)}
                <span className="text-xl text-neutral-300/70 ml-2">km</span>
              </div>

              <div className={`inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-full ${level.badge}`}>
                <span className="text-xs uppercase tracking-wider opacity-80">Mafia Level</span>
                <span className="opacity-70">•</span>
                <span className="font-extrabold">{level.name}</span>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <ProgressRing value={pct} size={130} stroke={10} sublabel="Completion" color={level.ringColor} />
            </div>
          </div>

          <div className="mt-10">
            <div className="h-3 bg-neutral-900/60 rounded-full overflow-hidden">
              <div className={`h-full ${level.accentBar}`} style={{ width: `${clamp(pct, 0, 100)}%` }} />
            </div>

            <div className="text-neutral-300/80 text-sm mt-4">
              <span>
                Annual target: <span className="text-white font-semibold">{fmtKm(annualTarget)} km</span>
              </span>
              <span className="text-neutral-500"> {" • "} </span>
              <span>
                85% safety: <span className="text-white font-semibold">{fmtKm(minRequired)} km</span>
              </span>
              <span className="text-neutral-500"> {" • "} </span>
              <span>
                To safety: <span className="text-white font-semibold">{fmtKm(kmToSafety)} km</span>
              </span>
            </div>

            {/* Next level progress */}
            <div className="mt-6">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                <div className="text-neutral-300 font-semibold">Hierarchy progress</div>

                {tier.next ? (
                  <div className="text-neutral-400 text-sm">
                    <span className="text-white font-semibold tabular-nums">{fmtKm(tier.kmToNext)}</span>{" "}
                    km to <span className="text-white font-semibold">{tier.next.name}</span>
                  </div>
                ) : (
                  <div className="text-neutral-400 text-sm">
                    <span className="text-white font-semibold">Top tier</span> 🥃
                  </div>
                )}
              </div>

              <div className="mt-3 h-3 bg-neutral-900/60 rounded-full overflow-hidden">
                <div className={`h-full ${level.accentBar}`} style={{ width: `${tier.pct}%` }} />
              </div>

              <div className="mt-3 text-neutral-500 text-xs">
                {tier.next ? (
                  <span>
                    Progress inside <span className="text-neutral-300">{tier.current.name}</span> ({tier.curMin} →{" "}
                    {tier.nextMin} km)
                  </span>
                ) : (
                  <span>
                    You’re at <span className="text-neutral-300">{tier.current.name}</span> ({tier.curMin}+ km)
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* METRICS */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <Stat label="Weekly Target" value={weeklyTarget ? `${fmtKm(weeklyTarget)} km` : "—"} />
          <Stat label="Active Weeks" value={String(activeWeeks)} />
          <Stat label="🔥 Running Streak" value={`${runStreak} weeks`} />
          <Stat label="🎯 Target Hit Rate" value={weeklyTarget ? `${targetHitRate.toFixed(0)}%` : "—"} />
          <Stat label="⏱️ Pace vs Plan" value={daysBadge.label} sub={daysBadge.sub} />
          <Stat
            label="📅 Projected Finish"
            value={projectedDate ? fmtDate(projectedDate) : annualTarget > 0 ? "—" : "Set annual target"}
            sub={projectedDate ? projectionNote : annualTarget > 0 ? "Need more weekly data" : ""}
          />
          <Stat label="📈 Best Week" value={bestWeek ? `W${bestWeek.weekNum} • ${fmtKm(bestWeek.km)} km` : "—"} />
          <Stat label="📉 Worst Week" value={worstWeek ? `W${worstWeek.weekNum} • ${fmtKm(worstWeek.km)} km` : "—"} />
        </section>

        {/* ACCEPTED CONTRACTS */}
<section className="bg-neutral-900/70 rounded-3xl p-8 ring-1 ring-neutral-800">
  <div className="text-neutral-400 text-xs uppercase tracking-wider">Paper</div>
  <div className="text-2xl font-bold mt-2">Active Contracts</div>
  <div className="text-neutral-500 text-sm mt-1">
    Clauses this runner has signed. Permanent record.
  </div>

  {acceptedContracts.length === 0 ? (
    <div className="mt-6 text-neutral-500 text-sm">No accepted contracts yet.</div>
  ) : (
    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
      {acceptedContracts.map((c) => (
        <div
          key={c.contractId}
          className="rounded-2xl ring-1 ring-neutral-800 bg-neutral-950/40 p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs uppercase tracking-[0.3em] text-neutral-500">
              {c.period}
            </div>
            <div className="text-xs text-neutral-500">{fmtAcceptedTs(c.ts)}</div>
          </div>

          <div className="mt-2 text-lg font-semibold text-white">
            {c.title}
          </div>

          <div className="mt-2 text-xs text-neutral-500">
            ID: <span className="text-neutral-300">{c.contractId}</span>
          </div>
        </div>
      ))}
    </div>
  )}
</section>

        {/* WEEKLY BARS */}
        <section className="bg-neutral-900/70 rounded-3xl p-8 ring-1 ring-neutral-800">
          <div className="text-neutral-400 text-xs uppercase tracking-wider">Trend</div>
          <div className="text-xl font-bold mt-2">Last 12 completed weeks</div>

          <div className="mt-6">
            <WeeklyBars data={weeklyBars} target={weeklyTarget} colorClass={level.accentBar} />
          </div>

          {weekly.length === 0 ? (
            <div className="text-neutral-500 text-sm mt-4">No completed weekly data found yet for this runner.</div>
          ) : null}
        </section>


        {/* CHARTS */}
        <section className="space-y-4">
          <div>
            <div className="text-neutral-400 text-xs uppercase tracking-wider">Analytics</div>
            <div className="text-2xl font-bold mt-2">Graphs</div>
            <div className="text-neutral-500 text-sm mt-1">
              Weekly KM + rolling average + <span className="text-neutral-300">cumulative vs expected</span>.
            </div>
          </div>

          <RunnerCharts data={chartData.slice(-16)} weeklyTarget={weeklyTarget} />

          {chartData.length === 0 ? (
            <div className="text-neutral-500 text-sm">Add weekly KM rows in Sheets to unlock graphs.</div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-neutral-900 rounded-3xl p-8 ring-1 ring-neutral-800">
      <div className="text-neutral-400 text-sm mb-2">{label}</div>
      <div className="text-3xl font-bold tabular-nums">{value}</div>
      {sub ? <div className="mt-2 text-xs text-neutral-500">{sub}</div> : null}
    </div>
  );
}
