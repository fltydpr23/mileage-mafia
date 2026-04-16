import { NextRequest, NextResponse } from "next/server";
import {
    getValidToken,
    fetchClubActivitiesThisYear,
    aggregateKmByAthlete,
    getNameMap,
    saveToken,
    readStoredToken,
} from "@/lib/strava";
import { getSheet, writeSheet } from "@/lib/sheets";

export const dynamic = "force-dynamic";

const RUNNERS_SHEET = "_StravaRunners";
const YEAR_START_UNIX = Math.floor(new Date(`${new Date().getFullYear()}-01-01T00:00:00Z`).getTime() / 1000);

// ── Per-runner token helpers ────────────────────────────────────────────────

interface RunnerToken {
    runnerName: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
}

async function getRefreshedRunnerToken(rt: RunnerToken): Promise<RunnerToken> {
    if (Date.now() < rt.expiresAt * 1000 - 5 * 60 * 1000) return rt;

    const res = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            client_id: process.env.STRAVA_CLIENT_ID,
            client_secret: process.env.STRAVA_CLIENT_SECRET,
            refresh_token: rt.refreshToken,
            grant_type: "refresh_token",
        }),
    });
    const data = await res.json();
    if (!data.access_token) throw new Error(`Token refresh failed for ${rt.runnerName}`);

    const updated = { ...rt, accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: data.expires_at };

    // Persist refreshed token back to sheet
    const rows = await getSheet(`${RUNNERS_SHEET}!A2:E200`);
    const idx = (rows ?? []).findIndex((r: any[]) =>
        String(r?.[0] ?? "").trim().toLowerCase() === rt.runnerName.toLowerCase()
    );
    if (idx >= 0) {
        const rowNum = idx + 2;
        await writeSheet(`${RUNNERS_SHEET}!A${rowNum}:E${rowNum}`, [
            [updated.runnerName, updated.accessToken, updated.refreshToken, updated.expiresAt, ""],
        ]);
    }

    return updated;
}

async function loadRunnerTokens(): Promise<RunnerToken[]> {
    try {
        const rows = await getSheet(`${RUNNERS_SHEET}!A2:E200`);
        if (!rows) return [];
        return rows
            .filter((r: any[]) => r?.[0] && r?.[1])
            .map((r: any[]) => ({
                runnerName: String(r[0] ?? "").trim(),
                accessToken: String(r[1] ?? "").trim(),
                refreshToken: String(r[2] ?? "").trim(),
                expiresAt: parseInt(String(r[3] ?? "0")),
            }));
    } catch {
        return [];
    }
}

/** Fetch all of a runner's own activities for this year. Returns totalKm, full run history, and a rich computed summary. */
async function fetchRunnerStatsThisYear(token: string): Promise<{ totalKm: number; runs: string; summaryJSON: string }> {
    let totalKm = 0;
    let totalElevation = 0;
    const runs: any[] = [];
    let page = 1;

    console.log(`[Strava] Starting fetchRunnerStatsThisYear...`);

    while (true) {
        console.log(`[Strava] Fetching page ${page}...`);
        const url = `https://www.strava.com/api/v3/athlete/activities?after=${YEAR_START_UNIX}&per_page=200&page=${page}`;
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
            console.log(`[Strava] Response not OK: ${res.status}`);
            break;
        }

        const acts: any[] = await res.json();
        console.log(`[Strava] Page ${page} returned ${acts?.length || 0} activities`);
        if (!Array.isArray(acts) || acts.length === 0) break;

        for (const a of acts) {
            const type = a.sport_type ?? a.type ?? "";
            if (["Run", "Trail Run", "VirtualRun", "TrailRun"].includes(type)) {
                const distKm = (a.distance ?? 0) / 1000;
                const movingTimeSec = a.moving_time ?? 0;
                const elevGain = a.total_elevation_gain ?? 0;
                const startDate = (a.start_date_local || a.start_date || "");
                const startHour = startDate ? parseInt(startDate.split("T")[1]?.split(":")[0] ?? "12") : 12;
                const paceMinKm = distKm > 0 ? movingTimeSec / 60 / distKm : 0;

                totalKm += distKm;
                totalElevation += elevGain;

                runs.push({
                    date: startDate.split("T")[0],
                    distance: parseFloat(distKm.toFixed(2)),
                    time: parseFloat((movingTimeSec / 60).toFixed(1)),
                    avgHr: Math.round(a.average_heartrate ?? 0),
                    maxHr: Math.round(a.max_heartrate ?? 0),
                    pace: parseFloat(paceMinKm.toFixed(2)),
                    elev: Math.round(elevGain),
                    avgCadence: Math.round((a.average_cadence ?? 0) * 2), // Strava stores spm/2
                    startHour,
                    type,
                });
            }
        }

        if (acts.length < 200) {
            console.log(`[Strava] Reached end of activities (less than 200)`);
            break;
        }
        page++;
    }

    // ─── Compute summary stats ───────────────────────────────────────────────
    const hrRuns = runs.filter(r => r.avgHr > 0);
    const avgHrAll  = hrRuns.length ? Math.round(hrRuns.reduce((s, r) => s + r.avgHr, 0) / hrRuns.length) : 0;
    const maxHrEver = runs.reduce((mx, r) => Math.max(mx, r.maxHr), 0);

    const longestRun = runs.reduce((best, r) => r.distance > (best?.distance ?? 0) ? r : best, null as any);
    const fastestPaceRun = runs.filter(r => r.distance >= 1).reduce(
        (best, r) => (r.pace < (best?.pace ?? 999) && r.pace > 0) ? r : best, null as any
    );

    // Cardiac efficiency: avg km per heartbeat across all HR runs
    const cardiacEfficiency = hrRuns.length
        ? parseFloat((hrRuns.reduce((s, r) => s + r.distance / r.avgHr, 0) / hrRuns.length).toFixed(4))
        : 0;

    // Zone 2 ratio (avg HR < 75% of highest recorded max HR)
    const estimatedMaxHr   = maxHrEver > 0 ? maxHrEver : 185;
    const zone2Threshold   = estimatedMaxHr * 0.75;
    const zone2Ratio       = hrRuns.length
        ? Math.round((hrRuns.filter(r => r.avgHr < zone2Threshold).length / hrRuns.length) * 100)
        : 0;

    // Longest consecutive running streak (days)
    const runDates = [...new Set(runs.map(r => r.date))].sort();
    let maxStreak = 0, curStreak = 1;
    for (let i = 1; i < runDates.length; i++) {
        const diff = (new Date(runDates[i]).getTime() - new Date(runDates[i - 1]).getTime()) / 86400000;
        if (diff === 1) { curStreak++; maxStreak = Math.max(maxStreak, curStreak); }
        else curStreak = 1;
    }
    const longestStreak = runDates.length ? Math.max(maxStreak, curStreak) : 0;

    // Behavioural signals
    const earlyBirdRuns = runs.filter(r => r.startHour < 7).length;
    const nightOwlRuns  = runs.filter(r => r.startHour >= 20).length;

    // Consistency: active weeks / elapsed weeks
    const weekSet = new Set(runs.map(r => {
        const d = new Date(r.date);
        const jan1 = new Date(d.getFullYear(), 0, 1);
        return Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
    }));
    const weeksElapsed = Math.max(1, Math.ceil((Date.now() - new Date(`${new Date().getFullYear()}-01-01`).getTime()) / (7 * 86400000)));
    const consistencyScore = Math.round((weekSet.size / weeksElapsed) * 100);

    const cadenceRuns = runs.filter(r => r.avgCadence > 0);
    const avgCadence  = cadenceRuns.length
        ? Math.round(cadenceRuns.reduce((s, r) => s + r.avgCadence, 0) / cadenceRuns.length)
        : 0;

    const summary = {
        totalRuns: runs.length,
        totalElevation: Math.round(totalElevation),
        avgHr: avgHrAll,
        maxHrEver,
        cardiacEfficiency,
        zone2Ratio,
        longestRunKm: longestRun ? parseFloat(longestRun.distance.toFixed(2)) : 0,
        longestRunDate: longestRun?.date ?? "",
        bestPace: fastestPaceRun ? parseFloat(fastestPaceRun.pace.toFixed(2)) : 0,
        bestPaceDate: fastestPaceRun?.date ?? "",
        longestStreak,
        earlyBirdRuns,
        nightOwlRuns,
        consistencyScore,
        avgCadence,
    };

    console.log(`[Strava] Done. Total KM: ${totalKm.toFixed(1)}, Runs: ${runs.length}, AvgHR: ${avgHrAll}`);
    return { totalKm, runs: JSON.stringify(runs), summaryJSON: JSON.stringify(summary) };
}

// ── Main sync handler ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({}));
    if (body.password !== process.env.MM_PASSWORD) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
        const clubId = process.env.STRAVA_CLUB_ID;
        if (!clubId) throw new Error("Missing STRAVA_CLUB_ID env var");

        // 1. Load per-runner tokens and refresh if needed
        const rawRunnerTokens = await loadRunnerTokens();
        const runnerTokens: RunnerToken[] = [];
        for (const rt of rawRunnerTokens) {
            try {
                runnerTokens.push(await getRefreshedRunnerToken(rt));
            } catch {
                runnerTokens.push(rt); // keep stale token, will show as failed
            }
        }

        const connectedRunners = new Set(runnerTokens.map((r) => r.runnerName.toLowerCase()));

        // 2. Read the leaderboard sheet
        const leaderboardRaw = await getSheet("API_Leaderboard!A2:B200");
        const rows = (leaderboardRaw ?? []).map((r: any[]) => ({
            name: String(r?.[0] ?? "").trim(),
            km: String(r?.[1] ?? "").trim(),
        }));

        const norm = (s: string) => s.trim().toLowerCase();
        const sheetNameToRow: Record<string, number> = {};
        rows.forEach((r, i) => {
            if (r.name) sheetNameToRow[norm(r.name)] = i + 2;
        });

        // 3. Fetch full-year km and run history for individually connected runners
        console.log(`[Strava Sync] Fetching individual stats for ${runnerTokens.length} runners...`);
        const individualResults: { sheetName: string; km: number; runsJSON: string; summaryJSON?: string; source: "strava_individual" }[] = [];
        for (const rt of runnerTokens) {
            try {
                console.log(`[Strava Sync] Process individual: ${rt.runnerName}...`);
                const stats = await fetchRunnerStatsThisYear(rt.accessToken);
                const row = sheetNameToRow[norm(rt.runnerName)];
                if (row) {
                    individualResults.push({
                        sheetName: rt.runnerName,
                        km: stats.totalKm,
                        runsJSON: stats.runs,
                        summaryJSON: stats.summaryJSON,
                        source: "strava_individual"
                    });
                }
            } catch (err: any) {
                console.error(`[Strava Sync ERROR] Failed fetching individual for ${rt.runnerName}:`, err.message);
            }
        }

        // 4. For runners not yet individually connected, fall back to club activities
        console.log(`[Strava Sync] Fetching Club Activities fallback...`);
        const adminToken = await getValidToken();
        const clubActivities = await fetchClubActivitiesThisYear(clubId, adminToken);
        const kmByAthlete = aggregateKmByAthlete(clubActivities);
        const nameMap = getNameMap();

        const clubResults: { sheetName: string; stravaName: string; km: number; source: "strava_club" }[] = [];
        const unmatched: { stravaName: string; km: number }[] = [];

        for (const stravaName of Object.keys(kmByAthlete)) {
            const km = kmByAthlete[stravaName];
            const mappedName = nameMap[stravaName];
            const [firstName] = stravaName.split(" ");

            // Resolve sheet name via explicit map or bidirectional fuzzy
            let resolvedSheetName: string | null = null;
            if (mappedName) {
                resolvedSheetName = mappedName;
            } else {
                const fuzzy = rows.find((r) =>
                    norm(r.name).startsWith(norm(firstName)) ||         // "Raja".startsWith("Raja…") ✓
                    norm(firstName).startsWith(norm(r.name.split(" ")[0])) // "Rajasharavana".startsWith("Raja") ✓
                );
                if (fuzzy) resolvedSheetName = fuzzy.name;
            }

            if (!resolvedSheetName) { unmatched.push({ stravaName, km }); continue; }

            // Skip if this runner already has individual data
            if (connectedRunners.has(norm(resolvedSheetName))) continue;

            const row = sheetNameToRow[norm(resolvedSheetName)];
            if (row) {
                clubResults.push({ sheetName: resolvedSheetName, stravaName, km, source: "strava_club" });
            } else {
                unmatched.push({ stravaName, km });
            }
        }

        // 5. Write all results to the sheet (SKIP if manual mode)
        if (process.env.STATS_SOURCE === "MANUAL") {
            console.log(`[Strava Sync] SKIPPING leaderboard write (STATS_SOURCE=MANUAL)`);
        } else {
            console.log(`[Strava Sync] Writing individual results to Sheets...`);
            for (const r of individualResults) {
                const row = sheetNameToRow[norm(r.sheetName)];
                if (row) {
                    console.log(`[Strava Sync] Writing ${r.sheetName} to row ${row}`);
                    await writeSheet(`API_Leaderboard!B${row}`, [[parseFloat(r.km.toFixed(2))]]);
                    await writeSheet(`API_Leaderboard!G${row}`, [[r.runsJSON]]);
                    if ((r as any).summaryJSON) {
                        await writeSheet(`API_Leaderboard!H${row}`, [[(r as any).summaryJSON]]);
                    }
                }
            }

            console.log(`[Strava Sync] Writing club fallback results to Sheets...`);
            for (const r of clubResults) {
                const row = sheetNameToRow[norm(r.sheetName)];
                if (row) await writeSheet(`API_Leaderboard!B${row}`, [[parseFloat(r.km.toFixed(2))]]); // Only update B for club fallback
            }
        }

        // 6. Update last sync timestamp
        console.log(`[Strava Sync] Updating stored token last sync time...`);
        const stored = await readStoredToken();
        if (stored) await saveToken({ ...stored, lastSync: new Date().toISOString() });

        console.log(`[Strava Sync] DONE!`);
        return NextResponse.json({
            ok: true,
            connectedRunners: runnerTokens.map((r) => r.runnerName),
            individual: individualResults.map((r) => ({ ...r, km: parseFloat(r.km.toFixed(2)) })),
            club: clubResults.map((r) => ({ ...r, km: parseFloat(r.km.toFixed(2)) })),
            unmatched,
        });
    } catch (err: any) {
        console.error(`[Strava Sync FATAL]`, err);
        return NextResponse.json({ ok: false, error: err.message ?? "Sync failed" }, { status: 500 });
    }
}
