import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
    const clientId = process.env.STRAVA_CLIENT_ID;
    const redirectUri = process.env.STRAVA_REDIRECT_URI;

    if (!clientId || !redirectUri) {
        return NextResponse.json(
            { error: "Missing STRAVA_CLIENT_ID or STRAVA_REDIRECT_URI in env" },
            { status: 500 }
        );
    }

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        approval_prompt: "auto",
        scope: "activity:read_all,read",
    });

    const stravaAuthUrl = `https://www.strava.com/oauth/authorize?${params.toString()}`;
    return NextResponse.redirect(stravaAuthUrl);
}
