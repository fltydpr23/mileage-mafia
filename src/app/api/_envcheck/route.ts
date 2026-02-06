import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    hasSheetsId: Boolean(process.env.GOOGLE_SHEETS_ID),
    sheetsIdPreview: process.env.GOOGLE_SHEETS_ID?.slice(0, 6) ?? null,
    nodeEnv: process.env.NODE_ENV ?? null,
  });
}
