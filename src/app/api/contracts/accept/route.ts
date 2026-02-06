import { NextResponse } from "next/server";
import { appendRow } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const runner = String(body.runner || "").trim();
    const contractId = String(body.contractId || "").trim();
    const title = String(body.title || "").trim();
    const period = String(body.period || "").trim();

    if (!runner || !contractId) {
      return NextResponse.json(
        { ok: false, error: "Missing runner or contractId" },
        { status: 400 }
      );
    }

    await appendRow("API_ContractLog!A:G", [
      new Date().toISOString(),
      runner,
      "ACCEPTED",
      contractId,
      title,
      period,
      "",
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { ok: false, error: "Failed to log contract acceptance" },
      { status: 500 }
    );
  }
}
