import { NextResponse } from "next/server";
import { getSheet } from "@/lib/sheets";
export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const raw = await getSheet("API_Leaderboard!A2:G200");
        const rows = (raw ?? []).map((r: any[]) => ({
            name: String(r?.[0] ?? ""),
            km: r?.[1],
            hasG: !!r?.[6],
            gPreview: String(r?.[6] || "").slice(0, 100)
        }));

        const runnersRaw = await getSheet("_StravaRunners!A2:E200");
        const tokens = (runnersRaw ?? []).map((r: any[]) => ({
            name: String(r?.[0] ?? "")
        }));

        return NextResponse.json({ rows, tokens });
    } catch (err: any) {
        return NextResponse.json({ error: err.message });
    }
}
