"use client";

import { useState, useEffect, useCallback } from "react";

interface StatusData {
    connected: boolean;
    tokenExpiry: string | null;
    tokenValid: boolean;
    lastSync: string | null;
    error?: string;
}

interface SyncResult {
    ok: boolean;
    activitiesFound?: number;
    matched?: { stravaName: string; sheetName: string; km: number }[];
    unmatched?: { stravaName: string; km: number }[];
    allStravaAthletes?: string[];
    error?: string;
}

function fmtDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function StravaAdminPage() {
    const [password, setPassword] = useState("");
    const [authed, setAuthed] = useState(false);
    const [authError, setAuthError] = useState("");

    const [status, setStatus] = useState<StatusData | null>(null);
    const [loadingStatus, setLoadingStatus] = useState(false);

    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

    const fetchStatus = useCallback(async () => {
        setLoadingStatus(true);
        try {
            const res = await fetch("/api/strava/status");
            const data = await res.json();
            setStatus(data);
        } catch {
            setStatus({ connected: false, tokenExpiry: null, tokenValid: false, lastSync: null });
        } finally {
            setLoadingStatus(false);
        }
    }, []);

    useEffect(() => {
        if (!authed) return;

        // Check for OAuth result in URL
        const params = new URLSearchParams(window.location.search);
        if (params.get("connected")) {
            window.history.replaceState({}, "", "/admin/strava");
        }
        if (params.get("error")) {
            setSyncResult({ ok: false, error: decodeURIComponent(params.get("error") ?? "") });
            window.history.replaceState({}, "", "/admin/strava");
        }

        fetchStatus();
    }, [authed, fetchStatus]);

    function handleAuth(e: React.FormEvent) {
        e.preventDefault();
        if (password === "fearnone") {
            setAuthed(true);
            setAuthError("");
        } else {
            setAuthError("Wrong password");
        }
    }

    async function handleSync() {
        setSyncing(true);
        setSyncResult(null);
        try {
            const res = await fetch("/api/strava/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });
            const data = await res.json();
            setSyncResult(data);
            await fetchStatus();
        } catch (err: any) {
            setSyncResult({ ok: false, error: err.message });
        } finally {
            setSyncing(false);
        }
    }

    // ── Password Gate ──────────────────────────────────────────────────────────
    if (!authed) {
        return (
            <div className="min-h-screen bg-neutral-950 flex items-center justify-center font-sans">
                <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-2xl p-8 shadow-2xl">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-8 w-8 rounded-full bg-[#FC4C02] flex items-center justify-center text-white text-xs font-black">S</div>
                        <h1 className="text-white font-black tracking-widest uppercase text-sm">Strava Admin</h1>
                    </div>
                    <form onSubmit={handleAuth} className="space-y-4">
                        <input
                            type="password"
                            autoFocus
                            placeholder="Enter mafia password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-[#FC4C02]"
                        />
                        {authError && <p className="text-red-400 text-xs">{authError}</p>}
                        <button
                            type="submit"
                            className="w-full bg-[#FC4C02] hover:bg-[#e84302] text-white font-black uppercase tracking-widest text-xs py-3 rounded-lg transition-colors"
                        >
                            Unlock
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // ── Admin Dashboard ────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-neutral-950 text-white font-sans p-6 md:p-10">
            <div className="max-w-3xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-[#FC4C02] flex items-center justify-center">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
                            <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-xl font-black tracking-widest uppercase">Strava Integration</h1>
                        <p className="text-neutral-400 text-xs mt-0.5">Club ID: 1952621 · Mileage Mafia</p>
                    </div>
                </div>

                {/* Connection Status Card */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xs font-black uppercase tracking-widest text-neutral-400">Connection Status</h2>
                        <button
                            onClick={fetchStatus}
                            disabled={loadingStatus}
                            className="text-[10px] text-neutral-500 hover:text-white transition-colors uppercase tracking-widest"
                        >
                            {loadingStatus ? "Checking…" : "Refresh"}
                        </button>
                    </div>

                    {status === null ? (
                        <p className="text-neutral-500 text-sm">Loading…</p>
                    ) : status.connected ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                                <span className="text-green-400 font-bold text-sm">Connected to Strava</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mt-4">
                                <div>
                                    <p className="text-neutral-500 text-[10px] uppercase tracking-wider">Token expires</p>
                                    <p className="text-white text-sm font-semibold mt-1">{fmtDate(status.tokenExpiry)}</p>
                                </div>
                                <div>
                                    <p className="text-neutral-500 text-[10px] uppercase tracking-wider">Last sync</p>
                                    <p className="text-white text-sm font-semibold mt-1">{fmtDate(status.lastSync)}</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-red-500" />
                                <span className="text-red-400 font-bold text-sm">Not connected</span>
                            </div>
                            <a
                                href="/api/strava/connect"
                                className="inline-flex items-center gap-2 bg-[#FC4C02] hover:bg-[#e84302] text-white font-black uppercase tracking-widest text-xs px-5 py-3 rounded-lg transition-colors"
                            >
                                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                                </svg>
                                Connect with Strava
                            </a>
                        </div>
                    )}
                </div>

                {/* Sync Card (only show if connected) */}
                {status?.connected && (
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                        <h2 className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-4">Sync Club Data</h2>
                        <p className="text-neutral-400 text-sm mb-4">
                            Fetches all 2026 running activities from your Strava club, totals each runner&apos;s km, and updates the leaderboard in Google Sheets.
                        </p>
                        <button
                            onClick={handleSync}
                            disabled={syncing}
                            className="inline-flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white font-black uppercase tracking-widest text-xs px-5 py-3 rounded-lg transition-colors disabled:opacity-40"
                        >
                            {syncing ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                    </svg>
                                    Syncing…
                                </>
                            ) : (
                                <>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                                        <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Sync Now
                                </>
                            )}
                        </button>

                        {/* Sync Results */}
                        {syncResult && (
                            <div className="mt-6 space-y-4">
                                {syncResult.ok ? (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-green-400" />
                                            <span className="text-green-400 text-sm font-bold">
                                                Sync complete — {syncResult.activitiesFound} activities processed
                                            </span>
                                        </div>

                                        {/* Matched runners */}
                                        {syncResult.matched && syncResult.matched.length > 0 && (
                                            <div>
                                                <p className="text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
                                                    ✅ Updated ({syncResult.matched.length} runners)
                                                </p>
                                                <div className="space-y-1">
                                                    {syncResult.matched.map((m) => (
                                                        <div key={m.stravaName} className="flex justify-between items-center bg-neutral-800 rounded-lg px-4 py-2">
                                                            <div>
                                                                <span className="text-white text-sm font-semibold">{m.sheetName}</span>
                                                                <span className="text-neutral-500 text-xs ml-2">({m.stravaName} on Strava)</span>
                                                            </div>
                                                            <span className="text-[#FC4C02] font-black text-sm tabular-nums">{m.km.toFixed(1)} km</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Unmatched athletes */}
                                        {syncResult.unmatched && syncResult.unmatched.length > 0 && (
                                            <div>
                                                <p className="text-[10px] uppercase tracking-widest text-yellow-500 mb-2">
                                                    ⚠️ Unmatched Strava athletes (not written to sheet)
                                                </p>
                                                <div className="space-y-1">
                                                    {syncResult.unmatched.map((u) => (
                                                        <div key={u.stravaName} className="flex justify-between items-center bg-yellow-900/20 border border-yellow-700/30 rounded-lg px-4 py-2">
                                                            <span className="text-yellow-300 text-sm">{u.stravaName}</span>
                                                            <span className="text-yellow-400 font-black text-sm tabular-nums">{u.km.toFixed(1)} km</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="mt-3 bg-neutral-800 rounded-lg p-4 text-xs text-neutral-400 leading-relaxed">
                                                    <p className="font-bold text-white mb-1">How to fix unmatched names:</p>
                                                    <p>Add a mapping in <code className="bg-neutral-700 px-1 rounded">.env.local</code>:</p>
                                                    <pre className="mt-2 text-[#FC4C02] overflow-x-auto">
                                                        {`STRAVA_NAME_MAP={\n${(syncResult.unmatched ?? []).map(u => `  "${u.stravaName}": "SheetName"`).join(",\n")}\n}`}
                                                    </pre>
                                                    <p className="mt-2">Replace <code className="bg-neutral-700 px-1 rounded">SheetName</code> with the exact name in your Google Sheet, then restart the server and sync again.</p>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="bg-red-950/40 border border-red-700/40 rounded-lg p-4">
                                        <p className="text-red-400 text-sm font-bold">Sync failed</p>
                                        <p className="text-red-300 text-xs mt-1">{syncResult.error}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Re-connect option */}
                {status?.connected && (
                    <div className="text-center">
                        <a
                            href="/api/strava/connect"
                            className="text-neutral-600 hover:text-neutral-400 text-xs underline transition-colors"
                        >
                            Re-authorize Strava account
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
