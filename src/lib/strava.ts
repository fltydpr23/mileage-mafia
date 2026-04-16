import { getSheet, writeSheet } from "./sheets";

const TOKEN_RANGE = "_StravaTokens!A2:D2";
const HEADER_RANGE = "_StravaTokens!A1:D1";

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

export interface StravaToken {
    accessToken: string;
    refreshToken: string;
    expiresAt: number; // unix seconds
    lastSync: string;
}

async function ensureHeaderRow() {
    try {
        await writeSheet(HEADER_RANGE, [
            ["access_token", "refresh_token", "expires_at", "last_sync"],
        ]);
    } catch {
        // Sheet may not exist yet — caller will handle
    }
}

export async function readStoredToken(): Promise<StravaToken | null> {
    try {
        await ensureHeaderRow();
        const rows = await getSheet(TOKEN_RANGE);
        if (!rows || !rows[0] || !rows[0][0]) return null;
        const [accessToken, refreshToken, expiresAt, lastSync] = rows[0];
        return {
            accessToken: String(accessToken ?? ""),
            refreshToken: String(refreshToken ?? ""),
            expiresAt: parseInt(String(expiresAt ?? "0")),
            lastSync: String(lastSync ?? ""),
        };
    } catch {
        return null;
    }
}

export async function saveToken(token: StravaToken) {
    await ensureHeaderRow();
    await writeSheet(TOKEN_RANGE, [
        [token.accessToken, token.refreshToken, token.expiresAt, token.lastSync],
    ]);
}

/** Returns a valid access token, refreshing if needed. */
export async function getValidToken(): Promise<string> {
    const stored = await readStoredToken();
    if (!stored) throw new Error("Strava not connected");

    // 5 minute buffer before expiry
    if (Date.now() < stored.expiresAt * 1000 - 5 * 60 * 1000) {
        return stored.accessToken;
    }

    // Refresh
    const res = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            client_id: process.env.STRAVA_CLIENT_ID,
            client_secret: process.env.STRAVA_CLIENT_SECRET,
            refresh_token: stored.refreshToken,
            grant_type: "refresh_token",
        }),
    });
    const data = await res.json();
    if (!data.access_token) throw new Error("Token refresh failed");

    const updated: StravaToken = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at,
        lastSync: stored.lastSync,
    };
    await saveToken(updated);
    return updated.accessToken;
}

// ---------------------------------------------------------------------------
// Club activities
// ---------------------------------------------------------------------------

export interface StravaActivity {
    athlete: { firstname: string; lastname: string };
    distance: number; // metres
    start_date?: string; // omitted in club activities endpoint
    type?: string;
    sport_type?: string;
}

/** Fetch all club activities for the current year from Strava. Paginates automatically. */
export async function fetchClubActivitiesThisYear(
    clubId: string,
    accessToken: string
): Promise<StravaActivity[]> {
    // NOTE: The club activities endpoint does NOT return start_date,
    // so we fetch all recent pages. Strava returns most recent first.
    const allActivities: StravaActivity[] = [];
    let page = 1;

    while (true) {
        const url = `https://www.strava.com/api/v3/clubs/${clubId}/activities?per_page=200&page=${page}`;
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Strava API error ${res.status}: ${err}`);
        }

        const page_activities: StravaActivity[] = await res.json();
        if (!Array.isArray(page_activities) || page_activities.length === 0) break;

        allActivities.push(...page_activities);

        // Stop if we got a partial page
        if (page_activities.length < 200) break;
        page++;
    }

    return allActivities;
}

// ---------------------------------------------------------------------------
// Name mapping
// ---------------------------------------------------------------------------

/**
 * Returns the parsed STRAVA_NAME_MAP from env.
 * Format: { "Strava Full Name": "Sheet Runner Name" }
 */
export function getNameMap(): Record<string, string> {
    try {
        const raw = process.env.STRAVA_NAME_MAP ?? "{}";
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

/**
 * Aggregates total km (running activities only) per Strava athlete.
 * Key = "Firstname L." because Strava truncates last names for privacy
 * in the club activities endpoint (e.g. "Adhityan R." not "Adhityan Rajendran").
 */
export function aggregateKmByAthlete(
    activities: StravaActivity[]
): Record<string, number> {
    const km: Record<string, number> = {};
    for (const a of activities) {
        const sportType = a.sport_type ?? a.type ?? "";
        if (![
            "Run", "Trail Run", "VirtualRun", "TrailRun",
        ].includes(sportType)) continue;

        // Build "Firstname L." key to match Strava's privacy-truncated last names
        const first = (a.athlete.firstname ?? "").trim();
        const lastRaw = (a.athlete.lastname ?? "").trim().replace(/\.$/g, "");
        const lastInitial = lastRaw.charAt(0).toUpperCase();
        const key = lastInitial ? `${first} ${lastInitial}.` : first;
        km[key] = (km[key] ?? 0) + a.distance / 1000;
    }
    return km;
}
