import { NextRequest, NextResponse } from "next/server";
import { getSheet, writeSheet } from "@/lib/sheets";

export const dynamic = "force-dynamic";

const RUNNERS_SHEET = "_StravaRunners";

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({}));

    if (body.password !== process.env.MM_PASSWORD) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const runnerName = String(body.runner ?? "").trim();
    if (!runnerName) {
        return NextResponse.json({ ok: false, error: "runner name required" }, { status: 400 });
    }

    try {
        const rows = await getSheet(`${RUNNERS_SHEET}!A2:E200`);
        if (!rows) return NextResponse.json({ ok: false, error: "Sheet empty" });

        const norm = (s: string) => s.trim().toLowerCase();
        const idx = rows.findIndex((r: any[]) => norm(String(r?.[0] ?? "")) === norm(runnerName));

        if (idx < 0) {
            return NextResponse.json({ ok: false, error: `Runner "${runnerName}" not found in _StravaRunners` });
        }

        const rowNum = idx + 2; // 1-indexed, starts at row 2
        // Clear the row by writing empty strings
        await writeSheet(`${RUNNERS_SHEET}!A${rowNum}:E${rowNum}`, [["", "", "", "", ""]]);

        console.log(`[remove-runner] Cleared ${runnerName} from row ${rowNum}`);
        return NextResponse.json({ ok: true, message: `Token for "${runnerName}" cleared. They can now re-authorize.` });
    } catch (err: any) {
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}
