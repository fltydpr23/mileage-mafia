"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import TronTrack3D from "./TronTrack3D";

interface Runner {
    name: string;
    yearlyKm: number;
    completion: number;
    rank: number;
    weeklyTarget: number;
    annualTarget: number;
}

interface F1LeaderboardViewProps {
    runners: Runner[];
    globalStats: {
        totalRunners: number;
        totalKm: number;
        totalTargetKm: number;
    }
}

export default function F1LeaderboardView({ runners, globalStats }: F1LeaderboardViewProps) {
    const [activeRunner, setActiveRunner] = useState<Runner | null>(runners[0] || null);
    const [hoveredRunner, setHoveredRunner] = useState<Runner | null>(null);

    // Head-to-Head Compare State
    const [compareMode, setCompareMode] = useState(false);
    const [compareRunners, setCompareRunners] = useState<Runner[]>([]);

    // Toggle UI
    const [showList, setShowList] = useState(true);

    // Cinematic POV Entrance
    const [povHold, setPovHold] = useState(true);

    // Ensure leader is selected on mount if runners change
    useEffect(() => {
        if (runners.length > 0 && !activeRunner) {
            setActiveRunner(runners[0]);
        }
    }, [runners]);

    // Release POV hold after 3 seconds
    useEffect(() => {
        const t = setTimeout(() => setPovHold(false), 3000);
        return () => clearTimeout(t);
    }, []);

    const containerVars: any = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.15 }
        }
    };

    const itemVars: any = {
        hidden: { opacity: 0, x: -20 },
        show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 100, damping: 15 } }
    };

    return (
        <motion.div
            variants={containerVars}
            initial="hidden"
            animate={povHold ? "hidden" : "show"}
            className="w-full h-full relative"
        >
            {/* BACKGROUND: 3D TRON TRACK */}
            <motion.div variants={{ hidden: { opacity: 0, scale: 0.98 }, show: { opacity: 1, scale: 1, transition: { duration: 0.8, ease: "easeOut" } } }} className="absolute inset-0 z-0 bg-neutral-950">
                <TronTrack3D
                    runners={runners}
                    activeRunner={activeRunner}
                    setActiveRunner={setActiveRunner}
                    hoveredRunner={hoveredRunner}
                    setHoveredRunner={setHoveredRunner}
                    isEntrancePOV={povHold}
                />
            </motion.div>

            {/* OVERLAY: Floating Sidebar List */}
            <motion.div
                className="absolute left-0 top-0 bottom-0 w-full md:w-80 bg-neutral-950/70 backdrop-blur-2xl border-r border-neutral-800/80 z-10 flex flex-col pt-[88px] pb-6 shadow-[20px_0_30px_rgba(0,0,0,0.5)] pointer-events-auto"
                initial={{ opacity: 0, x: -100 }}
                animate={{ opacity: povHold || !showList ? 0 : 1, x: povHold || !showList ? -100 : 0 }}
                transition={{ duration: 1, ease: "easeOut", delay: povHold ? 0 : 0.5 }}
            >
                {/* Sidebar Header */}
                <div className="px-4 py-3 bg-red-600/90 border-b border-red-500/50 flex justify-between items-center shadow-md backdrop-blur-md relative z-20">
                    <div className="flex items-center gap-2">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                        </svg>
                        <span className="text-white font-black text-[11px] tracking-widest uppercase shadow-[0_0_10px_rgba(255,0,0,0.8)]">Active Operatives</span>
                    </div>
                    <button
                        onClick={() => {
                            setCompareMode(!compareMode);
                            if (compareMode) setCompareRunners([]);
                        }}
                        className={`text-[9px] font-black tracking-widest uppercase px-2 py-1 rounded transition-colors ${compareMode ? 'bg-white text-red-600' : 'bg-black/20 text-white/80 hover:bg-black/40'}`}
                    >
                        {compareMode ? 'Cancel H2H' : 'H2H Compare'}
                    </button>
                </div>

                {/* List Headers */}
                <div className="flex text-[9px] font-bold text-neutral-400 uppercase tracking-widest px-4 py-2 bg-neutral-950/80 border-b border-neutral-800/50 backdrop-blur-md relative z-20">
                    <div className="w-8">Pos</div>
                    <div className="flex-1">Agent</div>
                    <div className="w-12 text-right">Battle</div>
                    <div className="w-16 text-right">Dist</div>
                </div>

                {/* Runner List */}
                <div className="flex-1 overflow-y-auto no-scrollbar py-1">
                    {runners.map((runner, idx) => {
                        const isHovered = hoveredRunner?.name === runner.name;
                        const isActive = activeRunner?.name === runner.name;
                        const isLeader = idx === 0;

                        const nextRunner = runners[idx + 1];
                        const gap = nextRunner ? runner.yearlyKm - nextRunner.yearlyKm : null;
                        const isBattling = !compareMode && gap !== null && gap <= 10;
                        const isCompareSelected = compareRunners.some(r => r.name === runner.name);

                        return (
                            <React.Fragment key={runner.name}>
                                <div
                                    onMouseEnter={() => setHoveredRunner(runner)}
                                    onMouseLeave={() => setHoveredRunner(null)}
                                    onClick={() => {
                                        if (compareMode) {
                                            if (isCompareSelected) {
                                                setCompareRunners(prev => prev.filter(r => r.name !== runner.name));
                                            } else if (compareRunners.length < 2) {
                                                setCompareRunners(prev => [...prev, runner]);
                                            }
                                        } else {
                                            setActiveRunner(isActive ? null : runner);
                                        }
                                    }}
                                    className={`group flex items-center px-4 py-2.5 cursor-pointer font-sans transition-colors duration-150 border-l-4 ${compareMode
                                        ? isCompareSelected
                                            ? "bg-red-900/40 border-red-500"
                                            : "bg-transparent border-transparent hover:bg-neutral-900"
                                        : isActive
                                            ? "bg-neutral-800 border-white"
                                            : isHovered
                                                ? "bg-neutral-800/50 border-neutral-500"
                                                : "bg-transparent border-transparent hover:bg-neutral-900"
                                        }`}
                                >
                                    {/* Position */}
                                    <div className={`w-8 text-xs font-bold tabular-nums ${isLeader ? 'text-yellow-400' : 'text-neutral-500'}`}>
                                        {idx + 1}
                                    </div>

                                    {/* Agent Name & Team Color Bar */}
                                    <div className="flex-1 flex items-center gap-2 min-w-0">
                                        <div className={`w-1 h-3 rounded-full ${isLeader ? 'bg-yellow-400' : 'bg-cyan-500'}`} />
                                        <div className={`text-sm font-bold truncate ${isActive ? 'text-white' : 'text-neutral-300 group-hover:text-white'}`}>
                                            {runner.name.substring(0, 3).toUpperCase()}
                                        </div>
                                    </div>

                                    {/* Battle Gap */}
                                    <div className="w-12 text-right pr-2">
                                        {isBattling && (
                                            <span className="text-[10px] font-black italic text-red-500 shadow-[0_0_10px_rgba(255,0,0,0.4)] animate-pulse">
                                                -{Math.abs(gap!).toFixed(1)}
                                            </span>
                                        )}
                                    </div>

                                    {/* Distance/Completion */}
                                    <div className="w-16 text-right flex flex-col items-end">
                                        <span className={`text-[11px] font-bold tabular-nums ${isActive ? 'text-cyan-400' : 'text-neutral-400'}`}>
                                            {runner.yearlyKm} km
                                        </span>
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <div className="w-8 h-1 bg-neutral-800 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full ${isLeader ? 'bg-yellow-400' : 'bg-cyan-500'}`}
                                                    style={{ width: `${runner.completion}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </React.Fragment>
                        );
                    })}
                </div>

                {/* BOTTOM BLOCK: Global Telemetry */}
                <motion.div variants={itemVars} className="mt-auto p-4 bg-neutral-950/80 border-t border-neutral-800 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-20">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse shadow-[0_0_8px_rgba(0,255,255,0.8)]" />
                        <h3 className="text-[10px] font-bold tracking-widest uppercase text-cyan-400">Season Aggregates</h3>
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-[9px] text-neutral-500 uppercase tracking-wider">Fleet Range</p>
                                <p className="text-xl font-black text-white leading-none mt-1">{Math.round(globalStats.totalKm).toLocaleString()} <span className="text-xs text-neutral-400">KM</span></p>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] text-neutral-500 uppercase tracking-wider">Target</p>
                                <p className="text-sm font-bold text-neutral-300 leading-none mt-1">{Math.round(globalStats.totalTargetKm).toLocaleString()}</p>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden relative">
                            <div
                                className="absolute top-0 left-0 h-full bg-cyan-500 shadow-[0_0_10px_rgba(0,255,255,0.8)]"
                                style={{ width: `${Math.min(100, (globalStats.totalKm / globalStats.totalTargetKm) * 100)}%` }}
                            />
                        </div>
                    </div>
                </motion.div>
            </motion.div>

            {/* RIGHT PANE: 3D TRON TRACK */}
            <motion.div variants={{ hidden: { opacity: 0, scale: 0.98 }, show: { opacity: 1, scale: 1, transition: { duration: 0.8, ease: "easeOut" } } }} className="flex-1 h-full min-h-[400px] relative bg-neutral-950">
                <TronTrack3D
                    runners={runners}
                    activeRunner={activeRunner}
                    setActiveRunner={setActiveRunner}
                    hoveredRunner={hoveredRunner}
                    setHoveredRunner={setHoveredRunner}
                    isEntrancePOV={povHold}
                />
            </motion.div>
            {/* HEAD TO HEAD OVERLAY */}
            {compareMode && compareRunners.length === 2 && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto p-4 md:pl-[350px]">
                    <div className="bg-neutral-950 border border-red-500 shadow-[0_0_50px_rgba(255,0,0,0.3)] w-full max-w-3xl rounded-xl overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="bg-red-600 px-6 py-3 flex justify-between items-center">
                            <h2 className="text-white font-black tracking-widest uppercase text-xl">Head-to-Head Intel</h2>
                            <button onClick={() => setCompareRunners([])} className="text-white/80 hover:text-white">✕</button>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-3 gap-0 bg-neutral-900">
                            {/* Runner 1 */}
                            <div className="p-6 text-center border-r border-neutral-800 bg-neutral-950">
                                <h3 className="text-3xl font-black text-white">{compareRunners[0].name.substring(0, 3).toUpperCase()}</h3>
                                <p className="text-neutral-500 text-xs uppercase tracking-widest mt-1">Operative 1</p>

                                <div className="mt-8 space-y-6">
                                    <div>
                                        <p className="text-4xl font-black text-cyan-400">{compareRunners[0].yearlyKm.toFixed(1)}</p>
                                        <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">Total Sweep (KM)</p>
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-white">{Math.round(compareRunners[0].completion)}%</p>
                                        <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">Target Cleared</p>
                                    </div>
                                    <div>
                                        <p className="text-xl font-bold text-neutral-300">{compareRunners[0].annualTarget.toFixed(1)}</p>
                                        <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">YTD Target</p>
                                    </div>
                                </div>
                            </div>

                            {/* VS Column */}
                            <div className="p-6 flex flex-col items-center justify-center border-r border-neutral-800 relative bg-neutral-900/50">
                                <div className="absolute top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-red-500/50 to-transparent" />
                                <div className="z-10 bg-neutral-950 border border-red-500/50 rounded-full h-16 w-16 flex items-center justify-center shadow-[0_0_20px_rgba(255,0,0,0.2)]">
                                    <span className="text-red-500 font-black italic text-xl">VS</span>
                                </div>
                                <div className="mt-8 text-center z-10">
                                    <p className="text-[10px] text-neutral-500 uppercase tracking-widest mb-1">Delta</p>
                                    <p className="text-2xl font-black text-white">
                                        {Math.abs(compareRunners[0].yearlyKm - compareRunners[1].yearlyKm).toFixed(1)} <span className="text-xs text-neutral-400">KM</span>
                                    </p>
                                </div>
                            </div>

                            {/* Runner 2 */}
                            <div className="p-6 text-center bg-neutral-950">
                                <h3 className="text-3xl font-black text-white">{compareRunners[1].name.substring(0, 3).toUpperCase()}</h3>
                                <p className="text-neutral-500 text-xs uppercase tracking-widest mt-1">Operative 2</p>

                                <div className="mt-8 space-y-6">
                                    <div>
                                        <p className="text-4xl font-black text-yellow-400">{compareRunners[1].yearlyKm.toFixed(1)}</p>
                                        <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">Total Sweep (KM)</p>
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-white">{Math.round(compareRunners[1].completion)}%</p>
                                        <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">Target Cleared</p>
                                    </div>
                                    <div>
                                        <p className="text-xl font-bold text-neutral-300">{compareRunners[1].annualTarget.toFixed(1)}</p>
                                        <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">YTD Target</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* HUD Toggle Button */}
            {!povHold && (
                <button
                    onClick={() => setShowList(!showList)}
                    className="absolute bottom-6 left-6 z-50 bg-neutral-900/80 border border-neutral-700/50 hover:bg-neutral-800 text-neutral-400 hover:text-white px-3 py-2 rounded-full backdrop-blur-md shadow-lg transition-colors flex items-center gap-2 pointer-events-auto"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {showList ? (
                            <path d="M15 18l-6-6 6-6" /> // Left arrow to hide
                        ) : (
                            <path d="M9 18l6-6-6-6" /> // Right arrow to show
                        )}
                    </svg>
                    <span className="text-[10px] font-bold tracking-widest uppercase">{showList ? 'Hide HUD' : 'HUD'}</span>
                </button>
            )}
        </motion.div>
    );
}
