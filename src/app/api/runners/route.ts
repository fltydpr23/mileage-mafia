import { NextResponse } from "next/server";
import { getSheet } from "@/lib/sheets";

function normName(v: any) {
  return String(v ?? "").trim();
}

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const isManual = process.env.STATS_SOURCE === "MANUAL";
    const raw = await getSheet(isManual ? "Leaderboard!A2:M200" : "API_Leaderboard!A2:A200");
    const nameIdx = isManual ? 8 : 0;
    
    const names = (raw ?? [])
      .map((r) => normName(r?.[nameIdx]))
      .filter((n) => n.length > 0);

    // de-dupe
    const seen = new Set<string>();
    const runners = names.filter((n) => (seen.has(n) ? false : (seen.add(n), true))).map((name) => ({ name }));

    return NextResponse.json({ ok: true, runners });
  } catch (e: any) {
    return NextResponse.json({ ok: false, runners: [], error: "Failed to load runners" }, { status: 500 });
  }
}
