import { NextRequest, NextResponse } from "next/server";
import { getSheet, writeSheet, appendRow } from "@/lib/sheets";

export const dynamic = "force-dynamic";

const RUNNERS_SHEET = "_StravaRunners";
const HEADER_RANGE = `${RUNNERS_SHEET}!A1:E1`;

async function ensureRunnersHeader() {
    try {
        await writeSheet(HEADER_RANGE, [
            ["runner_name", "access_token", "refresh_token", "expires_at", "connected_at"],
        ]);
    } catch {
        // Sheet may not exist yet
    }
}

async function findRunnerRow(runnerName: string): Promise<number | null> {
    const rows = await getSheet(`${RUNNERS_SHEET}!A2:A200`);
    if (!rows) return null;
    const idx = rows.findIndex(
        (r) => String(r?.[0] ?? "").trim().toLowerCase() === runnerName.trim().toLowerCase()
    );
    return idx >= 0 ? idx + 2 : null; // +2: 1-based + header row
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const stateParam = searchParams.get("state");
    const error = searchParams.get("error");

    let parsedState: { runner?: string; returnTo?: string } = {};
    try {
        parsedState = JSON.parse(stateParam ?? "{}");
    } catch {
        // Fallback for old simple string state
        parsedState = { runner: stateParam || undefined, returnTo: "join" };
    }

    const runnerName = parsedState.runner;
    const returnTo = parsedState.returnTo;

    if (error || !code || !runnerName) {
        const fallbackPath = returnTo === "initiation" ? "/initiation?step=2" : "/";
        return NextResponse.redirect(
            new URL(
                `${fallbackPath}?error=${encodeURIComponent(error ?? "missing_params")}`,
                req.url
            )
        );
    }

    try {
        // Exchange code for tokens
        const redirectUri = process.env.STRAVA_REDIRECT_URI?.replace(
            "/api/strava/callback",
            "/api/strava/runner-callback"
        );

        const res = await fetch("https://www.strava.com/oauth/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                client_id: process.env.STRAVA_CLIENT_ID,
                client_secret: process.env.STRAVA_CLIENT_SECRET,
                code,
                grant_type: "authorization_code",
                redirect_uri: redirectUri,
            }),
        });

        const data = await res.json();
        if (!data.access_token) throw new Error(data.message ?? "Token exchange failed");

        await ensureRunnersHeader();

        const connectedAt = new Date().toISOString();
        const rowData = [
            runnerName,
            data.access_token,
            data.refresh_token,
            data.expires_at,
            connectedAt,
        ];

        // Update existing row if this runner already connected, otherwise append
        const existingRow = await findRunnerRow(runnerName);
        if (existingRow) {
            await writeSheet(`${RUNNERS_SHEET}!A${existingRow}:E${existingRow}`, [rowData]);
        } else {
            await appendRow(`${RUNNERS_SHEET}!A:E`, rowData);
        }

        const successPath = returnTo === "initiation" ? "/initiation?step=3" : "/";
        const separator = successPath.includes("?") ? "&" : "?";
        return NextResponse.redirect(
            new URL(
                `${successPath}${separator}success=1&runner=${encodeURIComponent(runnerName)}`,
                req.url
            )
        );
    } catch (err: any) {
        const fallbackPath = returnTo === "initiation" ? "/initiation?step=2" : "/";
        return NextResponse.redirect(
            new URL(
                `${fallbackPath}?error=${encodeURIComponent(err.message ?? "unknown")}`,
                req.url
            )
        );
    }
}
