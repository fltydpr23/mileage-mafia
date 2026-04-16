"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MafiaTelemetry from "@/components/MafiaTelemetry";
import NightRunGame from "@/components/NightRunGame";
import Link from "next/link";
import PotChip from "@/components/PotChip";
import NowPlaying from "@/components/NowPlaying";
import { Share_Tech_Mono } from "next/font/google";

const shareTech = Share_Tech_Mono({
    weight: "400",
    subsets: ["latin"],
});

interface Runner {
    name: string;
    yearlyKm: number;
    completion: number;
    rank: number;
    weeklyTarget: number;
    annualTarget: number;
    runHistory: any[];
}

interface HubClientProps {
    runners: Runner[];
    globalStats: {
        totalRunners: number;
        totalKm: number;
        totalTargetKm: number;
        totalPot: number;
        oathPot: number;
        penaltyFund: number;
        isManual?: boolean;
    };
}

export default function HubClient({ runners, globalStats }: HubClientProps) {
    const [hubMode, setHubMode] = useState<"track" | "game">("track");

    // Track state lifted up
    const [activeRunner, setActiveRunner] = useState<Runner | null>(null);
    const [hoveredRunner, setHoveredRunner] = useState<Runner | null>(null);

    // POV Hold state for leaderboard
    const [povHold, setPovHold] = useState(true);

    // cinematic startup
    useEffect(() => {
        const t = setTimeout(() => setPovHold(false), 3000);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => {
        if (runners.length > 0 && !activeRunner) {
            setActiveRunner(runners[0]);
        }
    }, [runners, activeRunner]);

    const LAST_UPDATED = "16 Feb • 10:33 IST";

    return (
        <main className="fixed inset-0 bg-black text-white overflow-hidden flex flex-col">
            <AnimatePresence mode="wait">
                <motion.div
                    key="leaderboard-view"
                    className="flex-1 flex flex-col relative pointer-events-auto"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8 }}
                >
                    {/* Subtle crimson radial glow */}
                    <div className="absolute inset-0 pointer-events-none z-0"
                        style={{ background: "radial-gradient(ellipse at top right, rgba(220,38,38,0.06) 0%, transparent 60%)" }} />

                        {/* ── TOP NAV CONSOLIDATED ── */}
                        <header className="w-full z-50 pointer-events-auto flex flex-col shrink-0"
                            style={{ background: "rgba(10,10,10,0.97)", backdropFilter: "blur(12px)" }}>
                            
                            {/* Top ticker */}
                            <div className="flex items-center justify-between py-1.5 px-4 sm:px-6 border-b border-white/5 relative z-20">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                                        <span className={`text-[9px] font-mono font-bold uppercase tracking-[0.3em] text-red-600 ${shareTech.className}`}>LIVE</span>
                                    </div>
                                    <span className={`text-[9px] text-zinc-600 uppercase tracking-widest hidden sm:block ${shareTech.className}`}>
                                        Mileage Mafia Racing Club — Season 2025
                                    </span>
                                </div>
                                <div className={`text-[9px] text-zinc-600 uppercase tracking-[0.25em] font-mono hidden sm:block`}>
                                    {LAST_UPDATED}
                                </div>
                            </div>

                            {/* Main header row: Brand + Player + Tabs */}
                            <div className="flex items-center justify-between px-4 sm:px-6 py-2 gap-4 border-b border-white/5 relative z-20">
                                
                                {/* Left: Brand */}
                                <div className="flex items-center gap-3 shrink-0">
                                    <div className="h-10 w-10 flex items-center justify-center shrink-0 bg-[#dc2626]"
                                        style={{ clipPath: "polygon(0 0, 100% 0, 100% 80%, 80% 100%, 0 100%)" }}>
                                        <span className="font-black text-xs text-white font-mono leading-none">MM</span>
                                    </div>
                                    <div className="flex flex-col justify-center">
                                        <h1 className="text-xl font-black tracking-tight uppercase leading-none text-white font-mono whitespace-nowrap -mb-0.5">
                                            Mileage Mafia
                                        </h1>
                                        <div className="flex items-center gap-2 mt-1 -mb-0.5">
                                            <p className={`text-[8.5px] tracking-[0.25em] uppercase text-zinc-500 font-bold ${shareTech.className}`}>
                                                Race Control · Telemetry
                                            </p>
                                            {globalStats.isManual && (
                                                <span className="text-[7.5px] px-1.5 py-[1px] font-bold tracking-widest uppercase bg-amber-500/10 border border-amber-500/30 text-amber-500 font-mono">
                                                    MANUAL
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Center: NowPlaying Widget (Embedded) */}
                                <div className="hidden md:flex flex-1 justify-center relative translate-y-[2px]">
                                    <NowPlaying />
                                </div>

                                {/* Right: Tabs */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                        onClick={() => setHubMode("track")}
                                        className="px-3.5 py-1.5 text-[10px] font-black font-mono tracking-widest transition-all"
                                        style={hubMode === "track"
                                            ? { background: "#dc2626", color: "#fff", border: "1px solid #dc2626" }
                                            : { background: "transparent", border: "1px solid #27272a", color: "#71717a" }}
                                    >
                                        TELEMETRY
                                    </button>
                                    <button
                                        onClick={() => setHubMode("game")}
                                        className="px-3.5 py-1.5 text-[10px] font-black font-mono tracking-widest transition-all"
                                        style={hubMode === "game"
                                            ? { background: "#fff", color: "#000", border: "1px solid #fff" }
                                            : { background: "transparent", border: "1px solid #27272a", color: "#71717a" }}
                                    >
                                        ▶ NIGHT RUN
                                    </button>
                                </div>
                            </div>

                            {/* Secondary Data Row: Global Stats (formerly in MafiaTelemetry) */}
                            <div className="flex items-center justify-between px-4 sm:px-6 py-2 border-b border-white/5 bg-[#0a0a0a] relative z-20">
                                <div className="flex items-center gap-6 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                                    {[
                                        { label: "Runners", value: String(globalStats.totalRunners) },
                                        { label: "Total KM", value: (globalStats.totalKm % 1 === 0 ? String(Math.round(globalStats.totalKm)) : globalStats.totalKm.toFixed(1)) },
                                        { label: "Prize Pool", value: `₹${globalStats.totalPot.toLocaleString()}` },
                                        { label: "Oath Fund", value: `₹${globalStats.oathPot.toLocaleString()}` },
                                    ].map((s) => (
                                        <div key={s.label} className="shrink-0 flex flex-col justify-center">
                                            <div className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest leading-none mb-1">{s.label}</div>
                                            <div className="text-sm font-black font-mono text-white leading-none whitespace-nowrap">{s.value}</div>
                                        </div>
                                    ))}
                                </div>
                                <div className="hidden sm:flex items-center gap-2 shrink-0">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" />
                                    <span className="text-[8px] font-mono text-emerald-500/50 font-bold uppercase tracking-widest">
                                        {globalStats.isManual ? "MANUAL DATA SOURCE" : "LIVE FEED ACTIVE"}
                                    </span>
                                </div>
                            </div>
                        </header>

                        {/* ── MODE TAB PILLS ── */}
                        {/* Handled inside the nav header above */}

                        {/* ── TELEMETRY DASHBOARD (default mode) ── */}
                        <AnimatePresence mode="wait">
                        {hubMode === "track" && (
                            <MafiaTelemetry
                                key="telemetry"
                                runners={runners}
                                globalStats={globalStats}
                                povHold={povHold}
                            />
                        )}
                        </AnimatePresence>

                        {/* ── NIGHT RUN GAME ── */}
                        <AnimatePresence>
                        {hubMode === "game" && (
                            <motion.div
                                key="nightrun"
                                className="absolute inset-0 z-30 pointer-events-auto"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 20 }}
                                transition={{ duration: 0.3 }}
                                style={{ paddingTop: "72px" }}
                            >
                                <NightRunGame
                                    runners={runners.map(r => ({ ...r, annualTarget: r.annualTarget ?? 1000 }))}
                                    onClose={() => setHubMode("track")}
                                />
                            </motion.div>
                        )}
                        </AnimatePresence>
                </motion.div>
            </AnimatePresence>

            <style>{`
        .mm-static{
          background-image:
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.78' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='220' height='220' filter=contrast(140%) brightness(115%);/%3E%3C/svg%3E");
          background-size: 320px 320px;
          animation: mmNoiseDrift 4.8s linear infinite;
          transform: translateZ(0);
        }
        @keyframes mmNoiseDrift{
          0%{ transform: translate3d(0,0,0); }
          50%{ transform: translate3d(-12px,8px,0); }
          100%{ transform: translate3d(0,0,0); }
        }

        .mm-scanlines{
          background: repeating-linear-gradient(
            to bottom,
            rgba(255,255,255,0.07),
            rgba(255,255,255,0.07) 1px,
            transparent 1px,
            transparent 4px
          );
          transform: translateZ(0);
        }

        .mm-vignette{
          background:
            radial-gradient(1100px circle at 50% 38%, rgba(255,255,255,0.04), transparent 60%),
            radial-gradient(1000px circle at 50% 120%, rgba(0,0,0,0.92), transparent 62%),
            radial-gradient(1200px circle at 50% 35%, transparent 45%, rgba(0,0,0,0.96) 82%);
        }

        .mm-angled {
          clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px));
        }

        .cyber-chip {
          position: relative;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(4px);
          clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
          transition: all 0.2s ease-out;
        }

        .cyber-chip.crimson {
          border: 1px solid rgba(239,68,68,0.3);
          border-right: 2px solid rgba(239,68,68,0.8);
          color: rgba(252,165,165,0.95);
          box-shadow: inset 0 0 20px rgba(239,68,68,0.0);
        }
        .cyber-chip.crimson:hover {
          background: rgba(239,68,68,0.15);
          box-shadow: inset 0 0 20px rgba(239,68,68,0.2), 0 0 15px rgba(239,68,68,0.4);
          border-color: rgba(239,68,68,0.8);
        }

        .cyber-chip.yellow {
          border: 1px solid rgba(250,204,21,0.3);
          border-right: 2px solid rgba(250,204,21,0.8);
          color: rgba(253,230,138,0.95);
        }
        .cyber-chip.yellow:hover {
          background: rgba(250,204,21,0.15);
          box-shadow: inset 0 0 20px rgba(250,204,21,0.2), 0 0 15px rgba(250,204,21,0.4);
          border-color: rgba(250,204,21,0.8);
        }

      `}</style>
        </main>
    );
}
