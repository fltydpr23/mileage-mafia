"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import ProgressRing from "@/components/ProgressRing";
import WeeklyBars from "@/components/WeeklyBars";
import RunnerCharts from "@/components/RunnerCharts";
import ActivityMatrix from "@/components/ActivityMatrix";
import PaceScatterMap from "@/components/PaceScatterMap";
import HRCybernetics from "@/components/HRCybernetics";
import NowPlaying from "@/components/NowPlaying";

// ─── Utils ───────────────────────────────────────────────────────────────────
function fmtKm(n: number) {
    if (!Number.isFinite(n)) return "0";
    return n % 1 === 0 ? String(Math.round(n)) : n.toFixed(1);
}
function fmtPace(minKm: number) {
    if (!minKm || !Number.isFinite(minKm) || minKm <= 0) return "—";
    const m = Math.floor(minKm);
    const s = Math.round((minKm - m) * 60);
    return `${m}:${String(s).padStart(2, "0")}`;
}

function highlightBorder(accentBar: string) {
    if (accentBar.includes("red")) return "border-red-500/40";
    if (accentBar.includes("rose")) return "border-rose-500/40";
    if (accentBar.includes("amber")) return "border-amber-500/40";
    if (accentBar.includes("emerald")) return "border-emerald-500/40";
    return "border-neutral-500/40";
}

// ─── Animation variants ───────────────────────────────────────────────────────
const fadeUp = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 90, damping: 18 } },
};
const stagger = {
    hidden: {},
    show: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

// ─── Animated number counter ──────────────────────────────────────────────────
function AnimatedNumber({ value, decimals = 0, suffix = "" }: { value: number; decimals?: number; suffix?: string }) {
    const [display, setDisplay] = useState(0);
    const ref = useRef<HTMLSpanElement>(null);
    const inView = useInView(ref, { once: true, margin: "-80px" });

    useEffect(() => {
        if (!inView) return;
        let start = 0;
        const end = value;
        const duration = 900;
        const step = (ts: number) => {
            if (!start) start = ts;
            const progress = Math.min((ts - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(parseFloat((eased * end).toFixed(decimals)));
            if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }, [inView, value, decimals]);

    return (
        <span ref={ref}>
            {display.toFixed(decimals)}{suffix}
        </span>
    );
}

// ─── Animated bar ─────────────────────────────────────────────────────────────
function AnimatedBar({ value, max = 100, colorClass }: { value: number; max?: number; colorClass: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const inView = useInView(ref, { once: true, margin: "-60px" });
    const pct = Math.min(100, (value / Math.max(1, max)) * 100);
    return (
        <div ref={ref} className="h-1.5 bg-white/5 rounded-full overflow-hidden w-full">
            <motion.div
                className={`h-full rounded-full ${colorClass}`}
                initial={{ width: 0 }}
                animate={inView ? { width: `${pct}%` } : { width: 0 }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
            />
        </div>
    );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <div className="text-[9px] font-black uppercase tracking-[0.25em] text-neutral-500 flex items-center gap-2.5">
            <div className="h-px w-4 bg-white/15" />
            {children}
            <div className="h-px flex-1 bg-white/5" />
        </div>
    );
}

// ─── Stat tile ────────────────────────────────────────────────────────────────
function StatTile({
    label,
    value,
    sub,
    accent = false,
    accentColor = "text-cyan-400",
    barValue,
    barMax,
    barColor = "bg-cyan-500",
}: {
    label: string;
    value: string | React.ReactNode;
    sub?: string;
    accent?: boolean;
    accentColor?: string;
    barValue?: number;
    barMax?: number;
    barColor?: string;
}) {
    return (
        <div className="flex flex-col gap-2 p-4 rounded-xl bg-black/30 border border-white/5 hover:border-white/10 transition-colors group">
            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-500">{label}</div>
            <div className={`text-lg sm:text-xl font-black tracking-tight leading-none ${accent ? accentColor : "text-white"}`}>
                {value}
            </div>
            {sub && <div className="text-[10px] text-neutral-600 font-mono truncate">{sub}</div>}
            {barValue !== undefined && barMax !== undefined && (
                <AnimatedBar value={barValue} max={barMax} colorClass={barColor} />
            )}
        </div>
    );
}

// ─── Divider ──────────────────────────────────────────────────────────────────
function Divider() {
    return <div className="h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />;
}

// ─── Main component ───────────────────────────────────────────────────────────
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
    weeklyBars,
    chartData,
    top5Runners,
    summaryStats,
    zeroWeeks,
    mafiaFine,
    serverTime,
}: any) {

    // Season progress
    const now = new Date(serverTime);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearEnd = new Date(now.getFullYear(), 11, 31);
    const yearProgressPct = Math.min(100, ((now.getTime() - yearStart.getTime()) / (yearEnd.getTime() - yearStart.getTime())) * 100);

    // Leaderboard gap
    const myIdx = top5Runners?.findIndex((r: any) => r.name === runner.name) ?? -1;
    let rivalGapStr = "Outside Top 5";
    let rivalGapPct = "";
    if (myIdx > 0 && top5Runners) {
        const rival = top5Runners[myIdx - 1];
        // Calculate the exact percentage gap, plus 0.1% to guarantee an overtake
        const gapPct = Math.max(0.1, rival.completion - runner.completion + 0.1);
        // Calculate how many KMs the runner needs to cover that percentage of their own annual target
        const gapKm = (gapPct / 100) * (annualTarget || 1);
        rivalGapStr = `${fmtKm(gapKm)} km to overtake ${rival.name}`;
        rivalGapPct = `+${gapPct.toFixed(1)}% gap to P${myIdx}`;
    } else if (myIdx === 0) {
        rivalGapStr = "Current Race Leader";
        rivalGapPct = "P1";
    }

    const accentText = level.accentText;
    const accentBar = level.accentBar;

    return (
        <main className="min-h-screen bg-[#0a0a0a] text-white relative overflow-x-hidden">
            {/* Background grid */}
            <div className="pointer-events-none fixed inset-0 z-0"
                style={{
                    backgroundImage:
                        "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
                    backgroundSize: "48px 48px",
                    maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)",
                }}
            />
            {/* Ambient glow tied to level color */}
            <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-[0.07] blur-[120px] rounded-full"
                style={{ background: level.ringColor }}
            />

            <motion.div
                variants={stagger}
                initial="hidden"
                animate="show"
                className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-20 space-y-6"
            >
                {/* ── HEADER ─────────────────────────────────────────────────── */}
                <motion.header variants={fadeUp} className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-cyan-400">Runner Dossier</span>
                        </div>
                        <h1 className="text-5xl sm:text-7xl font-black tracking-tighter uppercase leading-none">
                            {runner.name}
                        </h1>
                        <div className="flex items-center gap-3 pt-1">
                            {/* Mafia Level badge with hover */}
                            <div className="group relative">
                                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest ${level.badge} cursor-help`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${accentBar}`} />
                                    {level.name}
                                </div>
                                {/* Tooltip */}
                                <div className="absolute left-0 top-full mt-2 w-52 bg-zinc-950/95 backdrop-blur border border-white/10 rounded-xl p-3.5 shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                                    <p className="text-[9px] uppercase tracking-widest text-neutral-500 font-black mb-2.5 border-b border-white/10 pb-2">Syndicate Ranks</p>
                                    <div className="space-y-2">
                                        {[
                                            { name: "Godfather", km: 1800, color: "text-red-400" },
                                            { name: "Underboss", km: 1000, color: "text-rose-400" },
                                            { name: "Area Don", km: 500, color: "text-amber-400" },
                                            { name: "Soldier", km: 250, color: "text-emerald-400" },
                                            { name: "Associate", km: 0, color: "text-neutral-400" },
                                        ].map(t => (
                                            <div key={t.name} className="flex items-center justify-between text-[11px]">
                                                <div className="flex items-center gap-2">
                                                    {t.name === level.name && <div className="w-1 h-1 rounded-full bg-white animate-pulse" />}
                                                    {t.name !== level.name && <div className="w-1 h-1 rounded-full bg-transparent" />}
                                                    <span className={`font-black uppercase ${t.color}`}>{t.name}</span>
                                                </div>
                                                <span className="font-mono text-neutral-500 text-[10px]">{t.km}+ km</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            {isBonusLeader && (
                                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 text-[9px] font-black uppercase tracking-widest">
                                    👑 Top Earner +₹1000
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Rank */}
                    <div className="flex flex-col items-end gap-4 shrink-0">
                        <div className="text-right">
                            <div className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mb-0.5">Syndicate Rank</div>
                            <div className="text-4xl font-black tabular-nums">{String(runner.rank || "—").padStart(2, "0")}</div>
                        </div>
                    </div>
                </motion.header>

                <Divider />

                {/* ── HERO CARD ─────────────────────────────────────────────── */}
                <motion.section variants={fadeUp}
                    className={`relative rounded-2xl overflow-hidden border ${highlightBorder(accentBar)} ${level.cardBg}`}
                >
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentBar}`} />
                    <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 items-center">
                        {/* Left: distance + phase */}
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-500">
                                    {runner.completion < 25 ? "Phase 1 · Accumulation" :
                                     runner.completion < 50 ? "Phase 2 · Expansion" :
                                     runner.completion < 75 ? "Phase 3 · Domination" : "Phase 4 · Optimization"}
                                </div>
                                <div className={`text-6xl sm:text-8xl font-black tracking-tighter leading-none ${accentText}`}>
                                    <AnimatedNumber value={runner.yearlyKm} decimals={1} />
                                    <span className="text-xl sm:text-2xl text-white/30 ml-2 font-black">KM</span>
                                </div>
                            </div>

                            {/* Safety + Annual target row */}
                            <div className="flex items-center gap-6 text-[11px] font-black uppercase tracking-widest">
                                <div>
                                    <span className="text-neutral-500">Annual: </span>
                                    <span className="text-white">{fmtKm(annualTarget)} km</span>
                                </div>
                                <div className={kmToSafety === 0 ? "text-emerald-400" : "text-rose-400"}>
                                    {kmToSafety === 0 ? "✓ Safety met" : `${fmtKm(kmToSafety)} km to 85% safety`}
                                </div>
                            </div>

                            {/* Completion bar */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-neutral-500">
                                    <span>0 km</span>
                                    <span className={accentText}>{runner.completion.toFixed(1)}% Complete</span>
                                    <span>{fmtKm(annualTarget)} km</span>
                                </div>
                                <div className="relative h-3 bg-black/60 rounded-full border border-white/5 overflow-hidden">
                                    {/* Year time ghost */}
                                    <div className="absolute inset-y-0 left-0 bg-white/5 border-r border-white/10"
                                        style={{ width: `${yearProgressPct}%` }} />
                                    {/* Actual progress */}
                                    <motion.div
                                        className={`absolute inset-y-0 left-0 ${accentBar} opacity-90`}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.min(100, runner.completion)}%` }}
                                        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/15" />
                                    </motion.div>
                                    {/* 85% safety marker */}
                                    <div className="absolute top-0 bottom-0 w-px bg-white/20" style={{ left: "85%" }} />
                                </div>
                                <div className="flex justify-between text-[9px] text-neutral-600">
                                    <span>Start</span>
                                    <span className="text-neutral-500">‹ 85% safety</span>
                                    <span>Target</span>
                                </div>
                            </div>
                        </div>

                        {/* Right: Progress ring + level progress */}
                        <div className="flex flex-col items-center gap-4">
                            <ProgressRing value={runner.completion} size={160} stroke={10} sublabel="Completion" color={level.ringColor} />
                            {tier.next && (
                                <div className="w-full max-w-[160px] space-y-1.5">
                                    <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-neutral-500">
                                        <span>{level.name}</span>
                                        <span>{tier.next.name}</span>
                                    </div>
                                    <AnimatedBar value={tier.pct} max={100} colorClass={accentBar} />
                                    <div className="text-center text-[9px] text-neutral-600 font-mono">
                                        {fmtKm(tier.kmToNext)} km to {tier.next.name}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.section>

                {/* ── CORE STATS GRID ────────────────────────────────────────── */}
                <motion.section variants={fadeUp} className="space-y-3">
                    <SectionLabel>Field Intelligence</SectionLabel>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                        <StatTile
                            label="Weekly quota"
                            value={weeklyTarget > 0 ? `${fmtKm(weeklyTarget)} km` : "—"}
                        />
                        <StatTile
                            label="Avg last 4 wks"
                            value={`${fmtKm(avgLast4)} km`}
                            accent accentColor={accentText}
                            barValue={avgLast4}
                            barMax={weeklyTarget * 2 || 100}
                            barColor={accentBar}
                        />
                        <StatTile
                            label="Active streak"
                            value={`${runStreak} wks`}
                        />
                        <StatTile
                            label="Target hit rate"
                            value={weeklyTarget > 0 ? `${targetHitRate.toFixed(0)}%` : "—"}
                            barValue={targetHitRate}
                            barMax={100}
                            barColor={accentBar}
                        />
                        <StatTile
                            label="Projected finish"
                            value={projectedDateFmt}
                            sub={projectionNote}
                        />
                        <StatTile
                            label="Pace vs plan"
                            value={daysBadge.label}
                            sub={daysBadge.sub}
                            accent={daysBadge.label.includes("ahead")}
                            accentColor="text-emerald-400"
                        />
                        <StatTile
                            label="Zero Weeks"
                            value={`${zeroWeeks} wks`}
                            sub={mafiaFine > 0 ? `Penalty: ₹${mafiaFine}` : "No fines active"}
                            accent={mafiaFine > 0}
                            accentColor="text-red-500"
                        />
                    </div>
                </motion.section>

                {/* ── SEASON TIMELINE ────────────────────────────────────────── */}
                <motion.section variants={fadeUp}
                    className="rounded-xl bg-black/30 border border-white/5 p-5 space-y-4"
                >
                    <div className="flex items-center justify-between">
                        <SectionLabel>Season Timeline 2025</SectionLabel>
                        <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500">
                            {Math.round(yearProgressPct)}% of year elapsed
                        </span>
                    </div>
                    <div className="relative h-8 bg-black/50 rounded-full border border-white/5 overflow-hidden">
                        {/* Year ghost */}
                        <div className="absolute inset-y-0 left-0 bg-white/[0.04] border-r border-white/15 transition-all"
                            style={{ width: `${yearProgressPct}%` }} />
                        {/* Progress */}
                        <motion.div
                            className={`absolute inset-y-0 left-0 ${accentBar} opacity-80`}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, runner.completion)}%` }}
                            transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-white/20" />
                            {/* Shimmer */}
                            <motion.div
                                className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                                animate={{ x: ["-100%", "800%"] }}
                                transition={{ duration: 4, repeat: Infinity, repeatDelay: 6 }}
                            />
                        </motion.div>
                        {/* 85% line */}
                        <div className="absolute top-1 bottom-1 w-px bg-white/20" style={{ left: "85%" }}>
                            <div className="absolute -top-0.5 left-1 text-[8px] text-white/30 font-black whitespace-nowrap">85%</div>
                        </div>
                        {/* Labels inside bar */}
                        <div className="absolute inset-0 flex items-center px-3 justify-between pointer-events-none">
                            <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Jan</span>
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] text-white/30">◼ year elapsed</span>
                                <span className={`text-[9px] font-black ${accentText} opacity-80`}>■ {runner.completion.toFixed(1)}%</span>
                            </div>
                            <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Dec</span>
                        </div>
                    </div>
                </motion.section>

                {/* ── LEADERBOARD SNAPSHOT + TARGET ACQ ───────────────────────── */}
                <motion.section variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                    {/* Leaderboard */}
                    <div className="lg:col-span-3 rounded-xl bg-black/30 border border-white/5 p-5 space-y-3">
                        <SectionLabel>Leaderboard Snapshot</SectionLabel>
                        <div className="space-y-1.5">
                            {top5Runners?.map((r: any, idx: number) => {
                                const isMe = r.name === runner.name;
                                const gapToTop = top5Runners[0].yearlyKm - r.yearlyKm;
                                return (
                                    <div
                                        key={r.name}
                                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                                            isMe
                                                ? `bg-white/8 ${highlightBorder(accentBar)} scale-[1.01]`
                                                : "bg-black/20 border-white/5 hover:border-white/10"
                                        }`}
                                    >
                                        {/* Rank */}
                                        <span className={`text-xs w-5 text-center font-black tabular-nums ${isMe ? "text-white" : "text-neutral-600"}`}>
                                            {String(idx + 1).padStart(2, "0")}
                                        </span>
                                        {/* Name */}
                                        <span className={`flex-1 text-xs font-black uppercase tracking-widest min-w-0 truncate ${isMe ? "text-white" : "text-neutral-400"}`}>
                                            {r.name}
                                        </span>
                                        {/* Mini bar */}
                                        <div className="w-20 hidden sm:block">
                                            <AnimatedBar
                                                value={r.completion}
                                                max={100}
                                                colorClass={isMe ? accentBar : "bg-white/10"}
                                            />
                                        </div>
                                        {/* Completion % */}
                                        <span className={`text-xs font-black tabular-nums w-12 text-right ${isMe ? accentText : "text-neutral-500"}`}>
                                            {r.completion.toFixed(1)}%
                                        </span>
                                        {/* KM */}
                                        <span className={`text-xs font-black tabular-nums w-16 text-right ${isMe ? "text-white" : "text-neutral-500"}`}>
                                            {fmtKm(r.yearlyKm)} km
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Target Acquisition */}
                    <div className="lg:col-span-2 rounded-xl bg-black/30 border border-white/5 p-5 space-y-4 flex flex-col justify-between">
                        <SectionLabel>Target Acquisition</SectionLabel>
                        <div className="flex-1 flex flex-col justify-center space-y-5">
                            <div>
                                <div className="text-[9px] font-black uppercase tracking-widest text-neutral-500 mb-1.5">Mission Objective</div>
                                <div className={`text-sm font-black leading-tight ${myIdx === 0 ? "text-emerald-400" : "text-amber-400"}`}>
                                    {rivalGapStr}
                                </div>
                                {rivalGapPct && (
                                    <div className="text-[10px] text-neutral-500 font-mono mt-1">{rivalGapPct}</div>
                                )}
                            </div>
                            <Divider />
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <div className="text-[9px] font-black uppercase tracking-widest text-neutral-500 mb-1">Best Week</div>
                                    <div className="text-sm font-black text-white">{bestWeek ? `${fmtKm(bestWeek.km)} km` : "—"}</div>
                                    {bestWeek && <div className="text-[9px] text-neutral-600 font-mono">W{bestWeek.weekNum}</div>}
                                </div>
                                <div>
                                    <div className="text-[9px] font-black uppercase tracking-widest text-neutral-500 mb-1">Active Weeks</div>
                                    <div className="text-sm font-black text-white">{activeWeeks}</div>
                                    <div className="text-[9px] text-neutral-600 font-mono">weeks logged</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.section>

                {/* ── ADVANCED TELEMETRY (summaryStats) ─────────────────────── */}
                {summaryStats && (
                    <motion.section variants={fadeUp} className="space-y-3">
                        <SectionLabel>Advanced Telemetry · Heart Rate & Biometrics</SectionLabel>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                            <StatTile
                                label="Avg Heart Rate"
                                value={summaryStats.avgHr > 0 ? `${summaryStats.avgHr} bpm` : "—"}
                                sub="Average across all activities"
                                accent
                                accentColor="text-red-400"
                                barValue={summaryStats.avgHr}
                                barMax={summaryStats.maxHrEver || 200}
                                barColor="bg-red-500"
                            />
                            <StatTile
                                label="Peak HR Recorded"
                                value={summaryStats.maxHrEver > 0 ? `${summaryStats.maxHrEver} bpm` : "—"}
                                sub="Highest recorded all-time"
                                accent
                                accentColor="text-rose-400"
                            />
                            <StatTile
                                label="Cardiac Efficiency"
                                value={summaryStats.cardiacEfficiency > 0 ? `${(summaryStats.cardiacEfficiency * 1000).toFixed(1)}` : "—"}
                                sub="m / heartbeat"
                                accent
                                accentColor={accentText}
                            />
                            <StatTile
                                label="Zone 2 Ratio"
                                value={summaryStats.zone2Ratio > 0 ? `${summaryStats.zone2Ratio}%` : "—"}
                                sub="Aerobic base runs"
                                barValue={summaryStats.zone2Ratio}
                                barMax={100}
                                barColor="bg-emerald-500"
                            />
                            <StatTile
                                label="Avg Cadence"
                                value={summaryStats.avgCadence > 0 ? `${summaryStats.avgCadence}` : "—"}
                                sub="steps / min"
                            />
                            <StatTile
                                label="Total Elevation"
                                value={summaryStats.totalElevation > 0 ? `${summaryStats.totalElevation.toLocaleString()}m` : "—"}
                                sub="Total gain this year"
                            />
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                            <StatTile
                                label="Longest Run"
                                value={summaryStats.longestRunKm > 0 ? `${fmtKm(summaryStats.longestRunKm)} km` : "—"}
                                sub={summaryStats.longestRunDate || ""}
                                accent
                                accentColor={accentText}
                            />
                            <StatTile
                                label="Best Pace"
                                value={summaryStats.bestPace > 0 ? fmtPace(summaryStats.bestPace) : "—"}
                                sub={summaryStats.bestPaceDate ? `on ${summaryStats.bestPaceDate}` : "min / km"}
                            />
                            <StatTile
                                label="Longest Streak"
                                value={`${summaryStats.longestStreak} days`}
                                sub="Consecutive running days"
                                accent={summaryStats.longestStreak >= 7}
                                accentColor="text-amber-400"
                            />
                            <StatTile
                                label="Consistency"
                                value={`${summaryStats.consistencyScore}%`}
                                sub="Active weeks vs elapsed"
                                barValue={summaryStats.consistencyScore}
                                barMax={100}
                                barColor={accentBar}
                            />
                            <StatTile
                                label="Early Bird"
                                value={`${summaryStats.earlyBirdRuns}`}
                                sub="Runs before 7am"
                                accent={summaryStats.earlyBirdRuns > 5}
                                accentColor="text-cyan-400"
                            />
                            <StatTile
                                label="Night Owl"
                                value={`${summaryStats.nightOwlRuns}`}
                                sub="Runs after 8pm"
                                accent={summaryStats.nightOwlRuns > 5}
                                accentColor="text-violet-400"
                            />
                        </div>
                    </motion.section>
                )}

                {/* ── HR CYBERNETICS ────────────────────────────────────────── */}
                {runner.runHistory?.length > 0 && (
                    <motion.section variants={fadeUp} className="space-y-3">
                        <SectionLabel>Heart Rate Telemetry</SectionLabel>
                        <HRCybernetics runHistory={runner.runHistory} color={level.ringColor} />
                    </motion.section>
                )}

                {/* ── PACE SCATTER + ACTIVITY MATRIX ───────────────────────── */}
                {runner.runHistory?.length > 0 && (
                    <motion.section variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="rounded-xl bg-black/30 border border-white/5 p-5 space-y-4">
                            <SectionLabel>Speed Distribution</SectionLabel>
                            <PaceScatterMap runHistory={runner.runHistory} color={level.ringColor} />
                        </div>
                        <div className="rounded-xl bg-black/30 border border-white/5 p-5 space-y-4">
                            <SectionLabel>Execution Density</SectionLabel>
                            <ActivityMatrix runHistory={runner.runHistory} color={level.ringColor} />
                        </div>
                    </motion.section>
                )}

                {/* ── LIVE TELEMETRY CHART ──────────────────────────────────── */}
                <motion.section variants={fadeUp} className="rounded-xl bg-black/30 border border-white/5 p-5 space-y-4">
                    <SectionLabel>Live Telemetry · Weekly KM</SectionLabel>
                    <RunnerCharts data={chartData.slice(-16)} weeklyTarget={weeklyTarget} totalKm={runner.yearlyKm} />
                </motion.section>

                {/* ── 12-WEEK HISTORY BARS ─────────────────────────────────── */}
                <motion.section variants={fadeUp} className="rounded-xl bg-black/30 border border-white/5 p-5 space-y-4">
                    <SectionLabel>12-Week Activity Log</SectionLabel>
                    <WeeklyBars data={weeklyBars} target={weeklyTarget} colorClass={accentBar} />
                </motion.section>

            </motion.div>

            {/* ── FLOATING MUSIC PLAYER ────────────────────────────────────── */}
            <motion.div 
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 100, damping: 20, delay: 1 }}
                className="fixed bottom-6 right-6 z-[100] hidden sm:block"
            >
                <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-1 shadow-2xl hover:border-white/20 transition-colors">
                    <NowPlaying />
                </div>
            </motion.div>

            {/* Mobile Music Player (slim version or just regular but centered) */}
            <motion.div 
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 100, damping: 20, delay: 1 }}
                className="fixed bottom-4 left-4 right-4 z-[100] sm:hidden"
            >
                <div className="bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-1 shadow-2xl">
                    <NowPlaying />
                </div>
            </motion.div>
        </main>
    );
}
