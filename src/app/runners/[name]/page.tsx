import ProgressRing from "@/components/ProgressRing";
import WeeklyBars from "@/components/WeeklyBars";
import RunnerCharts from "@/components/RunnerCharts";
import RunnerProfileClient from "@/components/RunnerProfileClient";
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
 * Mafia-themed palette (MATCH leaderboard page)
 * NOTE: We keep the same keys your page already uses: badge/cardBg/cardRing/accentBar/accentText/ringColor
 */
const MAFIA_LEVELS = [
  {
    minKm: 1800,
    name: "Godfather",
    badge: "bg-red-900 text-red-50 ring-1 ring-red-700/40",
    cardBg: "bg-red-900/15",
    cardRing: "ring-red-700/35",
    accentBar: "bg-red-800",
    accentText: "text-red-200",
    ringColor: "#fecaca",
  },
  {
    minKm: 1000,
    name: "Underboss",
    badge: "bg-rose-950 text-rose-50 ring-1 ring-rose-700/35",
    cardBg: "bg-rose-950/15",
    cardRing: "ring-rose-700/30",
    accentBar: "bg-rose-800",
    accentText: "text-rose-200",
    ringColor: "#fecdd3",
  },
  {
    minKm: 500,
    name: "Area Don",
    badge: "bg-amber-900 text-amber-50 ring-1 ring-amber-700/35",
    cardBg: "bg-amber-900/15",
    cardRing: "ring-amber-700/30",
    accentBar: "bg-amber-700",
    accentText: "text-amber-200",
    ringColor: "#fde68a",
  },
  {
    minKm: 250,
    name: "Soldier",
    badge: "bg-emerald-950 text-emerald-50 ring-1 ring-emerald-700/30",
    cardBg: "bg-emerald-950/18",
    cardRing: "ring-emerald-700/25",
    accentBar: "bg-emerald-700",
    accentText: "text-emerald-200",
    ringColor: "#a7f3d0",
  },
  {
    minKm: 0,
    name: "Associate",
    badge: "bg-neutral-700 text-neutral-100 ring-1 ring-neutral-500/30",
    cardBg: "bg-neutral-800/40",
    cardRing: "ring-neutral-500/25",
    accentBar: "bg-neutral-500",
    accentText: "text-neutral-200",
    ringColor: "#e5e7eb",
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

  // A Name | B Yearly KM | C Completion % | D Rank | E Weekly Target | F Annual Target | G RunHistory JSON
  const isManual = process.env.STATS_SOURCE === "MANUAL";
  const raw = await getSheet(isManual ? "Leaderboard!A2:M200" : "API_Leaderboard!A2:H200");
  
  const rows = (raw ?? []).map((r) => {
    if (isManual) {
       // Manual Table Mapping: 
       // H (7) Rank | I (8) Name | J (9) Annual | K (10) Yearly | L (11) % | M (12) Weekly
       return {
         name: String(r?.[8] ?? "").trim(),
         yearlyKm: toNum(r?.[10]),
         completionText: String(r?.[11] ?? ""),
         rank: String(r?.[7] ?? ""),
         weeklyTarget: toNum(r?.[12]),
         annualTarget: toNum(r?.[9]),
         runHistory: [],
       };
    }

    let runHistory = [];
    let summaryStats = null;
    try {
      if (r?.[6]) runHistory = JSON.parse(String(r[6]));
    } catch (err) {
      console.error("Error parsing runHistory for", r?.[0], err);
    }
    try {
      if (r?.[7]) summaryStats = JSON.parse(String(r[7]));
    } catch {}

    return {
      name: String(r?.[0] ?? ""),
      yearlyKm: toNum(r?.[1]),
      completion: toPercent(r?.[2]),
      completionText: String(r?.[2] ?? ""),
      rank: String(r?.[3] ?? ""),
      weeklyTarget: toNum(r?.[4]),
      annualTarget: toNum(r?.[5]),
      runHistory,
      summaryStats,
    };
  });

  const runner = rows.find((r) => norm(r.name) === routeName);

  const sortedRows = [...rows].sort((a, b) => {
    const rankA = Number(a.rank) || 999;
    const rankB = Number(b.rank) || 999;
    if (rankA !== 999 && rankB !== 999 && rankA !== rankB) return rankA - rankB;
    return toPercent(b.completionText) - toPercent(a.completionText);
  });

  const top5Runners = sortedRows.slice(0, 5).map(r => ({
    name: r.name,
    yearlyKm: r.yearlyKm,
    completion: toPercent(r.completionText),
    annualTarget: r.annualTarget,
    rank: Number(r.rank) || null
  }));

  const leader = sortedRows[0] || null;
  const isBonusLeader = runner && leader && norm(runner.name) === norm(leader.name);

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
  runner.completion = pct;

  const level = getMafiaLevel(runner.yearlyKm);
  const tier = getTierProgress(runner.yearlyKm);

  const annualTarget = runner.annualTarget > 0 ? runner.annualTarget : 0;
  const weeklyTarget = runner.weeklyTarget > 0 ? runner.weeklyTarget : 0;

  // ── Removed the weekly aggregate override to ensure we use the true Strava yearly Total (Column B) ──

  const minRequired = Math.round(annualTarget * 0.85);
  const kmToSafety = Math.max(0, minRequired - runner.yearlyKm);

  const activeWeeks = weekly.filter((w) => w.km > 0).length;

  // ✅ Avg weekly mileage (last 4 completed weeks)
  const last4Weeks = weekly.slice(-4);
  const avgLast4 = last4Weeks.length
    ? last4Weeks.reduce((s, w) => s + w.km, 0) / last4Weeks.length
    : 0;

  // ===== Chart data: weekly km + roll4 + cumulative + expected cumulative =====
  const now = new Date();
  const today = now;
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

  const projectedDays = annualTarget > 0 && kmPerDay > 0.05 ? Math.ceil(remainingKm / kmPerDay) : null;
  const projectedDate = projectedDays ? addDays(today, projectedDays) : null;

  const projectionNote =
    recentWeekKms.length >= 3
      ? `Median of last ${Math.min(N, recentWeekKms.length)} weeks: ~${fmtKm(medianWeekly)} km/wk`
      : `Using pace so far: ~${fmtKm(kmPerDay * 7)} km/wk`;

  // ===== Penalty & Zero Weeks =====
  // Rule: 2 zero weeks b2b (back-to-back) = 500 rs fine.
  const jan1 = new Date(yearNow, 0, 1);
  const diffDays = Math.floor((today.getTime() - jan1.getTime()) / 86400000);
  const weeksElapsed = Math.max(0, Math.floor((diffDays + jan1.getDay()) / 7));

  // Determine when the runner officially "started" in the system to avoid legacy fines
  const startWeek = weekly.length > 0 ? Math.min(...weekly.map(w => w.weekNum)) : 1;
  const activeMap = new Set(weekly.filter(w => w.km > 0).map(w => w.weekNum));

  let mafiaFine = 0;
  let consecutiveZeros = 0;
  let zeroWeekCount = 0;

  for (let w = startWeek; w <= weeksElapsed; w++) {
    if (activeMap.has(w)) {
      consecutiveZeros = 0;
    } else {
      zeroWeekCount++;
      consecutiveZeros++;
      if (consecutiveZeros === 2) {
        mafiaFine += 500;
        consecutiveZeros = 0; // Reset streak so 4 weeks = 1000, etc.
      }
    }
  }
  const zeroWeeks = zeroWeekCount;

  // ===== RENDER =====
  return (
    <RunnerProfileClient
      runner={runner}
      level={level}
      tier={tier}
      isBonusLeader={isBonusLeader}
      annualTarget={annualTarget}
      weeklyTarget={weeklyTarget}
      minRequired={minRequired}
      kmToSafety={kmToSafety}
      activeWeeks={activeWeeks}
      avgLast4={avgLast4}
      runStreak={runStreak}
      targetHitRate={targetHitRate}
      daysBadge={daysBadge}
      projectedDateFmt={projectedDate ? fmtDate(projectedDate) : annualTarget > 0 ? "—" : "Set annual target"}
      projectionNote={projectedDate ? projectionNote : annualTarget > 0 ? "Need more weekly data" : ""}
      bestWeek={bestWeek}
      worstWeek={worstWeek}
      acceptedContracts={acceptedContracts}
      weeklyBars={weeklyBars}
      chartData={chartData}
      top5Runners={top5Runners}
      summaryStats={runner.summaryStats ?? null}
      zeroWeeks={zeroWeeks}
      mafiaFine={mafiaFine}
      serverTime={now.getTime()}
    />
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
