import { NextResponse } from "next/server";
import { appendRow } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LogBody = {
  runner?: unknown;
  action?: unknown;
  contractId?: unknown;
  title?: unknown;
  period?: unknown;
  meta?: unknown;
};

function nowISO() {
  return new Date().toISOString();
}

function clean(v: unknown) {
  return String(v ?? "").trim();
}

function safeMeta(v: unknown) {
  try {
    if (v === undefined || v === null || v === "") return "";
    if (typeof v === "string") return v;
    return JSON.stringify(v);
  } catch {
    return "";
  }
}

export async function POST(req: Request) {
  try {
    let body: LogBody;
    try {
      body = (await req.json()) as LogBody;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON body" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const ts = nowISO();
    const runner = clean(body.runner);
    const action = clean(body.action).toUpperCase();
    const contractId = clean(body.contractId);
    const title = clean(body.title);
    const period = clean(body.period);
    const meta = safeMeta(body.meta);

    if (!runner || !action || !contractId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing required fields",
          required: ["runner", "action", "contractId"],
          received: {
            runner: !!runner,
            action: !!action,
            contractId: !!contractId,
          },
        },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const allowedActions = new Set(["ACCEPTED", "COMPLETED", "FAILED"]);
    if (!allowedActions.has(action)) {
      return NextResponse.json(
        { ok: false, error: `Invalid action: ${action}` },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Write to sheet: A ts | B runner | C action | D contractId | E title | F period | G meta
    await appendRow("API_ContractLog!A:G", [
      ts,
      runner,
      action,
      contractId,
      title,
      period,
      meta,
    ]);

    // Return the exact row we wrote (super useful for UI + debugging)
    return NextResponse.json(
      {
        ok: true,
        row: { ts, runner, action, contractId, title, period, meta },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Failed to append log";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
