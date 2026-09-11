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

export default async function LeaderboardPage() {
  try {
    // We're setting Strava aside for now; exclusively use Google Sheets as the data source
    const isManual = true; 
    console.log(`[LeaderboardPage] STATS_SOURCE is forced to MANUAL, isManual: ${isManual}`);
    
    const raw = await getSheet(isManual ? "Leaderboard!A2:Z200" : "API_Leaderboard!A2:H200");
    console.log(`[LeaderboardPage] Raw rows count: ${raw?.length || 0}`);

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

          return {
            name: nameStr,
            yearlyKm: toNum(r?.[10]),
            completion: toPercent(r?.[11]),
            rank: toNum(r?.[7]),
            weeklyTarget: toNum(r?.[12]),
            annualTarget: toNum(r?.[9]),
            bonus,
            zeroWeeks,
            mafiaFine,
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
