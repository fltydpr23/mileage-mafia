"use client";

import React from "react";
import { motion } from "framer-motion";
import ProgressRing from "@/components/ProgressRing";
import WeeklyBars from "@/components/WeeklyBars";
import RunnerCharts from "@/components/RunnerCharts";

function fmtKm(n: number) {
    if (!Number.isFinite(n)) return "0";
    return n % 1 === 0 ? String(Math.round(n)) : n.toFixed(1);
}

export default function RunnerProfileClient({
    runner,
    level,
    tier,
    isBonusLeader,
    annualTarget,
    weeklyTarget,
    minRequired,
    kmToSafety,
    activeWeeks,
    avgLast4,
    runStreak,
    targetHitRate,
    daysBadge,
    projectedDateFmt,
    projectionNote,
    bestWeek,
    worstWeek,
    acceptedContracts,
    weeklyBars,
    chartData,
}: any) {
    const containerVars: any = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.15, delayChildren: 0.1 },
        },
    };

    const itemVars: any = {
        hidden: { opacity: 0, y: 30 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } },
    };

    return (
        <main className="min-h-screen bg-neutral-950 text-white relative overflow-hidden">
            {/* High-tech background subtle grid */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

            {/* Top ambient glow */}
            <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-cyan-900/20 to-transparent pointer-events-none" />

            <motion.div
                variants={containerVars}
                initial="hidden"
                animate="show"
                className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20 space-y-8"
            >
                {/* HEADER */}
                <motion.div variants={itemVars} className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/10 pb-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse shadow-[0_0_10px_rgba(0,255,255,0.8)]" />
                            <h2 className="text-[10px] font-bold tracking-widest uppercase text-cyan-400">Secure Dossier Access</h2>
                        </div>
                        <h1 className="text-5xl sm:text-7xl font-black tracking-tighter uppercase">{runner.name}</h1>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1">Global Rank</p>
                        <div className="text-4xl font-black text-white">0{runner.rank}</div>
                    </div>
                </motion.div>

                {isBonusLeader ? (
                    <motion.div variants={itemVars} className="inline-flex items-center gap-2 px-4 py-2 rounded border border-yellow-500/50 bg-yellow-500/10 text-yellow-400 font-bold text-xs uppercase tracking-widest">
                        <span>👑 Top Earner Bonus: +₹1000</span>
                    </motion.div>
                ) : null}

                {/* HERO DOSSIER CARD */}
                <motion.section variants={itemVars} className={`relative rounded-2xl overflow-hidden border border-white/10 ${level.cardBg} backdrop-blur-md`}>
                    <div className={`absolute top-0 left-0 w-1.5 h-full ${level.accentBar}`} />
                    <div className="p-8 sm:p-12 flex flex-col md:flex-row items-center justify-between gap-10">
                        <div className="flex-1 space-y-6">
                            <div>
                                <p className="text-[10px] uppercase tracking-widest text-neutral-400 mb-2">Primary Metric: Sector Sweep</p>
                                <div className={`text-7xl lg:text-8xl font-black tracking-tight leading-none ${level.accentText}`}>
                                    {fmtKm(runner.yearlyKm)}<span className="text-2xl text-white/40 ml-2">KM</span>
                                </div>
                            </div>

                            <div className={`inline-flex items-center gap-3 px-4 py-2 rounded bg-black/40 border border-white/5`}>
                                <span className="text-[10px] uppercase tracking-widest text-neutral-400">Threat Level</span>
                                <span className={`h-3 w-px bg-white/20`} />
                                <span className={`text-sm font-black uppercase tracking-wider ${level.accentText}`}>{level.name}</span>
                            </div>
                        </div>

                        <div className="shrink-0 relative">
                            <ProgressRing value={runner.completion} size={180} stroke={12} sublabel="SYS Power" color={level.ringColor} />
                        </div>
                    </div>

                    {/* Target Bar Footer */}
                    <div className="bg-black/40 p-6 sm:px-12 border-t border-white/5">
                        <div className="flex justify-between text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">
                            <span>Annual Target: {fmtKm(annualTarget)} KM</span>
                            <span className={kmToSafety === 0 ? "text-emerald-400" : "text-rose-400"}>
                                {kmToSafety === 0 ? "Safety Met" : `${fmtKm(kmToSafety)} KM to Safety`}
                            </span>
                        </div>
                        <div className="h-2 bg-neutral-900 rounded-full overflow-hidden">
                            <div className={`h-full ${level.accentBar}`} style={{ width: `${Math.min(100, runner.completion)}%` }} />
                        </div>
                    </div>
                </motion.section>

                {/* TELEMETRY METRICS GRID */}
                <motion.section variants={itemVars} className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatBox label="Weekly Quota" value={weeklyTarget ? `${fmtKm(weeklyTarget)} km` : "—"} />
                    <StatBox label="Avg (Last 4W)" value={`${fmtKm(avgLast4)} km`} highlight />
                    <StatBox label="Active Streak" value={`${runStreak} wks`} />
                    <StatBox label="Target Hit Rate" value={weeklyTarget ? `${targetHitRate.toFixed(0)}%` : "—"} />
                    <StatBox label="Pace vs Plan" value={daysBadge.label} sub={daysBadge.sub} colSpan={2} />
                    <StatBox label="Est. Completion" value={projectedDateFmt || "—"} sub={projectionNote} colSpan={2} />
                </motion.section>

                {/* CHARTS */}
                <motion.section variants={itemVars} className="bg-neutral-900/50 border border-white/5 rounded-2xl p-6 sm:p-8 backdrop-blur-md">
                    <div className="flex items-center gap-2 mb-6">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-500">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                        </svg>
                        <h3 className="text-sm font-bold uppercase tracking-widest text-white">Live Telemetry</h3>
                    </div>

                    <RunnerCharts data={chartData.slice(-16)} weeklyTarget={weeklyTarget} />
                </motion.section>

                {/* TREND BARS */}
                <motion.section variants={itemVars} className="bg-neutral-900/50 border border-white/5 rounded-2xl p-6 sm:p-8 backdrop-blur-md">
                    <div className="flex items-center gap-2 mb-6">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-500">
                            <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-4" />
                        </svg>
                        <h3 className="text-sm font-bold uppercase tracking-widest text-white">12-Week History</h3>
                    </div>
                    <WeeklyBars data={weeklyBars} target={weeklyTarget} colorClass={level.accentBar} />
                </motion.section>

            </motion.div>
        </main>
    );
}

function StatBox({ label, value, sub, highlight = false, colSpan = 1 }: { label: string; value: string; sub?: string; highlight?: boolean; colSpan?: number }) {
    return (
        <div className={`bg-neutral-900/80 border ${highlight ? 'border-cyan-500/30 shadow-[0_0_15px_rgba(0,255,255,0.1)]' : 'border-white/5'} rounded-xl p-6 flex flex-col justify-between ${colSpan === 2 ? 'col-span-2' : 'col-span-1'}`}>
            <div className="text-[10px] uppercase font-bold tracking-widest text-neutral-500 mb-2">{label}</div>
            <div className={`text-2xl sm:text-3xl font-black tracking-tight ${highlight ? 'text-cyan-400' : 'text-white'}`}>{value}</div>
            {sub && <div className="mt-2 text-[10px] text-neutral-400 font-mono tracking-wider">{sub}</div>}
        </div>
    );
}
