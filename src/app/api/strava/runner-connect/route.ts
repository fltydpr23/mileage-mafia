import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const runnerName = searchParams.get("runner");

    if (!runnerName) {
        return NextResponse.json({ error: "Missing runner name" }, { status: 400 });
    }

    const clientId = process.env.STRAVA_CLIENT_ID;
    const redirectUri = process.env.STRAVA_REDIRECT_URI?.replace(
        "/api/strava/callback",
        "/api/strava/runner-callback"
    );

    if (!clientId || !redirectUri) {
        return NextResponse.json({ error: "Missing Strava env vars" }, { status: 500 });
    }

    const returnTo = searchParams.get("returnTo") || "join";
    const stateObj = JSON.stringify({ runner: runnerName, returnTo });

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        approval_prompt: "force",
        scope: "activity:read_all,read",
        state: stateObj,
    });

    return NextResponse.redirect(
        `https://www.strava.com/oauth/authorize?${params.toString()}`
    );
}
