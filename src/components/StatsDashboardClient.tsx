"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import PotBreakdownModal from "@/components/PotBreakdownModal";

interface Runner {
    name: string;
    yearlyKm: number;
    completion: number;
    rank: number;
    weeklyTarget: number;
    annualTarget: number;
    zeroWeeks: number;
    mafiaFine: number;
    bestWeek: number;
    avgWeek: number;
    activeWeeksCount: number;
    proj: number;
    form: number[];
    runHistory: any[];
}

interface StatsDashboardClientProps {
    runners: Runner[];
    globalStats: any;
    fullNames: Record<string, string>;
}

// ─── Mafia Theme Palette ──────────────────────────────────────────────────────
const MAFIA_LEVELS = [
    {
        minKm: 1800,
        name: "Godfather",
        badge: "bg-red-900/40 text-red-100 border-red-700/50 shadow-[0_0_15px_rgba(220,38,38,0.3)]",
        cardBg: "bg-gradient-to-b from-red-900/20 to-black/40",
        cardRing: "border-red-700/30",
        accentBar: "bg-gradient-to-r from-red-800 to-red-500",
        accentText: "text-red-400",
        ringColor: "#fca5a5",
        glow: "rgba(220,38,38,0.15)",
    },
    {
        minKm: 1000,
        name: "Underboss",
        badge: "bg-rose-950/50 text-rose-100 border-rose-700/50 shadow-[0_0_10px_rgba(225,29,72,0.2)]",
        cardBg: "bg-gradient-to-b from-rose-950/20 to-black/40",
        cardRing: "border-rose-700/30",
        accentBar: "bg-gradient-to-r from-rose-800 to-rose-500",
        accentText: "text-rose-400",
        ringColor: "#fda4af",
        glow: "rgba(225,29,72,0.1)",
    },
    {
        minKm: 500,
        name: "Area Don",
        badge: "bg-amber-900/40 text-amber-100 border-amber-700/50 shadow-[0_0_10px_rgba(217,119,6,0.2)]",
        cardBg: "bg-gradient-to-b from-amber-900/20 to-black/40",
        cardRing: "border-amber-700/30",
        accentBar: "bg-gradient-to-r from-amber-700 to-amber-400",
        accentText: "text-amber-400",
        ringColor: "#fcd34d",
        glow: "rgba(217,119,6,0.1)",
    },
    {
        minKm: 250,
        name: "Soldier",
        badge: "bg-emerald-950/50 text-emerald-100 border-emerald-700/50 shadow-[0_0_10px_rgba(4,120,87,0.2)]",
        cardBg: "bg-gradient-to-b from-emerald-950/20 to-black/40",
        cardRing: "border-emerald-700/30",
        accentBar: "bg-gradient-to-r from-emerald-700 to-emerald-400",
        accentText: "text-emerald-400",
        ringColor: "#6ee7b7",
        glow: "rgba(4,120,87,0.1)",
    },
    {
        minKm: 0,
        name: "Associate",
        badge: "bg-neutral-800/50 text-neutral-200 border-neutral-600/50",
        cardBg: "bg-gradient-to-b from-neutral-800/20 to-black/40",
        cardRing: "border-neutral-700/30",
        accentBar: "bg-gradient-to-r from-neutral-600 to-neutral-400",
        accentText: "text-neutral-400",
        ringColor: "#d1d5db",
        glow: "rgba(255,255,255,0.02)",
    },
] as const;

function getMafiaLevel(km: number) {
    return MAFIA_LEVELS.find((l) => km >= l.minKm) ?? MAFIA_LEVELS[MAFIA_LEVELS.length - 1];
}

function fmtKm(n: number) {
    if (!Number.isFinite(n)) return "0";
    return n % 1 === 0 ? String(Math.round(n)) : n.toFixed(1);
}

// ─── Liquid Glass Classes ─────────────────────────────────────────────────────
const LIQUID_GLASS = "bg-white/[0.02] backdrop-blur-[32px] border border-white/[0.04] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]";
const LIQUID_GLASS_HOVER = "hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-300 ease-out";

const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 80, damping: 20 } },
};
const stagger = {
    hidden: {},
    show: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StatsDashboardClient({ runners, globalStats, fullNames }: StatsDashboardClientProps) {
    const router = useRouter();

    const [sortBy, setSortBy] = useState<"completion" | "km">("completion");
    const [showPotModal, setShowPotModal] = useState(false);

    const sortedRunners = React.useMemo(() => {
        const list = [...runners];
        if (sortBy === "km") {
            list.sort((a, b) => b.yearlyKm - a.yearlyKm);
        } else {
            list.sort((a, b) => b.completion - a.completion);
        }
        return list.map((runner, idx) => ({
            ...runner,
            rank: idx + 1,
        }));
    }, [runners, sortBy]);

    const top3 = sortedRunners.slice(0, 3);
    const allRunners = sortedRunners;

    return (
        <main className="w-full flex-1 min-h-0 bg-[#050505] text-white overflow-y-auto overflow-x-hidden relative custom-scrollbar touch-pan-y" style={{ WebkitOverflowScrolling: "touch" }}>
            {/* Liquid Dark Background */}
            <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-rose-900/10 via-black to-black opacity-80" />
            <div className="pointer-events-none fixed inset-0 z-0"
                style={{
                    backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
                    backgroundSize: "64px 64px",
                    maskImage: "radial-gradient(circle 800px at 50% 0%, black 20%, transparent 100%)",
                }}
            />
            <motion.div
                variants={stagger}
                initial="hidden"
                animate="show"
                className="relative z-10 w-full max-w-[1600px] mx-auto px-6 sm:px-12 lg:px-16 pt-12 pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-32 space-y-16"
            >
                {/* ── HEADER ─────────────────────────────────────────────────── */}
                <motion.header variants={fadeUp} className={`flex flex-col md:flex-row md:items-end justify-between gap-6 pt-8 sm:pt-4`}>
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-mono text-red-500 font-bold uppercase tracking-[0.3em]">
                                SEASON 2026 STANDINGS
                            </span>
                            {globalStats?.totalPot && (
                                <button
                                    onClick={() => setShowPotModal(true)}
                                    className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[9px] font-bold tracking-widest hover:bg-amber-500/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                                >
                                    <span>POT: ₹{globalStats.totalPot.toLocaleString()}</span>
                                    <span>ℹ️</span>
                                </button>
                            )}
                        </div>
                        <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tighter uppercase leading-none drop-shadow-2xl">
                            LEADERBOARD
                        </h1>
                    </div>

                    {/* SORT TOGGLE */}
                    <div className="flex items-center gap-1.5 bg-black/80 p-1.5 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl self-start md:self-auto">
                        <span className="text-[9px] font-mono text-zinc-500 font-bold uppercase px-2 tracking-widest hidden sm:inline">RANK BY:</span>
                        <button
                            onClick={() => setSortBy("completion")}
                            className={`px-4 py-2 text-[10px] font-mono font-bold tracking-widest rounded-xl transition-all ${
                                sortBy === "completion"
                                    ? "bg-[#dc2626] text-white shadow-[0_0_15px_rgba(220,38,38,0.5)] border border-red-500/50"
                                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                            }`}
                        >
                            % TARGET COMPLETION
                        </button>
                        <button
                            onClick={() => setSortBy("km")}
                            className={`px-4 py-2 text-[10px] font-mono font-bold tracking-widest rounded-xl transition-all ${
                                sortBy === "km"
                                    ? "bg-white text-black font-black shadow-md border border-white"
                                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                            }`}
                        >
                            TOTAL KM LOGGED
                        </button>
                    </div>
                </motion.header>

                {/* ── PODIUM ─────────────────────────────────────────────────── */}
                <motion.section variants={fadeUp} className="py-8">
                    {/* Desktop Podium (side-by-side) */}
                    <div className="hidden sm:flex items-end justify-center gap-8 lg:gap-12 w-full h-[450px]">
                        {top3[1] && <PodiumStep rank={2} runner={top3[1]} fullName={fullNames[top3[1].name] || top3[1].name} level={getMafiaLevel(top3[1].yearlyKm)} />}
                        {top3[0] && <PodiumStep rank={1} runner={top3[0]} fullName={fullNames[top3[0].name] || top3[0].name} level={getMafiaLevel(top3[0].yearlyKm)} />}
                        {top3[2] && <PodiumStep rank={3} runner={top3[2]} fullName={fullNames[top3[2].name] || top3[2].name} level={getMafiaLevel(top3[2].yearlyKm)} />}
                    </div>
                    {/* Mobile Podium (Stacked hero) */}
                    <div className="flex sm:hidden flex-col items-center gap-4 w-full">
                        {top3[0] && <MobilePodiumStep rank={1} runner={top3[0]} fullName={fullNames[top3[0].name] || top3[0].name} level={getMafiaLevel(top3[0].yearlyKm)} />}
                        <div className="flex w-full gap-4 justify-center">
                            {top3[1] && <MobilePodiumStep rank={2} runner={top3[1]} fullName={fullNames[top3[1].name] || top3[1].name} level={getMafiaLevel(top3[1].yearlyKm)} />}
                            {top3[2] && <MobilePodiumStep rank={3} runner={top3[2]} fullName={fullNames[top3[2].name] || top3[2].name} level={getMafiaLevel(top3[2].yearlyKm)} />}
                        </div>
                    </div>
                </motion.section>

                {/* ── LIST & LEGEND ────────────────────────────────────────── */}
                <motion.section variants={fadeUp} className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-8 xl:gap-12">
                    
                    {/* LEADERBOARD LIST */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 pl-2">
                            <div className="w-1.5 h-6 bg-rose-600 rounded-full" />
                            <h2 className="text-lg font-black uppercase tracking-[0.2em] text-white">Global Rankings</h2>
                        </div>
                        
                            <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#0a0a0a] shadow-2xl custom-scrollbar">
                                <div className="min-w-[980px] flex flex-col">
                                    {/* Header row for list */}
                                    <div className="grid grid-cols-[48px_minmax(180px,1.5fr)_80px_80px_80px_70px_70px_50px_50px_80px_100px] items-center gap-x-2 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-neutral-500 border-b border-white/10 bg-black/40">
                                        <div className="text-center">POS</div>
                                        <div className="text-left">DRIVER</div>
                                        <div className="text-right">YTD</div>
                                        <div className="text-right">TGT</div>
                                        <div className="text-right">PROG</div>
                                        <div className="text-right">BEST</div>
                                        <div className="text-right">AVG</div>
                                        <div className="text-center">WKS</div>
                                        <div className="text-center">B2B</div>
                                        <div className="text-right">FINES</div>
                                        <div className="text-right pr-2">FORM</div>
                                    </div>
                                    
                                    {allRunners.map((runner) => {
                                        const level = getMafiaLevel(runner.yearlyKm);
                                        const fullName = fullNames[runner.name] || runner.name;
                                        
                                        return (
                                            <div 
                                                key={runner.name}
                                                onClick={() => router.push(`/runners/${encodeURIComponent(runner.name)}`)}
                                                className={`grid grid-cols-[48px_minmax(180px,1.5fr)_80px_80px_80px_70px_70px_50px_50px_80px_100px] items-center gap-x-2 px-4 py-3 border-b border-white/5 cursor-pointer group ${LIQUID_GLASS_HOVER} transition-colors`}
                                            >
                                                {/* POS */}
                                                <div className="text-center font-mono font-bold text-neutral-400 group-hover:text-white transition-colors text-sm">
                                                    {runner.rank}
                                                </div>
                                                
                                                {/* DRIVER */}
                                                <div className="text-left flex flex-col truncate pr-2">
                                                    <span className="font-bold text-white text-sm truncate uppercase tracking-wider">{fullName}</span>
                                                    <span className={`text-[9px] ${level.accentText} uppercase tracking-widest font-black mt-0.5`}>{level.name}</span>
                                                </div>

                                                {/* YTD */}
                                                <div className="text-right font-mono font-black text-white text-sm">
                                                    {fmtKm(runner.yearlyKm)}
                                                </div>

                                                {/* TARGET */}
                                                <div className="text-right font-mono text-neutral-400 text-sm">
                                                    {runner.annualTarget > 0 ? fmtKm(runner.annualTarget) : '-'}
                                                </div>

                                                {/* % COMPLETION */}
                                                <div className="text-right font-mono font-bold text-sm" style={{ color: level.ringColor }}>
                                                    {runner.completion.toFixed(1)}%
                                                </div>

                                                {/* BEST */}
                                                <div className="text-right font-mono text-neutral-300 text-sm">
                                                    {runner.bestWeek > 0 ? fmtKm(runner.bestWeek) : '-'}
                                                </div>

                                                {/* AVG */}
                                                <div className="text-right font-mono text-neutral-300 text-sm">
                                                    {runner.avgWeek > 0 ? fmtKm(runner.avgWeek) : '-'}
                                                </div>

                                                {/* ACTIVE WEEKS */}
                                                <div className="text-center font-mono text-neutral-400 text-sm">
                                                    {runner.activeWeeksCount}
                                                </div>

                                                {/* ZERO WEEKS */}
                                                <div className="text-center font-mono text-red-500 font-bold text-sm">
                                                    {runner.zeroWeeks > 0 ? runner.zeroWeeks : '-'}
                                                </div>

                                                {/* FINES */}
                                                <div className="text-right font-mono text-rose-500 font-bold text-sm">
                                                    {runner.mafiaFine > 0 ? `₹${runner.mafiaFine}` : '-'}
                                                </div>

                                                {/* FORM (Last 5) */}
                                                <div className="flex justify-end gap-1.5 pr-2">
                                                    {runner.form.map((f, i) => (
                                                        <div 
                                                            key={i} 
                                                            className={`w-3 h-3 rounded-[2px] ${f > 0 ? 'bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.3)]'}`}
                                                            title={f > 0 ? `${fmtKm(f)} km` : '0 km'}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                    </div>

                    {/* SIDEBAR: MAFIA TIERS LEGEND */}
                    <div className="space-y-6 hidden xl:block">
                        <div className="flex items-center gap-4 pl-2">
                            <div className="w-1.5 h-6 bg-neutral-600 rounded-full" />
                            <h2 className="text-lg font-black uppercase tracking-[0.2em] text-white">Syndicate Ranks</h2>
                        </div>
                        <div className={`${LIQUID_GLASS} rounded-[2rem] p-8 sticky top-32`}>
                            <div className="space-y-8">
                                {MAFIA_LEVELS.map((level, idx) => {
                                    const nextLevel = MAFIA_LEVELS[idx - 1]; // Array is sorted highest to lowest
                                    const rangeText = nextLevel 
                                        ? `${level.minKm} - ${nextLevel.minKm} KM` 
                                        : `${level.minKm}+ KM`;

                                    return (
                                        <div key={level.name} className="flex items-center gap-5 group">
                                            <div className={`w-1.5 h-10 rounded-full ${level.accentBar} shadow-[0_0_10px_${level.glow}] group-hover:scale-y-110 transition-transform`} />
                                            <div className="flex flex-col">
                                                <span className={`text-sm font-black uppercase tracking-widest ${level.accentText}`}>{level.name}</span>
                                                <span className="text-neutral-500 text-[11px] font-mono tracking-widest mt-1">{rangeText}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                </motion.section>
            </motion.div>

            <PotBreakdownModal
                isOpen={showPotModal}
                onClose={() => setShowPotModal(false)}
                globalStats={globalStats}
            />
        </main>
    );
}

// ─── Subcomponents ────────────────────────────────────────────────────────────
function PodiumStep({ rank, runner, fullName, level }: { rank: number; runner: Runner; fullName: string; level: any }) {
    const isFirst = rank === 1;
    const isSecond = rank === 2;
    // Taller heights for a grander podium
    const heightClass = isFirst ? "h-64 sm:h-80" : isSecond ? "h-48 sm:h-60" : "h-36 sm:h-48";
    
    return (
        <div 
            onClick={() => window.location.href = `/runners/${encodeURIComponent(runner.name)}`}
            className={`flex flex-col items-center justify-end flex-1 max-w-[240px] relative group cursor-pointer ${isFirst ? 'z-10' : 'z-0'}`}
        >
            {isFirst && (
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-yellow-500/15 blur-[60px] rounded-full pointer-events-none" />
            )}
            
            <div className="flex flex-col items-center mb-6 text-center z-10 transition-transform duration-500 group-hover:-translate-y-2">
                <div className="flex flex-col items-center gap-2 mb-2 w-full px-2">
                    <div className="font-black text-xl sm:text-2xl uppercase tracking-widest text-white truncate w-full drop-shadow-md">{fullName}</div>
                    <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                        +₹{rank === 1 ? '5,000' : rank === 2 ? '3,000' : '2,000'}
                    </div>
                </div>
                <div className={`text-xs sm:text-sm font-black uppercase tracking-widest ${level.accentText} bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/5`}>
                    {fmtKm(runner.yearlyKm)} km
                </div>
            </div>
            
            <motion.div 
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                transition={{ type: "spring", stiffness: 70, damping: 15, delay: rank * 0.15 }}
                className="w-full flex flex-col items-center justify-end"
            >
                <div className={`w-full ${heightClass} ${level.cardBg} backdrop-blur-[40px] border border-white/[0.08] shadow-[inset_0_1px_2px_rgba(255,255,255,0.2)] rounded-t-[2rem] relative overflow-hidden flex flex-col items-center pt-8 sm:pt-10 group-hover:border-white/[0.2] group-hover:bg-white/[0.05] transition-all duration-500`}>
                    
                    {/* Glowing top lip */}
                    <div className={`absolute top-0 left-0 right-0 h-1.5 ${level.accentBar} opacity-80`} />
                    <div className={`absolute top-0 left-0 right-0 h-8 ${level.accentBar} blur-xl opacity-30 pointer-events-none`} />
                    
                    <span className={`text-7xl sm:text-9xl font-black ${isFirst ? 'text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] -ml-2 sm:-ml-4' : 'text-white/30'} z-10`}>
                        {rank}
                    </span>
                    
                    <div className={`absolute bottom-6 sm:bottom-8 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg border text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${level.badge} backdrop-blur-md bg-black/40 whitespace-nowrap z-10 shadow-2xl`}>
                        {level.name}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

function MobilePodiumStep({ rank, runner, fullName, level }: { rank: number; runner: Runner; fullName: string; level: any }) {
    const isFirst = rank === 1;
    return (
        <div 
            onClick={() => window.location.href = `/runners/${encodeURIComponent(runner.name)}`}
            className={`w-full flex ${isFirst ? 'flex-col p-6' : 'flex-col p-4 flex-1'} items-center justify-center ${level.cardBg} backdrop-blur-[40px] border border-white/[0.08] shadow-[inset_0_1px_2px_rgba(255,255,255,0.2)] rounded-3xl relative overflow-hidden active:scale-[0.98] active:bg-white/[0.05] transition-all`}
        >
            <div className={`absolute top-0 left-0 right-0 h-1.5 ${level.accentBar} opacity-80`} />
            {isFirst && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-yellow-500/15 blur-[50px] rounded-full pointer-events-none" />}
            
            <div className="flex flex-col items-center z-10 w-full relative">
                <div className="flex flex-col items-center gap-1.5 mb-2 w-full px-2">
                    <div className={`font-black uppercase tracking-widest text-white ${isFirst ? 'text-2xl' : 'text-lg'} text-center drop-shadow-md w-full truncate`}>
                        {fullName}
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                        +₹{rank === 1 ? '5,000' : rank === 2 ? '3,000' : '2,000'}
                    </div>
                </div>
                
                <div className={`text-[10px] font-black uppercase tracking-widest ${level.accentText} bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/5 mb-3`}>
                    {fmtKm(runner.yearlyKm)} km
                </div>
                
                <span className={`font-black ${isFirst ? 'text-6xl text-white/30 absolute bottom-[-10px] right-2' : 'text-5xl text-white/20 absolute bottom-[-5px] right-1'} pointer-events-none`}>
                    {rank}
                </span>
                
                <div className={`px-2.5 py-1 rounded border text-[8px] font-black uppercase tracking-widest ${level.badge} backdrop-blur-md bg-black/40 z-10 shadow-xl`}>
                    {level.name}
                </div>
            </div>
        </div>
    );
}
