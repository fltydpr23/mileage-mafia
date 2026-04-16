"use client";

import React, { useMemo } from "react";

export default function HRCybernetics({ runHistory, color = "#06b6d4" }: { runHistory: any[], color?: string }) {
    const { aei, zone2Badge, redlineBadge } = useMemo(() => {
        let bestAEI = 0;
        let longestZone2 = null; // max dist where avgHr < 145
        let maxHrReached = null;

        const hrRuns = runHistory.filter(r => r.avgHr > 0);

        for (const run of hrRuns) {
            // AEI = Speed (m/min) / Avg HR
            // Speed = dist(m) / time(min)
            const speed = (run.distance * 1000) / run.time;
            const runAEI = speed / run.avgHr;
            if (runAEI > bestAEI) bestAEI = runAEI;

            if (run.avgHr < 145 && (!longestZone2 || run.distance > longestZone2.distance)) {
                longestZone2 = run;
            }

            if (run.maxHr > 0 && (!maxHrReached || run.maxHr > maxHrReached.maxHr)) {
                maxHrReached = run;
            }
        }

        return { aei: bestAEI, zone2Badge: longestZone2, redlineBadge: maxHrReached };
    }, [runHistory]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
            {/* AEI */}
            <div className="bg-neutral-900/50 border border-white/5 rounded-xl p-4 flex flex-col justify-between group overflow-hidden relative">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none" style={{ backgroundColor: color }} />
                <div className="text-[10px] uppercase text-neutral-500 mb-2 whitespace-nowrap">Aerobic Efficiency</div>
                <div className="text-3xl font-black text-white" style={{ color }}>
                    {aei > 0 ? aei.toFixed(2) : "—"}
                </div>
                <div className="text-[9px] text-neutral-500 mt-1 uppercase">Meters / Heartbeat</div>
            </div>

            {/* Zone 2 Badge */}
            <div className="bg-neutral-900/50 border border-white/5 rounded-xl p-4 flex flex-col justify-between group overflow-hidden relative">
                <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                <div className="text-[10px] uppercase text-neutral-500 mb-2">Zone 2 Zenith</div>
                <div className="text-3xl font-black text-white">
                    {zone2Badge ? `${zone2Badge.distance.toFixed(1)}k` : "—"}
                </div>
                <div className="text-[9px] text-neutral-500 mt-1 uppercase">
                    {zone2Badge ? `Avg HR: ${zone2Badge.avgHr}bpm` : "No Zone 2 Data"}
                </div>
            </div>

            {/* The Redline */}
            <div className="bg-neutral-900/50 border border-white/5 rounded-xl p-4 flex flex-col justify-between relative inset-0 overflow-hidden group">
                <div className="absolute inset-0 bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                <div className="text-[10px] uppercase text-red-500 mb-2">Engine Redline</div>
                <div className="text-3xl font-black text-red-500 group-hover:animate-pulse">
                    {redlineBadge ? `${redlineBadge.maxHr}` : "—"}
                </div>
                <div className="text-[9px] text-red-500/60 mt-1 uppercase">
                    {redlineBadge ? `Max HR Reached` : "No Max HR Data"}
                </div>
            </div>
        </div>
    )
}
