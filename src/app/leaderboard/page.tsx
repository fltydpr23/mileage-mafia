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
  const isManual = process.env.STATS_SOURCE === "MANUAL";
  console.log(`[LeaderboardPage] STATS_SOURCE: ${process.env.STATS_SOURCE}, isManual: ${isManual}`);
  
  const raw = await getSheet(isManual ? "Leaderboard!A2:M200" : "API_Leaderboard!A2:H200");
  console.log(`[LeaderboardPage] Raw rows count: ${raw?.length || 0}`);
  if (raw && raw.length > 0) {
    console.log(`[LeaderboardPage] First row sample:`, JSON.stringify(raw[0]));
  }

  const rows = (raw ?? [])
    .map((r) => {
      let runHistory = [];
      try {
        // Run history is only available in Column G (original table)
        if (!isManual && r?.[6]) runHistory = JSON.parse(String(r[6]));
      } catch (e) {
        // ignore parse errors
      }

      let summaryStats = null;
      try {
        if (!isManual && r?.[7]) summaryStats = JSON.parse(String(r[7]));
      } catch {}

      if (isManual) {
        return {
          name: String(r?.[8] ?? "").trim(),
          yearlyKm: toNum(r?.[10]),
          completion: toPercent(r?.[11]),
          rank: toNum(r?.[7]),
          weeklyTarget: toNum(r?.[12]),
          annualTarget: toNum(r?.[9]),
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
  const PENALTIES = [
    { name: "Kumar", amount: 500, reason: "Bribery", date: "2 Feb 2026" },
    { name: "Rishi", amount: 500, reason: "Bribery", date: "2 Feb 2026" }
  ] as const;
  const penaltyFund = PENALTIES.reduce((s, p) => s + p.amount, 0);
  const totalPot = oathPot + penaltyFund;

  const totalKm = rows.reduce((s, r) => s + r.yearlyKm, 0);
  const totalTargetKm = rows.reduce((s, r) => s + r.annualTarget, 0);

  return (
    <LeaderboardWrapper
      runners={sorted}
      globalStats={{
        totalRunners,
        totalKm,
        totalTargetKm,
        totalPot,
        oathPot,
        penaltyFund,
        isManual: process.env.STATS_SOURCE === "MANUAL"
      }}
    />
  );
}
