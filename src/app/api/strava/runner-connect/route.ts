import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const runnerName = searchParams.get("runner");

    if (!runnerName) {
        return NextResponse.json({ error: "Missing runner name" }, { status: 400 });
    }

    const clientId = process.env.STRAVA_CLIENT_ID;
    
    // Dynamically detect origin to construct redirect URI
    const origin = new URL(req.url).origin;
    const redirectUri = `${origin}/api/strava/runner-callback`;

    if (!clientId) {
        return NextResponse.json({ error: "Missing STRAVA_CLIENT_ID env var" }, { status: 500 });
    }
    if (!redirectUri) {
        return NextResponse.json({ error: "Could not determine redirect URI" }, { status: 500 });
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
