"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import F1TrackMap from "@/components/F1TrackMap";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Runner {
    name: string;
    yearlyKm: number;
    completion: number;
    rank: number;
    weeklyTarget: number;
    annualTarget: number;
    runHistory: any[];
}
interface GlobalStats {
    totalRunners: number;
    totalKm: number;
    totalTargetKm: number;
    totalPot: number;
    oathPot: number;
    penaltyFund: number;
    isManual?: boolean;
}
interface Props {
    runners: Runner[];
    globalStats: GlobalStats;
    povHold: boolean;
}
type MobileTab = "timing" | "map" | "stats";

// ─── Palette ──────────────────────────────────────────────────────────────────
const CRIMSON = "#dc2626";
const GOLD    = "#d4a017";
const SILVER  = "#9ca3af";
const BRONZE  = "#92400e";

function rankColor(rank: number): string {
    if (rank === 1) return GOLD;
    if (rank === 2) return SILVER;
    if (rank === 3) return "#cd7f32";
    return "#71717a";
}
function completionColor(pct: number): string {
    if (pct >= 75) return "#dc2626";
    if (pct >= 50) return "#f59e0b";
    if (pct >= 25) return "#10b981";
    return "#3b82f6";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtKm(n: number) { return n == null ? "—" : n % 1 === 0 ? String(Math.round(n)) : n.toFixed(1); }
function fmtGap(val: number) { return val <= 0 ? "LEADER" : `+${val.toFixed(1)}%`; }

// ─── SVG Circuit path (abstract oval with chicane) ───────────────────────────
// Designed in a 500×300 viewBox. A running-circuit aesthetic (not F1 car).
const CIRCUIT_PATH = `
  M 200,270
  L 100,270
  C 60,270 45,245 45,210
  L 45,110
  C 45,70 70,45 110,45
  L 170,45
  C 195,45 205,60 205,80
  L 205,110
  C 205,140 220,150 245,150
  L 285,150
  C 310,150 320,135 320,110
  L 320,70
  C 320,50 340,35 365,45
  L 435,75
  C 465,90 475,120 450,150
  L 405,210
  C 385,240 355,270 315,270
  L 255,270
  C 235,270 225,255 225,235
  L 225,210
  C 225,190 210,180 190,180
  C 170,180 160,195 160,215
  C 160,245 175,270 200,270
  Z
`;

// Pre-compute a set of evenly-spaced points along the path
function getPointsAlongPath(pathEl: SVGPathElement, count = 200) {
    const total = pathEl.getTotalLength();
    return Array.from({ length: count }, (_, i) => {
        const pt = pathEl.getPointAtLength((i / count) * total);
        return { x: pt.x, y: pt.y };
    });
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function MafiaTelemetry({ runners, globalStats, povHold }: Props) {
    const [activeRunner, setActiveRunner] = useState<Runner | null>(null);
    const [hoveredRunner, setHoveredRunner] = useState<Runner | null>(null);
    const [mobileTab, setMobileTab] = useState<MobileTab>("timing");
    const [isHudVisible, setIsHudVisible] = useState<boolean>(true);
    const [tick, setTick] = useState(0);

    // Sort runners by rank
    const sorted = useMemo(() => [...runners].sort((a, b) => (a.rank || 99) - (b.rank || 99)), [runners]);
    const leader = sorted[0];

    // Set default active runner
    useEffect(() => {
        if (sorted.length > 0 && !activeRunner) setActiveRunner(sorted[0]);
    }, [sorted, activeRunner]);

    const gapToLeader = useCallback((runner: Runner) => {
        if (!leader) return 0;
        return Math.max(0, leader.yearlyKm - runner.yearlyKm);
    }, [leader]);
    const gapToAhead = useCallback((runner: Runner) => {
        const above = sorted[runner.rank - 2];
        if (!above) return 0;
        return Math.max(0, above.completion - runner.completion);
    }, [sorted]);

    // ─── RACE CLASSIFICATION ──────────────────────────────────────────────────
    const TimingTower = () => (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-[#111]">
                <span className="text-[10px] font-mono font-black tracking-[0.25em] text-white uppercase">Race Classification</span>
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[9px] font-mono text-emerald-400">{globalStats.isManual ? "MANUAL" : "LIVE"}</span>
                </div>
            </div>

            {/* Runner rows */}
            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                {sorted.map((runner, i) => {
                    const isActive = activeRunner?.name === runner.name;
                    const isHovered = hoveredRunner?.name === runner.name;
                    const rc = rankColor(runner.rank);
                    const gap = gapToLeader(runner);
                    const gapAbove = gapToAhead(runner);

                    return (
                        <button
                            key={runner.name}
                            onClick={() => setActiveRunner(runner)}
                            onMouseEnter={() => setHoveredRunner(runner)}
                            onMouseLeave={() => setHoveredRunner(null)}
                            className="w-full text-left relative border-b border-white/[0.04] transition-all"
                            style={{
                                background: isActive ? "rgba(220,38,38,0.08)" : isHovered ? "rgba(255,255,255,0.02)" : "transparent",
                                borderLeft: isActive ? `3px solid ${CRIMSON}` : "3px solid transparent",
                            }}
                        >
                            <div className="flex items-center gap-3 px-3 py-2.5">
                                {/* Position badge */}
                                <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-xs font-black font-mono"
                                    style={{ background: isActive ? CRIMSON : "rgba(255,255,255,0.05)", color: isActive ? "#fff" : rc }}>
                                    P{runner.rank}
                                </div>

                                {/* Name + gap info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-black text-white uppercase tracking-wide truncate"
                                            style={{ color: isActive ? "#fff" : "#e5e7eb" }}>
                                            {runner.name}
                                        </span>
                                        <span className="text-sm font-black font-mono shrink-0"
                                            style={{ color: runner.rank === 1 ? GOLD : "#fff" }}>
                                            {runner.completion.toFixed(1)}%
                                        </span>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="mt-1 h-[3px] bg-zinc-800 w-full">
                                        <motion.div
                                            className="h-full"
                                            style={{ background: completionColor(runner.completion) }}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.min(runner.completion, 100)}%` }}
                                            transition={{ duration: 1.2, ease: "easeOut", delay: i * 0.05 }}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between mt-1">
                                        <span className="text-[10px] font-mono text-zinc-500 font-bold uppercase tracking-wider">
                                            {fmtKm(runner.yearlyKm)} km total
                                        </span>
                                        {runner.rank > 1 && gapAbove > 0 && (
                                            <span className="text-[8px] font-mono text-orange-400">
                                                ↑ {gapAbove.toFixed(1)}% to P{runner.rank - 1}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Bottom stats */}
            <div className="border-t border-white/5 px-4 py-3 grid grid-cols-2 gap-3">
                <div>
                    <div className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest">Total KM</div>
                    <div className="text-sm font-black font-mono text-white mt-0.5">{fmtKm(globalStats.totalKm)}</div>
                </div>
                <div>
                    <div className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest">Prize Pool</div>
                    <div className="text-sm font-black font-mono mt-0.5" style={{ color: GOLD }}>
                        ₹{globalStats.totalPot.toLocaleString()}
                    </div>
                </div>
            </div>
        </div>
    );



    // ─── Runner Detail Panel ──────────────────────────────────────────────────
    const RunnerDetail = () => {
        const r = activeRunner ?? sorted[0];
        if (!r) return null;
        const rc = rankColor(r.rank);
        const comp = r.completion;
        const gap = gapToLeader(r);

        // SVG arc progress
        const size = 100, strokeW = 8, rad = (size - strokeW) / 2;
        const circ = 2 * Math.PI * rad;
        const dash = (comp / 100) * circ;
        const color = completionColor(comp);

        // Run history bars (last 10 weeks)
        const history = (r.runHistory ?? []).slice(-10).map((w: any) => ({
            label: w.week ?? "",
            km: typeof w.totalKm === "number" ? w.totalKm : 0,
        }));
        const maxBarKm = Math.max(...history.map((h: any) => h.km), 1);

        return (
            <div className="flex flex-col h-full overflow-hidden">
                {/* Runner header */}
                <div className="px-5 pt-4 pb-3 border-b border-white/5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                            {/* Rank badge */}
                            <div className="w-10 h-10 flex items-center justify-center text-sm font-black font-mono shrink-0"
                                style={{ background: `${rc}20`, border: `1.5px solid ${rc}`, color: rc }}>
                                P{r.rank}
                            </div>
                            <div>
                                <div className="text-2xl font-black text-white tracking-tight leading-none uppercase">
                                    {r.name}
                                </div>
                                <div className="text-[10px] font-mono mt-0.5"
                                    style={{ color: r.rank === 1 ? GOLD : "#6b7280" }}>
                                    {r.rank === 1 ? "● RACE LEADER" : `+${fmtKm(gap)} km to leader`}
                                </div>
                            </div>
                        </div>

                        {/* SVG arc */}
                        <div className="shrink-0">
                            <svg width={size} height={size}>
                                <circle cx={size / 2} cy={size / 2} r={rad}
                                    fill="none" stroke="#1f1f1f" strokeWidth={strokeW} />
                                <circle cx={size / 2} cy={size / 2} r={rad}
                                    fill="none" stroke={color} strokeWidth={strokeW}
                                    strokeDasharray={`${dash} ${circ}`}
                                    strokeLinecap="butt"
                                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                                    style={{ transition: "stroke-dasharray 1.2s ease" }}
                                />
                                <text x={size / 2} y={size / 2 - 5}
                                    textAnchor="middle" fill="white"
                                    fontSize="14" fontFamily="monospace" fontWeight="900">
                                    {comp.toFixed(0)}%
                                </text>
                                <text x={size / 2} y={size / 2 + 10}
                                    textAnchor="middle" fill="#6b7280"
                                    fontSize="7" fontFamily="monospace">
                                    TARGET
                                </text>
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-px bg-white/5 border-b border-white/5">
                    {[
                        { label: "Logged KM", value: `${fmtKm(r.yearlyKm)} km`, color: "#fff" },
                        { label: "Annual Target", value: `${fmtKm(r.annualTarget)} km`, color: "#fff" },
                        { label: "Weekly Target", value: r.weeklyTarget > 0 ? `${fmtKm(r.weeklyTarget)} km/wk` : "—", color: "#fff" },
                        { label: "Remaining", value: `${fmtKm(Math.max(0, r.annualTarget - r.yearlyKm))} km`, color: CRIMSON },
                    ].map((s) => (
                        <div key={s.label} className="px-4 py-3 bg-[#111]">
                            <div className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest mb-1">{s.label}</div>
                            <div className="text-base font-black font-mono" style={{ color: s.color }}>{s.value}</div>
                        </div>
                    ))}
                </div>

                {/* Activity sparkline */}
                {history.length > 0 && (
                    <div className="px-4 py-3 border-b border-white/5">
                        <div className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Weekly Activity</div>
                        <div className="flex items-end gap-0.5 h-10">
                            {history.map((h: any, i: number) => {
                                const hPct = (h.km / maxBarKm) * 100;
                                const isTarget = r.weeklyTarget > 0 && h.km >= r.weeklyTarget;
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end group relative">
                                        <div
                                            className="w-full transition-all duration-700"
                                            style={{
                                                height: `${Math.max(hPct, 5)}%`,
                                                background: isTarget ? CRIMSON : "#374151",
                                                opacity: 0.8,
                                            }}
                                        />
                                        {/* Tooltip */}
                                        <div className="absolute bottom-full mb-1 hidden group-hover:flex bg-black border border-zinc-700 px-1.5 py-0.5 text-[8px] font-mono text-white whitespace-nowrap z-10">
                                            {h.km.toFixed(1)} km
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex justify-between mt-1 text-[7px] font-mono text-zinc-600">
                            <span>10wk ago</span><span>Now</span>
                        </div>
                    </div>
                )}

                {/* CTA */}
                <div className="px-4 py-3 mt-auto">
                    <Link
                        href={`/runners/${r.name.toLowerCase()}`}
                        className="block w-full text-center text-[10px] font-black font-mono tracking-widest py-2.5 transition-all uppercase"
                        style={{
                            background: CRIMSON,
                            color: "#fff",
                            boxShadow: "0 4px 16px rgba(220,38,38,0.3)",
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 24px rgba(220,38,38,0.5)"}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(220,38,38,0.3)"}
                    >
                        ▶ Open Full Dossier
                    </Link>
                </div>
            </div>
        );
    };



    // ─── Bottom gap bar (desktop only) ───────────────────────────────────────
    const GapBar = () => {
        const leaderKm = leader?.yearlyKm ?? 1;
        return (
            <div className="hidden sm:flex items-center gap-3 px-6 py-2 border-t border-white/5 overflow-x-auto"
                style={{ scrollbarWidth: "none" }}>
                {sorted.map((r, i) => {
                    const rc = rankColor(r.rank);
                    const fillPct = Math.min((r.yearlyKm / leaderKm) * 100, 100);
                    return (
                        <div key={r.name} className="flex items-center gap-1.5 shrink-0 cursor-pointer"
                            onClick={() => setActiveRunner(r)}>
                            <span className="text-[8px] font-mono font-bold uppercase"
                                style={{ color: rc, minWidth: 28 }}>
                                P{r.rank}
                            </span>
                            <div className="h-[6px] w-[60px] bg-zinc-800 relative">
                                <motion.div
                                    className="absolute left-0 top-0 h-full"
                                    style={{ background: activeRunner?.name === r.name ? CRIMSON : rc }}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${fillPct}%` }}
                                    transition={{ duration: 1.2, ease: "easeOut", delay: i * 0.06 }}
                                />
                            </div>
                            <span className="text-[8px] font-mono text-zinc-500">{r.name.toUpperCase()}</span>
                        </div>
                    );
                })}
            </div>
        );
    };

    // ─── Mobile tab bar ───────────────────────────────────────────────────────
    const MobileTabBar = () => (
        <div className="flex sm:hidden border-b border-white/5">
            {([["timing", "TIMING"], ["map", "CIRCUIT"], ["stats", "STATS"]] as [MobileTab, string][]).map(([id, label]) => (
                <button
                    key={id}
                    onClick={() => setMobileTab(id)}
                    className="flex-1 py-2 text-[9px] font-black font-mono uppercase tracking-widest transition-all"
                    style={{
                        color: mobileTab === id ? "#fff" : "#52525b",
                        borderBottom: mobileTab === id ? `2px solid ${CRIMSON}` : "2px solid transparent",
                        background: mobileTab === id ? "rgba(220,38,38,0.06)" : "transparent",
                    }}
                >
                    {label}
                </button>
            ))}
        </div>
    );

    // ─── RENDER ───────────────────────────────────────────────────────────────
    return (
        <motion.div
            className="flex-1 flex flex-col overflow-hidden relative"
            style={{ background: "#0d0d0d" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: povHold ? 0 : 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
        >
            {/* ── MOBILE TAB SWITCHER ── */}
            <MobileTabBar />

            {/* ── MAIN CONTENT ── */}
            <div className="flex flex-1 overflow-hidden">

                {/* ── DESKTOP: Left — Timing Tower ── */}
                <div className={`
                    w-full sm:w-[260px] lg:w-[280px] flex-shrink-0 border-r border-white/5
                    overflow-hidden
                    ${/* Mobile: show only when timing tab active */""}
                    sm:flex flex-col
                    ${mobileTab === "timing" ? "flex" : "hidden sm:flex"}
                    ${!isHudVisible ? "!hidden" : ""}
                `}>
                    <TimingTower />
                </div>

                {/* ── Right pane ── */}
                <div className={`
                    flex-1 flex flex-col overflow-hidden
                    ${mobileTab !== "timing" ? "flex" : "hidden sm:flex"}
                `}>
                    {/* Track + Detail side by side on large screens */}
                    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

                        {/* Circuit map */}
                        <div className={`
                            flex-1 lg:flex-[1.4] border-b lg:border-b-0 lg:border-r border-white/5
                            flex items-center justify-center relative
                            min-h-0
                            ${mobileTab === "map" ? "flex" : "hidden sm:flex"}
                        `}
                            style={{ background: "#0d0d0d" }}>
                            <F1TrackMap 
                                runners={sorted} 
                                fullNames={{}} 
                                activeRunner={activeRunner?.name}
                                hoveredRunner={hoveredRunner?.name}
                                onRunnerSelect={(name) => {
                                    const r = sorted.find(x => x.name === name);
                                    if (r) setActiveRunner(r);
                                }}
                            />
                        </div>

                        {/* Runner detail */}
                        <div className={`
                            lg:w-[280px] xl:w-[320px] flex-shrink-0 overflow-y-auto
                            ${mobileTab === "stats" ? "flex flex-col" : "hidden lg:flex lg:flex-col"}
                            ${!isHudVisible ? "!hidden" : ""}
                        `}
                            style={{ background: "#111", scrollbarWidth: "none" }}>
                            <RunnerDetail />
                        </div>
                    </div>

                    {/* Gap bar — spans full width of right pane */}
                    {isHudVisible && <GapBar />}
                    
                    {/* HUD Toggle Button */}
                    <button 
                        onClick={() => setIsHudVisible(!isHudVisible)}
                        className="absolute bottom-6 right-6 z-50 bg-black/80 backdrop-blur-md border border-white/10 text-white px-4 py-2 rounded-full shadow-2xl text-[10px] font-black font-mono tracking-widest hover:bg-neutral-800 transition-colors uppercase"
                    >
                        {isHudVisible ? "HIDE TELEMETRY HUD" : "SHOW TELEMETRY HUD"}
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
