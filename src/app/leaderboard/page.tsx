import { getSheet } from "@/lib/sheets";
import LeaderboardWrapper from "@/components/LeaderboardWrapper";

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
    pcd: ["pcd", "parikshit", "parikshit d", "p.c.d.", "p.c.d", "p c d", "parikshit choudhary", "pari"],
    boba: ["boba", "boba fett"],
    raja: ["raja", "rajasharavana"],
    sd: ["sd", "shreyas", "shreyas d"],
    loaf: ["loaf", "loafcat"],
  };
  for (const list of Object.values(ALIASES)) {
    const nList = list.map(norm);
    if (nList.includes(na) && nList.includes(nb)) return true;
  }
  if (na.length >= 3 && nb.length >= 3) {
    if (na.startsWith(nb) || nb.startsWith(na)) return true;
  }
  return false;
}

export default async function LeaderboardPage() {
  try {
    // We're setting Strava aside for now; exclusively use Google Sheets as the data source
    const isManual = true; 
    console.log(`[LeaderboardPage] STATS_SOURCE is forced to MANUAL, isManual: ${isManual}`);
    
    // Fetch both Leaderboard and API_Weekly concurrently for maximum efficiency
    const [raw, weeklyRaw] = await Promise.all([
      getSheet(isManual ? "Leaderboard!A2:ZZ200" : "API_Leaderboard!A2:H200"),
      getSheet("API_Weekly!A2:E4000") // Safely covers ~80 weeks for 50 runners
    ]);
    console.log(`[LeaderboardPage] Raw rows count: ${raw?.length || 0}`);

    // Pre-process weekly data into an array grouped by runner name
    const allWeeklyLogs: { name: string; weekNum: number; km: number }[] = [];
    let globalMaxWeek = 0;

    if (isManual && weeklyRaw) {
      for (const row of weeklyRaw) {
        const name = String(row[0] ?? "").trim();
        const weekNum = toNum(row[1]);
        const km = toNum(row[4]);

        if (name && weekNum > 0 && km > 0) {
          allWeeklyLogs.push({ name, weekNum, km });
          if (weekNum > globalMaxWeek) {
            globalMaxWeek = weekNum;
          }
        }
      }
    }

    const rows = (raw ?? [])
      .map((r) => {
        let runHistory = [];
        try {
          if (!isManual && r?.[6]) runHistory = JSON.parse(String(r[6]));
        } catch (e) {}

        let summaryStats = null;
        try {
          if (!isManual && r?.[7]) summaryStats = JSON.parse(String(r[7]));
        } catch {}

        if (isManual) {
          const bonus = toNum(r?.[13]);
          const nameStr = String(r?.[8] ?? "").trim();
          const isRaja = nameStr.toLowerCase() === "raja";
          const mafiaFine = isRaja ? 0 : Math.abs(toNum(r?.[14]));
          const zeroWeeks = toNum(r?.[15]);

          // Retrieve all weekly logs matching this runner's name
          const runnerWeeklyLogs = allWeeklyLogs
            .filter((log) => normMatch(log.name, nameStr))
            .sort((a, b) => a.weekNum - b.weekNum);

          // Construct a continuous weekly array up to globalMaxWeek
          const weeklyKms: number[] = new Array(globalMaxWeek).fill(0);
          for (const log of runnerWeeklyLogs) {
            if (log.weekNum <= globalMaxWeek) {
              weeklyKms[log.weekNum - 1] = log.km;
            }
          }
          
          const activeKms = weeklyKms.filter(k => k > 0);
          const bestWeek = activeKms.length > 0 ? Math.max(...activeKms) : 0;
          const activeWeeksCount = activeKms.length;
          const totalKmComputed = weeklyKms.reduce((a, b) => a + b, 0);
          
          // Prefer explicitly defined yearlyKm from sheet, but fallback if missing
          const yearlyKm = toNum(r?.[10]) || totalKmComputed;
          
          const avgWeek = activeWeeksCount > 0 ? (yearlyKm / activeWeeksCount) : 0;
          const proj = avgWeek * 52;
          
          // Get the most recent 5 calendar weeks
          const form = weeklyKms.slice(-5);

          return {
            name: nameStr,
            yearlyKm,
            completion: toPercent(r?.[11]),
            rank: toNum(r?.[7]),
            weeklyTarget: toNum(r?.[12]),
            annualTarget: toNum(r?.[9]),
            bonus,
            zeroWeeks,
            mafiaFine,
            bestWeek,
            avgWeek,
            activeWeeksCount,
            proj,
            form,
            runHistory: [],
            summaryStats: null,
          };
        }

        return {
          name: String(r?.[0] ?? "").trim(),
          yearlyKm: toNum(r?.[1]),
          completion: toPercent(r?.[2]),
          rank: toNum(r?.[3]),
          weeklyTarget: toNum(r?.[4]),
          annualTarget: toNum(r?.[5]),
          zeroWeeks: 0,
          mafiaFine: 0,
          runHistory: runHistory,
          summaryStats,
        };
      })
      .filter((r) => r.name.length > 0);

    const sorted = [...rows].sort((a, b) => b.completion - a.completion);
    
    // Force sequential ranking based purely on completion percentage
    sorted.forEach((r, i) => {
      r.rank = i + 1;
    });

    const totalRunners = rows.length;

    const oathPot = totalRunners * 1000;
    const briberyPenalties = 1000; // Kumaran (500) + Rishi (500)
    const zeroKmFinesTotal = rows.reduce((s, r) => s + (r.mafiaFine || 0), 0);
    const penaltyFund = briberyPenalties + zeroKmFinesTotal;
    const totalPot = oathPot + penaltyFund;

    const totalKm = rows.reduce((s, r) => s + r.yearlyKm, 0);
    const totalTargetKm = rows.reduce((s, r) => s + r.annualTarget, 0);

    const safeSorted = JSON.parse(JSON.stringify(sorted));
    const safeGlobalStats = JSON.parse(JSON.stringify({
      totalRunners,
      totalKm,
      totalTargetKm,
      totalPot,
      oathPot,
      penaltyFund,
      zeroKmFinesTotal,
      isManual: true
    }));

    return (
      <LeaderboardWrapper
        runners={safeSorted}
        globalStats={safeGlobalStats}
      />
    );
  } catch (err: any) {
    console.error("[LeaderboardPage Error]:", err?.message || String(err));
    return (
      <LeaderboardWrapper
        runners={[]}
        globalStats={{
          totalRunners: 0,
          totalKm: 0,
          totalTargetKm: 0,
          totalPot: 0,
          oathPot: 0,
          penaltyFund: 0,
          isManual: true
        }}
      />
    );
  }
}
