"use client";

import React, { useMemo } from "react";

function hexToRgb(hex: string) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : "6, 182, 212";
}

export default function ActivityMatrix({ runHistory, color = "#06b6d4" }: { runHistory: any[], color?: string }) {
    const { matrix, maxDist } = useMemo(() => {
        const distMap = new Map<string, number>();
        let maxDist = 0;

        for (const run of runHistory) {
            if (!run.date) continue;
            const current = distMap.get(run.date) || 0;
            const updated = current + (run.distance || 0);
            distMap.set(run.date, updated);
            if (updated > maxDist) maxDist = updated;
        }

        const year = new Date().getFullYear();
        const startDate = new Date(year, 0, 1);

        const startDay = startDate.getDay();
        const weeks = [];
        let currDate = new Date(startDate);
        currDate.setDate(currDate.getDate() - startDay);

        for (let w = 0; w < 53; w++) {
            const week = [];
            for (let d = 0; d < 7; d++) {
                const dateStr = currDate.toISOString().split("T")[0];
                const dist = distMap.get(dateStr) || 0;
                const isCurrentYear = currDate.getFullYear() === year;
                week.push({ date: dateStr, dist, active: isCurrentYear });

                currDate.setDate(currDate.getDate() + 1);
            }
            weeks.push(week);
            if (currDate.getFullYear() > year) break;
        }

        return { matrix: weeks, maxDist };
    }, [runHistory]);

    const rgb = hexToRgb(color);

    return (
        <div className="w-full flex flex-col gap-3 overflow-x-auto pb-6 pt-16" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
            <style>{`
                .matrix-scroll::-webkit-scrollbar { display: none; }
            `}</style>
            <div className="flex gap-2 min-w-max mx-auto matrix-scroll">
                {matrix.map((week, wIdx) => {
                    let tooltipX = "left-1/2 -translate-x-1/2";
                    if (wIdx < 4) tooltipX = "left-0 translate-x-0";
                    else if (wIdx > 48) tooltipX = "right-0 translate-x-0";

                    return (
                        <div key={wIdx} className="flex flex-col gap-2">
                            {week.map((day, dIdx) => {
                                if (!day.active) return <div key={dIdx} className="w-4 h-4 rounded-sm opacity-0" />;

                                let intensityClass = "bg-neutral-800/50 outline outline-1 outline-white/5 hover:bg-neutral-700 transition-colors";
                                if (day.dist > 0) {
                                    const ratio = day.dist / Math.max(10, maxDist * 0.8);
                                    const clamped = Math.min(1, Math.max(0.3, ratio));
                                    return (
                                        <div
                                            key={dIdx}
                                            className="w-4 h-4 rounded-[3px] transition-all duration-300 hover:scale-150 hover:z-30 group relative"
                                            style={{ backgroundColor: `rgba(${rgb}, ${clamped})`, boxShadow: `0 0 ${clamped * 10}px rgba(${rgb}, ${clamped * 0.5})` }}
                                        >
                                            <div className={`absolute opacity-0 group-hover:opacity-100 bottom-full mb-3 ${tooltipX} bg-neutral-950/95 backdrop-blur-md border border-white/20 text-white whitespace-nowrap px-2 py-1.5 rounded pointer-events-none z-50 font-mono shadow-2xl transition-all duration-200 translate-y-2 group-hover:translate-y-0`}>
                                                <div className="text-[9px] text-neutral-400 font-bold uppercase tracking-widest leading-tight mb-1">{day.date}</div>
                                                <div className="font-black text-white text-xs">{day.dist.toFixed(1)} <span className="text-[9px] text-neutral-500 font-bold tracking-widest">KM</span></div>
                                            </div>
                                        </div>
                                    )
                                }

                                return (
                                    <div key={dIdx} className={`w-4 h-4 rounded-[3px] cursor-pointer group relative ${intensityClass} hover:z-30 hover:scale-125`}>
                                        <div className={`absolute opacity-0 group-hover:opacity-100 bottom-full mb-3 ${tooltipX} bg-neutral-950/95 backdrop-blur-md border border-white/20 text-white whitespace-nowrap px-2 py-1.5 rounded pointer-events-none z-50 font-mono shadow-2xl transition-all duration-200 translate-y-2 group-hover:translate-y-0`}>
                                            <div className="text-[9px] text-neutral-400 font-bold uppercase tracking-widest leading-tight mb-1">{day.date}</div>
                                            <div className="font-black text-neutral-500 uppercase text-[9px] tracking-widest">Rest Day</div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )
                })}
            </div>
            <div className="flex justify-between items-center text-[10px] text-neutral-500 uppercase tracking-widest mt-2 px-2">
                <span>Simulation Standard Year</span>
            </div>
        </div>
    )
}
