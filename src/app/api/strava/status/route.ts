import { NextResponse } from "next/server";
import { readStoredToken } from "@/lib/strava";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const token = await readStoredToken();

        if (!token || !token.accessToken) {
            return NextResponse.json({ connected: false, lastSync: null, tokenExpiry: null });
        }

        const now = Date.now();
        const expiryMs = token.expiresAt * 1000;
        const isExpired = now >= expiryMs - 5 * 60 * 1000;

        return NextResponse.json({
            connected: true,
            tokenExpiry: new Date(expiryMs).toISOString(),
            tokenValid: !isExpired,
            lastSync: token.lastSync || null,
        });
    } catch (err: any) {
        return NextResponse.json({ connected: false, error: err.message });
    }
}
