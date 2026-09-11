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

function normMatch(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const ALIASES: Record<string, string[]> = {
    "pcd": ["pcd", "parikshit", "parikshit d", "p.c.d.", "p.c.d", "p c d", "parikshit choudhary", "pari"],
    "boba": ["boba", "boba fett"],
    "raja": ["raja", "rajasharavana"],
    "sd": ["sd", "shreyas", "shreyas d"],
    "loaf": ["loaf", "loafcat"],
  };

  for (const list of Object.values(ALIASES)) {
    const normList = list.map(norm);
    if (normList.includes(na) && normList.includes(nb)) {
      return true;
    }
  }

  if (na.length >= 3 && nb.length >= 3) {
    if (na.startsWith(nb) || nb.startsWith(na)) return true;
  }

  return false;
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
  try {
    const { name } = await params;

    const urlName = decodeURIComponent(name);
    const routeName = norm(urlName);

    // A Name | B Yearly KM | C Completion % | D Rank | E Weekly Target | F Annual Target | G RunHistory JSON
    // We're setting Strava aside for now; exclusively use Google Sheets as the data source
    const isManual = true; 
    const raw = await getSheet(isManual ? "Leaderboard!A2:Z200" : "API_Leaderboard!A2:H200");
    
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
           rawRow: r,
           runHistory: [],
         };
      }

      let runHistory = [];
      let summaryStats = null;
      try {
        if (r?.[6]) runHistory = JSON.parse(String(r[6]));
      } catch (err) {}
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
        rawRow: r,
        runHistory,
        summaryStats,
      };
    });

    const runner = rows.find((r) => normMatch(r.name, urlName) || normMatch(r.name, routeName));

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
    const isBonusLeader = runner && leader && normMatch(runner.name, leader.name);

    if (!runner) {
      return (
        <div className="min-h-screen bg-neutral-950 text-white p-10 space-y-4">
          <h1 className="text-2xl font-bold">Runner not found</h1>
          <div className="text-neutral-400">
            URL name: <span className="text-white">{urlName}</span>
          </div>
          <div className="text-neutral-400">First 10 names in Leaderboard:</div>
          <ul className="list-disc pl-6 space-y-1 text-neutral-300">
            {rows.slice(0, 10).map((r, i) => (
              <li key={`${r.name}-${i}`}>{r.name || "(blank)"}</li>
            ))}
          </ul>
        </div>
      );
    }

    // ===== CONTRACTS (Accepted) =====
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
      .filter((x) => normMatch(x.runner, runner.name) || normMatch(x.runner, routeName))
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

    const weeklyRaw = await getSheet("API_Weekly!A2:E3307");
    let weekly = (weeklyRaw ?? [])
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
      .filter((w) => normMatch(w.name, runner.name) || normMatch(w.name, routeName))
      .filter((w) => w.weekNum > 0)
      .filter((w) => !isBlankKmCell(w.kmRaw))
      .sort((a, b) => a.weekNum - b.weekNum);

    // Stage 2: Fetch dedicated sheet tab for runner (e.g. "PCD!A1:Z200", "Parikshit!A1:Z200")
    if (weekly.length === 0) {
      const candidateTabNames = [
        runner.name,
        runner.name.toUpperCase(),
        runner.name.toLowerCase(),
        "PCD",
        "Parikshit",
        "Parikshit D",
        urlName,
      ];
      const triedTabs = new Set<string>();

      for (const tabName of candidateTabNames) {
        if (triedTabs.has(tabName.toLowerCase())) continue;
        triedTabs.add(tabName.toLowerCase());

        try {
          const tabData = await getSheet(`${tabName}!A1:Z200`);
          if (tabData && tabData.length > 0) {
            tabData.forEach((row, rowIdx) => {
              if (!row || row.length === 0) return;
              let weekNum = 0;
              let km = 0;
              let kmRaw = "";

              row.forEach((cell, colIdx) => {
                const s = String(cell ?? "").trim();
                const wMatch = s.match(/^w(?:eek)?\s*(\d+)$/i) || (colIdx === 0 ? s.match(/^(\d+)$/) : null);
                if (wMatch && !weekNum) {
                  const val = parseInt(wMatch[1], 10);
                  if (val > 0 && val <= 53) weekNum = val;
                }
                const n = parseFloat(s.replace(/[^0-9.-]/g, ""));
                if (Number.isFinite(n) && n > 0 && n < 500 && !km && colIdx > 0) {
                  km = n;
                  kmRaw = s;
                }
              });

              if (!weekNum) weekNum = rowIdx + 1;

              if (km > 0 && weekNum > 0 && weekNum <= 53) {
                weekly.push({
                  name: runner.name,
                  weekNum,
                  weekStart: `W${weekNum}`,
                  weekEnd: `W${weekNum}`,
                  kmRaw: kmRaw || String(km),
                  km,
                });
              }
            });

            if (weekly.length > 0) {
              weekly.sort((a, b) => a.weekNum - b.weekNum);
              break;
            }
          }
        } catch (e) {
          // ignore tab read error
        }
      }
    }

    // Stage 3: Fallback if API_Weekly and dedicated tab returned no entries (extract weekly columns Q+ / indices 16+ from Leaderboard row)
    if (weekly.length === 0 && runner.rawRow) {
      const r = runner.rawRow;
      for (let colIdx = 16; colIdx < r.length; colIdx++) {
        const valRaw = String(r[colIdx] ?? "").trim();
        if (valRaw && !isBlankKmCell(valRaw)) {
          const km = toNum(valRaw);
          const weekNum = colIdx - 15; // Col Q (index 16) = W1
          weekly.push({
            name: runner.name,
            weekNum,
            weekStart: `W${weekNum}`,
            weekEnd: `W${weekNum}`,
            kmRaw: valRaw,
            km,
          });
        }
      }
    }

    // ===== COMPUTE =====
    const pct = toPercent(runner.completionText);
    runner.completion = pct;

    const level = getMafiaLevel(runner.yearlyKm);
    const tier = getTierProgress(runner.yearlyKm);

    const annualTarget = runner.annualTarget > 0 ? runner.annualTarget : 0;
    const weeklyTarget = runner.weeklyTarget > 0 ? runner.weeklyTarget : 0;

    const minRequired = Math.round(annualTarget * 0.85);
    const kmToSafety = Math.max(0, minRequired - runner.yearlyKm);

    const activeWeeks = weekly.filter((w) => w.km > 0).length;

    const last4Weeks = weekly.slice(-4);
    const avgLast4 = last4Weeks.length
      ? last4Weeks.reduce((s, w) => s + w.km, 0) / last4Weeks.length
      : 0;

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

    let runStreak = 0;
    for (let i = weekly.length - 1; i >= 0; i--) {
      if (weekly[i].km > 0) runStreak++;
      else break;
    }

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

    const N = 6;
    const recentWeeks = weekly.slice(-N);
    const recentWeekKms = recentWeeks.map((w) => w.km).filter((k) => k > 0);

    let medianWeekly = median(recentWeekKms);

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

    const jan1 = new Date(yearNow, 0, 1);
    const diffDays = Math.floor((today.getTime() - jan1.getTime()) / 86400000);
    const weeksElapsed = Math.max(0, Math.floor((diffDays + jan1.getDay()) / 7));

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
          consecutiveZeros = 0;
        }
      }
    }
    const zeroWeeks = zeroWeekCount;

    const safeProps = JSON.parse(JSON.stringify({
      runner,
      level,
      tier,
      isBonusLeader,
      annualTarget,
      weeklyTarget,
      minRequired,
      kmToSafety,
      activeWeeks,
      avgLast4,
      runStreak,
      targetHitRate,
      daysBadge,
      projectedDateFmt: projectedDate ? fmtDate(projectedDate) : annualTarget > 0 ? "—" : "Set annual target",
      projectionNote: projectedDate ? projectionNote : annualTarget > 0 ? "Need more weekly data" : "",
      bestWeek,
      worstWeek,
      acceptedContracts,
      weeklyBars,
      chartData,
      top5Runners,
      summaryStats: runner.summaryStats ?? null,
      zeroWeeks,
      mafiaFine,
      serverTime: today.getTime()
    }));

    return <RunnerProfileClient {...safeProps} />;
  } catch (err: any) {
    console.error("[RunnerPage Error]:", err?.message || String(err));
    return (
      <div className="min-h-screen bg-neutral-950 text-white p-10 space-y-4">
        <h1 className="text-2xl font-bold">Runner Profile Unavailable</h1>
        <p className="text-neutral-400">Please refresh or try again in a few moments.</p>
      </div>
    );
  }
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
