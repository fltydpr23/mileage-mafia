import { NextRequest, NextResponse } from "next/server";
import { saveToken } from "@/lib/strava";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error || !code) {
        return NextResponse.redirect(
            new URL(
                `/admin/strava?error=${encodeURIComponent(error ?? "missing_code")}`,
                req.url
            )
        );
    }

    try {
        const res = await fetch("https://www.strava.com/oauth/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                client_id: process.env.STRAVA_CLIENT_ID,
                client_secret: process.env.STRAVA_CLIENT_SECRET,
                code,
                grant_type: "authorization_code",
            }),
        });

        const data = await res.json();

        if (!data.access_token) {
            throw new Error(data.message ?? "Token exchange failed");
        }

        await saveToken({
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: data.expires_at,
            lastSync: "",
        });

        return NextResponse.redirect(new URL("/admin/strava?connected=1", req.url));
    } catch (err: any) {
        return NextResponse.redirect(
            new URL(
                `/admin/strava?error=${encodeURIComponent(err.message ?? "unknown")}`,
                req.url
            )
        );
    }
}
