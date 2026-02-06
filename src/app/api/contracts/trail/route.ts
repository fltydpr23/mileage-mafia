import { NextResponse } from "next/server";
import { getSheet } from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toStr(v: any) {
  return String(v ?? "").trim();
}

function norm(s: string) {
  return s.trim().toLowerCase();
}

function parseTs(ts: string): number {
  const t = Date.parse(ts);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Sheet: API_ContractLog
 * Columns A:G:
 * A ts | B runner | C action | D contractId | E title | F period | G meta
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const runner = toStr(searchParams.get("runner"));
    const limitRaw = toStr(searchParams.get("limit"));
    const limit = Math.min(Math.max(parseInt(limitRaw || "50", 10) || 50, 1), 200);

    const raw = await getSheet("API_ContractLog!A2:G5000");

    const rows = (Array.isArray(raw) ? raw : [])
      .map((r: any[]) => {
        const row = {
          ts: toStr(r?.[0]),
          runner: toStr(r?.[1]),
          action: toStr(r?.[2]),
          contractId: toStr(r?.[3]),
          title: toStr(r?.[4]),
          period: toStr(r?.[5]),
          meta: toStr(r?.[6]),
        };

        return row;
      })
      // drop empty garbage rows (common from Sheets ranges)
      .filter((x) => x.ts || x.runner || x.contractId || x.title);

    const filtered = runner
      ? rows.filter((x) => norm(x.runner) === norm(runner))
      : rows;

    // newest first (prefer timestamp sort; fallback keeps stable order)
    filtered.sort((a, b) => {
      const ta = parseTs(a.ts);
      const tb = parseTs(b.ts);
      if (ta && tb) return tb - ta;
      if (ta && !tb) return -1;
      if (!ta && tb) return 1;
      return 0;
    });

    return NextResponse.json(
      { ok: true, trail: filtered.slice(0, limit) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Failed to load trail" },
      { status: 500 }
    );
  }
}
