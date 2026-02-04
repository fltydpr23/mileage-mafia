import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const pw = String(body?.password ?? "");

  const correct = process.env.MM_PASSWORD ?? "";
  console.log("AUTH CHECK:", pw, "vs", correct); // 👈 add this line

  const ok = correct.length > 0 && pw === correct;
  return NextResponse.json({ ok });
}
